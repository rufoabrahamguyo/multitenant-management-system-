# Functional and Non-Functional Requirements: Propizy

**System:** Propizy: Property Management Made Easy  
**Course framework:** Requirements as a specification contract (Van Lamsweerde, 2009); quality attributes (Bass et al., 2003); SMART criteria (Gabry, 2017)

Requirements describe **what** the system shall do (functional) and **how well** it shall behave under constraints (non-functional). Each requirement below is written to be **Specific**, **Measurable**, **Attainable**, **Realizable**, and **Traceable** to system processes (DFD Level 1, Chapter 4).

---

## 1. Functional Requirements

Functional requirements state a function or feature the system shall implement. They are expressed in terms of **inputs**, **processing (computations)**, **outputs**, and **data exchanged** with external systems.

### 1.1 Authentication and Organization Management (DFD Process 1)

| ID | Requirement | Inputs | Processing | Outputs |
|----|-------------|--------|------------|---------|
| **FR-01** | The system shall allow a property owner to register an account and automatically create an **Organization** with a unique `property_manager_id`. | Owner name, email, username, password | Validate credentials; create `User` (role: owner) and `Organization` (plan: FREE by default) | JWT access/refresh tokens; organization profile |
| **FR-02** | The system shall authenticate all users (Owner, Staff, Tenant) via **JWT** over HTTPS/JSON. | Username/email and password | Issue and validate tokens (SimpleJWT); enforce role-based access | Authenticated session; 401 on invalid/expired token |
| **FR-03** | The system shall allow the Owner to invite **Staff** members using a one-time invite token. | Staff email, invite link generation | Create `StaffInvite`; on registration, link user to `OrganizationMember` | Staff account scoped to owner's organization |
| **FR-04** | The system shall enforce **organization-scoped data access** so that no user can read or modify another organization's records. | Resource ID + authenticated user | Filter queries by `property_manager_id` / `get_pm_id()` | Only in-scope records returned; cross-org access denied (IDOR prevention) |
| **FR-05** | The system shall enforce **subscription plan limits**: FREE (2 properties, 10 units), STARTER (10 properties, 50 units), PRO (unlimited within configured caps). | New property or unit creation request | Compare current counts against `Organization.PLAN_LIMITS` | Creation allowed or rejected with upgrade message |

### 1.2 Property, Category, and Unit Management (DFD Process 2)

| ID | Requirement | Inputs | Processing | Outputs |
|----|-------------|--------|------------|---------|
| **FR-06** | The system shall allow the Owner to create, update, and delete **Properties** within their organization. | Property name, address, metadata | CRUD on `Property` model; scope by `property_manager_id` | Property list and detail views on web dashboard |
| **FR-07** | The system shall allow the Owner to define **Unit Categories** per property (e.g. Studio, 1 Bedroom, Premium). | Category name, property ID | Create/update `UnitCategory` linked to property | Category list used for transfers and availability |
| **FR-08** | The system shall allow the Owner to manage **Units** with rent amount and status (`vacant`, `occupied`, etc.). | Unit number, rent amount, category, property | CRUD on `Unit`; update status on lease events | Unit inventory; occupancy counts on dashboard |
| **FR-09** | The system shall display property and unit data to **Staff** in read-only mode (no create/update/delete). | Staff JWT | Apply `PERMISSION_MATRIX`: Staff: read only on properties/units | Read-only views; write attempts blocked with alert |

### 1.3 Lease and Tenant Onboarding (DFD Process 3)

| ID | Requirement | Inputs | Processing | Outputs |
|----|-------------|--------|------------|---------|
| **FR-10** | The system shall support **invite-only tenant onboarding**: Owner creates `TenantInvite` → tenant registers on mobile with token. | Tenant email/phone, invite token, registration details | Validate token; create `TenantProfile`, `User` (tenant role), active `Lease` | Tenant mobile account; unit marked `occupied` |
| **FR-11** | When a tenant accepts an invite, the system shall auto-generate a **Kenya-compliant lease agreement PDF** and store it in `media/`. | Tenant profile, unit, lease terms | Generate PDF; attach to `Lease` record | Downloadable lease document for tenant and owner |
| **FR-12** | The system shall maintain **one active lease per tenant-unit assignment** and deactivate prior leases on transfer completion. | Lease start/end, unit ID, tenant ID | Create/deactivate `Lease` records per business rules | Current lease visible on mobile "My Unit" and web tenant views |

