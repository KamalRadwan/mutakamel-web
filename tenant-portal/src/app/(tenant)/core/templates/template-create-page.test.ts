import { describe, expect, it } from "vitest";
import { DEFAULT_TEMPLATE_PAGE, resolveTemplateCreatePage, templateCreatePage, type TemplateCreatePageValues } from "./template-create-page";

const margins = { top: "17", end: "13", bottom: "19", start: "11" };

describe("Create print geometry", () => {
  it("derives the approved A4 example without adding display fields to the preset payload", () => {
    const values = { ...DEFAULT_TEMPLATE_PAGE, top: "12", end: "12", bottom: "12", start: "12" };
    const page = {
      preset: "A4", orientation: "PORTRAIT", marginMm: { top: 12, end: 12, bottom: 12, start: 12 },
    };
    expect(resolveTemplateCreatePage(values)).toEqual({ page, printableArea: { widthMm: 186, heightMm: 273 } });
    expect(templateCreatePage(values)).toEqual(page);
  });

  it("uses logical margins after rotating the paper and retains preset decimal dimensions", () => {
    expect(resolveTemplateCreatePage({
      ...DEFAULT_TEMPLATE_PAGE, ...margins, preset: "A5", orientation: "LANDSCAPE",
    })?.printableArea).toEqual({ widthMm: 186, heightMm: 112 });
    const letter = resolveTemplateCreatePage({
      ...DEFAULT_TEMPLATE_PAGE, ...margins, preset: "LETTER",
    })?.printableArea;
    expect(letter?.widthMm).toBeCloseTo(191.9, 10);
    expect(letter?.heightMm).toBeCloseTo(243.4, 10);
  });

  it("retains unrotated custom dimensions in the existing request payload", () => {
    const values: TemplateCreatePageValues = {
      ...DEFAULT_TEMPLATE_PAGE, ...margins, preset: "CUSTOM", orientation: "LANDSCAPE", widthMm: "160.5", heightMm: "240.25",
    };
    const page = {
      preset: "CUSTOM", orientation: "LANDSCAPE", widthMm: 160.5, heightMm: 240.25,
      marginMm: { top: 17, end: 13, bottom: 19, start: 11 },
    };
    expect(resolveTemplateCreatePage(values)).toEqual({ page, printableArea: { widthMm: 216.25, heightMm: 124.5 } });
    expect(templateCreatePage(values)).toEqual(page);
  });

  it.each<Partial<TemplateCreatePageValues>>([
    { start: "" }, { top: "NaN" }, { bottom: "101" }, { end: "-1" },
    { preset: "A5", start: "74", end: "74" },
    { preset: "CUSTOM", widthMm: "50", heightMm: "50", top: "26", bottom: "25" },
    { preset: "CUSTOM", widthMm: "49", heightMm: "100" },
    { preset: "CUSTOM", widthMm: "100", heightMm: "1001" },
  ])("rejects invalid setup %j in feedback and in the Create request", change => {
    const values = { ...DEFAULT_TEMPLATE_PAGE, ...change };
    expect(resolveTemplateCreatePage(values)).toBeNull();
    expect(templateCreatePage(values)).toBeNull();
  });
});
