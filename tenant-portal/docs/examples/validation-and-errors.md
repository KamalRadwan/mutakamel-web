# Validation and Error Example

Status: **Pattern only**

Last verified: **2026-07-25**

## Optional versus nullable

Given a DTO where `note?: string | null`:

```ts
function mapNote(input: { note: string; clearNote: boolean }) {
  if (input.clearNote) return { note: null };
  const value = input.note.trim();
  return value ? { note: value } : {};
}
```

Omitted means no update; `null` means clear only when the DTO supports it.

## Field errors

```ts
type NormalizedError = {
  status: number;
  code?: string;
  category?: string;
  message: string;
  fields: Record<string, string[]>;
  correlationId?: string;
};

function applyServerErrors(
  error: NormalizedError,
  setFieldError: (path: string, message: string) => void,
) {
  for (const [path, messages] of Object.entries(error.fields)) {
    if (path !== "_" && messages[0]) setFieldError(path, messages[0]);
  }
}
```

Unknown paths go to a form summary rather than creating arbitrary form fields.

## Conflict

```ts
if (error.status === 409) {
  await reloadAuthoritativeResource();
  showConflict({
    code: error.code,
    correlationId: error.correlationId,
  });
}
```

Do not silently resubmit after a conflict.

## Rate limit

```ts
const retryAfter = parseBoundedRetryAfter(response.headers.get("retry-after"));
```

Preserve safe user input, stop repeated requests, and show a bounded retry time.
Do not allow an invalid/malicious header to create an unbounded timer.
