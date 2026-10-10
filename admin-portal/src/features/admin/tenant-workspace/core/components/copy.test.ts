import { describe, expect, it } from "vitest";
import { TENANT_DESTROY_PHASES } from "../types";
import { tenantDestroyReasonLabel, tenantWorkspaceCopy } from "./copy";

/** Key paths, with each function's arity, so a missing translation fails. */
function shape(value: unknown, path: readonly string[] = []): string[] {
  if (typeof value === "function") return [`${JSON.stringify(path)}/${value.length}`];
  if (typeof value !== "object" || value === null) return [JSON.stringify(path)];
  return Object.keys(value)
    .sort()
    .flatMap((key) =>
      shape((value as Record<string, unknown>)[key], [...path, key]),
    );
}

describe("tenant workspace copy", () => {
  it("has the same keys and interpolations in Arabic and English", () => {
    expect(shape(tenantWorkspaceCopy("ar"))).toEqual(
      shape(tenantWorkspaceCopy("en")),
    );
  });

  it("titles and explains every destruction phase in both languages", () => {
    for (const locale of ["en", "ar"] as const) {
      const text = tenantWorkspaceCopy(locale);
      for (const phase of TENANT_DESTROY_PHASES) {
        expect(text.destroyPhases[phase].trim()).not.toBe("");
        expect(text.destroyPhaseHints[phase].trim()).not.toBe("");
      }
    }
  });

  it("labels known safe codes and leaves the rest to be shown verbatim", () => {
    expect(
      tenantDestroyReasonLabel("en", "TENANT_DESTROY_MULTIPLE_OPEN_OPERATIONS"),
    ).toMatch(/needs reconciliation/);
    expect(
      tenantDestroyReasonLabel("ar", "WORKER.TENANT_DESTROY.CORE_UNREACHABLE"),
    ).not.toBeNull();
    expect(tenantDestroyReasonLabel("en", "WORKER.SOMETHING_NEW")).toBeNull();
    expect(tenantDestroyReasonLabel("en", "constructor")).toBeNull();
  });
});
