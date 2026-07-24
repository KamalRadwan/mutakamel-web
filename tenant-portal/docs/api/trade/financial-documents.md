# Trade Financial Documents API

Base paths:
- `/trade/invoices`
- `/trade/contracts`

The Financial Documents module manages the billing and legal structures around trade operations. It tracks the issuance of invoices from confirmed sales orders or direct sales, and formal contracts governing vendor or customer terms.

## Invoices

### `GET /trade/invoices`
Returns a paginated list of invoices associated with the branch.
- **Permissions**: `trade.invoice.read.*`
- **Response**: `200 OK`

### `POST /trade/invoices`
Creates a draft invoice from a sales order or standard product lines.
- **Permissions**: `trade.invoice.create.*`
- **Body**: `CreateInvoiceDto`
- **Response**: `201 Created`

### `GET /trade/invoices/:id`
Loads the complete detail of a specific invoice.
- **Permissions**: `trade.invoice.read.*`
- **Response**: `200 OK`

### `PATCH /trade/invoices/:id`
Updates a draft invoice before issuance.
- **Permissions**: `trade.invoice.update.*`
- **Body**: `UpdateInvoiceDto`
- **Response**: `200 OK`

### `POST /trade/invoices/:id/issue`
Finalizes and locks the draft invoice, transitioning it to the `ISSUED` state. This makes it a legally binding financial document.
- **Permissions**: `trade.invoice.issue.*`
- **Response**: `200 OK`

## Contracts

### `GET /trade/contracts`
Returns a paginated list of contracts within the branch scope.
- **Permissions**: `trade.contract.read.*`
- **Response**: `200 OK`

### `POST /trade/contracts`
Creates a new draft contract.
- **Permissions**: `trade.contract.create.*`
- **Body**: `CreateContractDto`
- **Response**: `201 Created`

### `GET /trade/contracts/:id`
Loads the complete details of a specific contract.
- **Permissions**: `trade.contract.read.*`
- **Response**: `200 OK`

### `PATCH /trade/contracts/:id`
Updates terms or dates on a draft contract.
- **Permissions**: `trade.contract.update.*`
- **Body**: `UpdateContractDto`
- **Response**: `200 OK`

### `POST /trade/contracts/:id/activate`
Activates the contract, locking its terms and applying it to future operational queries.
- **Permissions**: `trade.contract.activate.*`
- **Response**: `200 OK`
