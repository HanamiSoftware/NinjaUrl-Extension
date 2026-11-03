# NinjaAuth integration — NinjaURL Chrome Extension

**Reviewed:** 3 November 2026  
**Project milestone:** NinjaAuth v1.0.1-beta (internal milestone name; not a published package release).

## Responsibility boundaries

- **Ninja Connect** owns shared identity, authentication, and the server-side session lifecycle.
- **NinjaAuth SDK** owns client-side Authorization Code + PKCE, session lookup, and logout.
- **Background Service Worker** initializes the SDK, coordinates the authentication flow, and adapts results to Chrome runtime messages.
- **Side Panel** displays account state and product UI. It must not implement OAuth or call the Auth Worker session endpoints directly.
- **NinjaURL Worker** owns NinjaURL application APIs, product data, and capabilities.

The browser session is represented by an HttpOnly cookie. The Extension must not read or persist the raw session secret.

## Packaging and initialization

The Manifest V3 Background Service Worker is a classic worker. It loads the vendored SDK bundle using:

~~~js
importScripts("../libs/ninja-auth.iife.js");
~~~

The Background initializes NinjaAuth with:

- the registered NinjaURL Extension client ID;
- chrome.identity.getRedirectURL("auth") as redirect URI;
- platform extension;
- environment development in the reviewed branch.

The local Ninja Connect Auth Worker endpoint is http://127.0.0.1:8787/v1. The production SDK endpoint is https://auth.ninjaconnect.io/v1. The Extension build and environment configuration must be verified before release.

## Runtime message contract

The Side Panel sends RESTORE_SESSION to the Background. The Background returns a response envelope with:

- success;
- authenticated;
- user;
- session;
- data, containing the normalized NinjaSession result.

LOGIN and LOGOUT also return normalized session data through data. The Side Panel renders the returned state; it does not infer authentication from a cached API key or implement its own OAuth flow.

## Session restoration

### Current master behavior

The NinjaAuth integration is present on Extension master at commit 9606469a3f6412c5d47c9ee83c38b359499e1e8d. In this version, restoreSession() calls NinjaAuth getSession() and persists a valid authenticated user.

### Cache-first behavior on dev

The remote dev branch is two commits ahead of master as reviewed on 3 November 2026. Its Background restoreSession() first reads user from chrome.storage.local.

1. If a cached user exists, return an immediate UI snapshot with authenticated true, the cached user, and session null.
2. Do not call NinjaAuth getSession() or GET /v1/session on that cache hit.
3. If no cached user exists, call NinjaAuth getSession().
4. Save the user only when NinjaAuth returns an authenticated session with a user.
5. If the live lookup fails temporarily, propagate the error and preserve the cached user.

The Side Panel uses RESTORE_SESSION and consumes data. It does not need a separate GET_USER round trip for the cache-first path.

### Security meaning of session null

A cached user is presentation state, not proof of a valid server session.

- authenticated true in a cache-only response means a user profile was found locally and the UI can be restored.
- session null means the server session was not checked in that call.
- A protected operation must call NinjaAuth getSession() and require a valid authenticated result before relying on the session.
- A network or Worker failure must remain an error; it must not be converted into an anonymous result or silently treated as a verified session.

The live-session check before protected operations is a required follow-up and must be tested before the cache-first path is promoted to master.

## Current branch state

| Repository branch | State |
|---|---|
| master | NinjaAuth integration is present; restoreSession() still calls getSession() on every restore |
| dev | Two commits ahead of master; contains the cache-first restoreSession() implementation |
| feature/typescript-migration-(v7) | Separate TypeScript migration work |

The old feature/NinjaAuth-Integration branch is not present in the current remote branch listing. Do not use that name as the current integration branch.

## Verification still required

- Build the Extension and inspect the packaged MV3 Background and vendored IIFE.
- Load the Extension in Chrome and verify login, session restore, logout, and login again.
- Verify cookie creation, persistence, transmission, and clearing.
- Verify the actual Extension origin against the Auth Worker CORS allowlist.
- Verify temporary session lookup failures preserve cached user data.
- Verify a cache hit makes no /v1/session request.
- Verify a protected operation forces a live NinjaAuth session check when the cached result contains session null.
- Confirm the vendored IIFE is generated from the intended SDK source/build and matches the package version and default scope.

No Extension build, Chrome E2E, or live cookie/CORS verification is claimed by this document.
