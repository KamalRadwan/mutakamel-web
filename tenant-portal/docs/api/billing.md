# Tenant Billing API

Base paths:
- `/tenant/billing`
- `/tenant/subscription`
- `/tenant/payments`
- `/tenant/taxes`
- `/tenant/currencies`

This module encapsulates all self-serve functionality related to the tenant's workspace billing, subscriptions, payments, taxes, and currencies. Most billing endpoints require `TenantOwnerGuard` (only the tenant owner can manage these settings).

## Billing & Invoices

### `GET /tenant/billing/summary`
Returns the billing summary for the tenant (wallet balance, unbilled charges, active subscription, last invoice, etc.).
- **Permissions**: Tenant Owner
- **Response**: `200 OK`

### `GET /tenant/billing/invoices`
Lists all invoices for the tenant.
- **Permissions**: Tenant Owner
- **Response**: `200 OK` (Paginated)

### `GET /tenant/billing/invoices/:invoiceId`
Get specific invoice details.
- **Permissions**: Tenant Owner
- **Response**: `200 OK`

### `POST /tenant/billing/invoices/:invoiceId/payment-quote`
Generates a payment quote for an unpaid invoice.
- **Permissions**: Tenant Owner
- **Response**: `201 Created`

### `POST /tenant/billing/invoices/:invoiceId/payment-intents`
Creates a payment intent (e.g. Stripe checkout session) from a quote.
- **Permissions**: Tenant Owner
- **Headers**: `x-idempotency-key`
- **Response**: `201 Created`

### `GET /tenant/billing/invoices/:invoiceId/payment-intents/active`
Returns the currently active payment intent for the invoice, if any.
- **Permissions**: Tenant Owner
- **Response**: `200 OK`

### `GET /tenant/billing/payment-input-currencies`
Returns a list of supported currencies for wallet top-ups and payments.

## Subscriptions

### `GET /tenant/subscription`
Get the current subscription state of the tenant.
- **Permissions**: Tenant Owner
- **Response**: `200 OK`

### `GET /tenant/subscription/items`
Get the active subscription items (plans, seats, features).
- **Permissions**: Tenant Owner
- **Response**: `200 OK`

### `POST /tenant/subscription/plan-change-previews`
Preview a self-serve plan change (e.g. adding seats, upgrading tier).
- **Permissions**: Tenant Owner
- **Headers**: `x-idempotency-key`
- **Response**: `201 Created`

### `POST /tenant/subscription/plan-change-previews/:previewId/apply`
Apply the previewed plan change.
- **Permissions**: Tenant Owner
- **Headers**: `x-idempotency-key`
- **Response**: `200 OK`

## Payments & Wallet

### `POST /tenant/payments/topup`
Initiates a wallet top-up; returns the hosted checkout URL.
- **Permissions**: Tenant Owner
- **Headers**: `x-idempotency-key`
- **Response**: `201 Created`

### `GET /tenant/payments`
Lists all payments (top-ups, refunds) for the tenant wallet.
- **Permissions**: Tenant Owner
- **Response**: `200 OK` (Paginated)

### `GET /tenant/billing/payments/:paymentId`
Check the status of a specific payment (e.g. polling after returning from checkout).
- **Permissions**: Tenant Owner
- **Response**: `200 OK`

## Taxes

### `POST /tenant/taxes`
Creates a tenant tax rate, optionally scoped to a company.
- **Permissions**: `taxes.tax.manage`
- **Response**: `201 Created`

### `GET /tenant/taxes`
Lists tax rates.
- **Permissions**: `taxes.tax.read`
- **Response**: `200 OK` (Paginated)

### `PATCH /tenant/taxes/:id`
Updates tenant tax rate.
- **Permissions**: `taxes.tax.manage`
- **Response**: `200 OK`

### `DELETE /tenant/taxes/:id`
Deactivates a tax rate.
- **Permissions**: `taxes.tax.manage`
- **Response**: `204 No Content`

## Currencies

### `POST /tenant/currencies`
Creates an ISO-4217 tenant currency and optionally makes it the workspace default.
- **Permissions**: `currencies.currency.manage`
- **Response**: `201 Created`

### `GET /tenant/currencies`
Lists currencies.
- **Permissions**: `currencies.currency.read`
- **Response**: `200 OK` (Paginated)

### `PATCH /tenant/currencies/:id`
Updates tenant currency metadata.
- **Permissions**: `currencies.currency.manage`
- **Response**: `200 OK`

### `POST /tenant/currencies/:id/set-default`
Promotes a currency to default.
- **Permissions**: `currencies.currency.manage`
- **Response**: `200 OK`

### `DELETE /tenant/currencies/:id`
Deactivates a currency.
- **Permissions**: `currencies.currency.manage`
- **Response**: `204 No Content`
