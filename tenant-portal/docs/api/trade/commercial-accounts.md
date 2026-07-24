# Trade Commercial Accounts API

Base path: `/trade/commercial-accounts`

The Commercial Accounts module manages the centralized accounts for trade customers and vendors, tracking their financial terms, credit exposure, and branch-specific rules.

## Endpoints

### `GET /trade/commercial-accounts`
List commercial accounts accessible to the operating context.
- **Permissions**: `trade.commercial_account.read.*`
- **Response**: `200 OK`

### `POST /trade/commercial-accounts`
Creates a new commercial account.
- **Permissions**: `trade.commercial_account.manage.*`
- **Body**: `CreateCommercialAccountDto`
- **Response**: `201 Created`

### `GET /trade/commercial-accounts/:id`
Loads the details of a commercial account.
- **Permissions**: `trade.commercial_account.read.*`
- **Response**: `200 OK`

### `PATCH /trade/commercial-accounts/:id`
Updates a commercial account.
- **Permissions**: `trade.commercial_account.manage.*`
- **Body**: `UpdateCommercialAccountDto`
- **Response**: `200 OK`

### `POST /trade/commercial-accounts/:id/branch-rules`
Creates branch-specific operational rules for the account.
- **Permissions**: `trade.commercial_account.manage.*`
- **Body**: `CreateAccountBranchRuleDto`
- **Response**: `201 Created`

### `PATCH /trade/commercial-accounts/:id/branch-rules/:branchId`
Updates branch-specific operational rules for the account.
- **Permissions**: `trade.commercial_account.manage.*`
- **Body**: `UpdateAccountBranchRuleDto`
- **Response**: `200 OK`

### `POST /trade/commercial-accounts/:id/evaluate-credit`
Evaluates an account's credit status against a proposed transaction amount.
- **Permissions**: `trade.credit.view.*`
- **Body**: `CreditEvaluationDto`
- **Response**: `200 OK`

### `POST /trade/commercial-accounts/:id/block`
Transitions the account to a BLOCKED state, preventing new transactions.
- **Permissions**: `trade.commercial_account.manage.*`
- **Body**: `AccountTransitionDto`
- **Response**: `200 OK`

### `POST /trade/commercial-accounts/:id/unblock`
Transitions a blocked account back to an ACTIVE state.
- **Permissions**: `trade.commercial_account.manage.*`
- **Body**: `AccountTransitionDto`
- **Response**: `200 OK`
