# Frontend Capability Matrix

Status: **Current source audit**

Last source verification: **2026-07-30**

This matrix describes the current working tree. `DONE` means source-integrated,
not live-authenticated or deployment-verified.

## Domain status

| Domain | Frontend label | Current evidence and remaining boundary |
| --- | --- | --- |
| Auth session | `DONE/PARTIAL/BROKEN` | Login, refresh, `/auth/me`, logout are real; accept invite, reset password, logout-all are missing; forgot password is simulated |
| Dashboard | `DONE/REFACTOR` | Real dashboard endpoint and unavailable states; five report pages are missing |
| Admin users/WebPhone | `DONE/PARTIAL` | User lifecycle, roles, WebPhone, and call logs use Core; self profile is missing |
| Roles/permissions | `DONE/PARTIAL/REFACTOR` | Real Core calls; ordinary metadata update must not require the critical permission; RBAC foundation lacks ANY |
| Database Servers | `DONE/REFACTOR` | CRUD/connectivity/history/lifecycle are real; filtering, error states, metrics, and typing remain weak |
| Storage Servers | `DONE/PARTIAL/GATED` | Bounded registry/history/verification/lifecycle is real; routing/rotation not exposed; attestation/recovery remain operator-safety gated |
| Tenants list/detail | `PARTIAL/BROKEN` | Some real calls; nested FQDN/user/subscription/wallet and local lifecycle behavior contain contract defects |
| Tenant creation | `PARTIAL/BROKEN` | Real Storage placement and quote-route attempts exist, but the quote body does not match Core and identity/plan/database/catalogue/FQDN work remains simulated or hardcoded |
| Tenant users/access | `PARTIAL/BROKEN` | Some real user calls; lifecycle methods and access catalogues are wrong/mock |
| Tenant operations | `PARTIAL/MISSING` | List/reconciliation foundation exists; operation-specific and managed-provisioning controls are largely absent |
| Provisioning governance | `MISSING` | 32 Gateway routes; no frontend module |
| Storage migration | `GATED` | Eight default-off routes; do not expose |
| Catalogue | `DONE/PARTIAL/REFACTOR` | Main CRUD/grants/pricing/currency/audit are integrated; module delete, global audit, batch rates, and Storage entitlements are absent |
| Subscriptions | `MISSING/PARTIAL/BROKEN` | Some tenant detail reads; cancellation path is wrong; administration and plan changes are absent |
| Wallet | `BROKEN/MISSING` | Local credit/debit calls nonexistent APIs; preview/confirm workflow is absent |
| Payments/reconciliation | `MISSING` | Five Gateway routes; no frontend module |
| Invoices | `MISSING` | Seven Gateway routes; no frontend module |
| Settings/SMTP | `DONE/PARTIAL/REFACTOR` | Real registry/auth/platform/notifications/Asterisk/SMTP foundation; permissions, fallbacks, and runtime-effect claims need tightening |
| Notifications | `MISSING` | Navbar uses static data; 14 REST routes are exposed |
| Logging | `MISSING` | Six routes including SSE; no frontend module |
| Control-plane audit | `MISSING` | Two immutable-evidence routes; no explorer |

## Confirmed false-live defects

| Defect | Current frontend evidence | Correct contract |
| --- | --- | --- |
| Separate tenant FQDN read | `src/app/tenants/[id]/hooks/useTenantDetail.ts` | Read `fqdns` from `GET /tenants/:id` |
| Tenant-user lifecycle method | Same hook uses `PATCH` | Use `POST` for suspend/activate/restore |
| Add FQDN body | Sends `{ domain }` | Send `{ fqdn }` |
| Primary FQDN method | Uses `PATCH` | Use `POST` |
| Subscription cancellation | Calls nested tenant route | `POST /subscriptions/:tenantId/cancel` |
| Wallet adjustment | Calls `/wallet/credit` and `/wallet/debit` | Preview then confirm with separate UUIDv7 intents |
| Access catalogues | Mock branch/department/team/role arrays | Use permission-specific access routes |
| Tenant creation | Sends undocumented `modules` to quote, then uses hardcoded `srv-*`, `YEARLY`, timers, and selections | Send Core `items`, use the source-verified sequence, and use `ANNUAL` |
| Forgot password | Timer-only behavior | Real auth route |
| Notifications | Static hook data | REST inbox/config/preferences/actions |

## Foundation gaps

- `axiosClient.ts` partially normalizes errors but remains loose and auto-owns
  mutation keys.
- `rbac.ts` lacks `adminCanAny`.
- `RequirePermission.tsx` supports only one permission.
- Tenant nested loading uses `Promise.allSettled` and discards independent
  failures.
- Some pagination still reads `totalItems` instead of `meta.total`.
- Financial UI still parses authoritative amounts as JavaScript numbers.
- API paths and projection types remain duplicated through large hooks.

## Gated work

### Existing-tenant Storage Server migration

Do not implement or expose. The default-off backend foundation does not yet
provide the complete safe placement/fence/current-operation/post-cutover
recovery projection the frontend needs. Ordinary tenant PATCH must never accept
`storageServerId`.

### Admin Realtime

Do not activate a Socket.IO client from this work. Use REST polling for
notifications while Admin Realtime lacks complete release/deployment evidence.

### Storage recovery

Do not collect/display access keys, secret keys, Ed25519 private keys, raw
fingerprints, or invented force activation. Keep attestation and recovery
controls gated until their operator evidence contract is confirmed.

## Evidence level for this matrix

- Source audit: yes.
- Generated Gateway route inventory: yes.
- Documentation checks: see current validation report.
- Authenticated live runtime: not established by this document.
- Deployment verification: not established by this document.
