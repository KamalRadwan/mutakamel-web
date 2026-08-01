# Feature API Module Example

Status: **Pattern only**

Last verified: **2026-07-25**

This example uses a synthetic resource to show separation. Replace every path
and field with a verified endpoint contract.

## Transport types

```ts
export type ExampleRecordDto = {
  id: string;
  status: "ACTIVE" | "INACTIVE" | (string & {});
  amount: string;
  createdAt: string;
};

export type ExampleListQuery = {
  page?: number;
  limit?: number;
  search?: string;
};
```

The open string fallback keeps unknown future enum values readable. Unsafe
actions should remain disabled for unknown values.

## API functions

```ts
import { tenantApi } from "@/shared/api/tenant-api";

const ROOT = "/api/tenant/core/v1/examples";

export function listExamples(query: ExampleListQuery, signal?: AbortSignal) {
  return tenantApi.getPage<ExampleRecordDto>(ROOT, { query, signal });
}

export function createExample(
  input: CreateExampleInput,
  intent: { idempotencyKey: string },
) {
  return tenantApi.post<ExampleRecordDto>(ROOT, {
    body: input,
    idempotencyKey: intent.idempotencyKey,
  });
}
```

## Form mapping

```ts
export function toCreateExampleInput(form: ExampleFormValues) {
  return {
    name: form.name.trim(),
    amount: normalizeExactDecimalString(form.amount),
  };
}
```

Do not spread the complete form object into the request.

## Cache identity

```ts
export const exampleKeys = {
  all: (sessionGeneration: string, branchId: string) =>
    ["examples", sessionGeneration, branchId] as const,
  list: (
    sessionGeneration: string,
    branchId: string,
    query: ExampleListQuery,
  ) => [...exampleKeys.all(sessionGeneration, branchId), "list", query] as const,
};
```

Include every context that changes authorization/result membership.

## Mutation state

The feature hook—not the view—retains the command key through an exact ambiguous
retry and rotates it for a genuinely new user intent.
