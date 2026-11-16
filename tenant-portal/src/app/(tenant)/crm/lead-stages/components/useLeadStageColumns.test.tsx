// @vitest-environment jsdom

import { cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/design-system";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import type { LeadStageItem } from "../lead-stage-contract";
import { useLeadStageColumns } from "./useLeadStageColumns";

const locale = vi.hoisted(() => ({ lang: "en" as "ar" | "en" }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: { ar, en }[locale.lang], lang: locale.lang }) }));

const stage: LeadStageItem = {
  id: "01900300-0000-7000-8000-000000000001", nameAr: "تم التواصل", nameEn: "Contacted",
  flag: "CONTACTED", category: "IN_PROGRESS", sortOrder: 2, isDefault: false, isActive: true,
};
const options = {
  canManage: true, writesBlocked: false, needsReload: false, settingDefaultId: null,
  onEdit: vi.fn(), onDelete: vi.fn(), onDefault: vi.fn().mockResolvedValue(undefined),
};

beforeEach(() => { locale.lang = "en"; vi.clearAllMocks(); });
afterEach(cleanup);

it.each(["ar", "en"] as const)("keeps both persisted names in separate cells in %s", (lang) => {
  locale.lang = lang;
  const { result } = renderHook(() => useLeadStageColumns(options));
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

it.each(["NEW", "DISQUALIFIED", "CONVERTED"] as const)("retains edit and delete protection for %s", (flag) => {
  const { result } = renderHook(() => useLeadStageColumns(options));
  const protectedStage = { ...stage, flag };
  const actions = result.current.find(({ id }) => id === "actions")!;
  render(<TooltipProvider>{actions.cell(protectedStage)}</TooltipProvider>);
  const edit = screen.getByRole("button", { name: `${en.crmLeadStages.editTitle}: Contacted` });
  const remove = screen.getByRole("button", { name: `${en.common.delete}: Contacted` });
  expect(edit).toBeDisabled();
  expect(remove).toBeDisabled();
  fireEvent.click(edit);
  fireEvent.click(remove);
  expect(options.onEdit).not.toHaveBeenCalled();
  expect(options.onDelete).not.toHaveBeenCalled();
});

it("keeps the names visible without management actions for a read-only actor", () => {
  const { result } = renderHook(() => useLeadStageColumns({ ...options, canManage: false }));
  expect(result.current.map(({ id }) => id)).toContain("nameAr");
  expect(result.current.map(({ id }) => id)).toContain("nameEn");
  expect(result.current.some(({ id }) => id === "actions")).toBe(false);
  const defaultColumn = result.current.find(({ id }) => id === "default")!;
  render(<>{defaultColumn.cell(stage)}</>);
  expect(screen.queryByRole("button")).toBeNull();
});
