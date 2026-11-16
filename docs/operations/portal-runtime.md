# Portal runtime: production build by default, rebuild after every change

Status: current since 28/10/2026. Applies to `admin-portal` and `tenant-portal`
in the local Docker stack (`backend/mutakamel-apps/docker-compose.yaml`).

## What runs

| Port | Browser URL | Served by |
|---|---|---|
| 5001 | `http://localhost:5001` | `portal-edge` → `admin-portal` (`node admin-portal/server.js`) |
| 5002 | `http://<tenant host>:5002`, e.g. `http://mersany.mutakamel.ai:5002` | `portal-edge` → `tenant-portal` (`node tenant-portal/server.js`) |

- The portals run their **production build** (`next build`, `output:
  "standalone"`): compiled pages, a few hundred MB of memory instead of the
  ~2 GB `next dev` grew to, and no Compose Watch drift.
- `portal-edge` (nginx, `backend/mutakamel-apps/portal-edge/nginx.conf`) is the
  local stand-in for the production ingress: same-origin `/api/*` goes to the
  API Gateway, everything else to the portal, with the browser `Host`
  preserved. No development-only proxy or host fallback is enabled in the
  production build.
- The Tenant portal admits a request by its **tenant host**. Open it on the
  tenant hostname (the Windows hosts file maps `mersany.mutakamel.ai` to
  `127.0.0.1`); `http://localhost:5002` answers 404 by design in the
  production build.

## Tenant security headers

`backend/mutakamel-apps/portal-edge/nginx.conf` owns tenant static headers in
the port 5002 server: `X-Content-Type-Options: nosniff`, `Referrer-Policy:
same-origin`, and `Permissions-Policy: camera=(), microphone=(), geolocation=(),
payment=()`. All use `always`, covering errors and the edge health response.
HSTS is scheme-gated: the local HTTP profile omits it; a TLS listener using
the tenant header set emits `max-age=31536000`. If a separate ingress terminates
TLS, its HTTPS profile must own HSTS on that public response. Never derive
this from a caller-supplied forwarded scheme.

Tenant `src/proxy.ts` remains the sole CSP owner for documents; portal-edge
passes that header through without adding another policy. Admin headers are
owned by admin Next configuration. See the tenant
[security header policy](../../tenant-portal/docs/architecture/security-headers.md).

After an edge config change, the lead runs `nginx -t` inside portal-edge and
reloads nginx (an already-running edge is not reloaded by a portal rebuild).
Check `curl -I http://<tenant-host>:5002/login` and a missing page for the three
static headers and exactly one CSP; check `/__edge/health` for the static
headers on a 204. HTTP must omit HSTS, and the HTTPS profile must emit it.

## Production container hardening

Both standalone servers run as `node` (UID/GID 1000) with root-owned server
code and static assets. Their production Compose services have a read-only
root filesystem, drop all capabilities, and enable `no-new-privileges`.
Only `/tmp` and `/app/<portal>/.next/cache` are writable tmpfs mounts; the
cache mount belongs to UID/GID 1000. Runtime caches are lost on container
replacement. BuildKit's build caches are separate and remain reusable.

The edge also drops all capabilities and enables `no-new-privileges`. It runs
as UID/GID 101 with its existing read-only filesystem and `/tmp` mount;
ports 5001/5002 do not require a privileged bind capability. The opt-in dev
services retain their existing writable development setup.

Both portal Dockerfiles pin the Node base image by digest (`node:24.22.1-bookworm-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205`); to bump it, rerun `docker buildx imagetools inspect node:<tag>`, update every `FROM` in both Dockerfiles with the new tag and index digest, then rebuild both portals with `node scripts/rebuild-portal.mjs all`.

Build logs saved under the temporary `rebuild-portal-*` directory and the
failure tail printed by the rebuild script mask every literal occurrence of
the build's `NODE_AUTH_TOKEN` with `***` before either output is written.

Lead verification after changing these settings:

1. From `backend/mutakamel-apps`, run `docker compose config -q`.
2. From `frontend`, run `node scripts/rebuild-portal.mjs admin` and
   `node scripts/rebuild-portal.mjs tenant`; require both final ready lines to
   report HTTP 200 through the edge (use the tenant hostname, not localhost).
3. Inspect all three running containers for `ReadonlyRootfs`, `CapDrop=ALL`,
   and `no-new-privileges`; confirm the edge runs as 101:101 and both servers
   as `node`. In each portal, verify `/tmp` and `.next/cache` accept writes
   as `node`, while writing beside `server.js` fails. Exercise an image
   optimisation/cache request and check logs for write-permission errors.
4. Check successful and failed build logs with a disposable token fixture:
   repeated occurrences must be masked in the saved log and printed tail.

## The rule: a change is live only after a rebuild

Source edits do **not** reach the running portal by themselves. After any
change to a portal — code, styles, translations, config, dependencies — run
from the `frontend` repository:

```bash
node scripts/rebuild-portal.mjs tenant   # or: admin | all
```

or the equivalent package scripts:

```bash
pnpm run portal:rebuild tenant           # frontend root
pnpm run portal:rebuild                  # inside tenant-portal or admin-portal (that portal only)
```

The script:

1. saves the running image as `<service>:previous` (for example
   `tenant-portal:previous`), then builds the portal's production image
   (`next build` type-checks the app — a
   type error fails the rebuild and the **previous container keeps serving**);
