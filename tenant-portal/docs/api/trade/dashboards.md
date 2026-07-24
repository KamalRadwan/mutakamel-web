# Trade Custom Dashboards API

Base paths:
- `/trade/dashboards`
- `/trade/widgets`

The Trade Dashboards API provides a fully-customizable analytics engine. Unlike the hardcoded CRM dashboards, this module allows users to define custom SQL/Metric widgets, place them on flexible grid layouts, and share them across teams.

## Dashboards

### `GET /trade/dashboards/catalog`
Returns a catalog of available default or public dashboards.
- **Permissions**: `trade.dashboard.read.*`
- **Response**: `200 OK`

### `GET /trade/dashboards`
Lists dashboards owned by or shared with the current user.
- **Permissions**: `trade.dashboard.read.*`
- **Response**: `200 OK`

### `POST /trade/dashboards`
Creates a new empty dashboard definition.
- **Permissions**: `trade.dashboard.create.*`
- **Body**: `CreateDashboardDto`
- **Response**: `201 Created`

### `GET /trade/dashboards/:id`
Retrieves a specific dashboard layout and its widget placements.
- **Permissions**: `trade.dashboard.read.*`
- **Response**: `200 OK`

### `PATCH /trade/dashboards/:id`
Updates dashboard metadata (name, description).
- **Permissions**: `trade.dashboard.update.*`
- **Response**: `200 OK`

### `PATCH /trade/dashboards/:id/layout`
Atomically replaces the X/Y coordinate layout grid for widget placements.
- **Permissions**: `trade.dashboard.update.*`
- **Response**: `200 OK`

### `POST /trade/dashboards/:id/run`
Executes the data fetching for all widgets placed on the dashboard.
- **Permissions**: `trade.dashboard.read.*`
- **Response**: `200 OK`

### `POST /trade/dashboards/:id/shares/bulk-upsert`
Shares the dashboard with specific users or teams.
- **Permissions**: `trade.dashboard.share.*`
- **Response**: `200 OK`

## Widgets

### `GET /trade/widgets`
Lists reusable custom widgets.
- **Permissions**: `trade.widget.read.*`
- **Response**: `200 OK`

### `POST /trade/widgets`
Creates a new custom metric or chart widget definition.
- **Permissions**: `trade.widget.create.*`
- **Body**: `CreateWidgetDto`
- **Response**: `201 Created`

### `POST /trade/widgets/preview`
Simulates running the widget against live data before saving.
- **Permissions**: `trade.dashboard.read.*`
- **Response**: `200 OK`
