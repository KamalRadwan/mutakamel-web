# CRM browser examples

> Status: `verified-current`
> Last source verification: `2026-07-25`
> Owner: CRM (`crm-app`)
> Canonical browser prefix: `/api/tenant/crm/v1`
> Controller-relative prefix: `/api/v1/crm`
> Tenant Portal replacement: `not-started`
> Legacy frontend: `live-partial`
> Authorship: hand-written from current source

These TypeScript examples demonstrate contract-safe transport patterns, not a required client architecture. Replace placeholder IDs with IDs returned for the active tenant. See [Common contract](./common-contract.md).

## Raw JSON request

```ts
type CrmFailure = {
  status: number;
  code?: string;
  correlationId?: string;
  body: unknown;
};

export async function crmJson<T>(
  path: `/${string}`,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api/tenant/crm/v1${path}`, {
    ...init,
    credentials: "include",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  if (response.status === 204) return undefined as T;

  const body = await response.json().catch(() => undefined);
  if (!response.ok) {
    const value = body as Record<string, unknown> | undefined;
    throw {
      status: response.status,
      code:
        typeof value?.errorCode === "string"
          ? value.errorCode
          : typeof value?.code === "string"
            ? value.code
            : undefined,
      correlationId:
        typeof value?.correlationId === "string"
          ? value.correlationId
          : undefined,
      body,
    } satisfies CrmFailure;
  }

  // CRM success payloads are raw; there is no global { success, data } envelope.
  return body as T;
}
```

Do not add trusted tenant headers. The Gateway derives tenant and actor context from the canonical session.

## List leads

```ts
const query = new URLSearchParams({
  branchId: "0191e9a8-7f51-7b32-8d72-19f9217a41b3",
  page: "1",
  limit: "20",
  sortBy: "createdAt",
  sortDir: "DESC",
});

const page = await crmJson<{
  items: unknown[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}>(`/leads?${query}`);
```

The owner, branch, status, stage, and source filters narrow the server-authorized result. They cannot expand visibility.

## Create a lead

```ts
const lead = await crmJson<unknown>("/leads", {
  method: "POST",
  body: JSON.stringify({
    branchId: "0191e9a8-7f51-7b32-8d72-19f9217a41b3",
    leadProfileType: "INDIVIDUAL",
    displayName: "Example Contact",
    email: "contact@example.invalid",
  }),
});
```

Use `.invalid` domains and synthetic data in documentation, tests, and demos. Unknown body properties are rejected.

## UUIDv7 idempotency

```ts
// Inject a standards-compliant UUIDv7 generator from the portal's chosen library.
declare function createUuidV7(): string;

const idempotencyKey = createUuidV7();
const body = {
  pipelineId: "0191e9a8-7f51-7b32-8d72-19f9217a41b4",
  stageId: "0191e9a8-7f51-7b32-8d72-19f9217a41b5",
  reason: "Moved to the correct sales process",
};

await crmJson<unknown>(
  "/opportunities/0191e9a8-7f51-7b32-8d72-19f9217a41b6/pipeline",
  {
    method: "PUT",
    headers: { "x-idempotency-key": idempotencyKey },
    body: JSON.stringify(body),
  },
);
```

If the connection fails before a response is received, retry the exact same request with the exact same key. If the user edits the body, generate a new key. Do not use `crypto.randomUUID()` because it produces UUIDv4.

## Optimistic revision

```ts
await crmJson<unknown>(
  "/dashboards/0191e9a8-7f51-7b32-8d72-19f9217a41b7",
  {
    method: "PATCH",
    body: JSON.stringify({
      revision: 4,
      name: "Revenue and pipeline",
    }),
  },
);
```

On `CRM_DASHBOARD_REVISION_CONFLICT`, load the latest definition and ask the user to reconcile changes. Do not silently overwrite.

## Multipart upload

```ts
const form = new FormData();
form.set("file", selectedFile);
form.set("branchId", branchId);
form.set("sourceType", "LEAD");
form.set("sourceId", leadId);

const response = await fetch("/api/tenant/crm/v1/attachments/upload", {
  method: "POST",
  credentials: "include",
  cache: "no-store",
  body: form,
});
```

Do not set `Content-Type` manually for `FormData`; the browser supplies the multipart boundary. Validate size and type for user feedback, while treating server validation as authoritative.

## Private download

```ts
const response = await fetch(
  `/api/tenant/crm/v1/attachments/${attachmentId}/download`,
  { credentials: "include", cache: "no-store" },
);

if (!response.ok) throw new Error(`Download failed: ${response.status}`);
const blob = await response.blob();
```

Do not build a public storage URL from `storageKey`. Use the authorized download route and sanitize any client-side filename fallback.

## Accepted outbound email

```ts
declare function createUuidV7(): string;

const accepted = await crmJson<{
  outboundEmailId: string;
  status: "QUEUED";
}>(
  "/outbound-emails",
  {
    method: "POST",
    headers: { "x-idempotency-key": createUuidV7() },
    body: JSON.stringify({
      sourceType: "LEAD",
      sourceId: leadId,
      recipient: { kind: "SOURCE_PRIMARY_CONTACT" },
    }),
  },
);

// 202 means accepted, not delivered. Poll by accepted.outboundEmailId.
```

Render preview `bodyHtml` in a sandboxed, non-privileged surface. Never inject it into trusted portal markup.

## Sources

- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/crm.route-contracts.ts`
- `../backend/mutakamel-apps/api-gateway-app/src/idempotency/gateway-idempotency.service.ts`
- `../backend/mutakamel-apps/crm-app/src/main.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/leads/dto/lead.dto.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/notes-attachments/notes-attachments.controller.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/outbound-emails/outbound-emails.controller.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/dashboards/dto/dashboard-builder.dto.ts`
