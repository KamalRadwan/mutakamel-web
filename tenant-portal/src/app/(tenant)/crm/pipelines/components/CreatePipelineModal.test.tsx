// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/I18nContext";
import { en } from "@/i18n/dictionaries/en";
import { CreatePipelineModal } from "./CreatePipelineModal";

vi.mock("@/i18n/I18nContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/i18n/I18nContext")>()),
  useI18n: () => ({ t: en, lang: "en", dir: "ltr" }),
}));
afterEach(cleanup);

function renderCreate() {
  const onOpenChange = vi.fn();
  const onSubmit = vi.fn();
  render(<I18nProvider><CreatePipelineModal open onOpenChange={onOpenChange}
    onSubmit={onSubmit} isSubmitting={false} stageCatalogue={[]} isLoadingCatalogue={false} />
  </I18nProvider>);
  return { onOpenChange, onSubmit };
}

it("does not resize the form with blur errors before the user can cancel", () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  const { onOpenChange, onSubmit } = renderCreate();
  fireEvent.blur(screen.getByRole("textbox", { name: en.crmPipelines.codeLabel }));
  expect(screen.queryByText(en.crmShared.fieldRequired)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: en.common.cancel }));
  expect(onOpenChange).toHaveBeenCalledWith(false);
  expect(onSubmit).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});

it("shows required fields on submit and preserves valid canonical-stage creation", () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  const { onSubmit } = renderCreate();
  fireEvent.click(screen.getByRole("button", { name: en.common.create }));
  expect(screen.getByText(en.crmShared.fieldRequired)).toBeInTheDocument();
  expect(onSubmit).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole("textbox", { name: en.crmPipelines.codeLabel }), { target: { value: "sales" } });
  fireEvent.change(screen.getByRole("textbox", { name: en.crmPipelines.nameAr }), { target: { value: "المبيعات" } });
  fireEvent.change(screen.getByRole("textbox", { name: en.crmPipelines.nameEn }), { target: { value: "Sales" } });
  fireEvent.click(screen.getByRole("button", { name: en.common.create }));
  expect(onSubmit).toHaveBeenCalledWith({ code: "SALES", nameAr: "المبيعات", nameEn: "Sales", description: "", isDefault: false, stageIds: [] });
  vi.unstubAllGlobals();
});
