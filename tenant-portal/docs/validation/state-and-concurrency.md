# State and Concurrency Validation

Status: **Current implementation guidance**

Last verified: **2026-07-25**

## Principle

A form-valid command can still be invalid because permission, resource state,
price, version, ownership, or subscription changed. Tenant Portal must preserve
server evidence and expect conflicts.

## Common concurrency mechanisms

| Mechanism | Client responsibility |
| --- | --- |
| UUIDv7 idempotency key | Retain for the exact user intent and ambiguous retry |
| ETag/`If-Match` | Submit the last observed ETag; refresh on precondition failure |
| Revision/version field | Preserve exact observed value and send only where documented |
| Preview/apply token or ID | Bind apply to the exact preview and actor |
| Release/checksum pins | Submit every exact observed target/current pin |
| Cursor | Preserve as opaque query-bound evidence |
| Operation/attempt ID | Poll/cancel the exact attempt |
| Session generation | Discard responses from a replaced session |

## Mutations

Before submit:

- verify the local feature is still bound to the current resource and session;
- freeze the normalized payload used for idempotency fingerprinting;
- disable duplicate user submission while the same intent is pending;
- do not rotate the idempotency key because a response was lost.

After submit:

- use returned server state, not optimistic assumptions, for security,
  financial, or lifecycle transitions;
- handle a replay as success only when it is the exact same command;
- on conflict, retain user input where safe and reload current state;
- create a new intent/key only after the user reviews changed state or changes
  the command.

## Async commands

Do not collapse command and result:

```text
idle -> submitting -> accepted -> processing
     -> succeeded | failed | cancelled | expired | outcome-unknown
```

An outcome-unknown state retains the command key and known operation ID. It is
not equivalent to failed.

## Destructive operations

- Require a fresh capability/state check.
- Bind confirmation to the exact target identity and action.
- Reject confirmation if the displayed target changed.
- Do not use display name alone as identity.
- Preserve audit reason only where the DTO accepts it.
- After success, verify authoritative absence/state rather than only removing a
  local row.

## Financial operations

- Use exact decimal strings.
- Treat quote/preview expiry as authoritative.
- Never claim provider/payment success from the return URL.
- Re-read payment/invoice state through Core.
- Keep one command key through an ambiguous create.
- Do not mutate/reprice an already claimed collection attempt locally.

## Testing

Each concurrency-sensitive feature should test:

- double click;
- exact replay;
- changed-payload key reuse;
- lost response;
- stale ETag/version;
- permission revoked after load;
- resource state changed after load;
- logout/account replacement while request is in flight;
- two-tab competing edits;
- async completion after navigation.
