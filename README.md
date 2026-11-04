# NinjaURL — Smart NinjaLinks for Builders

## Stop using dumb links

NinjaURL turns ordinary URLs into short, programmable links, with a Chrome Extension designed for fast workflows.

## What it does

### Link creation
- Generate short links through the NinjaURL API.
- Create and manage links from the browser.
- Keep recent links available in the Extension interface.

### Chrome Extension
- One-click shortening from the active tab.
- Side Panel interface for account state and recent links.
- Background Service Worker coordinates API requests and authentication.

### Centralized authentication with NinjaAuth
- The Extension delegates login, session lookup, and logout to the NinjaAuth SDK.
- Ninja Connect owns shared identity and the server-side session.
- The Background Service Worker adapts SDK results to Chrome runtime messages.
- The Side Panel remains a UI client; it does not implement OAuth or own the authentication protocol.
- The session cookie is HttpOnly. The Extension must not read or persist the raw session secret.

## Current authentication integration status

- NinjaAuth integration and cache-first session restoration are present on both `dev` and `master`; the reviewed Background source file has identical content on both branches.
- In the cache-first path, a cached user restores the UI with session null and avoids an immediate /v1/session request. This cached state is not proof of a live authenticated session; protected operations must verify the session with NinjaAuth.
- SDK package/source version: `v0.1.0`.
- Extension build, Chrome functional tests, and live cookie/CORS end-to-end verification remain open.

## Anonymous link key lifecycle

### Current implementation (reviewed 2026-11-04)

- The Background reads `ninja_guest_api_key` from `chrome.storage.local` and sends it as `x-api-key` when present.
- On the first shortening request, if the key is absent, the Extension omits the header. The Worker currently generates a `NIKO_R_...` key and returns it; the Extension stores that returned key locally.
- The Extension does not currently generate the anonymous key at installation and does not register a client-generated key with the Worker.
- The reviewed v6 manifest points to `service/background.js`; that source currently sets `API_BASE = http://127.0.0.1:8787/v1` and `AUTH_ENVIRONMENT = "development"`. This is a development configuration and must be reviewed before packaging a user-facing build.

### Agreed next design (not implemented)

- Generate the anonymous key locally when the Extension is first installed/initialized.
- Do not create a server-side `APIKEYS` record until the first real use.
- Register the locally generated key idempotently with the Worker on that first use; start the 24-hour server TTL at registration time.
- Reuse the local key for subsequent requests and replace it after expiry/invalidity without requiring reinstallation.

The Worker and Extension changes, key-loss/reinstall behavior, and the end-to-end registration flow still need implementation and tests. The current server-generated flow remains the implemented behavior until that work is completed.

See [NinjaAuth Extension Integration](docs/NINJAAUTH-INTEGRATION.md) for the runtime contract and verification checklist.

## Architecture principles

- Ninja Connect owns shared identity and central session lifecycle.
- NinjaAuth owns the client-side authentication flow.
- NinjaURL owns its product profile, capabilities, links, and business rules.
- Authentication and application authorization remain separate.

## What's coming

- Expanded public API and developer workflows.
- More advanced link behavior and analytics.
- Further SDK and ecosystem integrations.

## Project status

The MVP is under active development. The priority is to verify the authentication lifecycle, Extension build, and API behavior before declaring a public release.
