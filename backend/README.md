# Propizy Backend

Django REST API for Propizy: authentication, multi-tenant property management, M-PESA payments, maintenance, and governance.

## Stack

- Django 5 / Django REST Framework
- SimpleJWT
- PostgreSQL 16
- Celery + Redis (async email, SMS, PDF work)
- Gunicorn (container)
- Optional Cloudinary media storage

## Apps

| App | Responsibility |
|-----|----------------|
| `users` | Auth, orgs, invites, RBAC, governance |
| `properties` | Properties, units, leases, categories, transfers |
| `payments` | Invoices, M-PESA, cash collections, reconciliation |
| `maintenance` | Tenant maintenance requests |

## Prerequisites

- Docker Compose (recommended), or Python 3.12+ with PostgreSQL
- Copy env: `cp .env.example .env`

## Run with Docker

From the repository root:

```bash
docker compose up --build
```

API: **http://localhost:8002**  
Admin: **http://localhost:8002/admin/**

### Demo seed

```bash
docker compose exec backend python manage.py seed_demo
```

See the [root README](../README.md) for demo usernames and passwords.

## Run locally

```bash
# Use Compose Postgres (port 5435) or your own instance
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

With `CELERY_BROKER_URL` unset, Celery tasks run synchronously (no Redis required for basic local use).

## Tests

```bash
python manage.py test
# Includes users/security_tests.py (IDOR / isolation checks)
```

With Compose:

```bash
docker compose exec backend python manage.py test
```

## Configuration

See [`.env.example`](.env.example) for database, M-PESA, email, Cloudinary, and CORS settings. High-level setup is documented in the [root README](../README.md).

## Related docs

- [Architecture](../docs/ARCHITECTURE.md)
- [Root README](../README.md)
