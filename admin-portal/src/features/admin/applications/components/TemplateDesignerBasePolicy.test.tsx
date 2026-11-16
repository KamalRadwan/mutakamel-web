// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "../../../../i18n/dictionaries/en";
import { ar } from "../../../../i18n/dictionaries/ar";
import type { FeatureView } from "../types";
const state = vi.hoisted(() => ({ lang: "en" as "en" | "ar", update: vi.fn() }));
vi.mock("../api/applications.api", () => ({ applicationsApi: { updateCoreBaseFeaturePolicy: state.update } }));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: state.lang === "en" ? en : ar, dir: state.lang === "en" ? "ltr" : "rtl", lang: state.lang }),
  useOptionalI18n: () => ({ t: state.lang === "en" ? en : ar }),
}));
import { TemplateDesignerBasePolicy } from "./TemplateDesignerBasePolicy";
const feature = {
  id: "01a0edef-fd8f-70bf-892d-7e53517c0ae2", moduleId: "01a0edef-f984-72d6-a207-97ccc6131756",
  key: "core.template_designer", name: "Template Designer", baseIncluded: true, baseGrantRevision: 2,
} as FeatureView;
beforeEach(() => { state.lang = "en"; state.update.mockReset(); });
afterEach(cleanup);
async function show(row = feature, canMutate = true) {
  render(<TemplateDesignerBasePolicy feature={row} applicationId={row.moduleId} canMutate={canMutate} onRefresh={vi.fn().mockResolvedValue({ features: [row] })} />);
  await act(async () => {});
}
describe("default availability panel", () => {
  it.each(["en", "ar"] as const)("shows real inclusion and globally scoped confirmation in %s", async (lang) => {
    state.lang = lang;
    const copy = (lang === "en" ? en : ar).applications.baseFeaturePolicy;
    await show();
    expect(screen.getByText(copy.included)).toBeInTheDocument();
    expect(screen.getByText(`${copy.revision} 2`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: copy.exclude }));
    expect(screen.getByRole("dialog")).toHaveAttribute("dir", lang === "en" ? "ltr" : "rtl");
    expect(screen.getByText(copy.scope)).toBeInTheDocument();
    expect(screen.getByText(copy.excludeConsequence)).toBeInTheDocument();
    expect(state.update).not.toHaveBeenCalled();
  });
  it("shows unavailable rather than excluded when policy metadata is missing", async () => {
    await show({ ...feature, baseIncluded: undefined });
    expect(screen.getByText(en.applications.baseFeaturePolicy.unavailable)).toBeInTheDocument();
    expect(screen.queryByText(en.applications.baseFeaturePolicy.excluded)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: en.applications.baseFeaturePolicy.include })).not.toBeInTheDocument();
  });
  it("keeps current policy readable but hides mutation without both permissions", async () => {
    await show(feature, false);
    expect(screen.getByText(en.applications.baseFeaturePolicy.included)).toBeInTheDocument();
    expect(screen.getByText(en.applications.baseFeaturePolicy.permissionRequired)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: en.applications.baseFeaturePolicy.exclude })).not.toBeInTheDocument();
  });
});
