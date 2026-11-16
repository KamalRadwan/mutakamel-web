# Outbound Emails

Verified against the Gateway, CRM controller/DTO/service and restricted Worker sending pipeline on 2026-11-03.

## Scope and navigation

The CRM Settings aside is supplied by the shared shell. This item has no secondary setup navigation. The history page shows a visible heading, status filter, compact table, explicit message-details action and a cursor-based Load more control. History reads have no branch query, search, page number or total. Compose uses a branch only to choose a source Lead, Customer Profile or Opportunity.

Reads require scoped activities.read and source access; compose/preview/queue/retry require scoped email.send and the outbound-email entitlement. A server 403 is an access boundary, and feature exclusion is a distinct non-retry state.

## Sending semantics

The only statuses are QUEUED, DISPATCHING, SENT and FAILED. A 202 is shown as queued, never sent. SENT is labelled **Sent / تم الإرسال**, correcting the earlier approved image's Delivered wording: it confirms provider acceptance, not arrival in an inbox.

Source proof:
- Worker `src/modules/email-dispatcher/restricted/crm-restricted-email.service.ts:240` calls the provider and handles ACCEPTED by completing the job.
- Worker `src/modules/email-dispatcher/restricted/crm-email-delivery.repository.ts:538` persists provider acceptance and immediately emits EMAIL_SENT at line588.
- CRM `src/crm/outbound-emails/outbound-email-lifecycle.service.ts:161` maps that event to SENT.
- Bounce/complaint feedback is separate and does not create another list status.

## Composer and retries

Choose only server-approved masked recipients and eligible published template versions. The optional preview renders safe plain text and never creates an email. Source changes clear recipient/template selection and preview; recipient/template changes invalidate preview. Options and preview are read-like requests without idempotency keys.

Create/retry retain one UUIDv7 key and an immutable request body. There is no automatic write replay. An ambiguous result or unreadable acceptance freezes the original intent and retains selections; **Check original request** explicitly reconciles that same body/key. Close, reopen and New compose handlers cannot replace it. A stale actor, scope, source, preview or unmounted request cannot publish a queued-success result.

A retry creates one new queued message from a retained terminal FAILED message. An existing retry links to that child. Redacted content cannot retry. Retry reasons are NFC-normalized, trimmed, 1–500 Unicode scalar values, and cannot contain control characters. Invalid text stays in the form with an inline error.

## Read and state safety

History, detail, options, preview and retry drafts are tagged with their auth scope. Their visible state hides the previous scope's rows, names and content synchronously, before passive cancellation effects. Scope includes the actor, permissions, branch/company/team memberships and email entitlement.

Reads are cancelled and generation-ordered. Cursor pages cannot overwrite a changed filter; duplicate Load more clicks cannot issue the same page concurrently. Non-access refresh failures retain existing data and offer a real retry; 401/403/404 do not retain inaccessible detail. Timeline feedback is merged with a matching lifecycle event instead of appearing twice.

The forms retain inputs through server rejection, guard unsaved navigation and close, expose visible labels and preserve Arabic RTL, Western numerals and both themes through design-system primitives. All case data comes from real APIs. No SMTP inputs, arbitrary addresses/subject/body, attachments, bulk sends, cancellation, scheduling or delivery analytics are introduced.

## Verification

Focused unit tests cover contract validation, scoped admissions, cursor races, source/preview races, synchronous scope masking, same-tick write fencing, unreadable acceptance, uncertainty reconciliation with the original key/body, UI close/reopen fencing, retry lineage and NFC/Unicode/control-character validation. Source-specific lint and fresh TypeScript verification are recorded in the implementation handoff. No browser automation, credentials or customer-data writes were used in this phase.

The lead runs the combined checks and mandatory production rebuild after this item is frozen.
