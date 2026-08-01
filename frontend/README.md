# Propizy Web Dashboard

React dashboard for property owners and staff. Manage properties, tenants, payments, team access, and governance workflows against the Propizy REST API.

## Stack

- React 19 + Vite 8
- React Router 7
- Tailwind CSS 4
- Axios (JWT with refresh)
- Recharts
- Vitest

## Prerequisites

- Node.js 20+ recommended
- Backend API running (Docker Compose exposes **http://localhost:8002**)

## Setup

```bash
cp .env.example .env
npm install
npm run dev
```

App: http://localhost:5173

### Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:8002/api` (via `.env.example`) | REST API base URL |

If `VITE_API_URL` is unset, the client falls back to `http://localhost:8000/api` - set `.env` when using Compose port **8002**.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server with HMR |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build |
| `npm run lint` | ESLint |
| `npm test` | Vitest (single run) |
| `npm run test:watch` | Vitest watch mode |

## Project structure

```
src/
├── api/           Axios client and token refresh
├── components/    Layout, auth guards, shared UI
├── context/       Auth and feedback (toasts / confirm)
├── hooks/
├── pages/         Route-level screens
└── utils/
```

Owner-only routes are gated in the UI; the API enforces RBAC on every write.

## Related docs

- [Root README](../README.md) - full stack setup and demo accounts
- [Architecture](../docs/ARCHITECTURE.md) - frontend layout and security notes
