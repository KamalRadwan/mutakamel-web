# Invoice void command

Source verified 2026-11-17 against Core VoidInvoiceDto.

POST /api/admin/core/v1/invoices/:id/void requires reasonCode (ISSUED_IN_ERROR, DUPLICATE, PRICING_ERROR, CUSTOMER_DISPUTE, OTHER). OTHER requires a trimmed note of 1–500 characters. The existing free-text cancellation form sends OTHER with the operator-entered reason as note. The request body participates in the idempotency intent fingerprint. The operator must still confirm the action. Issue requests are unchanged.

The frontend previously sent an empty body and incorrectly described the cancellation reason as local-only. Core rejected that request with CORE_VALIDATION_FAILED. This change corrects the request; it does not bypass collection holds or perform any financial action automatically.
