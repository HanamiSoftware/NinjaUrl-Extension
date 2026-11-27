# NinjaURL Extension — Project Status

**Reviewed:** 27 November 2026  
**Repository:** `HanamiSoftware/NinjaUrl-Extension`  
**Branch:** `docs/local-link-cache-contract` (created from `dev`)  
**Scope:** documentation and static source inspection; no Extension runtime code changed.

## 1. Product and branch boundaries

- **V6** is the current functional product baseline. Preserve it while documenting and validating changes.
- **V7** is the separate TypeScript migration experiment on `feature/typescript-migration-(v7)`. It is not the default development baseline and is not a prerequisite for the current documentation or authentication work.
- Do not merge V7 into V6 or realign its history without an explicit decision and a regression plan.
- The Extension owns browser UI and browser integration. NinjaAuth owns the client authentication flow. NinjaURL Workers own application API and authorization behavior.

## 2. V6 authentication integration

The reviewed `v6/service/background.js`:
- imports the NinjaAuth IIFE;
- creates one SDK instance and initializes it with `clientId`, the Chrome identity redirect URI, `platform: "extension"` and production environment;
- uses the same instance for login, session lookup and logout;
- stores the user profile in `chrome.storage.local` after an authenticated session is confirmed;
- removes the cached user only after successful server logout;
- treats session restore failures as operational errors.

A cached user is presentation state only. It is not proof of a valid server session and must not authorize protected operations.

The existing [NinjaAuth Integration](NINJAAUTH-INTEGRATION.md) document records the intended SDK/background/Side Panel responsibility split and the manual smoke checks reported on 4 November 2026. Those checks are not automated CI evidence.


## 3.1 V6 recent links — local cache behavior

Static inspection of `dev` at commit `1a5d30a0d8f59591e5baa6c425ecb061c1aa2f71` confirms:

- The Background reads and writes the recent link array using `chrome.storage.local`.
- After create succeeds, the new link is prepended with `unshift`; the Side Panel displays newest-first.
- The Side Panel obtains the list through the Background's `GET_LINKS` message and does not request a server/database list when it opens.
- `createdAt` is generated locally by the client.
- Delete currently removes only the local item; the server DELETE call remains commented out.

This behavior is intentional for fast UI restoration, but the cache is not authoritative and does not prove current server state. The local-only delete and lack of server list reconciliation are open gaps. The 90-day anonymous link lifetime is defined in Workers ADR-001; the Extension must never use its cache to override server expiry or security decisions.

## 4. Documentation and test evidence

- The README describes the product and the intended authentication responsibility split.
- `docs/NINJAAUTH-INTEGRATION.md` documents login, restore, logout and integration checks.
- The 4 November manual smoke checks are project-owner-reported, not CI evidence.
- A current release-readiness statement requires exact branch/commit, build result, automated test result and browser integration evidence.

## 5. Next work

1. Close the P0 session-credential logging/exposure issue through a separately agreed code task.
2. Verify the SDK package/source version used by V6 and test login, session restore, logout and login-again.
3. Verify the full Extension → NinjaURL Worker create flow, including anonymous and authenticated paths.
4. Keep V7 isolated until V6 behavior and the public SDK contract are stable.
5. Update this status document only when new evidence identifies the exact branch, commit, environment and test result.

## 6. Related repositories

- [NinjaAuth SDK](https://github.com/HanamiSoftware/NinjaAuth-SDK)
- [NinjaURL Workers](https://github.com/HanamiSoftware/NinjaURL-URL-Shortener)
- [NinjaURL Dashboard](https://github.com/HanamiSoftware/Ninja-URL-Dashboard)
- [Ninja Platform Data](https://github.com/HanamiSoftware/Ninja-Platform-Data)

Ninja Connect is an external dependency. This document does not authorize changes to its repository, configuration, secrets, migrations or deployment.

---

**Constraints:** no merge; no deploy; no destructive operations; no Ninja Connect changes.
