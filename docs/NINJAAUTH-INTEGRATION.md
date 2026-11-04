# NinjaAuth Integration — NinjaURL Extension (dev)

> Branch scope: `dev` only. The Extension dev branch is divergent from master; this document does not describe master.

## Responsibility split

- NinjaAuth owns OAuth Authorization Code + PKCE, code exchange, session lookup, and current-session logout.
- The Background Service Worker owns the SDK instance and initialization.
- The Background translates SDK results into Chrome runtime messages and owns the local UI cache.
- The Side Panel is a UI client; it does not implement OAuth or call Auth Worker session routes directly.

## Current Background integration

The dev Background loads the NinjaAuth class into its own JavaScript runtime, creates one instance with `new NinjaAuth()`, and initializes it once with:

- Extension client ID.
- `chrome.identity.getRedirectURL("auth")`.
- `platform: "extension"`.
- `environment: "development"`.

The same instance is used for login, session lookup, and logout.

### Login

1. Call SDK `login()`.
2. Call SDK `getSession()`.
3. Require an authenticated result and user.
4. Save the user profile in `chrome.storage.local`.
5. Notify the UI with `USER_UPDATED`.

### Restore

1. Read the cached user from `chrome.storage.local`.
2. If present, restore the UI immediately with `authenticated: true` and `session: null`; this cache-hit path does not call the server.
3. If absent, call SDK `getSession()`.
4. Cache the user only when the server returns an authenticated session.
5. Preserve and propagate operational errors rather than silently converting them into anonymous state.

A cache hit is presentation restoration only. It does not prove that the server session is still valid.

### Logout

1. Call SDK `logout()`.
2. Only after successful server confirmation, remove the cached user.
3. Notify the UI with the anonymous session.

If the SDK logout call fails, the current flow does not proceed to remove the cached user.

## Manual smoke checks reported by the project owner

On 4 November 2026, the project owner reported successful manual checks of:

- Login.
- Logout.
- Session recovery from the server.
- UI/session restoration from local storage.

These are owner-reported manual smoke checks, not automated test or CI evidence.

## Remaining integration checks

- [ ] Verify a cache hit makes no `/v1/session` request.
- [ ] Verify a cache miss performs `getSession()` and caches only an authenticated user.
- [ ] Verify a temporary server failure does not erase a cached user.
- [ ] Verify the cache-only result cannot authorize protected operations.
- [ ] Verify a live session check occurs before every protected operation.
- [ ] Verify cookie creation, retention, and clearing in Chrome.
- [ ] Verify credentialed CORS for the exact Extension origin.
- [ ] Verify Service Worker restart and session recovery.
- [ ] Verify login again after logout.

See the SDK [Test Plan](https://github.com/HanamiSoftware/NinjaAuth-SDK/blob/dev/docs/TEST-PLAN.md) for the full integration matrix.
