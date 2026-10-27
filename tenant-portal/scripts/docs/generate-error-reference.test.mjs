import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { test } from "vitest";
import assert from "node:assert/strict";

test("includes shared custom HttpException codes and preserves ordinary exceptions", () => {
  const root = mkdtempSync(join(tmpdir(), "auth-error-reference-"));
  try {
    const portal = join(root, "frontend/tenant-portal");
    const backend = join(root, "backend/mutakamel-apps/core-app/src");
    mkdirSync(join(portal, "scripts/docs"), { recursive: true });
    mkdirSync(join(portal, "docs/reference"), { recursive: true });
    mkdirSync(join(backend, "common/auth"), { recursive: true });
    mkdirSync(join(backend, "tenant/tenant-auth"), { recursive: true });
    const script = join(portal, "scripts/docs/generate-error-reference.mjs");
    copyFileSync(fileURLToPath(new URL("./generate-error-reference.mjs", import.meta.url)), script);
    writeFileSync(join(backend, "common/auth/login-lockout.policy.ts"), `
      export class LoginThrottledException extends HttpException {
        constructor(readonly retryAfterSeconds: number) {
          super({ code: 'AUTH_LOGIN_THROTTLED',
            details: { retryAfterSeconds: [String(retryAfterSeconds)] } }, HttpStatus.TOO_MANY_REQUESTS);
        }
      }
      throw new LoginThrottledException(90);
    `);
    writeFileSync(join(backend, "tenant/tenant-auth/auth.service.ts"),
      "throw new UnauthorizedException('INVALID_CREDENTIALS');");
    const result = spawnSync(process.execPath, [script], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    const doc = readFileSync(join(portal, "docs/reference/error-codes.md"), "utf8");
    assert.match(doc, /`AUTH_LOGIN_THROTTLED` \| 429/);
    assert.match(doc, /`INVALID_CREDENTIALS` \| 401/);
    assert.equal((doc.match(/`AUTH_LOGIN_THROTTLED`/gu) ?? []).length, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
