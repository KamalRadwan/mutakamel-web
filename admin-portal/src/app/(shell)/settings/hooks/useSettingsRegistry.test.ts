import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { SETTINGS_UI_REGISTRY } from "./useSettingsRegistry";

describe("settings UI registry", () => {
  it("provides bilingual metadata for every backend registry key", () => {
    // Source contract check: run from admin-portal with the sibling backend checkout.
    // Read the canonical registry, not the admin module's re-export or a copied list.
    const source = readFileSync(
      resolve(
        process.cwd(),
        "../../backend/mutakamel-apps/core-app/src/common/system-settings/system-settings.registry.ts",
      ),
      "utf8",
    );
    const keys = Array.from(source.matchAll(/^  '([^']+)': \{/gm), (match) => match[1]);
    expect(keys).toContain("notifications.retention_days");
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.filter((key) => !SETTINGS_UI_REGISTRY[key])).toEqual([]);
    for (const key of keys) {
      const metadata = SETTINGS_UI_REGISTRY[key];
      expect(metadata.key).toBe(key);
      expect(metadata.titleEn.trim()).not.toBe("");
      expect(metadata.titleAr).toMatch(/[\u0600-\u06ff]/u);
    }
  });

  it("declares localized retention copy and the backend default and bounds", () => {
    expect(SETTINGS_UI_REGISTRY["notifications.retention_days"]).toMatchObject({
      titleEn: "Notification Retention (Days)",
      titleAr: "مدة الاحتفاظ بالإشعارات (أيام)",
      inputType: "number",
      defaultValue: 180,
      min: 1,
      max: 3650,
    });
  });
});