### 1.4 Rent Collection: M-PESA and Cash (DFD Process 4)

| ID | Requirement | Inputs | Processing | Outputs |
|----|-------------|--------|------------|---------|
| **FR-13** | The system shall allow a **Tenant** to initiate **M-PESA STK Push** rent payment via mobile app. | Lease ID, amount, phone number | `MpesaService.stk_push()` → Safaricom Daraja API (or simulation mode) | STK prompt on tenant phone; pending `Payment` record |
| **FR-14** | The system shall process **M-PESA payment callbacks** (or simulation) and mark payments `completed` with receipt number. | Safaricom callback payload (receipt, amount, phone) | Match to pending payment; update `Payment`; generate receipt PDF | Payment confirmation; downloadable receipt |
| **FR-15** | The system shall enforce **one completed payment per lease per calendar month**; if a tenant pays again while the current month is already paid or pending, the payment shall be recorded for the **next available month** on the lease. | Payment month, lease ID | `resolve_month_paid()` advances month until a free slot is found | Payment for correct month; advance flag in API response |
| **FR-16** | The system shall allow **Staff** to record **cash collections** with photo evidence; payment shall not count until **Owner approves**. | Amount, lease, cash photo, collector (staff) | Create `CashCollection` (status: `pending`); Owner POST `approve/` → create `Payment` (method=cash) + receipt | Pending approval queue for Owner; approved payment in ledger |
| **FR-17** | The system shall auto-generate **monthly invoices** and **payment receipts** as PDF documents. | Lease, payment completion event | Invoice/receipt generation service; store in `media/` | PDF invoice and receipt accessible to tenant and owner |
| **FR-18** | The system shall support **utility/service charge** line items (water, electricity, service charge) on tenant billing. | Utility type, amount, lease/month | Create `UtilityCharge` records | Updated amount due on payment initiation |
| **FR-19** | The system shall send **arrears reminders** via SMS and provide **click-to-WhatsApp** links for overdue tenants. | Overdue lease list, reminder template | Identify tenants without completed payment for current month; dispatch reminder | SMS/WhatsApp reminder; logged in evidence timeline |

### 1.5 Governance: Reconciliation, Evidence, Integrity (DFD Process 5)

| ID | Requirement | Inputs | Processing | Outputs |
|----|-------------|--------|------------|---------|
| **FR-20** | The system shall allow the Owner to upload **M-PESA statement CSV** for reconciliation. | CSV file, statement period | Parse into `MpesaStatementImport` and `MpesaStatementLine` rows | Import summary; matched/unmatched lines |
| **FR-21** | The system shall **match statement lines** to recorded `Payment` records or flag them as **orphan transactions**. | Statement lines, payment ledger | Reconciliation engine (`payments/reconciliation.py`) | Matched payments; orphan alerts |
| **FR-22** | The system shall identify **silent tenants**: active leases with no completed payment for the current month. | Active leases, payment history for month | Compute difference set | Silent tenant list on governance dashboard |
| **FR-23** | The system shall run **payment integrity checks** and flag amount mismatches, duplicate months, and unregistered phone numbers. | Payment and lease data | Integrity scan; create owner-visible alerts | Integrity alert list (Owner only) |
| **FR-24** | The system shall export **dispute evidence packs** (lease, payments, invoices, reminders) as PDF with **SHA-256 integrity hash**. | Tenant/lease ID, date range | Assemble timeline + PDF + JSON bundle | Evidence bundle for tribunal/dispute use (Owner only) |
| **FR-25** | The system shall allow per-organization **M-PESA configuration** (Paybill, Till, STK settings). | Paybill/Till credentials, org ID | Store encrypted config on `Organization`; Owner write only | Org-specific payment routing |
| **FR-26** | The system shall export **eTIMS/tax-ready CSV** of rent income for accountant/KRA preparation. | Date range, org scope | Aggregate completed payments; format CSV | Downloadable tax export (Owner only) |
| **FR-27** | The system shall log **staff blocked actions** and sensitive access attempts as **Owner alerts** and **activity logs**. | Blocked API call, user, resource | `log_owner_alert()`; `ActivityLog` entry | Owner notification feed |

