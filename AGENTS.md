# Frontend guidance

Use English for task interpretation, planning, progress updates, code, docs and free-text tool or MCP requests. Translate Arabic instructions before sending them to servers. Preserve exact identifiers, paths and Arabic content required by code or tests. Write the final user-facing reply in Arabic.

<!-- mutakamel-agent-tooling -->
Use the [repo tool and skill inventory](docs/agent-tooling.md) on demand for the current task.
<!-- /mutakamel-agent-tooling -->

## Context-saving workflow

- Use Serena for definitions, callers and symbol reads. Use Codebase Memory for cross-package or cross-service graphs. For a known file or exact text, use a targeted read or `rg`.
- Send large build, test and Docker output to Context Mode. Retrieve the summary and relevant lines, and reuse evidence already retrieved.
- Load one relevant skill at a time. Query one library version in Context7. Use live browser, database, cache or broker tools when their evidence is needed.
- Keep Serena memories short and topic-based. Save durable ownership, contract and message-flow facts, and verify them against current source.
- Keep indexes limited to source and project docs. Exclude dependencies, builds, coverage, generated files and secrets. Enable the MCP tools needed for the task.

## Production server

Ask the user and wait for explicit approval before any critical production decision or change. Follow the [production approval policy](../backend/PRODUCTION.md).

The Mutakamel production server is `12.0.0.88`. Connect from Windows PowerShell with the following command.

```powershell
ssh -i "$env:USERPROFILE\.ssh\pbs_ed25519" root@12.0.0.88
```
