# Propizy

Kenya-first multi-tenant property management platform. Owners and staff manage portfolios from a web dashboard; tenants pay rent and raise maintenance requests from a mobile app. Rent collection uses M-PESA STK Push, with invite-only onboarding and organization-scoped access control.

## Overview

| Layer | Stack |
|-------|-------|
| Backend | Django 5, Django REST Framework, SimpleJWT, Celery, PostgreSQL 16 |
| Web dashboard | React 19, Vite, Tailwind CSS 4, Recharts |
| Mobile app | React Native, Expo 56 (tenants) |
| Payments | M-PESA Daraja STK Push (simulation mode without credentials) |


## Features

- **Rent collection** - M-PESA STK Push, cash approval workflow, PDF invoices and receipts
- **Multi-tenancy** - organizations with owner/staff roles, plan limits, and invite-only tenants
- **Governance** - permission matrix, activity audit log, payment integrity checks, evidence packs
- **Reconciliation** - CSV statement import, orphan detection, per-org Paybill/Till config
- **Reporting** - live collection rates, owner statements, weekly digests, eTIMS/tax CSV export
- **Tenant services** - leases, balances, arrears reminders (SMS/WhatsApp), unit transfers, maintenance

## Quick start

### 1. Backend + database (Docker)

```bash
cp backend/.env.example backend/.env
docker compose up --build
```

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

1. Register a property owner on the web dashboard 
2. Add properties and units.
3. Invite tenants by email; they register on the mobile app via the invite link.
4. Invite staff from the Team page when you need caretakers with limited access.



