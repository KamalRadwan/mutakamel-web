import { strict as assert } from "node:assert";
import { existsSync, mkdtempSync, readFileSync, unlinkSync, rmdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { test } from "vitest";
import nextConfig from "../../next.config";
import * as validationLocales from "../../src/i18n/validation-locales";

const require = createRequire(import.meta.url);
const { webpack } = require("next/dist/compiled/webpack/webpack");

test("preserves Next aliases and leaves server dependency resolution unchanged", () => {
  const server = nextConfig.webpack({ resolve: { alias: { existing: "retained" } } }, { isServer: true });
  assert.deepEqual(server.resolve.alias, { existing: "retained" });
  const client = nextConfig.webpack({ resolve: { alias: { existing: "retained" } } }, { isServer: false, webpack });
  assert.equal(client.resolve.alias.existing, "retained");
  assert.match(client.resolve.alias["zod$"], /[/\\]zod[/\\]index\.js$/);
});

test("keeps both supported validation locale factories", () => {
  assert.deepEqual(Object.keys(validationLocales).sort(), ["ar", "en"]);
  for (const factory of Object.values(validationLocales)) {
    assert.equal(typeof factory().localeError, "function");
  }
});

test("bundles CommonJS contracts and ESM schemas with one interoperable Zod runtime", async () => {
  const root = mkdtempSync(join(tmpdir(), "tenant-client-zod-"));
  const input = join(root, "fixture.js");
  const output = join(root, "bundle.js");
  writeFileSync(input, `
    import { z } from "zod";
    const commonjs = require("zod");
    z.config({ jitless: true });
    const fromContract = commonjs.z.object({ count: commonjs.z.number().int().min(1) });
    const combined = z.object({ contract: fromContract, label: z.string().min(1) });
    const localeNames = Object.keys(commonjs.z.locales).sort();
    z.config(commonjs.z.locales.ar());
    const arabicError = z.string().safeParse(1).error.issues[0].message;
    z.config(commonjs.z.locales.en());
    const englishError = z.string().safeParse(1).error.issues[0].message;
    export default {
      localeNames, arabicError, englishError,
      sameConstructor: z.ZodError === commonjs.z.ZodError,
      jitless: commonjs.z.config().jitless,
      accepted: combined.safeParse({ contract: { count: 2 }, label: "valid" }).success,
      rejected: combined.safeParse({ contract: { count: 0 }, label: "" }).success,
      errors: combined.safeParse({ contract: { count: 0 }, label: "" }).error.issues.map(i => i.code),
    };
  `);
  const config = nextConfig.webpack({
    mode: "production",
    target: "web",
    entry: input,
    output: { path: root, filename: "bundle.js", library: { type: "commonjs2" } },
    resolve: { modules: [join(process.cwd(), "node_modules")] },
    optimization: { minimize: false },
    devtool: false,
  }, { isServer: false, webpack });
  const compiler = webpack(config);
  try {
    await new Promise((resolve, reject) => compiler.run((error, stats) => {
      if (error) return reject(error);
      if (stats.hasErrors()) return reject(new Error(stats.toString({ all: false, errors: true })));
      resolve();
    }));
    const sandbox = { module: { exports: {} } };
    runInNewContext(readFileSync(output, "utf8"), sandbox, { contextCodeGeneration: { strings: false, wasm: false } });
    const result = JSON.parse(JSON.stringify(sandbox.module.exports.default));
    const { localeNames, arabicError, englishError, ...validation } = result;
    assert.deepEqual(localeNames, ["ar", "en"]);
    assert.match(arabicError, /[\u0600-\u06ff]/);
    assert.match(englishError, /string/);
    assert.deepEqual(validation, { sameConstructor: true, jitless: true, accepted: true, rejected: false, errors: ["too_small", "too_small"] });
  } finally {
    await new Promise(resolve => compiler.close(resolve));
    // Only the two files created in our mkdtemp directory are removed.
    unlinkSync(input);
    if (existsSync(output)) unlinkSync(output);
    rmdirSync(root);
  }
}, 30000);
