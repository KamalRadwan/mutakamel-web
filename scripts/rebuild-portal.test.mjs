import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const scriptUrl = new URL("./rebuild-portal.mjs", import.meta.url);
// Run the complete command flow with inert OS boundaries: no Docker, network,
// real npmrc, or filesystem writes. Only the module bindings are substituted.
const source = readFileSync(scriptUrl, "utf8")
  .replace(/^#!.*\n/u, "")
  .replace(/^import .*;\r?$/gmu, "")
  .replaceAll("import.meta.url", JSON.stringify(scriptUrl.href));

async function exercise({ npmrc = "", env = {}, buildStatus = 0, unhealthy = false,
  probeStatus = 200, saveStatus = 0, restoreStatus = 0, running = true,
  rollbackUnhealthy = false, upStatus = 0, image = undefined } = {}) {
  const commands = [];
  const logs = [];
  const files = [];
  let starts = 0;
  let exitCode;
  const exited = new Error("Script exit");
  try {
    await runInNewContext(`(async () => {\n${source}\n})()`, {
      dirname, join, resolve, fileURLToPath,
      homedir: () => "/fixture/home",
      tmpdir: () => "/fixture/tmp",
      existsSync: () => true,
      readFileSync: () => npmrc,
      mkdtempSync: (prefix) => `${prefix}fixture`,
      writeFileSync: (path, content) => files.push({ path, content }),
      process: { argv: ["node", "rebuild-portal.mjs", "tenant"], env, exit: (code) => { exitCode = code; throw exited; } },
      console: { log: (line) => logs.push(line), error: (line) => logs.push(line) },
      spawnSync: (command, args, options) => {
        commands.push({ command, args, options });
        if (args.includes("config")) return { status: 0, stdout: JSON.stringify({
          name: "fixture", services: { "tenant-portal": { image } },
        }) };
        if (args[0] === "tag") return { status: args[1] === "tenant-portal:previous" ? restoreStatus : saveStatus, stderr: "tag failed" };
        if (args.includes("up")) {
          starts += 1;
          return { status: starts === 1 ? upStatus : 0, stdout: "", stderr: "start failed" };
        }
        if (args.includes("build")) {
          const token = options.env.NODE_AUTH_TOKEN;
          return { status: buildStatus, stdout: `out ${token} ${token}`, stderr: `err ${token}` };
        }
        if (args[0] === "inspect") return { status: 0, stdout: args[2] === "{{.Image}}"
          ? "sha256:running-image" : (starts === 1 && unhealthy) || (starts > 1 && rollbackUnhealthy)
            ? "running/unhealthy" : "running/healthy" };
        return { status: 0, stdout: args.includes("ps") && (starts > 0 || running) ? "container" : "", stderr: "" };
      },
      request: (_options, callback) => ({
        on() { return this; },
        end() { callback({ statusCode: starts === 1 ? probeStatus : 200, resume() {} }); },
      }),
    });
  } catch (error) {
    if (error !== exited) throw error;
  }
  return { commands, logs, files, exitCode };
}

for (const value of ["  fixture-token  ", '  "fixture-token"  ', "  'fixture-token'  "]) {
  test(`normalizes npmrc token ${JSON.stringify(value)} and passes it only to build`, async () => {
    const result = await exercise({ npmrc: `//npm.pkg.github.com/:_authToken=${value}\r\n` });
    assert.equal(result.exitCode, undefined);
    const compose = result.commands.filter(({ args }) => args[0] === "compose");
    assert.equal(compose.find(({ args }) => args.includes("build")).options.env.NODE_AUTH_TOKEN, "fixture-token");
    assert.ok(compose.some(({ args }) => args.includes("up")));
    for (const command of compose.filter(({ args }) => !args.includes("build"))) {
      assert.equal(Object.hasOwn(command.options.env, "NODE_AUTH_TOKEN"), false);
    }
    assert.equal(result.files[0].content, "out *** ***\nerr ***");
    assert.ok(result.logs.some((line) => line.includes("HTTP 200")));
  });
}

test("an exported token is not inherited by non-build Compose commands", async () => {
  const env = { NODE_AUTH_TOKEN: "exported-fixture-token", PATH: "/fixture/bin" };
  const result = await exercise({ env });
  const up = result.commands.find(({ args }) => args.includes("up"));
  assert.equal(up.options.env.NODE_AUTH_TOKEN, undefined);
  assert.equal(up.options.env.PATH, env.PATH);
  assert.equal(env.NODE_AUTH_TOKEN, "exported-fixture-token");
  assert.equal(result.files[0].content, "out *** ***\nerr ***");
});

test("masks every token occurrence in a failed build's saved log and printed tail", async () => {
  const result = await exercise({ env: { NODE_AUTH_TOKEN: "fixture-secret" }, buildStatus: 1 });
  assert.equal(result.exitCode, 1);
  assert.equal(result.files[0].content, "out *** ***\nerr ***");
  assert.ok(result.logs.includes("out *** ***\nerr ***"));
  assert.ok(result.logs.every((line) => !line.includes("fixture-secret")));
  assert.ok(result.commands.every(({ args }) => !args.includes("up")));
});

test("rejects a quoted unresolved npmrc token before invoking Docker", async () => {
  const result = await exercise({ npmrc: '//npm.pkg.github.com/:_authToken= "${NODE_AUTH_TOKEN}"\n' });
  assert.equal(result.exitCode, 1);
  assert.equal(result.commands.length, 0);
});

for (const failure of [{ unhealthy: true }, { probeStatus: 503 }, { probeStatus: 0 }, { upStatus: 1 }]) {
  test(`restores the saved image and exits 1 after a failed replacement ${JSON.stringify(failure)}`, async () => {
    const result = await exercise({ env: { NODE_AUTH_TOKEN: "fixture-token" }, ...failure });
    assert.equal(result.exitCode, 1);
    const tags = result.commands.filter(({ args }) => args[0] === "tag");
    assert.deepEqual(tags.map(({ args }) => Array.from(args)), [
      ["tag", "sha256:running-image", "tenant-portal:previous"],
      ["tag", "tenant-portal:previous", "fixture-tenant-portal"],
    ]);
    assert.ok(result.commands.indexOf(tags[0]) < result.commands.findIndex(({ args }) => args.includes("build")));
    const starts = result.commands.filter(({ args }) => args.includes("up"));
    assert.equal(starts.length, 2);
    assert.deepEqual(Array.from(starts[1].args.slice(-5)), ["up", "-d", "--no-deps", "tenant-portal", "portal-edge"]);
    assert.ok(result.logs.some((line) => line.includes("rolled back")));
    assert.ok(result.logs.every((line) => !line.includes("ready in")));
  });
}

test("restores an explicitly configured Compose image tag", async () => {
  const result = await exercise({ env: { NODE_AUTH_TOKEN: "fixture-token" }, unhealthy: true, image: "registry.example/portal:current" });
  assert.ok(result.commands.some(({ args }) => args[0] === "tag" && args[1] === "tenant-portal:previous"
    && args[2] === "registry.example/portal:current"));
  assert.equal(result.exitCode, 1);
});

test("a missing initial image allows a successful first build", async () => {
  const result = await exercise({ env: { NODE_AUTH_TOKEN: "fixture-token" }, running: false, saveStatus: 1 });
  assert.equal(result.exitCode, undefined);
  assert.ok(result.logs.some((line) => line.includes("HTTP 200")));
});

test("a missing initial image never restores a stale previous tag", async () => {
  const result = await exercise({ env: { NODE_AUTH_TOKEN: "fixture-token" }, running: false, saveStatus: 1, unhealthy: true });
  assert.equal(result.exitCode, 1);
  assert.equal(result.commands.filter(({ args }) => args[0] === "tag").length, 1);
  assert.equal(result.commands.filter(({ args }) => args.includes("up")).length, 1);
  assert.ok(result.logs.some((line) => line.includes("Rollback unavailable")));
});

for (const failure of [{ restoreStatus: 1 }, { rollbackUnhealthy: true }]) {
  test(`reports a failed rollback without claiming recovery ${JSON.stringify(failure)}`, async () => {
    const result = await exercise({ env: { NODE_AUTH_TOKEN: "fixture-token" }, unhealthy: true, ...failure });
    assert.equal(result.exitCode, 1);
    assert.ok(result.logs.some((line) => line.includes("rollback")));
    assert.ok(result.logs.every((line) => !line.includes("rolled back")));
  });
}
