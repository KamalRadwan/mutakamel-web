# Tenant Portal Rules

- **Main branch only**: Always work directly on `main`. Never create or switch branches, check out another ref, detach HEAD, or create a worktree.
- **Branch safety check**: Before editing a repository, verify that `git branch --show-current` returns `main`. Otherwise, stop and ask the user; do not switch branches or move existing changes yourself.

- **Strict Port Assignment**: This application MUST strictly run on port `5002`. Never switch to any alternate port even for testing.
- **Styling**: Always use Tailwind CSS first for all Tenant Portal pages and components.
- **Navigation**: Always use `Link` from `next/link` for internal routes.
- **Design & Layout**: Build compact, modern tenant management workflows and dashboards that optimize screen real estate.
- **Strict Design System Adherence**: Always strictly follow the Tenant Portal design system (`docs/design/` and `src/design-system/`). Import exclusively from `@/design-system` and conform strictly to defined tokens, components, and layout metrics without inventing ad-hoc styles.
- **UI/UX Intelligence (`ui-ux-pro-max`)**: Always use and consult the `ui-ux-pro-max` skill for UI and UX guidelines, accessibility standards, color palettes, and interaction patterns BEFORE starting any UI or UX design.
- **File Modifications**: Only modify files when explicitly requested by the user.
- **Continuous Documentation**: Update this `AGENTS.md` file whenever architectural decisions, ports, or portal-specific rules change.
- **Bilingual & Theme Standards (ar/en & dark/light)**: All UI pages, components, and layouts must seamlessly support Arabic (RTL) & English (LTR) language switching as well as Dark & Light mode switching using Tailwind logical properties (`start-*`, `end-*`, `ms-*`, `me-*`) and `@custom-variant dark`.
- **Separation of Logic and HTML View**: Separate component logic into custom hooks (`hooks/use<ComponentName>.ts`) and keep `.tsx` view components purely focused on TSX markup and Tailwind CSS.

## Shared Playwright MCP

Before UI design, all agents must inspect and screenshot the actual running
portal through shared Playwright MCP at `http://127.0.0.1:8931/mcp`. Follow
[the browser runbook](../../../backend/docs/operations/playwright-mcp.md). Measure current design-system
components and computed typography, density, badge and modal geometry before
proposing changes; verify Arabic RTL and English LTR in light and dark.

Use an isolated MCP session with the existing `mutakamel-playwright-mcp`
container. Never create a per-agent container, share browser context, or start
an app for a screenshot. If native tools have not loaded, use an MCP SDK HTTP
client to the same endpoint. Never put login credentials, cookies or
authenticated storage state into tracked documents, code or shared evidence.
Only the user-authorized local development access memo below may hold the
supplied development credentials; never browser cookies or storage state.

For explicitly authorized Mersany tenant development browser sign-in, read the
[local development access memo](C:/mutakamel.ai/.local/mersany-dev-access.md).
The user authorized saving and reusing that development login in this one
local memo outside all Git repositories. Do not duplicate its values in
tracked Markdown, application/config files, scripts, logs or shared artifacts;
keep browser cookies and authenticated storage state out of the memo too.

<!-- mutakamel-agent-tooling -->
Use the [repo tool and skill inventory](../../docs/agent-tooling.md) on demand for the current task.
<!-- /mutakamel-agent-tooling -->

## Production server

The Mutakamel production server is `12.0.0.88`. Connect from Windows PowerShell with the following command.

```powershell
ssh -i "$env:USERPROFILE\.ssh\pbs_ed25519" root@12.0.0.88
```
