# Tenant Portal Rules

- **Main branch only**: Always work directly on `main`. Never create or switch branches, check out another ref, detach HEAD, or create a worktree.
- **Branch safety check**: Before editing a repository, verify that `git branch --show-current` returns `main`. Otherwise, stop and ask the user; do not switch branches or move existing changes yourself.

- **Strict Port Assignment**: This application MUST strictly run on port `5002`. Never switch to any alternate port even for testing.
- **Styling**: Always use Tailwind CSS first for all Tenant Portal pages and components.
- **Navigation**: Always use `Link` from `next/link` for internal routes.
- **Design & Layout**: Build compact, modern tenant management workflows and dashboards that optimize screen real estate.
- **File Modifications**: Only modify files when explicitly requested by the user.
- **Continuous Documentation**: Update this `AGENTS.md` file whenever architectural decisions, ports, or portal-specific rules change.
- **Bilingual & Theme Standards (ar/en & dark/light)**: All UI pages, components, and layouts must seamlessly support Arabic (RTL) & English (LTR) language switching as well as Dark & Light mode switching using Tailwind logical properties (`start-*`, `end-*`, `ms-*`, `me-*`) and `@custom-variant dark`.
- **Separation of Logic and HTML View**: Separate component logic into custom hooks (`hooks/use<ComponentName>.ts`) and keep `.tsx` view components purely focused on TSX markup and Tailwind CSS.