### 1.6 Room Transfer and Waitlist (DFD Process 6)

| ID | Requirement | Inputs | Processing | Outputs |
|----|-------------|--------|------------|---------|
| **FR-28** | The system shall allow a **Tenant** to submit a **room transfer request** specifying desired unit category. | Desired category, optional reason | Create `UnitTransferRequest` (status: `pending` or `waitlisted`) | Request confirmation; status on mobile |
| **FR-29** | The system shall enforce **at most one active transfer request** per tenant (pending, waitlisted, or approved). | Existing requests for tenant | Reject new request if active one exists | Error message to tenant |
| **FR-30** | The system shall allow tenants to **browse vacant units by category** within their property. | Property scope, category filter | Query vacant `Unit` records | Availability list on mobile |
| **FR-31** | The system shall allow the **Owner** to approve a transfer by assigning a **vacant unit** matching the desired category. | Request ID, target `unit_id` | Deactivate old lease; mark old unit vacant; create new lease; status `completed` | Updated tenant unit; transfer history |
| **FR-32** | The system shall place transfer requests on a **waitlist** when no matching vacant unit exists. | Transfer request, vacancy check | Set status `waitlisted` until unit available | Waitlist position/status visible to tenant |

### 1.7 Maintenance Management (DFD Process 7)

| ID | Requirement | Inputs | Processing | Outputs |
|----|-------------|--------|------------|---------|
| **FR-33** | The system shall allow a **Tenant** to submit **maintenance requests** from the mobile app. | Description, unit, priority/category | Create `MaintenanceRequest` (status: open) | Ticket ID; confirmation to tenant |
| **FR-34** | The system shall allow **Owner and Staff** to view and update maintenance ticket status (`open`, `in-progress`, `resolved`). | Ticket ID, new status, notes | Update `MaintenanceRequest`; scope by organization | Updated task list on web dashboard |

### 1.8 Reporting and Owner Digest (DFD Process 8)

| ID | Requirement | Inputs | Processing | Outputs |
|----|-------------|--------|------------|---------|
| **FR-35** | The system shall provide an **organization dashboard** with occupancy rate, collection rate, overdue payments, and maintenance summary. | Org-scoped aggregates | `GET /api/auth/dashboard/` and report endpoints | Real-time KPI cards and charts (web) |
| **FR-36** | The system shall generate **real-time reports**: collection rates, property breakdown, and 6-month payment trends. | Date range, property filters | Aggregate `Payment`, `Lease`, `Unit` data | Recharts visualizations on web Reports module |
| **FR-37** | The system shall generate a **weekly Owner digest PDF** summarizing collections, arrears, and pending approvals for absentee/diaspora landlords. | Org data for week | Digest generation service; store in `media/` | Downloadable weekly digest (Owner only) |
| **FR-38** | The system shall generate **monthly owner statements** as PDF for financial oversight. | Statement period | Compile payments, invoices, utilities | PDF owner statement |

### 1.9 External System Integration

| ID | Requirement | Inputs | Processing | Outputs |
|----|-------------|--------|------------|---------|
| **FR-39** | The system shall integrate with **Safaricom M-PESA Daraja API** for STK Push initiation and payment callbacks. | STK request; callback payload | HTTPS to M-PESA; handle success/failure/timeout | Payment status sync; receipt number |
| **FR-40** | The system shall operate in **M-PESA simulation mode** when Daraja credentials are not configured (development/demo). | Simulated callback trigger | Local simulation of STK flow | Completed payment without live M-PESA |

---

## 2. Non-Functional Requirements

Non-functional requirements state constraints and quality attributes that apply across the system. They are **measurable** where possible (Gabry, 2017).

### 2.1 Performance

| ID | Requirement | Quality attribute | Measure / verification |
|----|-------------|-------------------|------------------------|
| **NFR-01** | API read endpoints (dashboard, property list, unit list) shall return responses within **3 seconds** under normal load (≤ 50 concurrent users per deployment). | Response time | Load test; 95th percentile ≤ 3 s |
| **NFR-02** | M-PESA STK Push initiation shall complete the API hand-off to Safaricom within **10 seconds** (excluding user phone interaction). | Time | Timed integration test |
| **NFR-03** | PDF generation (receipt, lease, digest) shall complete within **15 seconds** for a single document. | Resource utilization / time | Timed generation test |
| **NFR-04** | M-PESA statement CSV import shall process up to **5,000 lines** within **60 seconds**. | Throughput | Import benchmark test |

