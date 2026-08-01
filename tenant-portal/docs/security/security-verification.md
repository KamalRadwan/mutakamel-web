# Security Verification Matrix

Status: **Required**

Last verified: **2026-07-25**

## Host and tenancy

- [ ] Unknown and malformed hosts return not-found before tenant UI.
- [ ] Unverified FQDN fails closed.
- [ ] Suspended tenant login remains available with warning.
- [ ] Suspended tenant protected APIs fail.
- [ ] Token tenant and host tenant mismatch fails.
- [ ] Browser-forged forwarded/trusted headers are stripped.
- [ ] Server rendering/cache cannot cross hosts.

## Authentication

- [ ] Invalid/expired access token fails.
- [ ] One coordinated refresh handles concurrent `401`s.
- [ ] Refresh rotation cannot be replayed.
- [ ] Logout and logout-all invalidate appropriate sessions.
- [ ] Cross-tab logout/account replacement invalidates stale work.
- [ ] Delayed response cannot revive an old generation.
- [ ] Invite/reset token is single-use, bounded, and not logged.

## Authorization and scope

- [ ] Missing permission returns forbidden.
- [ ] Own/team/all scope is enforced.
- [ ] Company/branch/channel IDs cannot broaden access.
- [ ] Module not subscribed fails.
- [ ] Required seat missing fails.
- [ ] Cross-tenant and cross-resource UUID substitution fails.
- [ ] Backend capability change after page load is handled.

## Requests and writes

- [ ] Unknown DTO fields fail safely.
- [ ] Changed-payload idempotency-key reuse conflicts.
- [ ] Exact replay returns the original authoritative result where supported.
- [ ] Double click creates one command.
- [ ] Stale ETag/version/pins fail.
- [ ] Rate-limit behavior respects retry hints.
- [ ] Ambiguous writes are not blindly retried.

## Content and browser

- [ ] CSP and security headers are present in production.
- [ ] No token/secret appears in URL, HTML, storage dump, log, or telemetry.
- [ ] Unsafe HTML/SVG/template content is isolated.
- [ ] Open redirects and unsafe URL protocols fail.
- [ ] Upload type/size and download filename/content are handled safely.
- [ ] Protected responses are not cached by shared/public caches.

## Dependency and build

- [ ] Lockfile is intentional and reproducible.
- [ ] Dependency audit results are reviewed, not auto-fixed destructively.
- [ ] Source maps and runtime diagnostics do not expose secrets.
- [ ] Production build has no mock/fallback success path.
- [ ] Lint, types, unit, integration, and browser negative tests pass.

## Evidence

Store test names and commands in [AI test matrix](../ai/TEST_MATRIX.md). Do not
claim live deployment verification from source/unit tests alone.
