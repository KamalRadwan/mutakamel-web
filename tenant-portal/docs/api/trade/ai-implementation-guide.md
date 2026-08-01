# AI Implementation Guide for Tenant Portal Trade

> Contract status: implementation-ready AI guidance over verified backend contracts
> Verification date: 2026-07-25
> Backend owner: Trade, integrated with Core, Gateway, CRM, and Worker
> Documentation: hand-written AI rules backed by source-generated route and validation inventories
> Canonical browser prefix: `/api/tenant/trade/v1`
> Controller-relative prefix: `/trade` under upstream `/api/v1`
> Tenant Portal status: Trade is not implemented in the replacement frontend; this guide defines how AI-generated code must begin.

## Non-negotiable generation rules

1. Generate browser calls only from the 226 entries in [route-coverage.md](route-coverage.md).
2. Use `/api/tenant/trade/v1` exactly. Never emit `/api/v1/trade`, direct Trade service hosts, Worker routes, or unrouted `/uoms` CRUD calls.
3. Generate request types/forms from the named controller DTO and [validation-reference.md](validation-reference.md), including inherited fields.
4. Generate runtime enum choices only from `IsEnum`, `IsIn`, regex/limit contracts, or [static-data.md](static-data.md). A TypeScript union with only `IsString` is not a closed runtime enum.
5. Attach the exact route permission, feature expression, and scope target documented on the capability page. UI gates never replace server authorization.
6. Add `X-Idempotency-Key` and `If-Match` only where the route table requires them.
7. Preserve monetary and quantity decimal strings. Do not coerce them to JavaScript numbers.
8. Model every 202 response as an accepted job/attempt with a separate terminal observation path.
9. Treat legacy frontend behavior as migration evidence only. If it conflicts with current controllers/DTOs/services/tests, current backend wins.
10. Do not generate design, styling, layout, or visual component decisions from these API docs.

## Recommended implementation order

1. Build one shared canonical Trade transport adapter:
   - rejects non-canonical paths;
   - uses established Tenant Portal authentication;
   - attaches authorized company/branch/channel context;
   - distinguishes success envelopes from raw upstream Trade/Nest errors and Gateway Problem Details;
   - exposes response status, `ETag`, `Location`, `Retry-After`, and `Idempotency-Replayed`;
   - redacts sensitive values from telemetry.
2. Add shared primitives:
   - UUIDv7 command-intent creation and retention;
   - ETag storage and stale-version handling;
   - cancellable bounded polling;
   - decimal-string field helpers;
   - problem-details normalization.
3. Generate read projections before commands for each capability so company/branch/resource IDs and ETags come from authorized sources.
4. Implement commands in dependency order:
   - catalog/UOM catalogue/channels;
   - commercial accounts;
   - price books and policy/workflow governance;
   - quotations/orders/purchasing/inventory;
   - document platform and PDFs;
   - extensions/imports/webhooks;
   - dashboards and control tower.
5. Add contract tests from route metadata and DTO validators before enabling a capability.

## Ownership model

```text
Core identity and tenant masters
        |
        v
API Gateway canonical tenant route
        |
        v
Trade authorization + business projection
        |
        +---- references CRM-owned party/customer/opportunity IDs
        |
        +---- publishes/observes Worker-executed imports, webhooks, and PDFs
```

AI-generated code must not duplicate Core tenant/company/branch/user/role/subscription state as writable Trade state. Cache only the minimum authorized projection needed for a request, and invalidate it when the active tenant context/session changes.

Trade accepts some CRM-owned identifiers in DTOs, but that does not transfer record ownership. Fetch CRM data through CRM contracts and send only the accepted IDs/versions to Trade.

Worker execution identifiers, storage references, internal event payloads, and queues are not browser contracts. Start and inspect asynchronous work through Trade routes.

## Route-to-code generation schema

For every generated operation, retain this metadata:

```ts
type TradeOperationContract = {
  method: "GET" | "POST" | "PATCH";
  canonicalPath: `/api/tenant/trade/v1/${string}`;
  permission: string;
  feature: { allOf?: string[]; anyOf?: string[] };
  scope:
    | "TENANT"
    | "COMPANY"
    | "BRANCH"
    | "COMPANY_OR_BRANCH"
    | "OPERATING_CONTEXT"
    | "DASHBOARD_CONTEXT";
  requestDto?: string;
  requiresIdempotencyKey: boolean;
  requiresIfMatch: boolean;
  successStatuses: readonly number[];
  asyncObservationPath?: string;
};
```

Populate it from the route table/controller, not from path-name heuristics. Dynamic statuses such as sales-order confirm and dashboard/company-default upsert must preserve all documented outcomes.

## Request-schema generation

- `IsOptional` means omission is allowed; it does not always mean `null` is allowed.
- Preserve DTO defaults only when the field is omitted. Do not send defaults unnecessarily if omission has distinct service meaning.
- Follow `ValidateNested`/`Type` into nested DTOs.
- Respect `ArrayMinSize`/`ArrayMaxSize` and shared limits before sending.
- Keep ISO strings in their documented date/date-time shape.
- Use UUIDv7 for resource/intent fields guarded by the shared pattern.
- Do not add unknown properties; Trade rejects them.
- Do not build mutation payloads by spreading response objects.

