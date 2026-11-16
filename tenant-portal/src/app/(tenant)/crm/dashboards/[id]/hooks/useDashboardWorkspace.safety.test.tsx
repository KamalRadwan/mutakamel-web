// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { useDashboardWorkspace } from "./useDashboardWorkspace";
const { navigate, discard, reload, addWidget, toastError, toastSuccess, router } = vi.hoisted(() => {
  const navigate = vi.fn(); return { navigate, router: { push: navigate }, discard: vi.fn(), reload: vi.fn(), addWidget: vi.fn(), toastError: vi.fn(), toastSuccess: vi.fn() };
});
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: { permissions: [], accessibleBranches: [] } }) }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
vi.mock("@/hooks/useAccessMode", () => ({ useAccessMode: () => ({ canMutate: true }) }));
vi.mock("@/design-system", () => ({ hasPermission: () => false, useToast: () => ({ errorFromApi: toastError, outcomeFromApi: () => false, success: toastSuccess }) }));
vi.mock("./useDashboardDetail", () => ({ useDashboardDetail: () => ({ detail: { id: "current", name: "Sales", accessLevel: "OWNER" }, reload, reloadConfirmed: reload }) }));
vi.mock("./useDashboardLayout", () => ({ useDashboardLayout: () => ({ isEditing: true, isDirty: true, setIsEditing: discard, addWidget }) }));
vi.mock("./useDashboardShares", () => ({ useDashboardShares: () => ({}) }));
vi.mock("./useAvailableWidgets", () => ({ useAvailableWidgets: () => ({}) }));
vi.mock("./useWidgetDrilldown", () => ({ useWidgetDrilldown: () => ({}) }));
vi.mock("./useDashboardSwitcher", () => ({ useDashboardSwitcher: () => ({ items: [], unprovisionedTemplates: [] }) }));
beforeEach(() => vi.clearAllMocks()); afterEach(cleanup);
it("asks before switching a dirty dashboard and only navigates after explicit discard", () => {
  const { result } = renderHook(() => useDashboardWorkspace("current"));
  act(() => result.current.handleSwitcherChange("next"));
  expect(navigate).not.toHaveBeenCalled(); expect(discard).not.toHaveBeenCalled(); expect(result.current.guard.isDiscardOpen).toBe(true);
  act(() => result.current.guard.cancelDiscard()); expect(navigate).not.toHaveBeenCalled();
  act(() => result.current.handleSwitcherChange("next")); act(() => result.current.guard.confirmDiscard());
  expect(discard).toHaveBeenCalledWith(false); expect(navigate).toHaveBeenCalledWith("/crm/dashboards/next");
});
it("protects top Done and Reload instead of silently replacing a dirty layout", () => {
  const { result } = renderHook(() => useDashboardWorkspace("current"));
  act(() => result.current.toggleLayout()); expect(discard).not.toHaveBeenCalled();
  act(() => result.current.guard.cancelDiscard());
  act(() => result.current.reloadDashboard()); expect(reload).not.toHaveBeenCalled();
  act(() => result.current.guard.confirmDiscard()); expect(reload).toHaveBeenCalledTimes(1);
});
it("ignores a same-tick busy or stale completion without a false permission or action error", async () => {
  addWidget.mockResolvedValue({ ok: false, conflict: false, error: null, ignored: true });
  const { result } = renderHook(() => useDashboardWorkspace("current"));
  await act(async () => { result.current.addWidget("widget"); await Promise.resolve(); });
  expect(result.current.actionError).toBeUndefined(); expect(toastError).not.toHaveBeenCalled(); expect(toastSuccess).not.toHaveBeenCalled();
});
