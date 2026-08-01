# Source of Truth

Last verified: **2026-07-25**

## Contract verification order

### 1. Browser exposure

Read the typed Gateway route entry:

```text
api-gateway-app/src/routing-proxy/route-contracts/*.route-contracts.ts
```

It proves:

- public method/path pattern;
- owning target application;
- route class;
- idempotency and replay/transport settings when declared;
- body/timeout class when declared;
- Gateway permission metadata when declared.

The stored `pathPattern` is commonly a legacy lookup form. Convert through
Gateway canonical addressing:

```text
/api/tenant/core/v1/<relative>
/api/tenant/crm/v1/<relative>
/api/tenant/trade/v1/<relative>
```

Never expose raw controller or Swagger paths as browser paths.

### 2. Controller and guards

Read the owning controller plus global/module guard registration.

It proves:

- upstream route and parameter names;
- `GET`/`POST`/`PATCH`/`PUT`/`DELETE`;
- public/authenticated status;
- permission/owner decorators;
- route-specific scope decorators;
- explicit HTTP status, headers, streaming, or cache behavior;
- request DTO and response delegation.

Remember that global guards can enforce behavior absent from the controller.

### 3. DTOs and transport values

Read imported DTOs, nested DTOs, transforms, validators, enum definitions, and
DTO tests.

It proves:

- allowed fields;
- optional versus nullable;
- string/ID/number/decimal/date formats;
- min/max/length/array rules;
- exact enum values;
- nested validation;
- accepted query coercion.

Do not infer writable fields from entities.

### 4. Service, response, repository, and tests

Read enough implementation to prove:

- response projection;
- domain state transitions;
- authorization/resource checks not expressed in decorators;
- stable errors and conflicts;
- transaction/idempotency/concurrency behavior;
- pagination/sort allowlists;
- async job/operation state;
- secret redaction.

Tests are evidence of intended executable behavior but do not replace the
implementation they exercise.

### 5. Existing frontend

Use old-web client and tests to learn:

- currently used sequencing;
- auth refresh/session generations;
- response adapter assumptions;
- route/page replacement breadth;
- known loading/error/polling states.

Do not use old-web mocks, comments, labels, or fixtures as backend evidence.

## Drift-prone claims

Always recheck current source for:

- route existence and canonical namespace;
- permissions and route class;
- DTO fields and enum values;
- response projections;
- package versions and built declarations;
- feature/adapter production readiness;
- current old-web live/mock state;
- planned versus running services.

## Source citations in docs

API pages list source paths relative to `C:\mutakamel.ai\frontend`. Prefer a
symbol/file path over copied source. Record a verification date and source
revision in generated inventories.

## Backend gap rule

When the required API or safe projection is absent:

1. mark the frontend feature blocked or partial;
2. document the exact missing capability and evidence;
3. do not invent a request or workaround;
4. do not edit backend from this repository/task;
5. request a separately scoped backend change.
