# Tenant Portal Static Data & Enums

This document describes the key static data structures and enumerations used across the Tenant Portal APIs. 

## User and Organization States

### `UserStatus`
- `ACTIVE`: The user has accepted their invitation and can log in.
- `INVITED`: The user has been invited but has not yet accepted.
- `DEACTIVATED`: The user has been temporarily disabled.
- `ARCHIVED`: The user has been soft-deleted.

### `RoleType`
- `SYSTEM`: Built-in roles managed by the platform (cannot be modified or deleted).
- `CUSTOM`: Custom roles created by the tenant administrators.

## Templates and Business Letters

### `TemplateLifecycleStatus`
- `DRAFT`: The template is currently being edited and is not yet available for production use.
- `PUBLISHED`: The template is available for assignments and active generation.
- `ARCHIVED`: The template has been retired and can no longer be used for new generations.

### `AssetDeliveryClass`
- `EMAIL_PUBLIC`: An asset meant for public exposure (e.g., logo included in an email sent to end users).
- `PRIVATE`: An internal asset only accessible by authenticated users with appropriate permissions.

### `BusinessLetterState`
- `DRAFT`: The letter is actively being written/edited.
- `ISSUED`: The letter has been finalized and locked. No further edits are permitted.

## Activities and Notifications

### `ActivityStatus`
- `PENDING`: The activity is active and awaiting action.
- `COMPLETED`: The activity has been successfully resolved.
- `CANCELED`: The activity was aborted before completion.

### `NotificationPreferenceChannel`
- `IN_APP`: Delivery via the application inbox and real-time sockets.
- `EMAIL`: Delivery via SMTP email.
- `PUSH`: Delivery via mobile/browser push notifications.

## Billing and Settings

### `CurrencyStatus`
- `ACTIVE`: The currency is active and can be used in transactional forms.
- `INACTIVE`: The currency is disabled for new transactions but kept for historical records.

### `TaxStatus`
- `ACTIVE`: The tax rate is available for use.
- `INACTIVE`: The tax rate is no longer applicable for new documents.

## CRM

### `LeadStatus`
- `OPEN`: Lead is actively being worked.
- `CONVERTED`: Lead has been successfully converted into a customer.
- `DISQUALIFIED`: Lead is not a good fit.
- `ON_HOLD`: Lead is paused.

### `LeadProfileType` & `CustomerProfileType`
- `INDIVIDUAL`: A B2C retail person.
- `CORPORATE`: A B2B organization entity.

### `OpportunityStatus`
- `IN_PROGRESS`: Actively moving through pipeline stages.
- `WON`: Successfully closed.
- `LOST`: Closed without success.
- `ON_HOLD`: Opportunity is temporarily suspended.

## Trade

### `DocumentState` (Quotations & Sales Orders)
- `DRAFT`: Actively being prepared.
- `SENT`: Transmitted to the customer (Quotations).
- `ACCEPTED`: Approved by customer (Quotations).
- `CONFIRMED`: Finalized and locked for fulfillment (Sales Orders).
- `ON_HOLD`: Temporarily blocked from fulfillment.
- `REJECTED`: Declined by customer.
- `CANCELED`: Canceled before fulfillment.
- `COMPLETED`: Fully fulfilled.

### `AccountStatus` (Commercial Accounts)
- `ACTIVE`: Available for trade transactions.
- `BLOCKED`: Prevented from new transactions.
- `ARCHIVED`: Soft-deleted.
