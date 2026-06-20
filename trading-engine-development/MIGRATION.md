# Deriv API Migration Guide — Standard v3 → Options v1

> **Reference:** [Deriv Developer Documentation](https://developers.deriv.com/docs/)

---

## Overview

This document tracks the migration of the `analysisprofithub` project from the standard legacy Deriv WebSocket API (v3) to the official **Deriv Options API (v1)** (REST + OTP-authenticated WebSocket) architecture.

---

## What Changed in the Migration

### 1. WebSocket Endpoints

| Type   | Legacy (Standard v3)                          | Migrated (Options v1)                                           |
| ------ | --------------------------------------------- | --------------------------------------------------------------- |
| Public | `wss://ws.derivws.com/websockets/v3?app_id=…` | `wss://api.derivws.com/trading/v1/options/ws/public?app_id=…`   |
| Demo   | `wss://ws.derivws.com/websockets/v3?app_id=…` | `wss://api.derivws.com/trading/v1/options/ws/demo` _(OTP auth)_ |
| Real   | `wss://ws.derivws.com/websockets/v3?app_id=…` | `wss://api.derivws.com/trading/v1/options/ws/real` _(OTP auth)_ |

### 2. Authentication Flow

**Legacy:** Direct WebSocket `{ authorize: "<api_token>" }` over a single `websockets/v3` endpoint.

**New Flow (Options v1):**

1. Obtain an OAuth2 access token via PKCE flow at `https://oauth.deriv.com/oauth2/authorize`
2. Exchange code for token at `https://oauth.deriv.com/oauth2/token`
3. Call REST `GET /trading/v1/options/accounts` on `https://api.derivws.com` to list accounts
4. Call REST `POST /trading/v1/options/accounts/{accountId}/otp` to get a one-time WebSocket URL
5. Connect WebSocket directly to the OTP URL (no additional `authorize` message needed)

### 3. REST Base URL

|           | Legacy                   | New (Options v1)          |
| --------- | ------------------------ | ------------------------- |
| REST Base | `https://api.deriv.com/` | `https://api.derivws.com` |

### 4. OAuth Endpoints

| Endpoint       | URL                                        |
| -------------- | ------------------------------------------ |
| Authorization  | `https://oauth.deriv.com/oauth2/authorize` |
| Token Exchange | `https://oauth.deriv.com/oauth2/token`     |

---

## Files Migrated

### Core Configuration

#### `lib/deriv-config.ts`

- **BEFORE:** Referenced `wss://ws.derivws.com/websockets/v3` (legacy)
- **AFTER:** All endpoints updated to Options v1:
    ```ts
    WEBSOCKET: 'wss://api.derivws.com/trading/v1/options/ws/public';
    WEBSOCKET_PUBLIC: `wss://api.derivws.com/trading/v1/options/ws/public?app_id=${DERIV_APP_ID}`;
    WEBSOCKET_DEMO: `wss://api.derivws.com/trading/v1/options/ws/demo?app_id=${DERIV_APP_ID}`;
    WEBSOCKET_REAL: `wss://api.derivws.com/trading/v1/options/ws/real?app_id=${DERIV_APP_ID}`;
    REST_BASE: 'https://api.derivws.com';
    OAUTH: 'https://oauth.deriv.com/oauth2/authorize';
    TOKEN: 'https://oauth.deriv.com/oauth2/token';
    ```

#### `lib/trading/config.ts`

- `WS_URL` default updated to `wss://api.derivws.com/trading/v1/options/ws/public`

### Auth & OTP

#### `lib/deriv-otp-handler.ts`

- Fixed hardcoded URL double-path bug: was using a duplicate path structure, now uses `${DERIV_API.REST_BASE}/trading/v1/...`
- Added `DERIV_API` to imports

#### `lib/deriv-websocket-manager.ts`

- Uses `DERIV_API.REST_BASE` for all REST calls (`/trading/v1/options/accounts`, OTP endpoint)
- OTP reconnect flow implemented with exponential backoff `[500, 1000, 2000, 4000, 8000]ms`
- `DERIV_API.WEBSOCKET` alias resolves to Options v1 public endpoint

### WebSocket Managers

#### `lib/chart-websocket-manager.ts`

- Uses `DERIV_API.WEBSOCKET` (now Options v1 public endpoint)

#### `lib/deriv-rest-client.ts`

- All REST calls use `DERIV_API.REST_BASE` (`https://api.derivws.com`)
- OTP path: `/trading/v1/options/accounts/{accountId}/otp`
- Accounts path: `/trading/v1/options/accounts`

### Auth Routes

#### `app/api/auth/deriv-token/route.ts`

- Token exchange URL uses `DERIV_API.TOKEN` (`https://oauth.deriv.com/oauth2/token`)

### UI Components

#### `components/tabs/Slider.tsx`

- `API_URL` updated to `wss://api.derivws.com/trading/v1/options/ws/public`

#### `components/tabs/smartauto24-tab.tsx`

- OAuth redirect uses `DERIV_API.OAUTH` (centralized config)

---

## Packages Added

| Package             | Version   | Purpose                                  |
| ------------------- | --------- | ---------------------------------------- |
| `ws`                | `^8.17.0` | WebSocket client for server-side scripts |
| `node-fetch`        | `^3.3.2`  | Fetch polyfill for Node.js scripts       |
| `@types/ws`         | `^8.5.10` | TypeScript types for ws                  |
| `@types/node-fetch` | `^2.6.11` | TypeScript types for node-fetch          |
| `ts-node`           | `^10.9.2` | TypeScript execution for scripts         |

---

## Known Issues / Remaining Work

| Issue                                       | Status        | Notes                                                                                     |
| ------------------------------------------- | ------------- | ----------------------------------------------------------------------------------------- |
| `better-sqlite3` native compile error       | ⚠️ Existing   | Requires Visual Studio C++ build tools on Windows. Does not affect runtime (Next.js app). |
| Node.js v26 unsupported by `better-sqlite3` | ⚠️ Existing   | Consider downgrading to Node 22 LTS or replacing with `sql.js`                            |
| OAuth `app_id` registration                 | ✅ Configured | App ID: `32KGABH3pjSMkQ6JTotTG`                                                           |

---

## Testing the Connection

Run the balance verification script (requires `DERIV_API_TOKEN` in `.env.local`):

```bash
npx ts-node scripts/deriv_balance_test.ts
```

Expected output:

```
✅ Connected to wss://api.derivws.com/trading/v1/options/ws/public...
✅ Accounts fetched: [{ account_id: "DOT...", account_type: "demo", balance: "..." }]
✅ OTP URL received
✅ WebSocket authenticated via OTP
✅ Balance: { currency: "USD", balance: "10000.00" }
```

---

## References

- [Deriv Developer Portal](https://developers.deriv.com/docs/)
- [Deriv Options API Guide](https://developers.deriv.com/docs/options-basics/)
- [Deriv OAuth2 PKCE Flow](https://developers.deriv.com/docs/oauth/)
- [GitHub: deriv-com/deriv-api](https://github.com/deriv-com/deriv-api)
