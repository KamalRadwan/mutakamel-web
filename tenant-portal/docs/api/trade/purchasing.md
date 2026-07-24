# Trade Purchasing API

Base path: `/trade/purchase-orders`

The Trade Purchasing module orchestrates the B2B procurement lifecycle. It manages Purchase Orders issued to vendors to secure inventory or external services.

## Endpoints

### `GET /trade/purchase-orders`
Returns a paginated list of purchase orders across different lifecycle states.
- **Permissions**: `trade.purchase_order.read.*`
- **Response**: `200 OK`

### `POST /trade/purchase-orders`
Creates a draft purchase order directed at a vendor.
- **Permissions**: `trade.purchase_order.create.*`
- **Body**: `CreatePurchaseOrderDto`
- **Response**: `201 Created`

### `GET /trade/purchase-orders/:id`
Retrieves the details and line items of a purchase order.
- **Permissions**: `trade.purchase_order.read.*`
- **Response**: `200 OK`

### `PATCH /trade/purchase-orders/:id`
Updates quantities, expected dates, or vendor selections on a draft order.
- **Permissions**: `trade.purchase_order.update.*`
- **Body**: `UpdatePurchaseOrderDto`
- **Response**: `200 OK`

### `POST /trade/purchase-orders/:id/submit`
Submits the draft purchase order for internal management approval.
- **Permissions**: `trade.purchase_order.submit.*`
- **Body**: `PurchaseActionDto`
- **Response**: `200 OK`

### `POST /trade/purchase-orders/:id/withdraw`
Withdraws a previously submitted purchase order from the approval queue back to draft.
- **Permissions**: `trade.purchase_order.submit.*`
- **Response**: `200 OK`

### `POST /trade/purchase-orders/:id/approve`
Approves the purchase order, allowing it to be confirmed and sent to the vendor.
- **Permissions**: `trade.purchase_order.approve.*`
- **Response**: `200 OK`

### `POST /trade/purchase-orders/:id/reject`
Rejects the purchase order submission.
- **Permissions**: `trade.purchase_order.approve.*`
- **Response**: `200 OK`

### `POST /trade/purchase-orders/:id/confirm`
Locks and confirms the purchase order. It is now considered active and legally bound with the vendor.
- **Permissions**: `trade.purchase_order.confirm.*`
- **Response**: `200 OK`

### `POST /trade/purchase-orders/:id/cancel`
Cancels the purchase order before receiving goods.
- **Permissions**: `trade.purchase_order.cancel.*`
- **Response**: `200 OK`

### `POST /trade/purchase-orders/:documentId/render-pdf`
Dispatches an asynchronous job to render the purchase order document as a PDF.
- **Permissions**: `trade.purchase_order.read.*`
- **Body**: `RenderTradeBusinessPdfDto`
- **Response**: `202 Accepted`

### `GET /trade/purchase-orders/:documentId/render-jobs/:renderJobId`
Polls the PDF rendering job status and returns a presigned URL when completed.
- **Permissions**: `trade.purchase_order.read.*`
- **Response**: `200 OK`
