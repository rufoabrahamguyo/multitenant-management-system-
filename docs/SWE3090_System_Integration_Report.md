# SWE 3090 XA — System Integration Report
### Propizy: Multi-Tenant Property Management Platform

**Author:** [Your Name]  
**Date:** June 2026  
**Course:** SWE 3090 XA — System Integration

---

## 1. Introduction

### Purpose of the integration

Propizy was built around a problem we kept seeing in Kenyan rental management: landlords and caretakers tracking rent in WhatsApp groups and Excel sheets, with no reliable way to confirm who actually paid. Tenants would send M-PESA confirmation screenshots; managers would manually update a ledger. That workflow breaks down fast when you have more than a handful of units.

The integration goal was to connect three things that normally don't talk to each other — a manager web dashboard, a tenant mobile app, and Safaricom's M-PESA Daraja API — so that when a tenant pays rent on their phone, the payment shows up in the manager's dashboard without anyone re-typing amounts or receipt numbers.

Beyond payments, we also needed invite-only tenant onboarding (no random signups), cash collection with owner approval, and enough audit trail that disputes don't turn into "he said, she said."

### Scope of systems involved

| System | Role |
|--------|------|
| **Web Dashboard** (React + Vite) | Property managers, owners, and staff |
| **Mobile App** (Expo / React Native) | Tenants only — pay rent, view lease, log maintenance |
| **Django REST API** | Single backend hub for both clients |
| **PostgreSQL 16** | Shared database with row-level org isolation |
| **Redis + Celery** | Background jobs (email, PDF receipts) |
| **Safaricom M-PESA Daraja** | STK Push + payment callbacks |
| **SMTP** (e.g. Resend) | Invite links, password reset, M-PESA ops emails |
| **Africa's Talking** | SMS for phone verification and payment reminders |
| **Cloudinary** (optional) | ID photos, receipts, generated PDFs |

Out of scope for this phase: full KRA eTIMS API integration (CSV export exists as a starting point), WhatsApp Business API (we generate click-to-chat links only), and separate microservices per domain.

### Objectives achieved

