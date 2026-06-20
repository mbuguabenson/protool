# Migration Status — Deriv API Options v1

**Last Updated:** 2026-06-05  
**Migration Target:** Deriv API Options v1 (REST + OTP WebSocket)  
**Reference:** https://developers.deriv.com/docs/

---

## Summary

| Category   | Total | Done | In Progress | Pending |
| ---------- | ----- | ---- | ----------- | ------- |
| Endpoints  | 12    | 12   | 0           | 0       |
| Auth Flow  | 4     | 4    | 0           | 0       |
| REST Paths | 6     | 6    | 0           | 0       |
| Packages   | 5     | 5    | 0           | 0       |
| Docs       | 2     | 2    | 0           | 0       |

---

## Detailed Status

### ✅ WebSocket Endpoints

| File                                       | Old URL                              | New URL                                                       | Status  |
| ------------------------------------------ | ------------------------------------ | ------------------------------------------------------------- | ------- |
| `lib/deriv-config.ts` — `WEBSOCKET`        | `wss://ws.derivws.com/websockets/v3` | `wss://api.derivws.com/trading/v1/options/ws/public`          | ✅ Done |
| `lib/deriv-config.ts` — `WEBSOCKET_PUBLIC` | _(new field)_                        | `wss://api.derivws.com/trading/v1/options/ws/public?app_id=…` | ✅ Done |
| `lib/deriv-config.ts` — `WEBSOCKET_DEMO`   | _(new field)_                        | `wss://api.derivws.com/trading/v1/options/ws/demo?app_id=…`   | ✅ Done |
| `lib/deriv-config.ts` — `WEBSOCKET_REAL`   | _(new field)_                        | `wss://api.derivws.com/trading/v1/options/ws/real?app_id=…`   | ✅ Done |
| `lib/trading/config.ts` — `WS_URL`         | `wss://ws.derivws.com/websockets/v3` | `wss://api.derivws.com/trading/v1/options/ws/public`          | ✅ Done |
| `components/tabs/Slider.tsx` — `API_URL`   | Legacy endpoint                      | `wss://api.derivws.com/trading/v1/options/ws/public?app_id=…` | ✅ Done |

### ✅ REST Endpoints

| File                                        | Path                                              | Status  |
| ------------------------------------------- | ------------------------------------------------- | ------- |
| `lib/deriv-config.ts` — `REST_BASE`         | `https://api.derivws.com`                         | ✅ Done |
| `lib/deriv-websocket-manager.ts` — accounts | `/trading/v1/options/accounts`                    | ✅ Done |
| `lib/deriv-websocket-manager.ts` — OTP      | `/trading/v1/options/accounts/{id}/otp`           | ✅ Done |
| `lib/deriv-rest-client.ts` — accounts       | `/trading/v1/options/accounts`                    | ✅ Done |
| `lib/deriv-rest-client.ts` — OTP            | `/trading/v1/options/accounts/{id}/otp`           | ✅ Done |
| `lib/deriv-otp-handler.ts` — OTP            | Fixed double-path bug; uses `DERIV_API.REST_BASE` | ✅ Done |

### ✅ OAuth Endpoints

| Field                               | URL                                        | Status  |
| ----------------------------------- | ------------------------------------------ | ------- |
| `DERIV_API.OAUTH`                   | `https://oauth.deriv.com/oauth2/authorize` | ✅ Done |
| `DERIV_API.TOKEN`                   | `https://oauth.deriv.com/oauth2/token`     | ✅ Done |
| `app/api/auth/deriv-token/route.ts` | Uses `DERIV_API.TOKEN`                     | ✅ Done |
| `hooks/use-deriv-auth.ts` — PKCE    | Uses `https://auth.deriv.com/oauth2/auth`  | ✅ Done |

### ✅ Authentication Flow

| Step                                 | Implementation                                     | Status  |
| ------------------------------------ | -------------------------------------------------- | ------- |
| PKCE Code Verifier generation        | `hooks/use-deriv-auth.ts`                          | ✅ Done |
| OAuth2 Authorization redirect        | `hooks/use-deriv-auth.ts`                          | ✅ Done |
| Token Exchange (code → access_token) | `app/api/auth/deriv-token/route.ts`                | ✅ Done |
| Accounts fetch via REST              | `lib/deriv-websocket-manager.ts`                   | ✅ Done |
| OTP URL fetch via REST               | `lib/deriv-websocket-manager.ts`                   | ✅ Done |
| OTP WebSocket connection             | `lib/deriv-websocket-manager.ts`                   | ✅ Done |
| OTP Reconnect w/ fresh token         | `lib/deriv-websocket-manager.ts` (handleReconnect) | ✅ Done |

### ✅ Packages

| Package             | Version   | Added             | Status       |
| ------------------- | --------- | ----------------- | ------------ |
| `ws`                | `^8.17.0` | `dependencies`    | ✅ Installed |
| `node-fetch`        | `^3.3.2`  | `dependencies`    | ✅ Installed |
| `@types/ws`         | `^8.5.10` | `devDependencies` | ✅ Installed |
| `@types/node-fetch` | `^2.6.11` | `devDependencies` | ✅ Installed |
| `ts-node`           | `^10.9.2` | `devDependencies` | ✅ Installed |

### ✅ Documentation

| Document                   | Status     |
| -------------------------- | ---------- |
| `MIGRATION.md` (root)      | ✅ Created |
| `docs/migration-status.md` | ✅ Created |

---

## ⚠️ Known Issues

### `better-sqlite3` Native Compilation Failure

- **Error:** `gyp ERR! find VS` — Visual Studio C++ build tools not found
- **Impact:** `npm install` fails when `--ignore-scripts` is not used
- **Workaround:** Use `npm install --ignore-scripts` (already applied)
- **Long-term fix:** Install VS Build Tools, or replace `better-sqlite3` with `sql.js` (pure JS)

### Node.js v26 — Unsupported by `better-sqlite3`

- `better-sqlite3@12.6.2` only supports Node 20.x–25.x
- Current runtime: Node v26.1.0
- **Recommendation:** Downgrade to Node 22 LTS for full compatibility

---

## Removed (No Longer Applicable)

The following external URLs were removed from the codebase as they are not part of our API integration:

- `https://app.deriv.com` (DTrader)
- `https://app.deriv.com/bot` (DBot)
- `https://smarttrader.deriv.com` (SmartTrader)
- `https://app.deriv.com/copy-trading` (Copy Trading)

These iFrame-based embeddings were replaced by direct API integration using the v2 WebSocket + REST architecture.
