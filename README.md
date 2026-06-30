
# Propizy: Property Management Made Easy

Kenya-first multi-tenant property management platform with owner-staff governance, M-PESA rent collection, invite-only tenant onboarding, and mobile tenant services.

## Architecture

Propizy uses a **modular monolith** backend (Django REST) with a React web dashboard and React Native tenant app. Domains are split into apps (`users`, `properties`, `payments`, `maintenance`) with layered validation, JWT auth, and organization-scoped multi-tenancy.

Full design details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

| Layer | Stack |
|-------|-------|
| Backend | Django 5+, DRF, SimpleJWT, PostgreSQL (Docker) |
| Web Dashboard | React 18, Vite, Tailwind, Recharts (Managers + Staff) |
| Mobile App | React Native Expo (Tenants only, invite registration) |
| Payments | M-PESA Daraja STK Push (simulation mode without credentials) |

## SaaS Features

- **Automated Rent Collection**: M-PESA STK Push with automatic payment tracking
- **Real-Time Reports**: live collection rates, property breakdown, 6-month trends
- **Tenant Management**: balances, leases, arrears, notices & payment history
- **Invoicing & Receipts**: auto-generate monthly invoices and payment receipts (PDF)
- **Arrears Management**: identify late payers and send automated SMS reminders
- **Caretaker Accountability**: staff roles with read-only finances and owner activity logs
- **Dispute Evidence Packs**: export lease, payments, invoices & reminders as PDF
- **Payment Integrity Checks**: flag amount mismatches, duplicate months, unregistered phones
- **Owner Statements**: monthly PDF reports for diaspora/absentee landlords
- **Kenya Lease Agreements**: auto-generated written tenancy agreement on invite acceptance
- **Multi-Property Oversight**: manage apartments, units & estates from one dashboard
- **Organizations**: each manager registration creates an org with plan limits
- **Team members**: owners invite staff who share org access
- **Invite-only tenants**: managers invite via email; tenants register on mobile
- **Auto-leases**: lease created when tenant accepts invite
- **Plan limits**: FREE (2 properties, 10 units), STARTER, PRO (billing later)
- **Dashboard**: occupancy, collections, overdue payments, maintenance

## Governance & Trust Features (Tier 1-3)

- **Permission Matrix**: documented Owner vs Staff RBAC with blocked-action alerts
- **Cash Collection Workflow**: staff record cash; owner must approve before payment counts
- **Evidence Chain**: timeline + PDF + JSON bundle with SHA-256 integrity hash
- **M-PESA Reconciliation**: CSV statement import, orphan transactions, silent tenant detection
- **Per-Org M-PESA Config**: Paybill/Till/STK settings per organization
- **WhatsApp Reminders**: click-to-WhatsApp links on arrears reminders (SMS + WhatsApp)
- **Utility/Service Charges**: split billing (water, electricity, service charge)
- **eTIMS/Tax Export**: CSV rent income export for accountant/KRA prep
- **Weekly Owner Digest**: PDF summary for absentee/diaspora landlords
- **Security Tests**: IDOR/isolation penetration-style test suite (`users/security_tests.py`)
- **Room Categories**: Studio, Premium, 1 Bedroom, etc. per property
- **Unit Transfer Requests**: tenants request category changes with waitlist support
- **Availability Browser**: tenants see vacant units by category; managers approve assignments

## Quick Start (Docker)

```bash
# 1. Backend + PostgreSQL
cp backend/.env.example backend/.env
docker compose up --build

# API: http://localhost:8002
# Postgres: localhost:5435 (user/pass/db: postgres/postgres/propizy)

# 2. Web dashboard (managers)
cd frontend && npm install && npm run dev

# 3. Mobile app (tenants)
cd mobile && npm install && npx expo start
```

### Local backend (optional, without Docker)

Requires PostgreSQL running locally and `backend/.env` with `DB_HOST=localhost`.

