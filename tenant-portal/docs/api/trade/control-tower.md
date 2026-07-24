# Trade Control Tower API

Base path: `/trade/control-tower/exceptions`

The Control Tower acts as the operational oversight module for the Trade platform. It captures anomalies, data sync failures, and automation exceptions, allowing operators to manually retry or resolve them.

## Exceptions

### `GET /trade/control-tower/exceptions`
Returns a paginated list of system exceptions and blocked operations across Trade domains.
- **Permissions**: `trade.control_tower.read.*`
- **Response**: `200 OK`

### `GET /trade/control-tower/exceptions/:id`
Retrieves the full stack trace, payload, and operational context of an exception.
- **Permissions**: `trade.control_tower.read.*`
- **Response**: `200 OK`

### `POST /trade/control-tower/exceptions/:id/retry`
Dispatches a background job to re-attempt the failed operation using the original or updated payload.
- **Permissions**: `trade.control_tower.retry.*`
- **Body**: `RetryExceptionDto`
- **Response**: `202 Accepted`

### `POST /trade/control-tower/exceptions/:id/resolve`
Marks the exception as manually resolved or ignored, clearing it from the active operations queue.
- **Permissions**: `trade.control_tower.resolve.*`
- **Body**: `ResolveExceptionDto`
- **Response**: `200 OK`
