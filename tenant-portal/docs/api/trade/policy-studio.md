# Trade Policy Studio API

Base paths:
- `/trade/policies`
- `/trade/policy-versions`
- `/trade/workflows`
- `/trade/workflow-versions`
- `/trade/decisions`

The Policy Studio governs business rules across the Trade module. This includes dynamic discount matrices, commission rules, and pricing policies. Policies and Workflows are governed by a strict lifecycle (Draft -> Submit -> Approve -> Publish).

## Policies

### `GET /trade/policies`
Lists high-level policy definitions.
- **Permissions**: `trade.policy.read.*`
- **Response**: `200 OK`

### `POST /trade/policies`
Creates a new policy definition.
- **Permissions**: `trade.policy.manage.*`
- **Body**: `CreatePolicyDefinitionDto`
- **Response**: `201 Created`

### `POST /trade/policies/:id/versions`
Creates a new draft version for a policy.
- **Permissions**: `trade.policy.manage.*`
- **Response**: `201 Created`

### `PATCH /trade/policy-versions/:id`
Updates logic and rules on a draft policy version.
- **Permissions**: `trade.policy.manage.*`
- **Response**: `200 OK`

### `POST /trade/policy-versions/:id/validate`
Validates the syntax and references of a policy version.
- **Permissions**: `trade.policy.test.*`
- **Response**: `200 OK`

### `POST /trade/policy-versions/:id/test`
Runs a simulation test on the policy version.
- **Permissions**: `trade.policy.test.*`
- **Response**: `200 OK`

### `POST /trade/policy-versions/:id/submit`
Submits a policy version for approval.
- **Permissions**: `trade.policy.manage.*`
- **Response**: `200 OK`

### `POST /trade/policy-versions/:id/approve`
Approves a submitted policy version.
- **Permissions**: `trade.policy.approve.*`
- **Response**: `200 OK`

### `POST /trade/policy-versions/:id/reject`
Rejects a submitted policy version.
- **Permissions**: `trade.policy.approve.*`
- **Response**: `200 OK`

### `POST /trade/policy-versions/:id/publish`
Publishes the approved policy version, making it the active evaluation rule.
- **Permissions**: `trade.policy.publish.*`
- **Response**: `200 OK`

### `POST /trade/policy-versions/:id/retire`
Retires an active policy version.
- **Permissions**: `trade.policy.publish.*`
- **Response**: `200 OK`

### `POST /trade/policy-versions/:id/rollback`
Rolls back to the previous published version.
- **Permissions**: `trade.policy.publish.*`
- **Response**: `200 OK`

## Workflows

### `GET /trade/workflows`
Lists business workflow definitions.
- **Permissions**: `trade.policy.read.*`
- **Response**: `200 OK`

### `POST /trade/workflows`
Creates a new workflow definition.
- **Permissions**: `trade.policy.manage.*`
- **Response**: `201 Created`

*(Workflow versions follow the exact same lifecycle endpoints `validate`, `test`, `submit`, `approve`, `reject`, `publish`, `retire`, `rollback` as Policy versions, but scoped under `/trade/workflow-versions/:id`).*

## Decisions

### `GET /trade/decisions/:id`
Fetches the trace logs and results of a specific policy execution decision.
- **Permissions**: `trade.policy.read.*`
- **Response**: `200 OK`
