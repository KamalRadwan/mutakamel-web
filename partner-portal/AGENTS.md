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