### 2.2 Security

| ID | Requirement | Quality attribute | Measure / verification |
|----|-------------|-------------------|------------------------|
| **NFR-05** | All client-server communication shall use **HTTPS/TLS** in production. | Confidentiality, integrity | SSL configuration review |
| **NFR-06** | Authentication tokens shall expire per JWT policy; refresh tokens shall rotate on use. | Authenticity | Token expiry integration tests |
| **NFR-07** | The system shall prevent **Insecure Direct Object Reference (IDOR)** across organizations: no cross-tenant data access by manipulating resource IDs. | Confidentiality, integrity | `users/security_tests.py` penetration-style suite; 100% pass |
| **NFR-08** | **Owner-only** endpoints (cash approval, reconciliation write, integrity, tax export, M-PESA config) shall reject Staff and Tenant roles with **HTTP 403**. | Authorization | RBAC test matrix vs `PERMISSION_MATRIX` |
| **NFR-09** | Passwords shall be stored using Django's **hashed** password mechanism (never plaintext). | Confidentiality | Code review; database inspection |
| **NFR-10** | Evidence bundles shall include a **SHA-256 hash** so tampering after export is detectable. | Integrity | Hash verification test |

### 2.3 Reliability and Availability

| ID | Requirement | Quality attribute | Measure / verification |
|----|-------------|-------------------|------------------------|
| **NFR-11** | The system shall achieve **99% uptime** during business hours (08:00-20:00 EAT) in production deployment. | Availability | Uptime monitoring over 30-day window |
| **NFR-12** | Failed M-PESA callbacks shall leave payments in **reconcilable state** (pending/failed) without corrupting ledger; Owner can reconcile via CSV import. | Fault tolerance, recoverability | Callback failure simulation test |
| **NFR-13** | Database constraints (unique payment per lease/month, foreign keys) shall prevent **orphaned or duplicate financial records** at persistence layer. | Integrity | Migration and constraint tests |
| **NFR-14** | Cash collections pending Owner approval shall **not** affect collection rate or tenant balance until approved. | Consistency | Workflow test: pending cash excluded from completed totals |

### 2.4 Operability (Usability, Learnability, UX)

| ID | Requirement | Quality attribute | Measure / verification |
|----|-------------|-------------------|------------------------|
| **NFR-15** | A new **Owner** shall complete organization setup (register, add property, add unit, send tenant invite) within **30 minutes** without external training. | Learnability | Usability test with 3 novice users |
| **NFR-16** | A **Tenant** shall complete M-PESA rent payment in **≤ 5 taps** from mobile home screen (excluding M-PESA PIN entry). | Ease of use | Task completion observation |
| **NFR-17** | Web dashboard shall be **responsive** and usable on desktop browsers (Chrome, Firefox, Safari: latest two versions). | Technical accessibility | Cross-browser smoke test |
| **NFR-18** | Mobile app shall run on **Android and iOS** via React Native Expo with consistent core flows (pay, maintenance, transfer). | Appropriateness | Device matrix test |
| **NFR-19** | Blocked Staff actions shall surface a **clear denial message** and optionally notify Owner (not silent failure). | Recognizability | RBAC UX test |

### 2.5 Compatibility and Interoperability

| ID | Requirement | Quality attribute | Measure / verification |
|----|-------------|-------------------|------------------------|
| **NFR-20** | Web and mobile clients shall consume the **same REST API** (JSON over HTTPS) without duplicate business logic in clients. | Interoperability | Architecture review; shared endpoint documentation |
| **NFR-21** | The system shall use **PostgreSQL** as its sole relational database for development and production, deployed via **Docker Compose**. | Compatibility, portability | `docker compose up`; migrations and API respond on port 8000 |
| **NFR-22** | M-PESA statement import shall accept **Safaricom-standard CSV export** format documented in reconciliation module. | Interoperability | Sample CSV import test |

