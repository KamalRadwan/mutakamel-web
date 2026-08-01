# Feature Documentation Template

Copy this structure for a new functional feature. Remove instructional text and
never leave unverified placeholders marked as current.

```markdown
# <Feature name>

Status: **verified-current | partial | planned**

Last verified: **YYYY-MM-DD**

Backend owner: **Core | CRM | Trade**

New Tenant Portal: **not-started | partial | live | tested**

## Purpose

<User/business outcome, not visual description.>

## Replacement evidence

- Old routes:
- Old feature/client paths:
- Old tests:
- Live/mock/partial status:

## Source evidence

```text
Gateway:
Controller:
DTOs:
Enums/contracts:
Service/response:
Tests:
```

## API contract

| Method | Canonical browser path | Access/permission | Request | Response |
| --- | --- | --- | --- | --- |

## Validation

- Path:
- Query:
- Headers:
- Body:
- Enums:
- Optional versus nullable:

## Authorization and scope

- Tenant:
- Module/feature/seat:
- Permission:
- Company/branch/channel/team/own-all:
- Resource state:

## State model

<Current states and valid commands. Do not invent a state machine.>

## Errors and recovery

| Status/code | Meaning | Client behavior |
| --- | --- | --- |

## Idempotency and concurrency

- Key/ETag/version/preview/pins:
- Exact retry:
- Ambiguous outcome:

## Security

- Sensitive data:
- Trusted context:
- Upload/download/rich content:
- Logging/redaction:

## Examples

<Safe valid request/response and one meaningful failure.>

## Implementation boundary

- Routes:
- Shared dependencies:
- Feature files:
- Cache/query keys:
- Async polling:

## Tests

- Unit:
- Integration:
- Browser:
- Negative security:

## Known gaps

- <Evidence-backed only.>
```
