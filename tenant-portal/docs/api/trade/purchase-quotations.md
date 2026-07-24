# Trade Purchase Quotations API

Base path: `/trade/purchase-quotations`

The Purchase Quotations module manages Requests for Quotation (RFQs) and the quotes received from vendors prior to committing to a formal Purchase Order.

## Endpoints

### `GET /trade/purchase-quotations`
Returns a paginated list of purchase quotations.
- **Permissions**: `trade.purchase_quotation.read.*`
- **Response**: `200 OK`

### `POST /trade/purchase-quotations/search`
Searches purchase quotations using complex queries and filters.
- **Permissions**: `trade.purchase_quotation.read.*`
- **Response**: `200 OK`

### `GET /trade/purchase-quotations/:id`
Retrieves full details of a specific purchase quotation.
- **Permissions**: `trade.purchase_quotation.read.*`
- **Response**: `200 OK`

### `POST /trade/purchase-quotations`
Creates a draft purchase quotation, effectively functioning as an RFQ log.
- **Permissions**: `trade.purchase_quotation.create.*`
- **Body**: `CreatePurchaseQuotationDto`
- **Response**: `201 Created`

### `PATCH /trade/purchase-quotations/:id`
Updates draft quotation details (e.g., adding vendor prices once received).
- **Permissions**: `trade.purchase_quotation.update.*`
- **Body**: `UpdatePurchaseQuotationDto`
- **Response**: `200 OK`

### `POST /trade/purchase-quotations/:id/issue`
Finalizes the quotation and transitions it to an issued state, allowing it to be sourced for generating Purchase Orders.
- **Permissions**: `trade.purchase_quotation.issue.*`
- **Response**: `200 OK`
