# Trade Inventory & Pricing API

Base paths:
- `/trade/inventory`
- `/trade/pricing`

The Trade Inventory & Pricing modules govern the availability and cost rules for catalog items. They evaluate stock levels, manage reservations, and resolve dynamic pricing constraints.

## Inventory

### `GET /trade/inventory/stock`
Reads stock availability for specific items across branches or warehouses.
- **Permissions**: `trade.inventory.read.*`
- **Response**: `200 OK`

### `POST /trade/inventory/reservations`
Places an explicit hold or reservation on inventory quantities.
- **Permissions**: `trade.inventory.reserve.*`
- **Response**: `201 Created`

### `DELETE /trade/inventory/reservations/:id`
Releases an explicit inventory hold.
- **Permissions**: `trade.inventory.reserve.*`
- **Response**: `204 No Content`

## Pricing

### `GET /trade/pricing/evaluate`
Evaluates the final price for an item based on customer profile, quantity, and date.
- **Permissions**: `trade.pricing.read.*`
- **Response**: `200 OK`

### `POST /trade/pricing/price-locks`
Acquires a price lock (guarantee) for a specified duration during checkout flows.
- **Permissions**: `trade.pricing.lock.*`
- **Response**: `201 Created`