Service invariants remain server-owned. A transport-valid command can still fail because of scope, reference ownership, version, lifecycle, policy, credit, pricing, inventory, legal snapshot, or dependency state.

## State and concurrency generation

Each editable aggregate should track:

```ts
type EditableTradeResource<T> = {
  value: T;
  etag: string;
  loadedScopeKey: string;
  loadedAt: number;
};
```

Invalidate the editable state when tenant/company/branch/channel changes. Send the exact captured ETag on mutation. A stale response starts a refetch/reconcile flow; never perform an automatic last-write-wins retry.

Each command intent should track one UUIDv7 key and canonical request fingerprint until success, terminal domain error, or explicit cancellation. A transport timeout must not create a new key.

## Async generation

Use an explicit state machine:

```text
idle -> submitting -> accepted -> polling -> completed
                    \-> completed (synchronous)
                    \-> terminal_failed
                    \-> cancelled_by_client (polling only)
```

Cancellation stops client polling; it does not cancel server work unless a documented cancel route exists. Validate that returned `Location` is a same-origin canonical Trade path before following it. Honor `Retry-After`, bound backoff, stop on terminal state, and avoid parallel poll loops for the same job.

## Error generation

Generate an explicit wire-error union and normalize it before feature code consumes it:

```ts
type GatewayProblemDetails = {
  type: string;
  title: string;
  status: number;
  code: string;
  instance: string;
  correlationId: string;
  details?: unknown;
};

type TradeNestError = {
  code?: string;
  statusCode?: number;
  message?: string | string[] | Record<string, unknown>[];
  error?: string;
  details?: unknown;
};

type TradeWireError = GatewayProblemDetails | TradeNestError;

type NormalizedTradeError = {
  httpStatus: number;
  code?: string;
  correlationId?: string;
  source: "gateway" | "trade";
  safeMessage?: string;
};
```

The HTTP response status is authoritative. Only Gateway-originated failures are guaranteed to use Problem Details. Trade has no shared exception filter, and the Gateway forwards upstream Trade validation, guard, and domain exception bodies unchanged. Do not require `type`, `title`, `instance`, or `correlationId` for a Trade-originated failure.

Map stable codes to recovery categories rather than hard-coding one message per controller:

| Category | Typical action |
|---|---|
| authentication/session | established sign-in/session-refresh flow |
| seat/entitlement/feature | disable capability and refresh authorized Core entitlement state |
| permission/scope | deny action; let user choose an authorized context |
| validation | field/form correction without exposing raw internals |
| stale concurrency | refetch and reconcile |
| idempotency mismatch/in-flight | stop changed replay or wait/observe |
| semantic transition/policy | show domain reason and refresh aggregate |
| dependency unavailable/429 | bounded retry when safe |

Unknown or absent codes must remain visible through generic handling. Include a correlation ID when one exists in the body or approved response metadata; never invent one or treat an unknown error as success.

## Static and dynamic data

Code constants in [static-data.md](static-data.md) can seed type-safe values. The following remain dynamic and must be fetched:

- items, UOM catalogue records, categories, channels, company/branch profiles;
- commercial accounts, parties, credit evidence;
- policy/workflow definitions and versions;
- price books, promotions, configuration assignments;
- document profiles/templates/publications;
- dashboard catalog/templates/definitions/widgets/shares;
- extension profiles, import mappings/runs, webhook subscriptions/deliveries;
- every aggregate status/version/ETag and every signed/private artifact.

Do not fabricate fallback IDs or default database records.

## Required generated tests

For each operation, generate tests that prove:

- canonical path and HTTP method;
- correct scope-header shape and context reset;
- required permission/feature metadata used for UI affordances;
- exact DTO fields, decimal strings, nested arrays, enum values, and unknown-field rejection assumptions;
- idempotency-key retention across an uncertain retry;
- `If-Match` propagation and stale-version reconciliation;
- all success statuses, including 201/202/204/dynamic outcomes;
- problem-details parsing and correlation-ID preservation;
- cancellation and terminal handling for async polling;
- no trusted Gateway header, Worker URL, direct Trade URL, sensitive telemetry, or response-to-request spreading.

Use the backend tests named on each capability page as semantic evidence. Frontend tests must not claim live deployment verification.

## Stop conditions for an AI

Stop and request a contract decision when:

- a desired browser path is not in [route-coverage.md](route-coverage.md);
- a DTO/type union and runtime validator disagree in a way that changes product behavior;
- legacy UI sends a field the current DTO rejects;
- a response lacks the ID/version/ETag needed by the documented next command;
- a 202 route has no observable terminal projection;
- ownership between Core, CRM, Trade, Accounting, or Worker is unclear;
- implementing the requested behavior would require forging trusted headers or bypassing a guard.

Record the ambiguity in the owning capability page; do not silently invent a contract.