```bash
cd backend && source ../venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

## First-time setup

1. Open the web dashboard and **register** a property owner account (`POST /api/auth/register/`).
2. Add properties and units from the dashboard.
3. **Invite tenants** by email; they register on the mobile app with the invite link.
4. **Invite staff** from the Team page if you need caretakers with limited access.

No demo or seed accounts are created automatically — all users are real registrations.

## Key API Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /api/auth/register/` | Create org + owner account |
| `POST /api/auth/login/` | Manager login (JWT) |
| `GET /api/auth/me/` | Current user profile (session validation) |
| `POST /api/auth/register-tenant/` | Tenant signup with invite token |
| `POST /api/auth/register-staff/` | Staff signup with invite token |
| `POST /api/auth/tenant-invites/` | Manager sends tenant invite |
| `POST /api/auth/staff-invites/` | Owner invites staff |
| `GET /api/auth/dashboard/` | Org stats summary |
| `POST /api/payments/initiate/` | M-PESA STK Push |
| `GET /api/auth/owner-statement/` | Monthly owner statement PDF |
| `GET /api/auth/activity/` | Owner activity audit log |
| `GET /api/payments/integrity-alerts/` | Payment integrity flags |
| `GET /api/tenants/{id}/dispute_pack/` | Dispute evidence PDF export |
| `GET /api/auth/permission-matrix/` | Owner/Staff RBAC matrix |
| `GET /api/auth/owner-alerts/` | Owner governance alerts |
| `GET/PUT /api/auth/mpesa-config/` | Per-org Paybill/Till config (admin/legacy) |
| `GET/POST /api/auth/mpesa-integration-request/` | Owner requests managed M-PESA setup |
| `GET /api/auth/weekly-digest/` | Weekly owner digest PDF |
| `GET/POST /api/cash-collections/` | Cash collection workflow |
| `POST /api/cash-collections/{id}/approve/` | Owner approve cash |
| `GET/POST /api/reconciliation/` | M-PESA CSV import & summary |
| `GET /api/tax-export/` | eTIMS/tax CSV export |
| `GET /api/tenants/{id}/evidence-bundle/` | Evidence bundle + SHA-256 hash |
| `GET/POST /api/utilities/` | Utility/service charge billing |
| `GET/POST /api/unit-categories/` | Room categories (Studio, Premium, etc.) |
| `GET /api/unit-availability/` | Vacant units grouped by category |
| `GET/POST /api/transfer-requests/` | Tenant room change requests |
| `POST /api/transfer-requests/{id}/approve/` | Owner approves transfer to vacant unit |
| `POST /api/transfer-requests/{id}/waitlist/` | Move request to waitlist |
| `POST /api/transfer-requests/{id}/cancel/` | Tenant cancels request |

## Tenant Invite Flow

1. Manager invites tenant (email + phone + unit) in web dashboard — **invite email sent automatically**
2. Tenant opens link in email → `https://your-app/invite/<token>` → opens Propizy mobile app
3. Tenant registers in the app → lease auto-created
4. Tenant pays rent via M-PESA

## Run Tests

```bash
# With Docker (backend + db running)
docker compose exec backend python manage.py test

# Or locally against PostgreSQL
cd backend && python manage.py test
```

## M-PESA Setup

Property owners request M-PESA integration under **Governance → M-PESA** in the web dashboard. They submit their Till/Paybill number and details from the Safaricom onboarding email — no Daraja consumer keys required.

The Propizy team completes setup in **Django admin** (`Mpesa integration requests`): enter Daraja credentials and mark the request **Completed**. The owner is notified by email and tenants can pay via STK Push.

Set `MPESA_OPS_EMAIL` in `backend/.env` to receive new request notifications:

```
MPESA_OPS_EMAIL=integrations@yourdomain.com
```

Platform `.env` also needs the shared callback URL:

```
MPESA_CALLBACK_URL=https://your-ngrok-url/api/payments/mpesa-callback/
```

Without completed integration, tenant payments run in **simulation mode** (auto-complete + PDF receipt).

## Email (invite notifications)

Tenant and staff invites are emailed automatically when SMTP is configured.

Add to `backend/.env` for production (example: Resend):

```
EMAIL_HOST=smtp.resend.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=resend
EMAIL_HOST_PASSWORD=re_xxxxxxxx
DEFAULT_FROM_EMAIL=Propizy <invites@yourdomain.com>
FRONTEND_URL=https://app.propizy.app
```

In local development without `EMAIL_HOST`, invite emails are printed to the backend console.

## Cloudinary (image & file storage)

Tenant ID photos, cash receipt images, and generated PDFs are stored via Django's default storage. With Cloudinary credentials, uploads go to your Cloudinary account instead of the local `backend/media/` folder.

Add to `backend/.env`:

```
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

Leave these unset for local development (files saved under `backend/media/`). Get credentials from the [Cloudinary console](https://console.cloudinary.com/).