2. replaces the running container and starts `portal-edge` if needed;
3. waits for both health checks and requests `/` through the edge;
4. prints `ready in Ns -> http://<host>/ (HTTP <status>)`, or exits non-zero
   with the last build-log lines (full log path included).

If startup, either health check, or the HTTP probe fails after a successful
build, the script retags `<service>:previous` to the image used by Compose and
runs `up -d --no-deps` again. It verifies the restored portal and edge, prints
`rolled back`, and exits **1**: recovery does not make the replacement succeed.
It saves the running container's image ID when available, so an unused build
that overwrote the service tag cannot replace the working rollback image.
The saved tag is replaced on the next rebuild; this is a single rollback slot.
On a first build with no existing image, it proceeds without a rollback slot
and reports `Rollback unavailable` if startup fails. A stale previous tag is
never used when this run could not save an image. Failed retagging, restart,
or rollback verification exits 1 with the failing step, without claiming recovery.

A rebuild after a small change takes a minute or two (pnpm store and
`.next/cache` are BuildKit caches); the first build takes longer.

`node scripts/rebuild-portal.mjs --status` shows which variant of each portal
is running, without changing anything.

### For AI agents (Claude, Codex, Antigravity)

- **Every task that changes a portal ends with a rebuild of that portal**
  (`node scripts/rebuild-portal.mjs <tenant|admin>` from `frontend/`) after the
  unit checks pass and before you report the task done. Report the script's
  final line (ready + HTTP status) as evidence.
- A failed rebuild is a failed task: read the printed build log, fix the cause
  (usually a type error), rebuild again. Never report "done" on a failed or
  skipped rebuild.
- If Docker is not available in your sandbox (Codex), do not try to work around
  it: write `PENDING: node scripts/rebuild-portal.mjs <portal>` in your result
  so the lead runs it.
- Browser verification (Playwright / chrome-devtools) is only meaningful after
  the rebuild; before it you are looking at the previous build.
- All agents use the [shared Playwright MCP service](../../../backend/docs/operations/playwright-mcp.md)
  at `http://127.0.0.1:8931/mcp`. Capture a baseline of the running UI before
  redesigning, inspect actual component/computed styles, then verify changed
  screens in Arabic/English and light/dark. Keep a separate MCP session per
  agent, and never start a browser container per task. Design-only inspection
  needs no portal rebuild.
- Do not run `next dev` or `pnpm dev` on 5001/5002 yourself — the edge owns
  those ports. Use the opt-in dev variant below only when the task needs live
  reload, and switch back when done.

## Opt-in live reload (`next dev`)

For long UI sessions that need hot reload on one portal:

```bash
node scripts/rebuild-portal.mjs tenant --dev
docker compose -f ../backend/mutakamel-apps/docker-compose.yaml --profile portal-dev watch tenant-portal-dev
```

The dev variant answers on the same port through the edge (shared network
alias), so URLs stay the same. Return to the production build when finished:

```bash
node scripts/rebuild-portal.mjs tenant
```

Exactly one variant of a portal may run at a time. A plain
`docker compose up -d` recreates the production services, so switch back with
the script rather than leaving the dev variant running beside them.

## Configuration that is fixed at build time

`NEXT_PUBLIC_*` values are inlined into the client bundle by `next build`.
`NEXT_PUBLIC_REALTIME_MODE` is a Compose build argument (`off` | `shadow` |
`on`, read from the ignored `backend/mutakamel-apps/.env`; empty = off);
changing it requires a rebuild. Since 27/10 the local stack builds with `on`.

Realtime sockets connect same-origin to `/realtime/socket.io/`. `portal-edge`
routes that path straight to `realtime-app:8005` (the Gateway never proxies it)
and, as the ingress, forwards exactly one cookie — the tenant access token,
from either cookie profile — under the name realtime-app authenticates
(`__Host-mutakamel-tenant-access`). realtime-app itself admits connections only
with `REALTIME_PUBLIC_FEATURE_MODE=on` (or `shadow`) in the ignored
`realtime-app/.env`; its `.env.example` default `off` rejects every handshake
with 403 `{"code":4,"message":"Realtime transport is not available"}`. Live
notifications additionally need `NOTIFICATIONS_REALTIME_ENABLED=true` in
`core-app/.env`. Both need a container recreate.
Check the route with
`curl "http://<tenant host>:5002/realtime/socket.io/?EIO=4&transport=polling"`:
`0{"sid":…}` means realtime admits transports; a 403 with code 4 means the feature
mode is off or a dependency is not ready; a Next.js 404 means the route is not
wired. Server-side settings
(`TENANT_GATEWAY_INTERNAL_ORIGIN`) are runtime environment and only need a
container restart.

## Troubleshooting

| Symptom | Cause / action |
|---|---|
| Build fails with `error TS…` | Fix the type error; the old container is still serving. |
| `No GitHub Packages token` | Set `NODE_AUTH_TOKEN` or log in to `npm.pkg.github.com` in `~/.npmrc` (Tenant installs published `@mutakamel/*` packages). |
| 404 on every Tenant page | You opened `localhost:5002`; use the tenant host. |
| 502 from the edge | The portal or Gateway container is down: `--status`, then `docker compose logs <service>`. |
| Change not visible | You did not rebuild, or the rebuild failed. |
