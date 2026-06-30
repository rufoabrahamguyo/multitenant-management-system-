# CHAPTER FOUR: IMPLEMENTATION: SYSTEM ANALYSIS & DESIGN

Diagram source files (draw.io XML): `docs/diagrams/`

| Section | File |
|---------|------|
| 4.2 Context Diagram | `propizy-4.2-context-diagram.drawio` |
| 4.3 DFD Level 1 | `propizy-4.3-dfd-level1.xml` |
| 4.3 DFD Level 2 | `propizy-4.3-dfd-level2.xml` |
| 4.4 ER Diagram | `propizy-4.4-er-diagram.drawio` (conceptual Chen) |
| 4.4 Database ER Diagram | `propizy-database-er-diagram.xml` (all tables, Crow's Foot) |

Open with [diagrams.net](https://app.diagrams.net) → **File → Open**.

---

## 4.1 System Analysis & Design

Propizy implements a **three-tier, API-centric architecture** aligned with the methodology in Chapter 3. Presentation, application, and data tiers are separated so that web and mobile clients share one REST backend and one logical database per deployment.

### 4.1.1 Architectural Tiers

**Presentation tier**

| Client | Users | Key modules |
|--------|-------|-------------|
| React web dashboard (`frontend/`) | Owner, Staff (Manager role) | Dashboard, Properties, Units, Transfers, Governance, Payments, Reports |
| React Native app (`mobile/`) | Tenant | Home, My Unit (availability + transfer requests), Pay, Maintenance, Profile |

Both clients authenticate via **JWT** (SimpleJWT) and communicate with the backend over HTTPS/JSON.

**Application tier**

Django REST Framework exposes resources through modular apps:

| App | Responsibility |
|-----|----------------|
| `users` | Auth, organizations, invites, RBAC, activity logs, owner alerts, M-PESA config, digests |
| `properties` | Properties, unit categories, units, leases, transfer requests |
| `payments` | M-PESA, invoices, receipts, cash approval, integrity, reconciliation, utilities, evidence |
| `maintenance` | Maintenance tickets |

Business rules live in **services** (e.g. `transfer_service.py`, `transfer_service` approval, `payments/reconciliation.py`) and **permission classes** (`users/permissions.py`, `users/governance.py`).

**Data tier**

- **Relational DB:** PostgreSQL (via Docker Compose)  
- **File storage:** `media/` for lease PDFs, receipts, invoices, cash photos, statements, digests  
- **Tenant discriminator:** `property_manager_id` on `User` (manager) and `Organization` scopes all org queries  

### 4.1.2 Multi-Tenancy Design

Propizy uses **shared database, shared schema** multi-tenancy:

1. Each manager registration creates an `Organization` with unique `property_manager_id`.
2. Staff inherit org scope via `OrganizationMember` → org’s `property_manager_id` (`get_pm_id()` in `users/utils.py`).
3. All manager queries filter by `property_manager_id` (properties, units, payments, transfers).
4. Tenants are linked to a manager `User`; tenant data is scoped through `tenant.user.manager.property_manager_id`.

Automated tests in `users/security_tests.py` verify **IDOR prevention** across organizations.

### 4.1.3 Role Model

| Role | Platform | Write scope |
|------|----------|-------------|
| **Owner** | Web | Full org admin; approve cash, transfers, exports, integrity views |
| **Staff** | Web | Operations (cash record, maintenance); financial writes blocked |
| **Tenant** | Mobile | Pay rent, maintenance, transfer requests, view availability |

Permission matrix documented in `users/governance.py` (`PERMISSION_MATRIX`).

### 4.1.4 Core Workflow Designs

**A. Invite-only tenant onboarding**

Manager creates `TenantInvite` → tenant registers with token → `TenantProfile` + active `Lease` + lease agreement PDF → unit marked occupied.

**B. M-PESA rent payment**

Tenant POST `/api/payments/initiate/` → `MpesaService.stk_push()` → callback or simulation → `Payment` completed → receipt PDF.

**C. Caretaker cash with owner approval**

Staff POST `/api/cash-collections/` → status `pending` → owner POST `approve/` → creates `Payment` (method=cash) + receipt.

**D. Room transfer**

Tenant POST `/api/transfer-requests/` → `pending` or `waitlisted` → owner POST `approve/` with `unit_id` → old lease deactivated, old unit vacant, new lease on assigned unit, status `completed`.

**E. Reconciliation**

Owner uploads CSV → `MpesaStatementImport` + `MpesaStatementLine` rows → match to `Payment` or flag `orphan`; silent tenants computed from active leases without completed payment for current month.

### 4.1.5 Design Constraints

- One active transfer request per tenant (pending/waitlisted/approved).
- Unique active payment per lease/month (DB constraint); a second payment in the same calendar month is auto-assigned to the next unpaid month.
- Transfer target unit must match `desired_category` and be `vacant`.
- Owner-only endpoints enforced by `IsOrgOwnerOnly` / `IsOrgOwnerForWrite`.

---

## 4.2 Context Diagram

See **`docs/diagrams/propizy-4.2-context-diagram.drawio`**.

**Notation (Yourdon & Coad):** rounded rectangle with numbered header = process; plain rectangle = external entity; labelled arrow = data flow.

**Level 0 (Context):** Process **0: Propizy** (*Property Management Made Easy*) decomposes the whole system into one bubble. Four external entities interact across the boundary:

| External entity | Data flows |
|-----------------|------------|
| **Property Owner** | *In:* property details, staff invites, approval decisions, statement upload: *Out:* dashboards, owner statements, alerts, weekly digest |
| **Staff / Caretaker** | *In:* cash collection records, maintenance updates: *Out:* task lists, RBAC views, pending approval notices |
| **Tenant** | *In:* account details, rent payment, maintenance & transfer requests: *Out:* lease info, receipts, availability, waitlist status |
| **M-PESA (Safaricom)** | *In:* payment callbacks, receipt numbers: *Out:* STK Push requests, payment initiation |

Arrears reminders (SMS / WhatsApp) are internal outputs of Process 4 and are shown on the Level 1 DFD (§4.3).

---

## 4.3 Data Flow Diagram (DFD)

**Level 1:** **`docs/diagrams/propizy-4.3-dfd-level1.xml`**

**Level 2:** **`docs/diagrams/propizy-4.3-dfd-level2.xml`** (four pages: decomposition of Processes 3, 4, 5, and 6)

**Notation:** processes use rounded rectangles with blue ID headers; data stores use split rectangles (`D1 | Name`); all flows are labelled arrows. The Level 1 diagram is **balanced** with the context diagram: every boundary flow from §4.2 appears on a specific sub-process. Level 2 uses parent.child IDs (e.g. 4.1, 4.2) and must balance flows in/out of each parent process.

**Level 1 processes (decomposition of Process 0):**

| ID | Process | Primary data store |
|----|---------|-------------------|
| 1 | Authentication & Organization Management | D1 |
| 2 | Property, Category & Unit Management | D2 |
| 3 | Lease & Tenant Onboarding | D2, D4 |
| 4 | Rent Collection (M-PESA & Cash) | D3, D4 |
| 5 | Governance (Reconciliation, Evidence, Integrity) | D1, D3 |
| 6 | Room Transfer & Waitlist | D2 |
| 7 | Maintenance Management | D5 |
| 8 | Reporting & Owner Digest | D2, D3, D4 |

**Data stores:**

| ID | Name | Django models |
|----|------|---------------|
| D1 | Users & Organizations | User, Organization, OrganizationMember, Invites, ActivityLog, OwnerAlert |
| D2 | Properties, Units & Leases | Property, UnitCategory, Unit, TenantProfile, Lease, UnitTransferRequest |
| D3 | Payments & Reconciliation | Payment, Invoice, CashCollection, UtilityCharge, MpesaStatementImport/Line, EvidenceSnapshot |
| D4 | Media & PDF Files | lease, receipt, invoice, statement, digest files in `media/` |
| D5 | Maintenance Requests | MaintenanceRequest |

**Level 2 decompositions (in `propizy-4.3-dfd-level2.xml`):**

| Parent | Sub-processes | Maps to workflows §4.1.4 |
|--------|---------------|---------------------------|
| **3** Lease & Tenant Onboarding | 3.1 Issue Invite → 3.2 Register → 3.3 Create Lease → 3.4 Lease PDF | Workflow A |
| **4** Rent Collection | 4.1 STK Push → 4.2 Callback → 4.3 Record Cash → 4.4 Approve → 4.5 Receipt → 4.6 Reminder | Workflows B, C |
| **5** Governance | 5.1 Upload CSV → 5.2 Parse → 5.3 Match → 5.4 Orphans → 5.5 Evidence → 5.6 Alerts | Workflow E |
| **6** Room Transfer | 6.1 Submit → 6.2 Waitlist → 6.3 Approve → 6.4 Reassign → 6.5 Update Leases | Workflow D |

---

## 4.4 Entity Relationship (ER) Diagram

**Database schema (recommended for report):** **`docs/diagrams/propizy-database-er-diagram.xml`**

Crow's Foot notation per database-design standards:

| Rule | Application in diagram |
|------|------------------------|
| Table = entity | 23 tables (`tblUSER`, `tblPROPERTY`, …) mapped from Django models |
| Primary key | `entity_id (PK)` on every table |
| Foreign key | `(FK1)`, `(FK2)` numbered in child table; line runs parent → child |
| Cardinality | Mandatory FK: **1 → 0..\***; nullable FK: **0..1 → 0..\***; `OneToOneField`: **1 → 0..1** |
| Relationships | Dashed connectors with crow's-foot symbols at the many side |

**All 23 tables:** `tblUSER`, `tblORGANIZATION`, `tblORG_MEMBER`, `tblMPESA_CONFIG`, `tblTENANT_INVITE`, `tblSTAFF_INVITE`, `tblACTIVITY_LOG`, `tblOWNER_ALERT`, `tblPROPERTY`, `tblUNIT_CATEGORY`, `tblUNIT`, `tblTENANT`, `tblLEASE`, `tblTRANSFER_REQUEST`, `tblPAYMENT`, `tblINVOICE`, `tblCASH_COLLECTION`, `tblUTILITY_CHARGE`, `tblPAYMENT_REMINDER`, `tblMPESA_IMPORT`, `tblMPESA_LINE`, `tblEVIDENCE`, `tblMAINTENANCE`.

**Key relationship examples:**

| Parent | Child | Cardinality | Django field |
|--------|-------|-------------|--------------|
| tblUSER | tblORGANIZATION | 1 : 0..1 | `Organization.owner` (OneToOne) |
| tblUSER | tblTENANT | 1 : 0..1 | `TenantProfile.user` (OneToOne) |
| tblPROPERTY | tblUNIT | 1 : 0..* | `Unit.property` (required FK) |
| tblTENANT + tblUNIT | tblLEASE | 1 : 0..* each | Resolves tenant-unit M:N |
| tblLEASE | tblPAYMENT | 1 : 0..* | `Payment.lease` |
| tblPAYMENT | tblCASH_COLLECTION | 0..1 : 0..1 | `CashCollection.linked_payment` (OneToOne) |

**Conceptual alternative:** **`docs/diagrams/propizy-4.4-er-diagram.drawio`**: Chen notation (entities, attributes, relationship diamonds).

---

## Figure placement in Word report

1. Export each `.drawio` as PNG/PDF (File → Export as → PNG, 300 DPI).
2. Insert as Figure 4.1 (Context), Figure 4.2 (DFD), Figure 4.3 (ER).
3. Reference figures in text: *“Figure 4.1 shows the system context…”*
