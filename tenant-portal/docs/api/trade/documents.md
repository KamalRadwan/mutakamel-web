# Trade Documents API

Base paths:
- `/trade/quotations`
- `/trade/sales-orders`

The Trade Documents module handles the lifecycle of transactional business documents, from draft quotations to confirmed sales orders, including PDF rendering and state transitions.

## Quotations

### `GET /trade/quotations`
Lists quotations within the operating branch scope.
- **Permissions**: `trade.quotation.read.*`
- **Response**: `200 OK`

### `POST /trade/quotations/search`
Searches quotations using complex filters.
- **Permissions**: `trade.quotation.read.*`
- **Response**: `200 OK`

### `GET /trade/quotations/customer-options`
Lists viable customer accounts for quotation creation.
- **Permissions**: `trade.quotation.create.*`
- **Response**: `200 OK`

### `GET /trade/quotations/:id`
Retrieves a specific quotation.
- **Permissions**: `trade.quotation.read.*`
- **Response**: `200 OK`

### `POST /trade/quotations`
Creates a new draft quotation.
- **Permissions**: `trade.quotation.create.*`
- **Body**: `CreateQuotationDto`
- **Response**: `201 Created`

### `PATCH /trade/quotations/:id`
Updates a draft quotation.
- **Permissions**: `trade.quotation.update.*`
- **Response**: `200 OK`

### `POST /trade/quotations/:id/revisions`
Creates a new revision of a quotation.
- **Permissions**: `trade.quotation.update.*`
- **Response**: `201 Created`

### `POST /trade/quotations/:id/send`
Marks the quotation as sent to the customer.
- **Permissions**: `trade.quotation.send.*`
- **Response**: `200 OK`

### `POST /trade/quotations/:id/accept`
Marks the quotation as accepted by the customer.
- **Permissions**: `trade.quotation.accept.*`
- **Response**: `200 OK`

### `POST /trade/quotations/:id/reject`
Marks the quotation as rejected.
- **Permissions**: `trade.quotation.reject.*`
- **Response**: `200 OK`

### `POST /trade/quotations/:id/cancel`
Cancels the quotation.
- **Permissions**: `trade.quotation.cancel.*`
- **Response**: `200 OK`

### `POST /trade/quotations/:id/convert-to-sales-order`
Converts an accepted quotation into a sales order.
- **Permissions**: `trade.quotation.convert.*`
- **Response**: `201 Created`

### `POST /trade/quotations/:quotationId/render-pdf`
Dispatches a background job to render the quotation to PDF.
- **Permissions**: `trade.quotation.read.*`
- **Response**: `202 Accepted`

### `GET /trade/quotations/:quotationId/render-jobs/:renderJobId`
Polls the status of the PDF rendering job.
- **Permissions**: `trade.quotation.read.*`
- **Response**: `200 OK`

## Sales Orders

### `GET /trade/sales-orders`
Lists sales orders.
- **Permissions**: `trade.sales_order.read.*`
- **Response**: `200 OK`

### `POST /trade/sales-orders`
Creates a new draft sales order.
- **Permissions**: `trade.sales_order.create.*`
- **Body**: `CreateSalesOrderDto`
- **Response**: `201 Created`

### `GET /trade/sales-orders/:id`
Retrieves a sales order.
- **Permissions**: `trade.sales_order.read.*`
- **Response**: `200 OK`

### `PATCH /trade/sales-orders/:id`
Updates a draft sales order.
- **Permissions**: `trade.sales_order.update.*`
- **Response**: `200 OK`

### `POST /trade/sales-orders/:id/confirm`
Attempts to confirm the sales order. This may trigger inventory reservations asynchronously.
- **Permissions**: `trade.sales_order.confirm.*`
- **Response**: `200 OK` or `202 Accepted`

### `GET /trade/sales-orders/:id/confirmation-attempts/:attemptId`
Polls the status of a confirmation attempt.
- **Permissions**: `trade.sales_order.read.*`
- **Response**: `200 OK`

### `POST /trade/sales-orders/:id/confirmation-attempts/:attemptId/cancel`
Cancels a pending confirmation attempt.
- **Permissions**: `trade.sales_order.confirm.*`
- **Response**: `200 OK`

### `POST /trade/sales-orders/:id/hold`
Places the sales order on hold.
- **Permissions**: `trade.sales_order.hold.*`
- **Response**: `200 OK`

### `POST /trade/sales-orders/:id/release-hold`
Releases the sales order from hold.
- **Permissions**: `trade.sales_order.hold.*`
- **Response**: `200 OK`

### `POST /trade/sales-orders/:id/cancel`
Cancels the sales order.
- **Permissions**: `trade.sales_order.cancel.*`
- **Response**: `200 OK`

### `POST /trade/sales-orders/:documentId/render-pdf`
Dispatches a background job to render the sales order to PDF.
- **Permissions**: `trade.sales_order.read.*`
- **Response**: `202 Accepted`

### `GET /trade/sales-orders/:documentId/render-jobs/:renderJobId`
Polls the status of the PDF rendering job.
- **Permissions**: `trade.sales_order.read.*`
- **Response**: `200 OK`
