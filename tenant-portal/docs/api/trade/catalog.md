# Trade Catalog API

Base paths:
- `/trade/items`
- `/trade/uoms`
- `/trade/channels`

The Trade Catalog manages the central repository of master items (products/services), their unit of measure (UOM) configurations, and their specialized profiles per branch and distribution channel.

## Items

### `GET /trade/items`
Returns a paginated list of active items mapped to the operating context.
- **Permissions**: `trade.item.read.*`
- **Response**: `200 OK`

### `POST /trade/items/search`
Search items by complex queries.
- **Permissions**: `trade.item.read.*`
- **Body**: `CatalogSearchDto`
- **Response**: `200 OK`

### `GET /trade/items/:id`
Loads item details.
- **Permissions**: `trade.item.read.*`
- **Response**: `200 OK`

### `POST /trade/items`
Creates a master item in the catalog.
- **Permissions**: `trade.catalog_master.manage.*`
- **Body**: `CreateItemDto`
- **Response**: `201 Created`

### `PATCH /trade/items/:id`
Updates master item fields.
- **Permissions**: `trade.catalog_master.manage.*`
- **Body**: `UpdateItemDto`
- **Response**: `200 OK`

### `POST /trade/items/:id/company-profile`
Creates a company-level profile overlay for an item.
- **Permissions**: `trade.item.manage.*`
- **Body**: `UpsertItemCompanyProfileDto`
- **Response**: `201 Created`

### `PATCH /trade/items/:id/company-profile`
Updates a company-level profile overlay.
- **Permissions**: `trade.item.manage.*`
- **Response**: `200 OK`

### `POST /trade/items/:id/branch-profile`
Creates a branch-level profile overlay for localized configurations.
- **Permissions**: `trade.item.manage.*`
- **Response**: `201 Created`

### `PATCH /trade/items/:id/branch-profile`
Updates a branch-level profile overlay.
- **Permissions**: `trade.item.manage.*`
- **Response**: `200 OK`

### `POST /trade/items/:id/channel-listings`
Lists an item on a specific sales/distribution channel.
- **Permissions**: `trade.item.manage.*`
- **Response**: `201 Created`

### `PATCH /trade/items/:id/channel-listings/:channelId`
Updates an item's listing properties for a channel.
- **Permissions**: `trade.item.manage.*`
- **Response**: `200 OK`

## UOMs

### `GET /trade/uoms`
Lists Units of Measure.
- **Permissions**: `trade.item.read.*`
- **Response**: `200 OK`

### `GET /trade/uoms/:id`
Gets UOM detail.
- **Permissions**: `trade.item.read.*`
- **Response**: `200 OK`

### `POST /trade/uoms`
Creates a new UOM configuration.
- **Permissions**: `trade.catalog_master.manage.*`
- **Response**: `201 Created`

### `PATCH /trade/uoms/:id`
Updates UOM.
- **Permissions**: `trade.catalog_master.manage.*`
- **Response**: `200 OK`

## Channels

### `GET /trade/channels`
Lists available distribution channels.
- **Permissions**: `trade.item.read.*`
- **Response**: `200 OK`

### `POST /trade/channels`
Creates a new distribution channel.
- **Permissions**: `trade.item.manage.*`
- **Response**: `201 Created`

### `GET /trade/channels/:id`
Loads a channel detail.
- **Permissions**: `trade.item.read.*`
- **Response**: `200 OK`

### `PATCH /trade/channels/:id`
Updates a channel.
- **Permissions**: `trade.item.manage.*`
- **Response**: `200 OK`

### `POST /trade/channels/:id/branches`
Links a branch to a channel.
- **Permissions**: `trade.item.manage.*`
- **Response**: `201 Created`

### `PATCH /trade/channels/:id/branches/:branchId`
Updates branch linkage properties in a channel.
- **Permissions**: `trade.item.manage.*`
- **Response**: `200 OK`
