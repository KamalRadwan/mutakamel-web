# Glossary

Last source verification: **2026-07-30**

| Term | Meaning |
| --- | --- |
| Canonical browser path | Gateway path used by Admin Portal, normally `/api/admin/core/v1/*` |
| Upstream path | Internal Core controller path, normally `/api/v1/admin/*` |
| Exact retry | Same actor, method, path, query, and body using the original UUIDv7 idempotency key |
| Source-complete | Requested source exists and was verified; no runtime claim |
| Live authenticated | Exercised against running services with an authorized real session |
| Deployment-verified | Released artifact is confirmed running in the target environment |
| Forbidden | Authenticated actor lacks required permission; never equivalent to empty |
| Unavailable | Backend reports or documentation proves the capability cannot currently produce data |
| Terminal async failure | Accepted operation reached a non-retryable or manual-recovery terminal state |
| Safe projection | Public response that intentionally omits credentials, secrets, and unsafe operational evidence |
