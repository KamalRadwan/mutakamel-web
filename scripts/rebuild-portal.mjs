#!/usr/bin/env node
// Rebuilds a portal's production image and replaces the running container.
//
//   node scripts/rebuild-portal.mjs tenant        # Tenant portal (port 5002)
//   node scripts/rebuild-portal.mjs admin         # Admin portal (port 5001)
//   node scripts/rebuild-portal.mjs all           # both, one after the other
//   node scripts/rebuild-portal.mjs tenant --dev  # opt-in `next dev` variant
//   node scripts/rebuild-portal.mjs --status      # what is running, no changes
//
// The portals run `next build` + `node server.js` behind portal-edge (the local
// stand-in for the production ingress). Source edits reach them ONLY through
// this script. `next build` type-checks the app, so a type error fails the
// rebuild and the previous container keeps serving. A failed startup or HTTP
// probe restores the saved image and exits 1, even after a healthy rollback.
// Runbook:
// docs/operations/portal-runtime.md.
//
// Needs Docker. The Tenant image installs published @mutakamel packages: the
// GitHub Packages token is read from NODE_AUTH_TOKEN or ~/.npmrc and passed to
// BuildKit as a secret; it is never printed or written anywhere.

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { request } from "node:http";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const composeFile = process.env.MUTAKAMEL_COMPOSE_FILE
  ?? resolve(frontendRoot, "../backend/mutakamel-apps/docker-compose.yaml");
const tenantHost = process.env.DEV_TENANT_HOST ?? "mersany.mutakamel.ai";

const PORTALS = {
  admin: { service: "admin-portal", port: 5001, host: "localhost:5001" },
  tenant: { service: "tenant-portal", port: 5002, host: `${tenantHost}:5002` },
};

const args = process.argv.slice(2);
const flags = new Set(args.filter((arg) => arg.startsWith("--")));
const names = args.filter((arg) => !arg.startsWith("--"));
const unknownFlag = [...flags].find((flag) => !["--dev", "--status", "--help"].includes(flag));
if (flags.has("--help") || unknownFlag || names.length > 1
  || (names[0] && !["tenant", "admin", "all"].includes(names[0]))) {
  console.log("Usage: node scripts/rebuild-portal.mjs <tenant|admin|all> [--dev] | --status");
  process.exit(unknownFlag || names.length > 1 ? 2 : 0);
}
if (!existsSync(composeFile)) fail(`Compose file not found: ${composeFile}`);

const selected = flags.has("--status") ? [] :
  names[0] === "all" || !names[0] ? ["admin", "tenant"] : [names[0]];

