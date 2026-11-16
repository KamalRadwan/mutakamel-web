# Agent tooling

Use the smallest tool that answers the current question. The [shared development tooling guide](../../backend/docs/mcp.md) covers setup, connections, smoke checks and rollback in the sibling backend checkout.

| Tool | When to use it |
| --- | --- |
| `serena` | Activate `/workspaces/mutakamel/frontend` and inspect definitions, callers and symbols. |
| `codebase-memory` | Trace dependencies across packages or services. Refresh the graph after changes that affect the query. |
| `context-mode` | Summarize build, test and browser logs and retrieve only relevant excerpts. |
| `context7` | Look up a specific API for one library and version. |
| `next-devtools` | Inspect the local Next.js development server for routes, errors and project metadata. |
| `playwright` | Navigate a served portal and verify the user flow against live UI state. |
| `postgres`, `redis`, `rabbitmq` | Inspect a local backend dependency when a frontend failure needs runtime evidence. |
| Mailpit HTTP API | Verify delivery of locally captured development email. |
| Figma plugin | Read linked designs when the connected account has access. |

| Skill | When to load it |
| --- | --- |
| `ui-ux-pro-max` | Design or review responsive, accessible interfaces. |
| `vercel:react-best-practices` or `vercel-react-best-practices` | Review React or Next.js rendering, data fetching and performance. Use the local skill when the plugin skill is unavailable. |
| `nestjs-architecture-principles` | Check NestJS integration and API architecture when a frontend change crosses that boundary. |
| `backend-checker` | Audit backend contracts and release readiness when the task calls for it. |
| `supabase-postgres-best-practices` | Review PostgreSQL queries, schema, indexing or access for cross-stack work. |
