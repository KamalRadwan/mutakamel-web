# Phase 1 — Delete

Written: **2026-08-27**

Remove everything no user can reach. **Do this before any conversion work** —
it drops the UI conversion from 103 files to 25.

## Verify before deleting

Nothing outside these trees imports them. Confirm it yourself rather than
trusting this document:

```bash
grep -rn "features/crm/dashboards" src --include="*.ts" --include="*.tsx" | grep -v "^src/features/crm/dashboards"
grep -rnE 'from "@/app/\(tenant\)/(core|trade)/' src --include="*.ts" --include="*.tsx" | grep -v authentication
```

Both returned empty on 2026-08-27. If either returns a hit now, resolve it
before deleting.

## 1. Sealed Core routes — 3,776 lines

Everything under `src/app/(tenant)/core/` **except `authentication/`**:

```text
activities/                       organization/
billing-invoices-subscription/    party-directory/
business-letters/                 provisioning-updates/
currencies-taxes-numbering/       roles-role-assignments/
notifications-email-configuration/ template-platform/
user-module-assignments/          users/
wallet-payments/                  workspace-settings-branding/
```

All 14 hooks are local `useState` mock CRUD with **zero API calls**.
`core/users/hooks/useUsers.ts` ships three hardcoded Arabic-named users.

**Keep**: `core/authentication/`, `core/layout.tsx`, `core/page.tsx`.

## 2. Sealed Trade routes — 4,831 lines

The entire `src/app/(tenant)/trade/` tree except `layout.tsx` and `page.tsx`
(which renders the unavailable boundary):

```text
business-document-pdf-render-jobs/  invoices-contracts/
catalog-uom-channels/              policy-studio/
commercial-accounts-credit/        pricing-price-books/
configuration-scope/               purchase-orders/
control-tower/                     purchase-quotations/
dashboard-builder/                 quotations-sales-orders/
dashboard-widgets/                 workflow-versions/
document-profile-platform/         extension-profiles/
imports-webhooks/                  inventory/
```

The Trade **backend** is real — 231 Gateway routes, documented in
[../api/trade-reference.md](../api/trade-reference.md). Deleting this UI does
not touch those contracts. It removes 19 speculative mock screens.

## 3. Sealed CRM routes — 1,806 lines

```text
src/app/(tenant)/crm/activities-tasks-calendar-reminders/
src/app/(tenant)/crm/dashboard-builder-widgets/
src/app/(tenant)/crm/notes-attachments/
src/app/(tenant)/crm/opportunities-stage-history/
src/app/(tenant)/crm/outbound-emails/
src/app/(tenant)/crm/pipelines-boards-opportunity-stages/
src/app/(tenant)/crm/preset-dashboards/
```

## 4. Orphaned dashboards feature — 4,015 lines

```text
src/features/crm/dashboards/
```

Referenced by **no route**. Includes a 941-line `mega-demo-dashboard.ts` mock.

## 5. Old presentation layer — 2,156 lines

Delete **after** phase 3 has replacements, not now:

```text
src/components/ui/           Button, Input, Select, Modal, Table, Badge,
                             PageHeader, ConfirmModal, TableToolbar, ToastContext
src/components/layout/       Navbar, CoreNavbarLinks, CrmNavbarLinks,
                             NotificationsDropdown, UserDropdown,
                             PipelineSelectDropdown, ThemeToggle, LanguageToggle
src/components/shared/       CountrySelect
```

`ToastContext` is re-exported from the design system's `feedback/` — keep the
import path working during conversion, then delete.

## 6. Dependencies

After 1–4, these have zero reachable importers:

```bash
pnpm remove echarts echarts-for-react framer-motion react-grid-layout \
  react-hook-form @hookform/resolvers zustand recharts date-fns
```

`recharts` and `date-fns` already have **zero imports anywhere**.

Also remove them from `next.config.ts`'s `optimizePackageImports`, which
currently optimizes two packages that are never imported:

```ts
optimizePackageImports: ['lucide-react'],   // was ['lucide-react','date-fns','recharts']
```

**Keep**: `@hello-pangea/dnd` (board views), `zod` (notifications runtime),
`country-state-city` (until `CountrySelect` is replaced),
`@mutakamel/realtime-app-client`.

## 7. Route allowlist

Trim `src/lib/navigation/tenant-routes.ts` to only surviving routes, and
delete `isSupportedTradePath` along with the Trade tree. Update
`src/proxy.ts`'s matcher to drop `/trade/:path*`.

Update `src/proxy.test.ts` and `src/lib/navigation/tenant-routes.test.ts` in
the same commit — both assert on the removed paths.

## 8. Dead CSS

In `src/app/globals.css`, `.animate-bell-ring` is the only defined animation
and its only consumer is `NotificationsDropdown`, deleted in step 5. Remove the
keyframe when that component goes.

## Expected result

| Metric | Before | After |
| --- | ---: | ---: |
| `page.tsx` routes | 61 | 16 |
| Color utilities | 1,992 | ~1,052 |
| Runtime dependencies | 18 | 9 |
| Files importing `Button` | 103 | 25 |
| `src/` lines | ~30,800 | ~16,400 |

## Gate

```bash
rm -rf .next
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

All 181 tests must still pass, minus those asserting on deleted routes — which
you updated, not deleted. **If a test disappears, say so explicitly in your
commit message.** Silently dropping tests to make a gate green is the one
failure mode that makes everything downstream untrustworthy.

## Commit

One commit per numbered section, so any single deletion can be reverted
independently:

```text
chore(tenant-portal): delete sealed Core route scaffolds

14 route directories under (tenant)/core/ that src/proxy.ts redirects to
/unavailable. All hooks were local useState mock CRUD with zero API calls.
Backend Core contracts are unaffected and documented in docs/api/.

Keeps core/authentication/, which is server-backed.
```
