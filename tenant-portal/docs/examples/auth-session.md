# Authentication and Session Example

Status: **Illustrative replacement flow**

Last verified: **2026-08-09**

Exact DTOs and response fields: [Auth API](../api/auth.md).

## Login sequence

```ts
type LoginInput = {
  email: string;
  password: string;
};

async function login(input: LoginInput) {
  const response = await fetch("/api/tenant/core/v1/auth/login", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
    credentials: "include",
    cache: "no-store",
  });

  const payload: unknown = await response.json();
  if (!response.ok) throw normalizeTenantApiError(response.status, payload);

  const auth = parseVerifiedCookieSessionEnvelope(payload);
  const me = await tenantApi.get("/api/tenant/core/v1/auth/me");
  return adoptVerifiedSessionMetadata(auth, me);
}
```

`parseVerifiedCookieSessionEnvelope` rejects raw access/refresh fields. Only
non-secret session metadata may enter browser state. Every cold/new tab repeats
the `/auth/me` bootstrap instead of trusting stored metadata.

## Protected request with one refresh

```ts
async function protectedRequest(path: string, init: RequestInit = {}) {
  const eventBeforeRequest = readSharedNonSecretAuthEvent();
  const prepared = prepareExactRequest(path, init);
  let response = await sendWithCookieSession(prepared);

  if (isRefreshable401(response)) {
    await refreshOrObserveAnotherTab(eventBeforeRequest);
    if (!prepared.replayAfterRefresh) {
      throw normalizeTenantApiError(response);
    }
    response = await sendWithCookieSession(prepared);
  }

  return parseTenantResponseForCanonicalApp(path, response);
}
```

Real implementation must:

- recheck the shared non-secret event after acquiring the Web Lock;
- require the observed event to retain the same `sid`; a different-session
  login fails the old request closed;
- avoid refreshing auth endpoints;
- replay mutations only with a verified caller-owned idempotency key or an
  explicitly documented naturally idempotent contract, preserving the exact
  key/body;
- never replay a non-replayable write after repairing auth;
- clear auth only for explicit terminal session/security errors;
- retain auth for permission, rate-limit, network, and availability failures.

The parser must use the path's owner: Core envelope, raw CRM success, or Trade
envelope. Payload-shape guessing is not safe.

## Logout ordering

```text
capture current sid metadata
-> call logout using the HttpOnly credential
-> on durable 204: remove/tombstone local metadata
-> on durable 204: notify other tabs with a non-secret event
-> on durable 204: navigate to login
```

On permission, network, rate-limit, or server failure, retain local auth and
report that logout did not complete; browser JavaScript cannot clear the
HttpOnly credential truthfully. Explicit terminal session errors may complete
the local transition immediately.
