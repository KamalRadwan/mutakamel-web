<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Partner Portal Rules

- **Main branch only**: Always work directly on `main`. Never create or switch branches, check out another ref, detach HEAD, or create a worktree.
- **Branch safety check**: Before editing a repository, verify that `git branch --show-current` returns `main`. Otherwise, stop and ask the user; do not switch branches or move existing changes yourself.

- **Strict Backend Code Prohibition**: NEVER edit, modify, or update any backend file under `../backend/` or any backend application under any circumstances. Only read backend files for contract verification.
- **Strict Design System Adherence**: Always strictly follow the design system in this application. All UI components, tokens, and layouts must adhere to design system standards and barrel imports (`@/design-system`).
- **UI/UX Intelligence (`ui-ux-pro-max`)**: Always use and consult the `ui-ux-pro-max` skill for UI and UX guidelines, accessibility standards, color palettes, and interaction patterns BEFORE starting any UI or UX design.
- **Shared browser MCP**: Claude Code, Codex and Antigravity use `playwright` at `http://127.0.0.1:8931/mcp` to inspect the running portal on `5003`. Capture the real UI before design, measure current design-system styles and screenshot changed screens in RTL/LTR and light/dark. Follow the [browser runbook](../../backend/docs/operations/playwright-mcp.md). Claude-only tools remain `chrome-devtools`, `context7` and `eslint`. Never start an app for a screenshot or create a per-agent browser container. The read-only `postgres` MCP server remains one shared container; never start another postgres-mcp container. [Other MCP servers](../../backend/docs/operations/claude-mcp-servers.md).

For explicitly authorized Mersany tenant development browser sign-in, read the
[local development access memo](C:/mutakamel.ai/.local/mersany-dev-access.md).
The user authorized saving and reusing that development login in this one
local memo outside all Git repositories. Do not duplicate its values in
tracked Markdown, application/config files, scripts, logs or shared artifacts;
keep browser cookies and authenticated storage state out of the memo too.

<!-- mutakamel-agent-tooling -->
Use the [repo tool and skill inventory](../docs/agent-tooling.md) on demand for the current task.
<!-- /mutakamel-agent-tooling -->

## Production server

The Mutakamel production server is `12.0.0.88`. Connect from Windows PowerShell with the following command.

```powershell
ssh -i "$env:USERPROFILE\.ssh\pbs_ed25519" root@12.0.0.88
```
