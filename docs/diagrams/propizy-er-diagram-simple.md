# Propizy: Database ER Diagram (PK & FK)

Accurate schema from Django models. **23 tables** · Crow's Foot · PostgreSQL.

**Notation**

| Symbol | Meaning |
|--------|---------|
| **PK** | Primary key (`id`, auto-increment) |
| **FK → TABLE** | Foreign key referencing parent table |
| **FK → TABLE (null)** | Nullable foreign key |
| **FK → TABLE (UQ)** | OneToOne: FK column is unique |

> Render in VS Code (Mermaid preview) or [mermaid.live](https://mermaid.live).

---

## Full schema

```mermaid
erDiagram
    USER {
        int id PK
        int manager_id FK_USER
        string role
        uuid property_manager_id
    }

    ORGANIZATION {
        int id PK
        int owner_id FK_USER_UQ
        string name
        string slug
        uuid property_manager_id
        string plan
    }

    ORG_MEMBER {
        int id PK
        int organization_id FK_ORGANIZATION
        int user_id FK_USER_UQ
        string role
    }

    MPESA_CONFIG {
        int id PK
        int organization_id FK_ORGANIZATION_UQ
        string channel
        string shortcode
    }

    TENANT_INVITE {
        int id PK
        int organization_id FK_ORGANIZATION
        int unit_id FK_UNIT_NULL
        int invited_by_id FK_USER_NULL
        uuid token
    }

    STAFF_INVITE {
        int id PK
        int organization_id FK_ORGANIZATION
        int invited_by_id FK_USER_NULL
        uuid token
    }

    ACTIVITY_LOG {
        int id PK
        int organization_id FK_ORGANIZATION
        int user_id FK_USER_NULL
        string action
    }

    OWNER_ALERT {
        int id PK
        int organization_id FK_ORGANIZATION
        int triggered_by_id FK_USER_NULL
        string alert_type
    }

    PROPERTY {
        int id PK
        int manager_id FK_USER
        string name
        string address
    }

    UNIT_CATEGORY {
        int id PK
        int property_ref_id FK_PROPERTY
        string name
    }

    UNIT {
        int id PK
        int property_id FK_PROPERTY
        int category_id FK_UNIT_CATEGORY_NULL
        string unit_number
        string status
    }

    TENANT_PROFILE {
        int id PK
        int user_id FK_USER_UQ
        int current_unit_id FK_UNIT_NULL
        string phone_number
    }

    LEASE {
        int id PK
        int tenant_id FK_TENANT_PROFILE
        int unit_id FK_UNIT
        date start_date
        boolean is_active
    }

    TRANSFER_REQUEST {
        int id PK
        int tenant_id FK_TENANT_PROFILE
        int current_lease_id FK_LEASE
        int desired_category_id FK_UNIT_CATEGORY
        int preferred_unit_id FK_UNIT_NULL
        int assigned_unit_id FK_UNIT_NULL
        int reviewed_by_id FK_USER_NULL
        string status
    }

    PAYMENT {
        int id PK
        int tenant_id FK_TENANT_PROFILE
        int lease_id FK_LEASE
        decimal amount
        date month_paid
        string status
    }

    INVOICE {
        int id PK
        int lease_id FK_LEASE
        date month
        decimal amount
    }

    CASH_COLLECTION {
        int id PK
        int lease_id FK_LEASE
        int recorded_by_id FK_USER_NULL
        int reviewed_by_id FK_USER_NULL
        int linked_payment_id FK_PAYMENT_UQ_NULL
        string status
    }

    UTILITY_CHARGE {
        int id PK
        int lease_id FK_LEASE
        string utility_type
        date month
    }

    PAYMENT_REMINDER {
        int id PK
        int lease_id FK_LEASE
        text message
    }

    MPESA_IMPORT {
        int id PK
        int organization_id FK_ORGANIZATION
        int uploaded_by_id FK_USER_NULL
        string filename
    }

    MPESA_LINE {
        int id PK
        int statement_import_id FK_MPESA_IMPORT
        int matched_payment_id FK_PAYMENT_NULL
        string receipt_number
    }

    EVIDENCE {
        int id PK
        int tenant_id FK_TENANT_PROFILE
        int created_by_id FK_USER_NULL
        string sha256_hash
    }

    MAINTENANCE {
        int id PK
        int tenant_id FK_TENANT_PROFILE
        int unit_id FK_UNIT
        string issue_title
        string status
    }

  USER ||--o{ USER : "manager_id"
  USER ||--o| ORGANIZATION : "owner_id"
  USER ||--o| ORG_MEMBER : "user_id"
  USER ||--o| TENANT_PROFILE : "user_id"
  USER ||--o{ PROPERTY : "manager_id"
  ORGANIZATION ||--o{ ORG_MEMBER : "organization_id"
  ORGANIZATION ||--o| MPESA_CONFIG : "organization_id"
  ORGANIZATION ||--o{ TENANT_INVITE : "organization_id"
  ORGANIZATION ||--o{ STAFF_INVITE : "organization_id"
  ORGANIZATION ||--o{ ACTIVITY_LOG : "organization_id"
  ORGANIZATION ||--o{ OWNER_ALERT : "organization_id"
  ORGANIZATION ||--o{ MPESA_IMPORT : "organization_id"
  PROPERTY ||--o{ UNIT_CATEGORY : "property_ref_id"
  PROPERTY ||--o{ UNIT : "property_id"
  UNIT_CATEGORY ||--o{ UNIT : "category_id"
  UNIT ||--o{ TENANT_PROFILE : "current_unit_id"
  TENANT_PROFILE ||--o{ LEASE : "tenant_id"
  UNIT ||--o{ LEASE : "unit_id"
  TENANT_PROFILE ||--o{ TRANSFER_REQUEST : "tenant_id"
  LEASE ||--o{ TRANSFER_REQUEST : "current_lease_id"
  UNIT_CATEGORY ||--o{ TRANSFER_REQUEST : "desired_category_id"
  LEASE ||--o{ PAYMENT : "lease_id"
  TENANT_PROFILE ||--o{ PAYMENT : "tenant_id"
  LEASE ||--o{ INVOICE : "lease_id"
  LEASE ||--o{ CASH_COLLECTION : "lease_id"
  LEASE ||--o{ UTILITY_CHARGE : "lease_id"
  LEASE ||--o{ PAYMENT_REMINDER : "lease_id"
  PAYMENT ||--o| CASH_COLLECTION : "linked_payment_id"
  MPESA_IMPORT ||--o{ MPESA_LINE : "statement_import_id"
  PAYMENT ||--o{ MPESA_LINE : "matched_payment_id"
  TENANT_PROFILE ||--o{ EVIDENCE : "tenant_id"
  TENANT_PROFILE ||--o{ MAINTENANCE : "tenant_id"
  UNIT ||--o{ MAINTENANCE : "unit_id"
  UNIT ||--o{ TENANT_INVITE : "unit_id"
```

---

## Primary keys (all tables)

Every table uses `id` (integer, auto-increment) as **PK**.

| Table | PK column | Django model |
|-------|-----------|--------------|
| USER | `id` | `User` |
| ORGANIZATION | `id` | `Organization` |
| ORG_MEMBER | `id` | `OrganizationMember` |
| MPESA_CONFIG | `id` | `OrganizationMpesaConfig` |
| TENANT_INVITE | `id` | `TenantInvite` |
| STAFF_INVITE | `id` | `StaffInvite` |
| ACTIVITY_LOG | `id` | `ActivityLog` |
| OWNER_ALERT | `id` | `OwnerAlert` |
| PROPERTY | `id` | `Property` |
| UNIT_CATEGORY | `id` | `UnitCategory` |
| UNIT | `id` | `Unit` |
| TENANT_PROFILE | `id` | `TenantProfile` |
| LEASE | `id` | `Lease` |
| TRANSFER_REQUEST | `id` | `UnitTransferRequest` |
| PAYMENT | `id` | `Payment` |
| INVOICE | `id` | `Invoice` |
| CASH_COLLECTION | `id` | `CashCollection` |
| UTILITY_CHARGE | `id` | `UtilityCharge` |
| PAYMENT_REMINDER | `id` | `PaymentReminder` |
| MPESA_IMPORT | `id` | `MpesaStatementImport` |
| MPESA_LINE | `id` | `MpesaStatementLine` |
| EVIDENCE | `id` | `EvidenceSnapshot` |
| MAINTENANCE | `id` | `MaintenanceRequest` |

---

## Foreign keys (all tables)

| Child table | FK column | → Parent table | Nullable | Type |
|-------------|-----------|----------------|----------|------|
| USER | `manager_id` | USER | Yes | self-ref |
| ORGANIZATION | `owner_id` | USER | No | OneToOne |
| ORG_MEMBER | `organization_id` | ORGANIZATION | No | ManyToOne |
| ORG_MEMBER | `user_id` | USER | No | OneToOne |
| MPESA_CONFIG | `organization_id` | ORGANIZATION | No | OneToOne |
| TENANT_INVITE | `organization_id` | ORGANIZATION | No | ManyToOne |
| TENANT_INVITE | `unit_id` | UNIT | Yes | ManyToOne |
| TENANT_INVITE | `invited_by_id` | USER | Yes | ManyToOne |
| STAFF_INVITE | `organization_id` | ORGANIZATION | No | ManyToOne |
| STAFF_INVITE | `invited_by_id` | USER | Yes | ManyToOne |
| ACTIVITY_LOG | `organization_id` | ORGANIZATION | No | ManyToOne |
| ACTIVITY_LOG | `user_id` | USER | Yes | ManyToOne |
| OWNER_ALERT | `organization_id` | ORGANIZATION | No | ManyToOne |
| OWNER_ALERT | `triggered_by_id` | USER | Yes | ManyToOne |
| PROPERTY | `manager_id` | USER | No | ManyToOne |
| UNIT_CATEGORY | `property_ref_id` | PROPERTY | No | ManyToOne |
| UNIT | `property_id` | PROPERTY | No | ManyToOne |
| UNIT | `category_id` | UNIT_CATEGORY | Yes | ManyToOne |
| TENANT_PROFILE | `user_id` | USER | No | OneToOne |
| TENANT_PROFILE | `current_unit_id` | UNIT | Yes | ManyToOne |
| LEASE | `tenant_id` | TENANT_PROFILE | No | ManyToOne |
| LEASE | `unit_id` | UNIT | No | ManyToOne |
| TRANSFER_REQUEST | `tenant_id` | TENANT_PROFILE | No | ManyToOne |
| TRANSFER_REQUEST | `current_lease_id` | LEASE | No | ManyToOne |
| TRANSFER_REQUEST | `desired_category_id` | UNIT_CATEGORY | No | ManyToOne |
| TRANSFER_REQUEST | `preferred_unit_id` | UNIT | Yes | ManyToOne |
| TRANSFER_REQUEST | `assigned_unit_id` | UNIT | Yes | ManyToOne |
| TRANSFER_REQUEST | `reviewed_by_id` | USER | Yes | ManyToOne |
| PAYMENT | `tenant_id` | TENANT_PROFILE | No | ManyToOne |
| PAYMENT | `lease_id` | LEASE | No | ManyToOne |
| INVOICE | `lease_id` | LEASE | No | ManyToOne |
| CASH_COLLECTION | `lease_id` | LEASE | No | ManyToOne |
| CASH_COLLECTION | `recorded_by_id` | USER | Yes | ManyToOne |
| CASH_COLLECTION | `reviewed_by_id` | USER | Yes | ManyToOne |
| CASH_COLLECTION | `linked_payment_id` | PAYMENT | Yes | OneToOne |
| UTILITY_CHARGE | `lease_id` | LEASE | No | ManyToOne |
| PAYMENT_REMINDER | `lease_id` | LEASE | No | ManyToOne |
| MPESA_IMPORT | `organization_id` | ORGANIZATION | No | ManyToOne |
| MPESA_IMPORT | `uploaded_by_id` | USER | Yes | ManyToOne |
| MPESA_LINE | `statement_import_id` | MPESA_IMPORT | No | ManyToOne |
| MPESA_LINE | `matched_payment_id` | PAYMENT | Yes | ManyToOne |
| EVIDENCE | `tenant_id` | TENANT_PROFILE | No | ManyToOne |
| EVIDENCE | `created_by_id` | USER | Yes | ManyToOne |
| MAINTENANCE | `tenant_id` | TENANT_PROFILE | No | ManyToOne |
| MAINTENANCE | `unit_id` | UNIT | No | ManyToOne |

**Total: 23 PKs · 44 FKs**

---

## Core tables (PK + FK only)

```mermaid
erDiagram
    USER {
        int id PK
        int manager_id FK_USER
    }
    ORGANIZATION {
        int id PK
        int owner_id FK_USER_UQ
    }
    PROPERTY {
        int id PK
        int manager_id FK_USER
    }
    UNIT {
        int id PK
        int property_id FK_PROPERTY
        int category_id FK_UNIT_CATEGORY_NULL
    }
    TENANT_PROFILE {
        int id PK
        int user_id FK_USER_UQ
        int current_unit_id FK_UNIT_NULL
    }
    LEASE {
        int id PK
        int tenant_id FK_TENANT_PROFILE
        int unit_id FK_UNIT
    }
    PAYMENT {
        int id PK
        int tenant_id FK_TENANT_PROFILE
        int lease_id FK_LEASE
    }

  USER ||--o| ORGANIZATION : owner_id
  USER ||--o{ PROPERTY : manager_id
  PROPERTY ||--o{ UNIT : property_id
  USER ||--o| TENANT_PROFILE : user_id
  TENANT_PROFILE ||--o{ LEASE : tenant_id
  UNIT ||--o{ LEASE : unit_id
  LEASE ||--o{ PAYMENT : lease_id
```
