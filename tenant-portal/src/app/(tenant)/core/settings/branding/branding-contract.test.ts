import { describe, expect, it } from "vitest";
import {
  BRANDING_FORM_COLOR_ERROR,
  BRANDING_FORM_TEXT_ERROR,
  buildUpdateBrandingRequest,
  EMPTY_BRANDING,
  toBrandingForm,
  validateBrandingForm,
  type BrandingFormValues,
  type BrandingSettings,
} from "./branding-contract";

const populated = {
  ...EMPTY_BRANDING,
  appName: "Workspace",
  tabTitle: "Dashboard",
  fontFamily: "Arial",
  primaryColor: "#123456",
  secondaryColor: "#abcdef",
};
const fields: (keyof BrandingFormValues)[] = [
  "appName", "tabTitle", "fontFamily", "primaryColor", "secondaryColor",
];

describe("branding settings patch", () => {
  it("omits unchanged settings and loginHtml", () => {
    expect(buildUpdateBrandingRequest(toBrandingForm(populated), populated)).toEqual({});
    expect(buildUpdateBrandingRequest(toBrandingForm(EMPTY_BRANDING), EMPTY_BRANDING)).toEqual({});
  });

  it.each(fields)("serializes a reset of %s and maps cleared readback", (field) => {
    const values = { ...toBrandingForm(populated), [field]: "   " };
    const patch = buildUpdateBrandingRequest(values, populated);
    expect(patch).toEqual({ [field]: null });
    expect(JSON.stringify(patch)).toBe(JSON.stringify({ [field]: null }));
    const reloaded: BrandingSettings = { ...populated, ...patch };
    expect(toBrandingForm(reloaded)[field]).toBe("");
    expect(buildUpdateBrandingRequest(toBrandingForm(reloaded), reloaded)).toEqual({});
  });

  it("sends only edited values and never includes loginHtml", () => {
    const patch = buildUpdateBrandingRequest({ ...toBrandingForm(populated), appName: "New name" }, populated);
    expect(patch).toEqual({ appName: "New name" });
    expect(patch).not.toHaveProperty("loginHtml");
  });

  it.each(["appName", "tabTitle", "fontFamily"] as const)("rejects overlong %s without truncation", (field) => {
    const values = { ...toBrandingForm(populated), [field]: "x".repeat(121) };
    expect(validateBrandingForm(values)[field]).toBe(BRANDING_FORM_TEXT_ERROR);
    expect(() => buildUpdateBrandingRequest(values, populated)).toThrow(BRANDING_FORM_TEXT_ERROR);
    expect(values[field]).toHaveLength(121);
    expect(buildUpdateBrandingRequest({ ...values, [field]: "x".repeat(120) }, populated))
      .toEqual({ [field]: "x".repeat(120) });
  });

  it.each(["primaryColor", "secondaryColor"] as const)("validates %s before sending", (field) => {
    const values = { ...toBrandingForm(populated), [field]: "invalid" };
    expect(validateBrandingForm(values)[field]).toBe(BRANDING_FORM_COLOR_ERROR);
    expect(() => buildUpdateBrandingRequest(values, populated)).toThrow(BRANDING_FORM_COLOR_ERROR);
    for (const color of ["#abc", "#abcd", "#abcdef", "#abcdef12"]) {
      expect(buildUpdateBrandingRequest({ ...values, [field]: color }, EMPTY_BRANDING)[field]).toBe(color);
    }
  });
});
