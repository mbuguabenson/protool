# Deriv New API Migration Guide and Plan

## Overview

This document provides a comprehensive guide and step-by-step plan for migrating the ExpertTrader project from Deriv's Legacy API (v3) to the New API.

---

## Table of Contents

1. [Migration Plan](#migration-plan)
2. [Key Changes Breakdown](#key-changes-breakdown)
3. [Step-by-Step Implementation Guide](#step-by-step-implementation-guide)
4. [File Reference](#file-reference)
5. [Testing Checklist](#testing-checklist)

---

## Migration Plan

### Phase 1: Preparation and Dependencies

- [ ] **Review Deriv API Documentation** - Visit https://developers.deriv.com/comparison/ for detailed changes
- [ ] **Update Dependencies**
    - Upgrade `@deriv/deriv-api` to a version compatible with New API
    - Upgrade `@deriv/api-types` to New API type definitions
- [ ] **Set Up Testing Environment** - Create a dedicated test environment for New API changes
- [ ] **Backup Current Code** - Ensure code is backed up before making major changes

### Phase 2: Core Infrastructure Updates

- [ ] **Update WebSocket Connection URL**
    - Change from `/websockets/v3` to Deriv's New API WebSocket endpoint
    - Update `src/external/bot-skeleton/services/api/appId.js`
- [ ] **Review OAuth Flow** - Verify current OAuth implementation is compatible with New API
- [ ] **Update Type Definitions** - Replace Legacy API types with New API types in `src/types/api-types.ts`

### Phase 3: Endpoint Migrations (Critical First)

Migrate endpoints in order of criticality:

1. **Trading Endpoints** (most critical)
    - [ ] `proposal` - Update symbol → underlying_symbol, parameter changes
    - [ ] `buy` - Remove loginid parameter
    - [ ] `sell` - Remove loginid parameter, add price validation
    - [ ] `cancel` - Remove loginid parameter
    - [ ] `proposal_open_contract` - Remove loginid, update field types
    - [ ] `contract_update` - Remove loginid, add new `display_order_amount` field
2. **Account Endpoints**
    - [ ] `balance` - Update for removed multi-account support
    - [ ] `portfolio` - Update symbol → underlying_symbol, remove loginid
    - [ ] `profit_table` - Remove loginid
    - [ ] `statement` - Remove loginid and transfer fields
    - [ ] `transaction` - Remove multiple fields, update symbol → underlying_symbol
3. **Data Endpoints**
    - [ ] `active_symbols` - Handle renamed fields, removed filtering
    - [ ] `contracts_for` - Remove currency parameter, simplify market data
    - [ ] `ticks` - Update required fields, extended subscribe parameter
    - [ ] `ticks_history` - Update required fields, relaxed validation
4. **Subscription Endpoints**
    - [ ] `forget` - Relaxed stream ID validation
    - [ ] `forget_all` - Removed stream type enum validation

### Phase 4: Testing and Validation

- [ ] **Unit Tests** - Update tests for New API changes
- [ ] **Integration Tests** - Test full trading flow on New API
- [ ] **User Acceptance Testing** - Verify all features work as expected
- [ ] **Performance Testing** - Ensure New API integration performs as well as Legacy API

### Phase 5: Deployment

- [ ] **Staging Deployment** - Deploy changes to staging environment
- [ ] **Production Deployment** - Deploy to production
- [ ] **Post-Deployment Monitoring** - Monitor logs and errors after deployment

---

## Key Changes Breakdown

### Most Critical Changes

1. **Field Renaming**: `symbol` → `underlying_symbol` (applies to many endpoints, especially `proposal`)
2. **Removed Parameter**: `loginid` removed from almost all endpoints
3. **Response Changes**: Many fields now required, numeric types changed to `string | number` in some cases
4. **WebSocket Endpoint**: New endpoint replaces `/websockets/v3`

---

## Step-by-Step Implementation Guide

### Step 1: Update Dependencies

Update `package.json` with the latest compatible versions:

```json
{
    "dependencies": {
        "@deriv/deriv-api": "^[NEW_API_COMPATIBLE_VERSION]",
        "@deriv/api-types": "^[NEW_API_COMPATIBLE_VERSION]"
    }
}
```

Then run:

```powershell
npm install
```

### Step 2: Update WebSocket Connection URL

File to modify: `src/external/bot-skeleton/services/api/appId.js`

```javascript
// Original (Legacy API)
const socket_url = `wss://${cleanedServer}/websockets/v3?app_id=${cleanedAppId}&l=${getInitialLanguage()}&brand=${website_name.toLowerCase()}`;

// Updated (New API - replace with actual New API endpoint)
const socket_url = `wss://${cleanedServer}/[NEW_API_WEBSOCKET_ENDPOINT]?app_id=${cleanedAppId}&l=${getInitialLanguage()}&brand=${website_name.toLowerCase()}`;
```

### Step 3: Update Type Definitions

File to modify: `src/types/api-types.ts`

- Replace Legacy API imports with New API types from updated `@deriv/api-types`
- Update all type references throughout the project

### Step 4: Migrate `proposal` Endpoint

File to modify: `src/external/bot-skeleton/services/tradeEngine/trade/Proposal.js`

- Replace all instances of `symbol` with `underlying_symbol` in proposal requests
- Update response parsing to match New API structure

### Step 5: Remove `loginid` Parameter

Search the entire project for `loginid` parameter in API requests and remove it from all endpoints (check: `buy`, `sell`, `cancel`, `portfolio`, `profit_table`, `statement`, `transaction`, `proposal_open_contract`, `contract_update`)

### Step 6: Update Response Handling

For each endpoint you migrate:

1. Review New API response structure in Deriv documentation
2. Update response parsing in your code
3. Ensure all required fields are handled

---

## File Reference

### Files to Review/Update

| File Path                                                             | Purpose                             |
| --------------------------------------------------------------------- | ----------------------------------- |
| `src/external/bot-skeleton/services/api/appId.js`                     | WebSocket connection setup          |
| `src/external/bot-skeleton/services/tradeEngine/trade/Proposal.js`    | Proposal requests and handling      |
| `src/external/bot-skeleton/services/tradeEngine/trade/Purchase.js`    | Buy/sell requests                   |
| `src/external/bot-skeleton/services/tradeEngine/trade/Sell.js`        | Sell requests                       |
| `src/external/bot-skeleton/services/api/ticks_service.js`             | Tick stream handling                |
| `src/types/api-types.ts`                                              | API type definitions                |
| `src/components/layout/header/header.tsx`                             | UI components that may use API data |
| `api/oauth/start.js`, `api/oauth/callback.js`, `api/oauth/session.js` | OAuth implementation                |

---

## Testing Checklist

### Before Deployment

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Manual testing of all trading features
- [ ] Manual testing of account features
- [ ] Manual testing of OAuth flow
- [ ] Performance testing confirms acceptable latency

### After Deployment

- [ ] Monitor error logs for New API-related issues
- [ ] Verify all features are working in production
- [ ] Check user feedback for any issues

---

## Resources

- Deriv API Comparison: https://developers.deriv.com/comparison/
- Deriv API Documentation: https://developers.deriv.com/
