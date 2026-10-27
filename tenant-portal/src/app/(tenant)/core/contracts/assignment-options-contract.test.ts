import { describe, expect, it } from "vitest";
import { parseAssignmentOptions } from "./assignment-options-contract";

const branchId = "019f3000-0000-7000-8000-000000000001";
const roleId = "019f3000-0000-7000-8000-000000000002";
const choice = { branchId, roleId, branchName: "Main branch", roleName: "Reader", roleNameI18n: { ar: "قارئ", en: "Reader" } };
const label = { kind: "role", id: roleId, name: "Reader", nameI18n: { ar: "قارئ", en: "Reader" } };

describe("assignment picker response contract", () => {
  it("keeps grant labels even when the searched choice page is empty", () => {
    expect(parseAssignmentOptions({ choices: [], labels: [label], hasMore: false })).toEqual({
      choices: [], labels: [{ kind: "role", id: roleId, nameAr: "قارئ", nameEn: "Reader" }], hasMore: false,
    });
  });
  it.each([
    { choices: [{ ...choice, branchId: "bad" }], labels: [], hasMore: false },
    { choices: [choice, choice], labels: [], hasMore: false },
    { choices: [], labels: [label, label], hasMore: false },
    { choices: [], labels: [{ ...label, kind: "permission" }], hasMore: false },
    { choices: [], labels: [{ ...label, nameI18n: { en: "Reader" } }], hasMore: false },
    { choices: [], labels: [], hasMore: "false" },
    { choices: Array.from({ length: 101 }, () => choice), labels: [], hasMore: true },
  ])("rejects malformed or ambiguous authority data %#", (payload) => {
    expect(() => parseAssignmentOptions(payload)).toThrow();
  });
});
