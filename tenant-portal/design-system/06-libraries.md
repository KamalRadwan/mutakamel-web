# Libraries (Angular 22)

The design is custom, so build on headless libraries. Do not adopt a styled UI kit.

| Area | Library |
|---|---|
| Core | `@angular/cdk`, `@angular/aria`, Signal Forms, Router, HttpClient |
| Styling | Tailwind CSS 4 over CSS variables (these tokens) + logical properties |
| Translation | `@jsverse/transloco` |
| Icons | `@ng-icons/core` + `@ng-icons/tabler-icons` |
| Flags | `flag-icons` |
| Dates | `date-fns` |
| Fonts | `@fontsource/tajawal` (Arabic subset), `@fontsource-variable/readex-pro` (Latin subset only) |
| Charts | `echarts` + `ngx-echarts`; stat-card sparklines as hand-written SVG |
| Dashboard grid | `gridstack` v12+ (`column: 48`, `cellHeight: 8`; no extra CSS needed for 48 columns) |
| Kanban drag | `@atlaskit/pragmatic-drag-and-drop` (verify the lifted, rotated card look with a prototype of 2000 cards) |
| Simple drag (row reorder) | `@angular/cdk/drag-drop` |
| Tables and virtual scroll | `@tanstack/angular-table` + `@tanstack/angular-virtual` |
| Server data and cache | `@tanstack/angular-query` (one tool for all server state) |
| Validation | `zod` |
| Motion | `animate.enter` / `animate.leave` with CSS |

Built in-house on the CDK: toasts, date pickers, monthly agenda, org chart, notification panel.

Not allowed: `@angular/animations` (legacy), PrimeNG (license), any styled component kit.

Tailwind lock: see Platform and behavior for the allowed steps. A lint script rejects bracket values and off-scale numeric steps.
