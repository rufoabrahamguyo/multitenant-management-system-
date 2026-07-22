# Propizy

Kenya-first multi-tenant property management platform. Owners and staff manage portfolios from a web dashboard; tenants pay rent and raise maintenance requests from a mobile app. Rent collection uses M-PESA STK Push, with invite-only onboarding and organization-scoped access control.

## Overview

| Layer | Stack |
|-------|-------|
| Backend | Django 5, Django REST Framework, SimpleJWT, Celery, PostgreSQL 16 |
| Web dashboard | React 19, Vite, Tailwind CSS 4, Recharts |
| Mobile app | React Native, Expo 56 (tenants) |
| Payments | M-PESA Daraja STK Push (simulation mode without credentials) |

Architecture: a **modular monolith** (`users`, `properties`, `payments`, `maintenance`) with JWT auth and organization isolation. Design details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Features

- **Rent collection** — M-PESA STK Push, cash approval workflow, PDF invoices and receipts
- **Multi-tenancy** — organizations with owner/staff roles, plan limits, and invite-only tenants
- **Governance** — permission matrix, activity audit log, payment integrity checks, evidence packs
- **Reconciliation** — CSV statement import, orphan detection, per-org Paybill/Till config
- **Reporting** — live collection rates, owner statements, weekly digests, eTIMS/tax CSV export
- **Tenant services** — leases, balances, arrears reminders (SMS/WhatsApp), unit transfers, maintenance

## Repository layout

```
backend/     Django REST API
frontend/    Manager & staff web dashboard
mobile/      Tenant Expo app
docs/        Architecture, reports, diagrams
scripts/     Repo utilities (e.g. content policy checks)
```

## Quick start

### 1. Backend + database (Docker)

```bash
cp backend/.env.example backend/.env
docker compose up --build
```

| Service | URL / port |
|---------|------------|
| API | http://localhost:8002 |
| PostgreSQL | `localhost:5435` (`postgres` / `postgres` / `propizy`) |
| Redis | `localhost:6379` |

### 2. Web dashboard

```bash
cd frontend
cp .env.example .env   # points at http://localhost:8002/api
npm install
npm run dev
```

Dashboard: http://localhost:5173

### 3. Mobile app (tenants)

```bash
cd mobile
npm install --legacy-peer-deps
npx expo start -c
```

Uses **Expo SDK 54** so it opens in the Play Store / App Store **Expo Go** app. Set `EXPO_PUBLIC_API_URL=http://localhost:8002/api` in `mobile/.env` (Docker API port). On a phone the app rewrites `localhost` to your Expo LAN IP automatically.

### Local backend without Docker

Requires PostgreSQL and `backend/.env` with `DB_HOST=localhost` (and `DB_PORT=5435` if using Compose Postgres only).

```bash
cd backend
source ../venv/bin/activate   # or create a venv first
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

## First-time setup

1. Register a property owner on the web dashboard (`POST /api/auth/register/`).
2. Add properties and units.
3. Invite tenants by email; they register on the mobile app via the invite link.
4. Invite staff from the Team page when you need caretakers with limited access.

### Demo data

```bash
docker compose exec backend python manage.py seed_demo
# or: cd backend && python manage.py seed_demo
```

| Role | Username | Password |
|------|----------|----------|
| Owner (web) | `buke` | `Demo2026!` |
| Caretaker (web) | `rufina` | `Demo2026!` |
| Front Desk (web) | `jillo` | `Demo2026!` |
| Maintenance (web) | `guyo` | `Demo2026!` |
| Tenant (mobile) | `wanjiku` | `Demo2026!` |
| Tenant (mobile, arrears) | `kamau` | `Demo2026!` |

Re-run with `--flush` or `--force` to replace existing demo data. Demo emails use `@propizy.demo` and do not collide with real registrations.

## Tenant invite flow

1. Manager invites a tenant (email, phone, unit) — invite email is sent automatically when SMTP is configured.
2. Tenant opens the link → mobile app deep link (`propizy://` / invite URL).
3. Tenant registers → lease is created automatically.
4. Tenant pays rent via M-PESA (or simulation mode in development).

## Configuration

Copy [`backend/.env.example`](backend/.env.example) to `backend/.env`. Important variables:

| Variable | Purpose |
|----------|---------|
| `FRONTEND_URL` | Links in invite emails (default `http://localhost:5173`) |
| `MPESA_CALLBACK_URL` | Shared Safaricom STK callback URL |
| `MPESA_OPS_EMAIL` | Notify ops when owners request M-PESA setup |
| `EMAIL_*` | SMTP for invites (console fallback when unset) |
| `CLOUDINARY_*` | Optional media storage (else `backend/media/`) |
| `CELERY_BROKER_URL` | Async tasks; Compose sets Redis automatically |

**M-PESA:** owners request integration under **Governance → M-PESA**. The Propizy team completes setup in Django admin (`Mpesa integration requests`). Without a completed integration, payments run in simulation mode.

**Email:** with SMTP unset, invite emails print to the backend console.

## Testing

```bash
# Backend (Compose)
docker compose exec backend python manage.py test

# Backend (local)
cd backend && python manage.py test

# Frontend
cd frontend && npm test

# Mobile
cd mobile && npm test
```

## Documentation

| Document | Description |
|----------|-------------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, tenancy, security |
| [docs/reports/](docs/reports/) | Analysis & design reports |
| [docs/diagrams/](docs/diagrams/) | UML, DFD, and ER diagrams (diagrams.net) |
| [frontend/README.md](frontend/README.md) | Web dashboard |
| [backend/README.md](backend/README.md) | API service |
| [mobile/README.md](mobile/README.md) | Tenant app |

## Core API

| Endpoint | Description |
|----------|-------------|
| `POST /api/auth/register/` | Create organization + owner |
| `POST /api/auth/login/` | Issue JWT |
| `GET /api/auth/me/` | Current user / session check |
| `POST /api/auth/tenant-invites/` | Manager invites tenant |
| `POST /api/auth/staff-invites/` | Owner invites staff |
| `GET /api/auth/dashboard/` | Organization stats |
| `POST /api/payments/initiate/` | M-PESA STK Push |
| `POST /api/payments/mpesa-callback/` | Safaricom webhook |

Additional auth, governance, reconciliation, utilities, and transfer endpoints are implemented under `/api/`. See the Django apps in `backend/` and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
