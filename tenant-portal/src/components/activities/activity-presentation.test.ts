import { describe, expect, it } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { activityCreateModalTitle } from "./activity-presentation";

describe("activityCreateModalTitle", () => {
  it.each([
    ["company lead", en.activities.title, "Acme Trading", "Activities · Acme Trading"],
    ["individual lead", en.activities.title, "Kamal Radwan", "Activities · Kamal Radwan"],
    ["Arabic lead", ar.activities.title, "شركة النور", "الأنشطة · شركة النور"],
  ])("names the %s in the create heading", (_case, title, recordName, expected) => {
    expect(activityCreateModalTitle(title, recordName)).toBe(expected);
  });

  it("uses the workspace title until a record is selected", () => {
    expect(activityCreateModalTitle(en.activities.title)).toBe("Activities");
  });
});
