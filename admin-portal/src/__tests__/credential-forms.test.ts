import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SOURCE_DIR = join(process.cwd(), "src");
const FORM = /<form\b[\s\S]*?<\/form>/gu;
const CREDENTIAL_INPUT = /\btype=(?:["']password["']|\{[^}]*["']password["'][^}]*\})|<(?:PasswordField|SecretField|DatabaseSslConfigurationFields)\b/u;

function componentFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return componentFiles(path);
    return entry.name.endsWith(".tsx") && !entry.name.endsWith(".test.tsx")
      ? [path]
      : [];
  });
}

const credentialForms = componentFiles(SOURCE_DIR).flatMap((file) => {
  const source = readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//gu, "")
    .replace(/^\s*\/\/.*$/gmu, "");
  return (source.match(FORM) ?? [])
    .filter((form) => CREDENTIAL_INPUT.test(form))
    .map((form) => ({ file: relative(SOURCE_DIR, file).replaceAll("\\", "/"), form }));
});

describe("admin native credential submissions", () => {
  it("covers auth screens and the existing nested secret-entry forms", () => {
    expect(credentialForms.map(({ file }) => file).sort()).toEqual([
      "app/(auth)/login/page.tsx",
      "app/(shell)/settings/fatal-alerts/page.tsx",
      "app/(shell)/settings/smtp/page.tsx",
      "app/(shell)/settings/webphone/components/ServerIceServers.tsx",
      "features/admin/auth/components/AdminPasswordActionScreen.tsx",
      "features/admin/database-servers/components/EditDatabaseServerModal.tsx",
      "features/admin/storage-servers/screens/CreateStorageServerScreen.tsx",
      "features/admin/storage-servers/screens/StorageServerDetailScreen.tsx",
      "features/admin/storage-servers/screens/StorageServerDetailScreen.tsx",
      "features/admin/tenant-workspace/access/components/tenant-access-dialogs.tsx",
    ]);
  });

  it.each(credentialForms)("keeps credentials out of GET URLs in $file", ({ form }) => {
    // Before hydration, only the native method prevents values entering the URL.
    expect(form.match(/<form\b[^>]*>/u)?.[0]).toMatch(/\bmethod=["']post["']/u);
    expect(form).not.toMatch(/\bformMethod\s*=\s*(?:["'](?!post["'])[^"']*["']|\{)/iu);
  });
});
