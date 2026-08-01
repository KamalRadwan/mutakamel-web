# Asynchronous Operation Example

Status: **Pattern only**

Last verified: **2026-07-25**

## Accepted command

```ts
type AcceptedOperation = {
  operationId: string;
  status: string;
};

const accepted = await tenantApi.post<AcceptedOperation>(
  "/api/tenant/core/v1/<documented-command>",
  {
    body: verifiedInput,
    idempotencyKey: commandKey,
  },
);
```

Do not display completion from the `POST` unless the returned state is
explicitly terminal.

## Poll loop

```ts
async function waitForOperation(
  operationId: string,
  signal: AbortSignal,
): Promise<OperationProjection> {
  let delayMs = 1_000;

  while (!signal.aborted) {
    const result = await tenantApi.get<OperationProjection>(
      `/api/tenant/core/v1/<documented-operations>/${encodeURIComponent(operationId)}`,
      { signal, cache: "no-store" },
    );

    if (isTerminal(result.status)) return result;

    await abortableDelay(withJitter(delayMs), signal);
    delayMs = Math.min(delayMs * 1.5, 10_000);
  }

  throw new DOMException("Polling cancelled", "AbortError");
}
```

The real terminal states, path, delay hints, deadline, and retryable errors come
from the endpoint page.

## Recovery after reload

Persist only the minimum non-secret operation identity when the product must
resume status. On reload:

1. restore current tenant/session;
2. verify the operation through the owner API;
3. discard it if tenant/session/resource does not match;
4. continue polling without replaying the command.

## Unknown outcome

If the create response is lost:

- retain the exact idempotency key and normalized input;
- query a documented recovery/status route when available;
- retry only when the route contract permits exact replay;
- never create a new key merely because the response was lost.