### 2.6 Maintainability

| ID | Requirement | Quality attribute | Measure / verification |
|----|-------------|-------------------|------------------------|
| **NFR-23** | Business rules shall reside in **service modules** and **permission classes**, not duplicated in views. | Modularity, analyzability | Code structure review (`transfer_service.py`, `reconciliation.py`, `governance.py`) |
| **NFR-24** | The permission matrix shall be **documented and enforced** in one source (`PERMISSION_MATRIX` in `users/governance.py`). | Modifiability, traceability | Matrix matches permission class behavior |
| **NFR-25** | Automated tests shall cover **security isolation**, **cash approval workflow**, and **transfer approval** before release. | Testability | CI test run; minimum agreed coverage on critical paths |
| **NFR-26** | New organization onboarding shall require **no manual database edits** (self-service registration). | Modifiability | End-to-end registration test |

### 2.7 Portability and Scalability

| ID | Requirement | Quality attribute | Measure / verification |
|----|-------------|-------------------|------------------------|
| **NFR-27** | Application shall deploy as **three separable tiers**: React web, React Native mobile, Django API + DB. | Replaceability | Independent build and deploy of each tier |
| **NFR-28** | Multi-tenancy shall use **shared database, shared schema** with `property_manager_id` discriminator to support multiple organizations per deployment without separate databases per customer. | Scalability | Multi-org load test; isolation verification |
| **NFR-29** | Media files (PDFs, photos) shall be stored under configurable `media/` path for migration to cloud storage (e.g. S3) without schema change. | Adaptability | Configuration change test |

### 2.8 Regulatory and Domain Constraints (Kenya context)

| ID | Requirement | Quality attribute | Measure / verification |
|----|-------------|-------------------|------------------------|
| **NFR-30** | Lease agreements generated on onboarding shall follow **Kenya tenancy agreement** content structure required by the project domain. | Compliance | Legal/content review of PDF template |
| **NFR-31** | Rent income export shall produce **accountant-ready CSV** suitable for KRA/eTIMS preparation workflows. | Compliance | Sample export reviewed by domain expert |
| **NFR-32** | Tenant phone numbers shall align with **Kenya M-PESA** format validation before STK Push. | Compatibility | Phone validation unit tests |

---

## 3. Requirements Quality Checklist (SMART)

| Property | How addressed in this specification |
|----------|-------------------------------------|
| **Specific / Unambiguous** | Each FR/NFR has unique ID; actors (Owner, Staff, Tenant) and platforms (web, mobile) are named explicitly |
| **Measurable** | NFRs include numeric thresholds (time, uptime, taps); FRs define verifiable outputs (PDF, status codes, constraints) |
| **Attainable** | Features map to implemented Django/React stack and Safaricom Daraja API (or simulation) |
| **Realizable** | Plan limits, RBAC, and DB constraints reflect actual models and `PERMISSION_MATRIX` |
| **Traceable** | FR groups map to DFD Level 1 processes (Chapter 4, §4.3); NFRs map to ISO-style quality attributes |

---

## 4. Traceability Matrix (FR → DFD Process)

| DFD Process | Functional requirements |
|-------------|-------------------------|
| 1: Authentication & Organization Management | FR-01 - FR-05 |
| 2: Property, Category & Unit Management | FR-06 - FR-09 |
| 3: Lease & Tenant Onboarding | FR-10 - FR-12 |
| 4: Rent Collection (M-PESA & Cash) | FR-13 - FR-19 |
| 5: Governance | FR-20 - FR-27 |
| 6: Room Transfer & Waitlist | FR-28 - FR-32 |
| 7: Maintenance Management | FR-33 - FR-34 |
| 8: Reporting & Owner Digest | FR-35 - FR-38 |
| External: M-PESA (Safaricom) | FR-39 - FR-40 |

---

## 5. References

- Van Lamsweerde, A. (2009). *Requirements engineering: From system goals to UML models to software*. John Wiley & Sons.
- Bass, L., Clements, P., & Kazman, R. (2003). *Software architecture in practice*. Addison-Wesley.
- Gabry, O. E. (2017). Software Engineering: Software Process and Software Process Models.
- Propizy system design: `docs/reports/CHAPTER_FOUR_IMPLEMENTATION.md`
