// @vitest-environment jsdom

import { cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/design-system";
import { en } from "@/i18n/dictionaries/en";
import type { Pipeline } from "../pipeline-contract";
import { usePipelineColumns } from "./usePipelineColumns";

const access = vi.hoisted(() => ({ canMutate: true }));
vi.mock("@/hooks/useAccessMode", () => ({ useAccessMode: () => access }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
beforeEach(() => { access.canMutate = true; vi.clearAllMocks(); });
afterEach(cleanup);
const pipeline: Pipeline = {
  id: "pipeline", code: "SALES", nameEn: "Sales", nameAr: "Sales", description: null,
  isDefault: true, isActive: true, accessMode: "ALL", stages: [], assignments: null,
  createdAt: "2026-10-17T00:00:00Z", updatedAt: "2026-10-17T00:00:00Z",
};
const options = { canManage: true, pendingId: null, onSetDefault: vi.fn(), onDelete: vi.fn() };

it("hides delete on the default pipeline", () => {
  const { result } = renderHook(() => usePipelineColumns(options));
  const actions = result.current.find(({ id }) => id === "actions");
  render(<TooltipProvider>{actions?.cell?.(pipeline)}</TooltipProvider>);
  expect(screen.queryByRole("button", { name: `${en.common.delete}: Sales` })).toBeNull();
});

it("offers delete for another pipeline", () => {
  const { result } = renderHook(() => usePipelineColumns(options));
  const actions = result.current.find(({ id }) => id === "actions");
  render(<TooltipProvider>{actions?.cell?.({ ...pipeline, isDefault: false })}</TooltipProvider>);
  expect(screen.getByRole("button", { name: `${en.common.delete}: Sales` })).toBeTruthy();
});

it("omits management actions in read-only mode", () => {
  access.canMutate = false;
  const { result } = renderHook(() => usePipelineColumns(options));
  expect(result.current.some(({ id }) => id === "actions")).toBe(false);
});

it.each(["ALL", "RESTRICTED"] as const)("only allows ALL pipelines to become default (%s)", (accessMode) => {
  const { result } = renderHook(() => usePipelineColumns(options));
  const actions = result.current.find(({ id }) => id === "actions");
  const row = { ...pipeline, isDefault: false, accessMode };
  render(<TooltipProvider>{actions?.cell?.(row)}</TooltipProvider>);
  const button = screen.getByRole("button", { name: `${en.crmPipelines.makeDefault}: Sales` });
  expect((button as HTMLButtonElement).disabled).toBe(accessMode !== "ALL");
  fireEvent.click(button);
  expect(options.onSetDefault).toHaveBeenCalledTimes(accessMode === "ALL" ? 1 : 0);
});

it.each([
  { isActive: false, accessMode: "ALL" as const, pendingId: null, reason: en.crmConfigActionHints.inactivePipeline },
  { isActive: true, accessMode: "RESTRICTED" as const, pendingId: null, reason: en.crmConfigActionHints.restrictedPipeline },
  { isActive: true, accessMode: "ALL" as const, pendingId: "other", reason: en.crmConfigActionHints.pending },
])("exposes the disabled default reason on keyboard focus: $reason", async ({ isActive, accessMode, pendingId, reason }) => {
  const { result } = renderHook(() => usePipelineColumns({ ...options, pendingId }));
  const actions = result.current.find(({ id }) => id === "actions");
  render(<TooltipProvider>{actions?.cell?.({ ...pipeline, isDefault: false, isActive, accessMode })}</TooltipProvider>);
  const button = screen.getByRole("button", { name: `${en.crmPipelines.makeDefault}: Sales` });
  expect((button as HTMLButtonElement).disabled).toBe(true);
  const trigger = button.parentElement!;
  expect(trigger.tabIndex).toBe(0);
  fireEvent.focus(trigger);
  expect(await screen.findByRole("tooltip")).toHaveProperty("textContent", reason);
  expect(options.onSetDefault).not.toHaveBeenCalled();
});
