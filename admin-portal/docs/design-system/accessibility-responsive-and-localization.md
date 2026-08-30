# Accessibility, Responsive Behavior, and Localization

Status: **[Source remediation implemented; conformance verification pending]**

Design approval: **2026-08-29**

Current-source audit: **2026-08-29**

Owner: **Admin Portal**

## Conformance target

The Admin Portal targets WCAG 2.2 AA for supported browser workflows. Passing
lint or an RTL utility guard is not accessibility evidence; keyboard, screen
reader, zoom, contrast, reduced-motion, and responsive behavior require runtime
verification.

Shared source remediation and unit coverage are complete. Public runtime
observations cover selected auth states only and are recorded in the
[UI quality matrix](../audit/ui-quality-matrix.md). They do not establish WCAG
conformance for protected routes.

## Keyboard and focus

- Every interaction is reachable and operable without a pointer.
- A skip link is the first focusable shell control and targets a focusable
  `<main>` region.
- Route changes move focus to the page heading or main region without stealing
  focus during background updates.
- Focus uses the semantic ring token and is never removed without an equivalent.
- Sticky headers, bottom docks, dialogs, and the WebPhone may not obscure the
  focused element.
- Menus, listboxes, tabs, dialogs, and comboboxes use established Radix or WAI-ARIA
  behavior rather than partial hand-built keyboard models.
- Closing a transient layer returns focus to the control that opened it unless
  the action intentionally moved the workflow elsewhere.

## Names, labels, and feedback

- Every form control has a persistent visible label and a programmatic name.
- Icon-only controls have localized accessible names; `title` alone is not the
  contract.
- Required, invalid, hint, and error state are programmatically associated.
- A single field failure focuses that field. Multiple field failures focus a
  summary that links to every invalid field. A submission-level error with no
  field target focuses its persistent alert.
- Native browser validation is used only when its language and behavior match
  the application. Otherwise, controlled localized validation is authoritative.
- Live announcements are concise, contextual, and centralized; bare changing
  numbers are not useful status messages.

## Target sizes and density

| Context | Minimum requirement |
| --- | --- |
| Bare web target | 24×24px with adequate separation |
| Touch or coarse pointer | 44×44px interaction area |
| Compact desktop control | 32–36px visible box, with a real expanded hit area when needed |
| Mobile text input | 16px rendered text where browser zoom behavior requires it |

Hit-area expansion must be implemented and tested; documentation may not claim
an invisible target expansion that the primitive does not render.

## Responsive task policy

The route and permission model is shared across breakpoints. Layout changes;
capability and deep-link meaning do not.

| Width/context | Product expectation |
| --- | --- |
| 320–414px | Monitoring, search, approvals, status changes, urgent actions, and guided full-screen configuration |
| 768px tablet | Full workflows with simplified navigation and reduced simultaneous columns |
| 1024px+ desktop | Full data-dense administration and side-by-side operational context |
| Coarse pointer at any width | Comfortable target areas and non-hover access |

Complex mobile configuration may become a full-screen step flow, but it must not
be blocked merely because the device is narrow.

### Shell behavior

- At 320–360px, the topbar prioritizes menu, page identity, and urgent status.
  Search, language, notifications, and user actions may move into explicit
  overflow surfaces.
- Long subnavigation uses a labelled overflow/scroller or compact selector with
  a visible current location.
- Breadcrumbs collapse intermediate labels but preserve the parent path for
  assistive technology.
- The WebPhone reserves safe space or uses a non-obscuring presentation. Incoming
  calls use alert-dialog behavior with initial focus and focus return.
- Fixed controls respect viewport and safe-area insets.

## Bilingual typography

- Retain IBM Plex Sans, IBM Plex Sans Arabic, and IBM Plex Mono.
- Product text is at least 13px, including Latin uppercase micro-labels.
- Arabic-capable microcopy is at least 13px, normal case, and zero tracking.
- Arabic `text-xs`, `text-sm`, and `text-base` retain the documented optical lift.
- Truncation is tested with real long Arabic names; critical identifiers remain
  copyable and available in full.
- Direction changes layout, navigation keys, disclosure placement, progress
  direction, and logical alignment—not the semantic order of chronological data.

## Numbers, dates, identifiers, and bidirectionality

- Use explicit `ar-EG` or `en-US` locale formatting; never rely on runtime default.
- Arabic uses `ar-EG` locale-default digits and English uses `en-US`. Do not add
  per-screen numeral overrides that conflict with this product decision.
- Every date/time identifies or inherits a documented timezone.
- Currency and units remain explicit; authoritative decimal strings are not
  converted with floating-point arithmetic.
- Email addresses, URLs, IP addresses, UUIDs, correlation IDs, and idempotency
  keys use isolated LTR rendering inside Arabic text.
- Copy actions announce completion without changing the displayed identifier.

## Contrast and non-color signals

- Normal text meets at least 4.5:1 contrast.
- Large text and meaningful component boundaries meet applicable AA contrast.
- Focus indicators and control boundaries target at least 3:1 against adjacent
  colors.
- Disabled state remains legible and is not communicated by opacity alone.
- Status and chart meaning always includes text, icon, shape, pattern, or value.

## Motion

- Nonessential animation stops under `prefers-reduced-motion: reduce` and renders
  the stable end state immediately.
- Loading motion uses one purposeful indicator per region.
- Infinite pulse is reserved for genuinely live/in-progress state and remains
  accompanied by text.
- No essential information is revealed only through animation.

## Performance and stability budgets

Targets for representative authenticated routes:

- Largest Contentful Paint: 2.5s or better under the agreed test profile.
- Interaction to Next Paint: 200ms or better for common controls.
- Cumulative Layout Shift: below 0.1.
- Route and data loading reserve dimensions for tables, charts, and panels.
- Below-fold charts and expensive optional dialogs load lazily.
- Search/filter requests are debounced or cancelled without delaying local input.

Performance targets do not justify removing labels, focus behavior, status
announcements, or authoritative reconciliation.

## Verification matrix

Representative routes include authentication, dashboard, tenant directory and
creation, tenant detail, database/storage servers, backup, settings, audit/logging,
and the WebPhone.

Test each applicable route across:

- English/LTR and Arabic/RTL;
- light and dark themes;
- 320, 360, 375, 414, 768, 1024, and 1440px widths;
- keyboard-only operation;
- screen-reader smoke testing;
- touch/coarse-pointer operation;
- 200% zoom, 400% reflow where applicable, and text resizing;
- reduced motion;
- contrast and non-color state differentiation;
- slow, failed, stale, partial, forbidden, and ambiguous network states.

Every recorded result includes commit/build and environment identity, operating
system or device, browser/version, input type, and—when `SR` evidence is
claimed—screen reader and version. Without that metadata, the result is a
preliminary observation rather than repeatable conformance evidence.

Authenticated runtime verification is a separate evidence level from source,
lint, typecheck, unit tests, and build completion.

The current remaining gates include real long-Arabic truncation, the complete
width matrix, 200% zoom and 400% reflow, coarse-pointer behavior, keyboard-only
completion, screen-reader smoke tests, CVD review, and the LCP/INP/CLS budgets.
None is implied by source completion or the limited 320px public observations.
