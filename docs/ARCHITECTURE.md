# Propizy Architecture

Propizy is a **modular monolith**: one deployable backend and separate client apps (web dashboard, mobile tenant app). It is not microservices today, but domains are separated into Django apps with clear boundaries so services can be extracted later if needed.

## System overview

```
┌─────────────────┐     JWT (Bearer)      ┌──────────────────────────────┐
│  Web Dashboard  │ ◄──────────────────► │  Django REST API (monolith)   │
│  React + Vite   │                       │  users · properties · payments│
└─────────────────┘                       │  · maintenance                │
┌─────────────────┐                       └──────────────┬───────────────┘
│  Mobile (Expo)  │ ◄──────────────────────────────────┘
│  Tenants only   │                                      │
└─────────────────┘                                      ▼
                                              ┌──────────────────────┐
                                              │  PostgreSQL          │
                                              │  (shared database)   │
                                              └──────────────────────┘
```

## Backend — layered architecture

Each Django app follows a **Model → Serializer → View/ViewSet → URL** flow (Django REST Framework variant of MVC):

| Layer | Responsibility | Example |
|-------|----------------|---------|
| **Models** | Data schema, constraints, indexes | `payments/models.py` |
| **Serializers** | Input validation, output shaping | `users/serializers.py` |
| **Views / ViewSets** | HTTP handling, permissions, orchestration | `payments/views.py` |
| **Services** | Domain logic reused across views | `payments/services.py`, `properties/services.py` |
| **Permissions** | AuthZ rules | `users/permissions.py` |
| **Tenancy** | Org-scoped query helpers | `users/tenancy.py`, `users/utils.get_pm_id()` |

### Multi-tenancy

Organizations are isolated by `property_manager_id` (UUID). All manager/staff querysets filter through relationship chains (e.g. `unit__property__manager__property_manager_id`). Cross-tenant access is blocked by permission classes and tested in `users/security_tests.py`.

### Scalability

- **Pagination**: global DRF `PageNumberPagination` (50 items/page)
- **Query optimization**: `select_related` / `prefetch_related` on list endpoints
- **Database constraints**: unique indexes on payments per lease/month, checkout IDs
- **Rate limiting**: auth and phone verification throttles (`users/throttling.py`)
- **Horizontal scaling path**: stateless API + PostgreSQL; JWT avoids server-side sessions

Future growth: Redis cache, read replicas, Celery for SMS/PDF jobs, extract payments webhook to a dedicated worker.

### Security

| Control | Implementation |
|---------|----------------|
| Authentication | JWT (SimpleJWT), 12h access / 7d refresh |
| Authorization | Role (MANAGER/TENANT) + org role (OWNER/STAFF) + object permissions |
| Input validation | DRF serializers + Django password validators |
| Secrets | `.env` via python-dotenv; `SECRET_KEY` required when `DEBUG=False` |
| M-PESA STK | Per-organization Daraja credentials (encrypted); resolved from tenant lease → org |
| M-PESA callback | Shared platform URL; match by `checkout_request_id`; optional `MPESA_CALLBACK_SECRET` header; amount verification; `select_for_update` |
| CORS | Explicit allowlist only (`CORS_ALLOW_ALL_ORIGINS=False`) |
| IDOR tests | `users/security_tests.py` |

## Frontend — component architecture

```
src/
├── api/client.js          # Axios instance, token refresh
├── utils/                 # authStorage, apiHelpers, apiError
├── context/               # Auth, Feedback (toasts, confirm)
├── hooks/                 # useIsOwner, useFocusTrap
├── constants/             # Shared labels and config
├── components/            # Layout, AuthLayout, ProtectedRoute, UI
└── pages/                 # Route-level screens (feature modules)
```

### Separation of concerns

- **Routes & guards**: `App.jsx` + `components/ProtectedRoute.jsx` (MANAGER, OWNER, guest)
- **Session**: `context/AuthContext.jsx` validates JWT via `GET /api/auth/me/` on load
- **Feedback**: `context/FeedbackContext.jsx` (toasts, confirm dialogs)
- **API**: Central client with interceptors; pages call endpoints directly (service layer optional next step)

### Client security

- Tokens in `localStorage` (SPA standard); centralized in `utils/authStorage.js`
- React escapes rendered text (no `dangerouslySetInnerHTML`)
- Owner-only routes guarded in UI; backend enforces RBAC on every write

## Coding standards

- **Python**: PEP 8, serializers for all write paths, permissions on every view
- **JavaScript**: ES modules, shared CSS design tokens in `index.css`
- **Commits**: focused changes per domain (auth, payments, UI)
- **Tests**: `python manage.py test` — include `users/security_tests.py` in CI

## Key endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /api/auth/register/` | Create organization + owner |
| `POST /api/auth/login/` | Issue JWT |
| `GET /api/auth/me/` | Validate session / refresh user profile |
| `POST /api/payments/initiate/` | M-PESA STK Push |
| `POST /api/payments/mpesa-callback/` | Payment webhook (Safaricom) |

See [README.md](../README.md) for the full API list and setup instructions.
