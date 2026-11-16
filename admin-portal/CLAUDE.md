@AGENTS.md

Use the shared Playwright MCP browser instructions inherited from AGENTS.md.
Capture the running UI before design; [browser setup and evidence workflow](../../backend/docs/operations/playwright-mcp.md).

For explicitly authorized Mersany tenant development browser sign-in, read the
[local development access memo](C:/mutakamel.ai/.local/mersany-dev-access.md).
The user authorized saving and reusing that development login in this one
local memo outside all Git repositories. Do not duplicate its values in
tracked Markdown, application/config files, scripts, logs or shared artifacts;
keep browser cookies and authenticated storage state out of the memo too.

## Production server

The Mutakamel production server is `12.0.0.88`. Connect from Windows PowerShell with the following command.

```powershell
ssh -i "$env:USERPROFILE\.ssh\pbs_ed25519" root@12.0.0.88
```
