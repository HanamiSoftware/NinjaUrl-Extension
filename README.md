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
