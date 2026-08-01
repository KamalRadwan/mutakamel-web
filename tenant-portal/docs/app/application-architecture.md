# Tenant Portal Application Architecture

Status: **Approved replacement architecture; implementation pending**

Last verified: **2026-07-25**

## Runtime boundary

The Tenant Portal is one standalone Next.js App Router application on fixed
port `5002`. It serves only tenant and public tenant-authentication surfaces.
Admin and partner identities use their own applications.

The application must use:

- API Gateway as the only browser API edge;
- server-side tenant host admission before tenant content renders;
- thin route modules;
- feature-owned request schemas, API functions, hooks, types, and page
  composition;
- shared modules for auth, Gateway transport, tenancy, envelopes, errors,
  permissions, localization, and business-neutral utilities;
- server state kept in a server-state/query layer rather than duplicated into
  global client state.

This document intentionally does not specify visual appearance.

## Intended source boundaries

```text
src/
  app/                 Next routes, layouts, error/loading boundaries, API proxy
  features/
    auth/
    workspace/
    crm/
    trade/
    billing/
    notifications/
    templates/
  shared/
    api/
    auth/
    tenancy/
    permissions/
    validation/
    i18n/
    types/
    lib/
```

Create folders only when a feature needs them.

## Dependency direction

Allowed:

```text
app -> features -> shared
app -> shared
feature submodule -> its own files
```

Forbidden:

```text
shared -> features
shared -> app
CRM feature -> Trade implementation internals
Trade feature -> CRM implementation internals
frontend -> backend source imports
```

Cross-domain journeys coordinate through documented HTTP APIs and stable
frontend view models, not imports between backend packages or feature internals.

## Route responsibilities

Route files:

- parse route parameters at the framework boundary;
- run server-only admission when required;
- select the feature entry point;
- define metadata and framework error/loading behavior.

Route files do not:

- contain reusable API clients;
- implement permission or billing policy locally;
- duplicate DTO validation;
- hold large stateful feature components;
- call Core, CRM, or Trade directly outside the shared Gateway transport.

## Shared API layer

One shared API layer owns:

- canonical path construction;
- same-origin Gateway proxy behavior;
- credential and access-token attachment;
- explicit Core-envelope, raw-CRM, and Trade-envelope success parsing;
- normalized Gateway, Core/CRM, and Trade error shapes;
- correlation IDs;
- refresh coordination;
- UUIDv7 idempotency keys for write-sensitive intent;
- request cancellation and timeout policy;
- upload/download streaming rules;
- safe logging and redaction.

Feature API modules provide typed operations and query/mutation keys. Components
must not call `fetch` or construct Gateway URLs independently.

## Authentication state

Tenant session behavior must be ported deliberately from current verified
behavior, not copied mechanically.

Required properties:

- access and refresh material follow the Core tenant contract;
- requests remain bound to the auth generation that created them;
- one refresh attempt coordinates concurrent callers;
- cross-tab logout or account replacement invalidates stale work;
- delayed responses cannot revive a logged-out generation;
- public action tokens are not persisted beyond their narrow flow;
- permission and scope data are refreshed from `/auth/me`;
- no secret appears in logs, error analytics, URLs, or long-lived storage.

See [Authentication and session](../architecture/authentication-and-session.md).

## Server and client responsibilities

Prefer server execution for:

- original-host admission;
- protected route redirection before content disclosure;
- server-only environment and Gateway origin handling;
- initial data that does not require a browser-only session token;
- cache policy that must not be left to components.

Use client execution for:

- interactive forms and optimistic state;
- browser-coordinated auth refresh;
- live polling and user-driven cancellation;
- uploads/downloads requiring browser objects;
- cross-tab session events.

Do not expose internal Gateway origins or service credentials through
`NEXT_PUBLIC_*`.

## State classification

| State | Owner |
| --- | --- |
| Backend resource state | Server/query cache |
| Auth generation and access material | Shared auth boundary |
| Current tenant/actor projection | Server/query cache plus auth boundary |
| URL filters and pagination | URL/search parameters where shareable |
| Unsaved form draft | Feature-local form state |
| UI preference | Explicit bounded client preference store |
| Permission/module capability | Server-authoritative projection |

Permissions and entitlements may hide or disable actions for usability, but the
backend remains authoritative.

## Data adaptation

Feature boundaries may transform transport DTOs into view models. Adapters
must:

- preserve identifiers and exact decimal strings;
- parse timestamps explicitly;
- keep unknown enum values recoverable;
- avoid deriving financial or authorization truth locally;
- retain correlation and pagination metadata where needed;
- expose backend capability separately from presentation state.

## Replacement rule

Old-web code is ported only after its behavior is checked against current
Gateway and backend source. Legacy paths, old token behavior, mocks, and stale
target-state documentation must not be copied into the new portal.
