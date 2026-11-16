// @vitest-environment jsdom

import { cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/design-system";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import type { OpportunityStageDefinition } from "../../pipelines/pipeline-contract";
import { useOpportunityStageColumns } from "./useOpportunityStageColumns";

const locale = vi.hoisted(() => ({ lang: "en" as "ar" | "en" }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: { ar, en }[locale.lang], lang: locale.lang }) }));

const stage: OpportunityStageDefinition = {
  id: "01900300-0000-7000-8000-000000000001", nameAr: "مراجعة", nameEn: "Review",
  flag: "DISCOVERY", category: "IN_PROGRESS", isActive: true, isSystem: false,
  createdAt: "2026-08-01T09:00:00.000Z", updatedAt: "2026-08-01T09:00:00.000Z",
};
const options = { canManage: true, pendingId: null, onEdit: vi.fn(), onView: vi.fn(), onDelete: vi.fn() };

beforeEach(() => { locale.lang = "en"; vi.clearAllMocks(); });
afterEach(cleanup);

it.each(["ar", "en"] as const)("shows both persisted names in their own script direction in %s", (lang) => {
  locale.lang = lang;
  const { result } = renderHook(() => useOpportunityStageColumns(options));
  const columns = result.current.filter(({ id }) => id === "nameAr" || id === "nameEn");
  const copy = { ar, en }[lang].crmLeadStages;
  expect(columns.map(({ header }) => header)).toEqual([copy.arabicName, copy.englishName]);
  render(<table><tbody><tr>{columns.map((column) => <td key={column.id}>{column.cell(stage)}</td>)}</tr></tbody></table>);
  expect(screen.getByRole("cell", { name: stage.nameAr })).not.toHaveTextContent(stage.nameEn);
  expect(screen.getByRole("cell", { name: stage.nameEn })).not.toHaveTextContent(stage.nameAr);
  const arabic = screen.getByText(stage.nameAr);
  const english = screen.getByText(stage.nameEn);
  expect(arabic.tagName).toBe("BDI");
  expect(arabic).toHaveAttribute("dir", "rtl");
  expect(english).toHaveAttribute("dir", "ltr");
  expect(arabic.className).toBe(english.className);
  expect(arabic).toHaveClass("font-normal", "whitespace-normal");
});

it("retains viewing and safe editing while omitting delete for system definitions", () => {
  const { result } = renderHook(() => useOpportunityStageColumns(options));
  const actions = result.current.find(({ id }) => id === "actions")!;
  const systemStage = { ...stage, isSystem: true };
  render(<TooltipProvider>{actions.cell(systemStage)}</TooltipProvider>);
  fireEvent.click(screen.getByRole("button", { name: `${en.crmOpportunityStages.viewDetails}: Review` }));
  fireEvent.click(screen.getByRole("button", { name: `${en.crmOpportunityStages.edit}: Review` }));
  expect(options.onView).toHaveBeenCalledWith(systemStage);
  expect(options.onEdit).toHaveBeenCalledWith(systemStage);
  expect(screen.queryByRole("button", { name: `${en.common.delete}: Review` })).toBeNull();
});

it("keeps View available while hiding writes for a read-only actor", () => {
  const { result } = renderHook(() => useOpportunityStageColumns({ ...options, canManage: false }));
  const actions = result.current.find(({ id }) => id === "actions")!;
  render(<TooltipProvider>{actions.cell(stage)}</TooltipProvider>);
  expect(screen.getByRole("button", { name: `${en.crmOpportunityStages.viewDetails}: Review` })).toBeEnabled();
  expect(screen.queryByRole("button", { name: `${en.crmOpportunityStages.edit}: Review` })).toBeNull();
  expect(screen.queryByRole("button", { name: `${en.common.delete}: Review` })).toBeNull();
});

it("keeps all row actions blocked while a write is pending", () => {
  const { result } = renderHook(() => useOpportunityStageColumns({ ...options, pendingId: stage.id }));
  const actions = result.current.find(({ id }) => id === "actions")!;
  render(<TooltipProvider>{actions.cell(stage)}</TooltipProvider>);
  for (const button of screen.getAllByRole("button")) {
    expect(button).toBeDisabled();
    fireEvent.click(button);
  }
  expect(options.onView).not.toHaveBeenCalled();
  expect(options.onEdit).not.toHaveBeenCalled();
  expect(options.onDelete).not.toHaveBeenCalled();
});
