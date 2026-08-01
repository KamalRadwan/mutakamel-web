# Authentication and Session Example

Status: **Illustrative replacement flow**

Last verified: **2026-07-25**

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
    cache: "no-store",
  });

  const payload: unknown = await response.json();
  if (!response.ok) throw normalizeTenantApiError(response.status, payload);

  const auth = parseVerifiedLoginEnvelope(payload);
  return adoptNewSessionGeneration(auth);
}
```

`parseVerifiedLoginEnvelope`, generation storage, and error normalization must
live in shared auth/API code. A feature component must not implement them.

## Protected request with one refresh

```ts
async function protectedRequest(path: string, init: RequestInit = {}) {
  const expected = requireCurrentSessionGeneration();
  let response = await sendWithSession(path, init, expected);

  if (response.status === 401 && isRefreshEligible(path, init)) {
    const refreshed = await coordinateOneRefresh(expected);
    assertGenerationStillCurrent(refreshed);
    response = await sendWithSession(path, init, refreshed);
  }

  assertGenerationStillCurrent(expected);
  return parseTenantResponseForCanonicalApp(path, response);
}
```

Real implementation must:

- bind the retry to the refreshed generation correctly;
- avoid refreshing auth endpoints;
- preserve a write's exact idempotency key/body;
- clear only the expected session after refresh failure;
- reject a response from a replaced account.

The parser must use the path's owner: Core envelope, raw CRM success, or Trade
envelope. Payload-shape guessing is not safe.

## Logout ordering

```text
capture current generation
-> remove/tombstone it locally
-> notify other tabs
-> call logout with captured refresh evidence when available
-> navigate to login
```

Local invalidation happens before navigation so delayed work cannot continue as
authenticated.
