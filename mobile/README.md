# Propizy Mobile (Tenants)

Expo / React Native app for tenants: accept invites, view lease and balances, pay rent via M-PESA, and submit maintenance requests.

## Stack

- Expo SDK **54** (matches Play Store / App Store Expo Go)
- React Native 0.81 / React 19.1
- React Navigation (native stack + tabs)
- Axios + AsyncStorage (JWT)
- Jest + Testing Library

Docs: [Expo SDK 54](https://docs.expo.dev/versions/v54.0.0/).

## Prerequisites

- Node.js 20+ recommended
- **Expo Go for SDK 54** (Play Store / App Store version)
- Backend API reachable from the device (Compose: host port **8002**)

> SDK 56+ projects will not open in store Expo Go. This app targets SDK 54 on purpose.

## Setup

```bash
npm install --legacy-peer-deps
npx expo start -c
```

Scan the QR code with **Expo Go** on your phone (same Wi‑Fi as your Mac).

### API URL

`src/api/client.js` rewrites `localhost` → your Expo LAN IP so a physical phone can reach Docker on port **8002**.

```bash
cp .env.example .env
# optional override:
# EXPO_PUBLIC_API_URL=http://YOUR_LAN_IP:8002/api
```

Requirements:
- `docker compose up -d` (API on http://localhost:8002)
- Phone and Mac on the **same Wi‑Fi**
- Expo Go **SDK 54** (store build)

Demo tenants: `wanjiku` / `kamau` - password `Demo2026!`

Deep links use the `propizy://` scheme (see `app.json` / linking config).

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` / `npx expo start` | Dev server |
| `npm run ios` | Open iOS simulator |
| `npm run android` | Open Android emulator |
| `npm test` | Jest |

## Project structure

```
src/
├── api/           Axios client and token refresh
├── context/       Auth session
├── navigation/    Stack / tabs and linking
└── screens/       Tenant feature screens
```

## Related docs

- [Root README](../README.md) - stack setup, invites, demo accounts
- [Architecture](../docs/ARCHITECTURE.md)
