# Partner Portal Rules

- **Main branch only**: Always work directly on `main`. Never create or switch branches, check out another ref, detach HEAD, or create a worktree.
- **Branch safety check**: Before editing a repository, verify that `git branch --show-current` returns `main`. Otherwise, stop and ask the user; do not switch branches or move existing changes yourself.

- **Strict Port Assignment**: This application MUST strictly run on port `5003`. Never switch to any alternate port even for testing.
- **Styling**: Always use Tailwind CSS first for all Partner Portal pages and components.
- **Navigation**: Always use `Link` from `next/link` for internal routes.
- **Design & Layout**: Ensure partner dashboards and data views use dense, elegant, and space-efficient layouts.
- **Strict Design System Adherence**: Always strictly follow the Partner Portal design system. Never introduce arbitrary or inconsistent styles outside the design system tokens, patterns, and barrel imports (`@/design-system`).
- **UI/UX Intelligence (`ui-ux-pro-max`)**: Always use and consult the `ui-ux-pro-max` skill for UI and UX guidelines, accessibility standards, color palettes, and interaction patterns BEFORE starting any UI or UX design.
- **File Modifications**: Only modify files when explicitly requested by the user.
- **Continuous Documentation**: Update this `AGENTS.md` file whenever architectural decisions, ports, or portal-specific rules change.
- **Bilingual & Theme Standards (ar/en & dark/light)**: All UI pages, components, and layouts must seamlessly support Arabic (RTL) & English (LTR) language switching as well as Dark & Light mode switching using Tailwind logical properties (`start-*`, `end-*`, `ms-*`, `me-*`) and `@custom-variant dark`.
- **Separation of Logic and HTML View**: Separate component logic into custom hooks (`hooks/use<ComponentName>.ts`) and keep `.tsx` view components purely focused on TSX markup and Tailwind CSS.