function compose(composeArgs, { capture = false, env } = {}) {
  const commandEnv = { ...process.env };
  delete commandEnv.NODE_AUTH_TOKEN;
  const result = spawnSync("docker", ["compose", "-f", composeFile, "--profile", "portal-dev", ...composeArgs], {
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    env: env ?? commandEnv,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) fail(`Could not run docker: ${result.error.code ?? result.error.message}`);
  return result;
}

function fail(message) {
  console.error(`rebuild-portal: ${message}`);
  process.exit(1);
}

function npmToken() {
  if (process.env.NODE_AUTH_TOKEN) return process.env.NODE_AUTH_TOKEN;
  try {
    const line = readFileSync(join(homedir(), ".npmrc"), "utf8").split(/\r?\n/u)
      .find((entry) => entry.startsWith("//npm.pkg.github.com/:_authToken="));
    const token = line?.slice(line.indexOf("=") + 1).trim().replace(/^(["'])(.*)\1$/u, "$2").trim();
    if (token && !token.startsWith("${")) return token;
  } catch { /* fall through */ }
  return undefined;
}

function containerId(service) {
  return compose(["ps", "-q", service], { capture: true }).stdout.trim();
}

function health(id) {
  if (!id) return "absent";
  const result = spawnSync("docker", ["inspect", "--format",
    "{{.State.Status}}/{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}", id], { encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : "absent";
}

async function waitHealthy(service, timeoutMs) {
  const started = Date.now();
  for (;;) {
    const state = health(containerId(service));
    if (state === "running/healthy") return;
    if (state.endsWith("/unhealthy") || state.startsWith("exited") || state.startsWith("dead")) {
      compose(["logs", "--tail", "40", service]);
      throw new Error(`${service} is ${state}`);
    }
    if (Date.now() - started > timeoutMs) throw new Error(`${service} not healthy after ${timeoutMs / 1000}s (${state})`);
    await new Promise((done) => setTimeout(done, 2_000));
  }
}

function probe(port, host) {
  return new Promise((done) => {
    const req = request({ host: "127.0.0.1", port, path: "/", method: "GET", headers: { host }, timeout: 30_000 },
      (res) => { res.resume(); done(res.statusCode ?? 0); });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", () => done(0));
    req.end();
  });
}

async function rebuild(name, dev) {
  const portal = PORTALS[name];
  const target = dev ? `${portal.service}-dev` : portal.service;
  const other = dev ? portal.service : `${portal.service}-dev`;
  const begun = Date.now();
  console.log(`\n== ${target}: building ${dev ? "the next dev image" : "the production image"} ...`);

  const env = { ...process.env };
  if (name === "tenant") {
    const token = npmToken();
    if (!token) fail("No GitHub Packages token: set NODE_AUTH_TOKEN or log in to npm.pkg.github.com in ~/.npmrc");
    env.NODE_AUTH_TOKEN = token;
  }
  const logDir = mkdtempSync(join(tmpdir(), "rebuild-portal-"));
  const configResult = compose(["config", "--format", "json"], { capture: true });
  if (configResult.status !== 0) fail(`Could not resolve ${target}'s image:\n${configResult.stderr}`);
  const config = JSON.parse(configResult.stdout);
  const image = config.services[target].image ?? `${config.name}-${target}`;
  const previous = `${target}:previous`;
  const currentId = containerId(target);
  // Save the running image by ID: its tag may already point at an unused build.
  const currentImage = currentId
    ? spawnSync("docker", ["inspect", "--format", "{{.Image}}", currentId], { encoding: "utf8" })
    : undefined;
  if (currentImage && currentImage.status !== 0) fail(`Could not inspect ${target}'s running image`);
  const saved = spawnSync("docker", ["tag", currentImage?.stdout.trim() || image, previous], { encoding: "utf8" });
  // A first build has no image to save. Never reuse a stale :previous tag.
  const canRollback = saved.status === 0;
  if (!canRollback && currentId) fail(`Could not save ${target}'s running image for rollback`);
  const build = compose(["build", target], { capture: true, env });
  const output = `${build.stdout}\n${build.stderr}`;
  const log = env.NODE_AUTH_TOKEN ? output.replaceAll(env.NODE_AUTH_TOKEN, "***") : output;
  writeFileSync(join(logDir, "build.log"), log);
  if (build.status !== 0) {
    console.error(log.split("\n").filter((line) => line.trim()).slice(-60).join("\n"));
    fail(`${target} build failed (full log: ${join(logDir, "build.log")}). The running portal was left unchanged.`);
  }

  // Exactly one of the pair answers on the shared network alias.
  compose(["rm", "--stop", "--force", other], { capture: true });
  // One-time migration: a container created before portal-edge existed still
  // publishes 5001/5002 itself, which would stop the edge from binding them.
  const migrated = [];
  for (const service of ["admin-portal", "tenant-portal"]) {
    const id = containerId(service);
    if (!id) continue;
    const ports = spawnSync("docker", ["port", id], { encoding: "utf8" }).stdout.trim();
    if (ports) {
      compose(["rm", "--stop", "--force", service], { capture: true });
      if (service !== target) migrated.push(service);
    }
  }
  // A sibling removed by the migration comes back on its production image.
  const upArgs = ["up", "-d", "--no-deps", target, ...migrated, "portal-edge"];
  async function verify() {
    await waitHealthy(target, dev ? 240_000 : 120_000);
    await waitHealthy("portal-edge", 60_000);
    const status = await probe(portal.port, portal.host);
    if (status === 0 || status >= 500) throw new Error(`${target} answered ${status || "nothing"} on http://${portal.host}/`);
    return status;
  }
  let status;
  try {
    const up = compose(upArgs, { capture: true });
    if (up.status !== 0) throw new Error(`${target} did not start:\n${up.stderr}`);
    status = await verify();
  } catch (error) {
    console.error(`rebuild-portal: ${error.message}`);
    if (!canRollback) fail(`${target} failed; no previous image was available before this build. Rollback unavailable.`);
    const restored = spawnSync("docker", ["tag", previous, image], { encoding: "utf8" });
    if (restored.status !== 0) fail(`${target} rollback could not restore ${previous}: ${restored.stderr ?? "docker failed"}`);
    const restarted = compose(upArgs, { capture: true });
    if (restarted.status !== 0) fail(`${target} rollback did not start:\n${restarted.stderr}`);
    try {
      await verify();
    } catch (rollbackError) {
      fail(`${target} rollback verification failed: ${rollbackError.message}`);
    }
    console.error(`== ${target}: rolled back to ${previous}`);
    fail(`${target} replacement failed; the previous image is serving again.`);
  }
  const seconds = Math.round((Date.now() - begun) / 1000);
  console.log(`== ${target}: ready in ${seconds}s -> http://${portal.host}/ (HTTP ${status})`);
  if (dev) {
    console.log(`   Source sync is not running: start it with\n   docker compose -f "${composeFile}" --profile portal-dev watch ${target}\n   Return to production with: node scripts/rebuild-portal.mjs ${name}`);
  }
}

if (flags.has("--status")) {
  for (const service of ["admin-portal", "admin-portal-dev", "tenant-portal", "tenant-portal-dev", "portal-edge"]) {
    console.log(`${service.padEnd(18)} ${health(containerId(service))}`);
  }
  process.exit(0);
}

for (const name of selected) await rebuild(name, flags.has("--dev"));
