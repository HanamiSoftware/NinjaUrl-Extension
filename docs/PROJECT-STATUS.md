# NinjaURL Extension — Project Status

**Reviewed:** 12 November 2026  
**Repository:** `HanamiSoftware/NinjaUrl-Extension`  
**Branch:** `docs/alignment-2026-11-12` (created from `dev`)  
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

## 3. P0 security finding — session cookie exposure in V6

Static inspection of `v6/service/background.js` found the following behavior in `handleShorten()`:

1. The Background reads the `ninja_session` cookie from `https://auth.ninjaconnect.io` through `chrome.cookies.get()`.
2. It writes the returned cookie object to the console using `console.log("handleShorten: cookie", cookie)`.
3. It forwards `cookie.value` as a Bearer credential in a request to `https://api.ninjaurl.io/v1/link/create`.

The console statement can expose the raw session credential in extension/service-worker logs. This conflicts with the security rule that the raw session secret must not be logged or exposed to application code unnecessarily.

**Required follow-up, not performed in this documentation branch:**
- Remove all logging of the cookie object/value.
- Review whether the Extension should ever read the HttpOnly session cookie and forward its value as a Bearer token.
- Agree the intended authentication contract between Extension, NinjaAuth and NinjaURL Workers before changing the request path.
- Verify the browser permission/host access required for the current cookie access.
- Test anonymous create, authenticated create, revoked session, expired session and logout behavior.
- Confirm no raw session credential appears in logs, storage, messages or diagnostics.

Do not silently change this flow as part of a documentation task. It needs an explicit implementation task and review.

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