- Tenants initiate M-PESA STK Push from the mobile app; Safaricom callbacks confirm payment server-side.
- Managers see live payment status, approve cash collections, and download PDF receipts/invoices.
- Multiple property management companies share one deployment with data isolated by organization.
- Owners invite caretaker staff with reduced permissions (staff can't approve cash or export tax data).
- Tenant invite flow: manager sends email link → tenant registers → automatically linked to unit and lease.

---

## 2. System Overview

### Web Dashboard

The web app (`frontend/`) is where day-to-day property work happens — adding properties and units, creating leases, sending tenant invites, reviewing arrears, and running collection reports. We use Axios with interceptors in `frontend/src/api/client.js` so JWT refresh happens transparently when a token expires mid-session.

Route guards (`ProtectedRoute`, `OwnerRoute`) keep tenants off manager pages and staff off owner-only screens like activity logs. The backend still enforces everything; the UI guards are just UX.

Stack: React 19, Vite 8, Tailwind 4, Recharts for dashboard charts.

### Mobile App

Tenants use the Expo app (`mobile/`) to view their lease, pay rent, and submit maintenance requests. It hits the same REST API as the web dashboard — we deliberately avoided a separate "tenant backend" because that would double the integration surface.

Tokens live in AsyncStorage (`mobile/src/api/client.js`). Deep links (`propizy://invite/:token`) let invite emails open the app directly.

One practical detail: STK Push often fires on the same phone the tenant is using to tap "Pay." The app polls `GET /api/payments/payment-status/<id>/` after initiation because the callback can take a few seconds.

### Django REST API

A modular monolith under `backend/` with four domain apps:

| App | Responsibility |
|-----|----------------|
| `users` | Auth, organizations, invites, RBAC, M-PESA config, activity logs |
| `properties` | Properties, units, categories, leases, transfers |
| `payments` | Payments, wallets, invoices, reconciliation, evidence bundles |
| `maintenance` | Tenant maintenance requests |

Pattern throughout: Model → Serializer → ViewSet → service module for cross-model logic.

### External integrations

**M-PESA Daraja** — STK Push (Lipa na M-PESA Online). Each organization stores its own shortcode and Daraja credentials in `OrganizationMpesaConfig`, encrypted with Fernet (`backend/users/mpesa_crypto.py`). Without credentials, the system runs in simulation mode so dev/testing doesn't need live Safaricom keys.

**Email** — `backend/users/emails.py` sends tenant/staff invites, password resets, and M-PESA onboarding notifications. Heavy sends go through Celery tasks in `backend/users/tasks.py`.

**SMS** — `backend/payments/notifications.py` calls Africa's Talking when API keys are set; otherwise it logs to console in DEBUG.

### Dependencies and constraints

- Safaricom callbacks are asynchronous and sometimes duplicated. Payments stay `pending` until callback; we use `select_for_update()` to avoid double-crediting wallets.
- Shared schema multi-tenancy — all orgs share tables; isolation is query-time filtering on `property_manager_id`, not separate databases.
- Kenya-specific phone formatting: Daraja expects `2547XXXXXXXX`; users type `07...`, `+254...`, etc. Normalization happens before STK Push.
- Timezone is `Africa/Nairobi` everywhere — rent months and due dates need to make sense locally.

---

## 3. Integration Architecture

### Approach

We went with an **API-based hub-and-spoke** model. The Django REST API is the hub; web and mobile are spokes. Clients never call Safaricom directly — the backend owns that integration. This is not microservices; it's one deployable service with clear app boundaries so we can split later if payments volume forces it.

Async work (email, PDF generation) uses **Celery + Redis** as a lightweight message queue. In Docker Compose, a dedicated `celery` worker runs alongside the API. Locally without Redis, tasks execute synchronously via `CELERY_TASK_ALWAYS_EAGER`.

> **Diagram:** System context — open `docs/diagrams/propizy-4.2-context-diagram.drawio` in [draw.io](https://app.diagrams.net).

### Data flow

**Payment initiation (tenant → M-PESA → callback):**

```
Tenant (mobile)
  │  POST /api/payments/initiate/  { lease_id, phone, amount }
  ▼
Django API
  │  Validate lease belongs to tenant
  │  Load + decrypt org M-PESA config from lease chain
  │  Create Payment (status=pending)
  │  POST Daraja STK Push
  ▼
Safaricom → PIN prompt on tenant's phone
  │
  │  [tenant enters PIN]
  │
Safaricom → POST /api/payments/mpesa-callback/
  ▼
Django API
  │  Match checkout_request_id (row lock)
  │  Verify amount, set completed/failed
  │  Credit wallet if overpaid
  │  Queue receipt PDF (Celery)
```

**Manager reads payments:**

```
Web client → GET /api/payments/  (Bearer JWT)
           → API filters by property_manager_id chain
           → Paginated JSON (50/page)
```

> **Diagram:** Level-1 DFD — open `docs/diagrams/propizy-4.3-dfd-level1.drawio`.

### Protocols

| Link | Protocol | Format |
|------|----------|--------|
| Web/Mobile ↔ API | HTTPS REST | JSON + JWT Bearer |
| API ↔ Safaricom | HTTPS REST | JSON, OAuth2 client credentials |
| Safaricom → API callback | HTTPS POST | JSON body (`stkCallback`) |
| API ↔ Africa's Talking | HTTPS POST | Form-encoded SMS |
| API ↔ SMTP | TLS SMTP | HTML/plain email |
| Celery ↔ Redis | Redis protocol | Task queue |

### Security

**Authentication:** SimpleJWT — 12-hour access tokens, 7-day refresh with rotation. Stateless; no server-side sessions.

**Authorization (layered):**
1. User role: `MANAGER` vs `TENANT` (different endpoint sets)
2. Org membership via `OrganizationMember`
3. Org role: `OWNER` vs `STAFF` (`backend/users/governance.py` permission matrix)
4. Object-level: does this lease/payment belong to the requester's org?

**M-PESA secrets:** Fernet-encrypted in DB; key in environment only.

**Callback hardening:** Optional `X-MPESA-Callback-Secret` header; always validates `checkout_request_id` exists and amount matches before updating.

**Other:** CORS allowlist (no wildcard), rate limits on auth and STK initiation (`backend/users/throttling.py`), cross-tenant IDOR tests in `users/security_tests.py`.

---

## 4. Implementation Details

### Steps taken

**Phase 1 — Auth and multi-tenancy (foundation)**  
We extended Django's user model with `role` and `property_manager_id` UUID. Manager registration atomically creates `User`, `Organization`, and `OrganizationMember(OWNER)` in one transaction (`ManagerRegisterSerializer`).

Every org-scoped queryset filters through `organization_filter()` in `backend/users/tenancy.py`. Example payment filter:

```python
Payment.objects.filter(
    lease__unit__property__manager__property_manager_id=pm_id
)
```

We wrote security tests early — two fake orgs, cross-token requests on every sensitive endpoint — because fixing isolation bugs later would be painful.

**Phase 2 — Properties, leases, invites**  
Hierarchy: Property → UnitCategory → Unit → Lease → TenantProfile. The invite flow was trickier than CRUD: manager creates `TenantInvite` with UUID token, Celery sends email, tenant hits `/register-tenant/`, backend links profile to unit and activates lease. Expired or used tokens fail at serializer validation.

Unit transfer requests came later — tenants request a different unit type; managers approve/reject with waitlist support.

**Phase 3 — M-PESA**  
`MpesaService` (`backend/payments/mpesa.py`) handles OAuth token fetch, STK password encoding (shortcode + passkey + timestamp → base64), and callback parsing. The big design shift was moving from global env credentials to per-org `OrganizationMpesaConfig` — without that, true multi-tenancy on one Safaricom integration wouldn't work.

Managed onboarding: owners submit `MpesaIntegrationRequest`; ops gets email; admin completes setup in Django admin.

**Phase 4 — Wallet, reconciliation, maintenance**  
Wallet tracks overpayments with auditable `WalletTransaction.balance_after`. Reconciliation imports Safaricom CSV (`MpesaStatementImport` / `MpesaStatementLine`) and matches by receipt number. `EvidenceSnapshot` stores SHA-256-hashed JSON bundles for disputes.

Maintenance app lets tenants file requests from mobile; managers resolve them from web.

### Tools and technologies

| Layer | Tools |
|-------|-------|
| Backend | Django 5.2, DRF 3.15, SimpleJWT, Gunicorn, WhiteNoise |
| Database | PostgreSQL 16, psycopg2 |
| Queue | Celery 5.6, Redis 7 |
| Payments | Safaricom Daraja REST API |
| Crypto | `cryptography` (Fernet) for M-PESA credentials |
| Documents | ReportLab (receipts, invoices, lease PDFs) |
| Storage | Cloudinary or local `media/` |
| Web | React 19, Vite 8, Axios, React Router 7 |
| Mobile | Expo 56, React Native 0.85, React Navigation 7 |
| DevOps | Docker Compose, GitHub Actions (`backend-tests.yml`) |
| Testing | Django TestCase, Vitest (frontend), Jest (mobile) |

### Challenges and solutions

| Challenge | What we did |
|-----------|-------------|
| Duplicate Safaricom callbacks | `select_for_update()` + skip if payment already `completed` |
| Per-org M-PESA credentials | `OrganizationMpesaConfig` + Fernet; pass creds dict into `MpesaService` |
| Slow payment list with N+1 queries | `select_related('tenant__user', 'lease__unit__property')` + pagination |
| Phone format mismatches | `_format_phone()` normalizes to `254...` before STK |
| Callback slower than UI | Mobile polls payment-status endpoint after STK |
| Staff overstepping financially | `PERMISSION_MATRIX` + `IsOrgOwnerForWrite` on sensitive views |

---

## 5. Testing & Validation

### Test cases executed

**Payments** (`payments/tests.py`, `test_mpesa_org.py`, `test_wallet.py`)
- Payment starts as `pending`; callback flips to `completed`
- Duplicate callback doesn't double-credit wallet
- Amount mismatch on callback rejected
- Overpayment → wallet balance → auto-apply next month
- Simulation mode when org has no Daraja credentials

**Users & M-PESA onboarding** (`users/tests.py`, `test_mpesa_integration.py`, `test_emails.py`)
- Register creates org + owner atomically
- Invite token validation (expired, already used)
- Email tasks with mocked SMTP

**Properties** (`properties/tests.py`, `tests_transfer.py`, `tests_property_units.py`)
- Unit status vacant → occupied on lease activation
- Transfer request state machine (approve/reject/waitlist)

**Security** (`users/security_tests.py`) — most critical suite
- Org A's JWT cannot read/write Org B's properties, leases, payments, evidence bundles
- Staff blocked from tax export and cash approval where owner-only

**Maintenance** (`maintenance/tests.py`)
- Tenant can only see own requests; manager sees org-scoped list

**Frontend/Mobile**
- `frontend/src/utils/apiError.test.js`, `apiHelpers.test.js` (Vitest)
- `mobile/__tests__/client.test.js`, `AuthContext.test.js` (Jest)

### Validation methods

- Automated: `python manage.py test` in CI against PostgreSQL 16
- M-PESA tests mock `requests.post` — no live Safaricom keys in CI
- Manual: full sandbox STK flow (initiate → PIN → callback → receipt PDF)
- Manual: PDF layout checks (ReportLab fonts/spacing)
- Manual: web UI walkthroughs (no Playwright yet)

### Results summary

All backend tests pass in CI. Cross-tenant security tests have been stable since we standardized `organization_filter()` in Phase 1. We verified duplicate callback handling by replaying the same payload twice and confirming wallet balance moved once.

Known gap: no browser E2E tests. Frontend regressions are caught manually before demos.

---

## 6. Outcomes & Benefits

### Improved efficiency

Managers no longer chase M-PESA screenshots. Standard rent collection is callback-driven — the tenant pays, Safaricom tells our server, the ledger updates. Cash still needs human entry, but the owner-approval workflow with receipt photo is tighter than a notebook.

Invite emails and PDF receipts run in Celery, so the HTTP response isn't blocked while SMTP or ReportLab works.

### Data consistency

Payment completion depends on Safaricom's callback matching `checkout_request_id` and amount — not on tenant claims. Wallet transactions keep `balance_after` on every line, so balance drift is visible. Reconciliation CSV import catches orphan M-PESA lines the callback might have missed.

### Better user experience

Tenants pay from their phone without visiting an office. Managers see arrears and can trigger SMS/WhatsApp reminders from one screen. Evidence bundles give both sides a hashed snapshot if a dispute comes up months later.

### Multi-tenancy at scale

One deployment serves many property companies. Each org's data is invisible to others — tested explicitly, not assumed.

---

## 7. Recommendations

### Scalability

- **Cache dashboard aggregates** — monthly collection totals and vacancy rates don't need fresh SQL every page load; Redis with a short TTL would help.
- **Read replicas** — payment list and reconciliation reports are read-heavy; Django database routers can point reads to a replica without rewriting views.
- **Webhook worker** — if callback volume grows, isolate `/mpesa-callback/` behind a dedicated worker process while keeping the same codebase.

### Monitoring and maintenance

- Alert on non-200 responses from the M-PESA callback endpoint — Safaricom retries, and queued `select_for_update` locks can pile up.
- Log `checkout_request_id` on both initiate and callback; it's the only reliable correlation when a tenant says "I paid but it's not showing."
- Schedule monthly reconciliation imports instead of relying on managers to remember.

### Future integration opportunities

- **KRA eTIMS API** — tax CSV export exists; wire to eTIMS when compliance requirements land.
- **WhatsApp Business API** — replace click-to-chat links with templated reminder messages.
- **Bank EFT reconciliation** — same CSV-matching pattern as M-PESA statements for tenants who pay via bank transfer.
- **Playwright E2E** — cover login, invite acceptance, and payment status polling on web.

---

## 8. Conclusion

Propizy ties together a manager web dashboard, a tenant mobile app, and Safaricom M-PESA through one Django REST backend and a shared PostgreSQL database. The hardest integration work was the payment loop — async callbacks, duplicate handling, and per-organization Daraja credentials — not the CRUD around properties and leases.

Multi-tenancy via `property_manager_id` is simple on paper and holds up in practice because we test cross-org access explicitly. Layered auth (user role → org membership → owner/staff → object scope) keeps permission code readable without a custom policy engine.

Celery, SMS, and email are wired; what's left is operational maturity — monitoring, caching, scheduled reconciliation — rather than fundamental architecture changes. The modular monolith fits a small team: one deployment, standard Django logging, room to grow without premature microservices.

---

## Appendix: ER Diagrams (draw.io)

Open these in [diagrams.net](https://app.diagrams.net) → **File → Open from → Device**:

| File | Contents |
|------|----------|
| `docs/diagrams/propizy-4.2-context-diagram.drawio` | System context (clients, API, externals) |
| `docs/diagrams/propizy-4.3-dfd-level1.drawio` | Level-1 data flow |
| `docs/diagrams/propizy-4.4-er-diagram.drawio` | Chen notation ER (orgs, properties, payments) |
| `docs/diagrams/propizy-er-org-auth.drawio` | Organization & auth ER (logical) |
| `docs/diagrams/propizy-er-payments-wallet.drawio` | Payments & wallet ER (logical) |

---

*Report prepared for SWE 3090 XA — System Integration*  
*Codebase: Propizy Property Management Platform*  
*Stack: Django 5.2 · Django REST Framework · React 19 · Expo · PostgreSQL · Safaricom Daraja API*
