# Trade Configuration Scope API

Base path: `/trade/configuration`

The Configuration Scope API manages hierarchical, context-aware settings across the Trade platform. Configurations can be defined globally at the Tenant level, and then overridden at the Company, Branch, or User level.

## Endpoints

### `GET /trade/configuration/definitions`
Lists available configuration definitions and schemas.
- **Permissions**: `trade.configuration.read.*`
- **Response**: `200 OK`

### `POST /trade/configuration/definitions`
Creates a new master configuration definition.
- **Permissions**: `trade.configuration.manage.tenant`
- **Body**: `CreateConfigurationDefinitionDto`
- **Response**: `201 Created`

### `POST /trade/configuration/definitions/:id/versions`
Creates a new draft version for a specific configuration definition.
- **Permissions**: `trade.configuration.manage.*`
- **Response**: `201 Created`

### `POST /trade/configuration/versions/:id/test`
Validates a configuration version against the definition schema without publishing it.
- **Permissions**: `trade.configuration.manage.*`
- **Response**: `200 OK`

### `POST /trade/configuration/versions/:id/publish`
Publishes the configuration version, making it the active value for its assigned scope level.
- **Permissions**: `trade.policy.publish.*`
- **Response**: `200 OK`

### `POST /trade/configuration/resolve`
Evaluates the hierarchical configuration stack and returns the finalized configuration values applicable to the current user's operating context (branch/company).
- **Permissions**: `trade.configuration.read.*`
- **Body**: `ResolveConfigurationDto`
- **Response**: `200 OK`
