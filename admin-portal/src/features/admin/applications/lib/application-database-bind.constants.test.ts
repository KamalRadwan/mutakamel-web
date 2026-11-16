import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { MAX_BULK_APPLICATION_BIND_SERVERS } from "./application-database-bind.constants";

describe("application database bind limit", () => {
  it("mirrors the Core DTO maximum", () => {
    const dto = readFileSync(new URL(
      "../../../../../../../backend/mutakamel-apps/core-app/src/admin/database-servers/dto/application-database-server-bind.dto.ts",
      import.meta.url,
    ), "utf8");
    const maximum = dto.match(/export const MAX_BULK_APPLICATION_BIND_SERVERS = (\d+);/);
    expect(maximum).not.toBeNull();
    expect(MAX_BULK_APPLICATION_BIND_SERVERS).toBe(Number(maximum?.[1]));
  });

  it("keeps batch guidance in dictionary parity with the count placeholder", () => {
    expect(Object.keys(ar.applications.detail.databaseBind).sort()).toEqual(
      Object.keys(en.applications.detail.databaseBind).sort(),
    );
    for (const dictionary of [ar, en]) {
      expect(dictionary.applications.detail.databaseBind.batchHint).toContain("{{count}}");
    }
    expect(ar.applications.detail.databaseBind.batchHint).toMatch(/[\u0600-\u06ff]/);
  });
});
