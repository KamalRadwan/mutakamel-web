# Asynchronous Workflows

Status: **Verified ownership model; feature details live in API pages**

Last verified: **2026-07-25**

## Rule

Tenant Portal submits commands and reads projections through Core, CRM, or
Trade. It never calls Worker directly, publishes RabbitMQ messages, or infers
completion from the original HTTP acceptance alone.

## Generic command lifecycle

1. The browser submits an authorized command with the required idempotency key.
2. The owning app validates current state and commits command/evidence/outbox
   atomically where defined.
3. The response returns a resource, operation, attempt, or job identifier.
4. An outbox or direct owner dispatch initiates background work.
5. Worker or an owning consumer records monotonic progress and publishes a
   result.
6. The command owner projects safe tenant-visible state.
7. Tenant Portal polls the documented owner endpoint until success, failure,
   cancellation, or expiry.

`202 Accepted` means accepted for processing, not completed.

## Provisioning and component updates

- Core owns tenant-visible operation/update discovery and apply commands.
- Core plans subscribed components and emits immutable, digest-pinned controls.
- Worker owns the durable DAG, leases, fencing, retries, cancellation, and
  database creation.
- Core, CRM, and Trade own their component schema/seed/verification installers.
- Tenant self-service may apply only entitled, compatible releases explicitly
  allowed for self-service.
- The browser must submit exact observed/current and target pins; stale pins
  fail instead of silently selecting a new target.

## Rendering

Template and document rendering commonly returns a job identifier:

- preserve the document/template version or snapshot pin;
- poll the owner route;
- do not render success before the job reaches a terminal successful state;
- expose terminal safe error information without provider/internal secrets;
- stop polling on logout, generation change, cancellation, or route exit.

## Email and notifications

Core, CRM, and Trade can own command/status projections while Worker performs
delivery. Provider success can have an at-least-once duplicate window; the UI
must display server status rather than locally deducing delivery.

## Billing

Worker owns recurring lifecycle scheduling; Core owns financial truth and
tenant billing projections. The UI never marks an invoice paid based only on a
redirect return or provider page.

## Polling policy

- Use server-provided retry hints when present.
- Otherwise use bounded exponential or capped interval polling.
- Add jitter for many simultaneous clients.
- Stop at a documented deadline and show recoverable "still processing".
- Treat `404` during a just-created job only as retryable when the API contract
  explicitly allows projection lag.
- Do not discard a known operation ID after a transport-ambiguous create.
- Re-read authoritative state after focus/reconnect rather than replaying the
  command.

## Source evidence

```text
../backend/mutakamel-apps/core-app/src/admin/tenants/provisioning/
../backend/mutakamel-apps/core-app/src/tenant/
../backend/mutakamel-apps/worker-app/src/modules/tenant-provisioning/
../backend/mutakamel-apps/worker-app/src/modules/
../backend/mutakamel-apps/crm-app/src/database/provisioning/
../backend/mutakamel-apps/trade-app/src/database/provisioning/
../backend/mutakamel-apps/core-app/packages/contracts/src/events/
```
