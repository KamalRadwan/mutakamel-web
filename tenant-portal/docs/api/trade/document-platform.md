# Trade Document Platform API

Base path: `/trade/document-profiles`

The Document Platform API manages the "Document Profiles" within the Trade module. A Document Profile dictates the rules, numbering sequences, printing layouts, and validation logic for specific business documents (e.g., distinguishing between a standard "Sales Order" vs. an "Export Sales Order").

## Endpoints

### `GET /trade/document-profiles`
Lists available document profiles based on operating context.
- **Permissions**: `trade.document_profile.read.*`
- **Response**: `200 OK`

### `POST /trade/document-profiles`
Creates a new document profile identity.
- **Permissions**: `trade.document_profile.manage.*`
- **Body**: `CreateDocumentProfileDto`
- **Response**: `201 Created`

### `POST /trade/document-profiles/:id/versions`
Creates a new draft configuration version for an existing document profile.
- **Permissions**: `trade.document_profile.manage.*`
- **Body**: `CreateDocumentProfileVersionDto`
- **Response**: `201 Created`

### `POST /trade/document-profile-versions/:id/validate`
Validates the internal logic, required fields, and numbering sequence associations for a profile version.
- **Permissions**: `trade.document_profile.validate.*`
- **Response**: `200 OK`

### `POST /trade/document-profile-versions/:id/publish`
Publishes the document profile version, making it actively usable when creating new B2B documents.
- **Permissions**: `trade.document_profile.publish.*`
- **Body**: `PublishDocumentProfileVersionDto`
- **Response**: `200 OK`
