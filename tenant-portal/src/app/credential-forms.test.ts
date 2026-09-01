import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A `<form>` with no `method` submits as **GET**, which serialises its fields
 * into the URL. For a sign-in form that puts the password in the address bar,
 * in browser history, and in every access log on the way.
 *
 * This is not hypothetical. A real sign-in attempt was found in the dev server
 * log as `GET /login?email=…&password=…`: the submit reached the browser rather
 * than `onSubmit`, the page reloaded to a blank form, and the user's report was
 * that "nothing happened".
 *
 * `onSubmit` + `preventDefault` is the normal path and it is not enough on its
 * own, because it only runs once React has hydrated and only if hydration
 * succeeds. `method="post"` is what holds when it does not.
 *
 * The known-set assertion is the point: adding a new password screen without a
 * method fails here rather than shipping the same leak again.
 */

const APP_DIR = join(process.cwd(), "src", "app");

const PASSWORD_INPUT = /type=["']password["']|type=\{\s*showPassword/u;
const FORM_OPEN = /<form\b[^>]*>/gu;

/**
 * Comments have to go before anything is matched. The first run of this gate
 * failed on `login/page.tsx` because a JSX comment there contains the words
 * "a real <form>" — a scanner that reads prose reports defects that do not
 * exist, which is how a gate loses its authority.
 */
function stripComments(source: string): string {
  return source
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/gu, "")
    .replace(/\/\*[\s\S]*?\*\//gu, "")
    .replace(/^\s*\/\/.*$/gmu, "");
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return walk(path);
    return entry.name.endsWith(".tsx") && !entry.name.endsWith(".test.tsx")
      ? [path]
      : [];
  });
}

const credentialFiles = walk(APP_DIR)
  .filter((file) => PASSWORD_INPUT.test(stripComments(readFileSync(file, "utf8"))))
  .map((file) => file.slice(APP_DIR.length + 1).replaceAll("\\", "/"))
  .sort();

describe("credential forms never submit as GET", () => {
  // Update this list deliberately when a screen is added, and only after
  // giving its form a method.
  it("finds exactly the screens we know handle a password", () => {
    expect(credentialFiles).toEqual([
      "(tenant)/core/settings/email/components/EmailProviderFields.tsx",
      "login/page.tsx",
      "tenant/components/ActionTokenScreen.tsx",
    ]);
  });

  it.each(credentialFiles)("every <form> in %s posts", (relative) => {
    const source = stripComments(readFileSync(join(APP_DIR, relative), "utf8"));
    const forms = source.match(FORM_OPEN) ?? [];
    // EmailProviderFields renders fields into a parent form and opens none of
    // its own; that is fine, the assertion is about the forms that exist.
    for (const form of forms) {
      expect(form).toMatch(/method=["']post["']/u);
    }
    expect(source).not.toMatch(/\bformMethod\s*=\s*(?:["'](?!post["'])[^"']*["']|\{)/iu);
  });
});
