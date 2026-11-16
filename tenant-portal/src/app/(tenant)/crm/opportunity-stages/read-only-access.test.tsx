// @vitest-environment jsdom
import { Suspense } from "react";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/design-system";
import { en } from "@/i18n/dictionaries/en";
import { axiosClient, TenantApiClientError } from "@/lib/api/axiosClient";
import type { NormalizedApiError } from "@/lib/api/errors";
import OpportunityStagesPage from "./page";
import OpportunityStageDetailPage from "./[id]/page";
import { useOpportunityStagesScreen } from "./hooks/useOpportunityStagesScreen";
import { useOpportunityStageDetailScreen } from "./hooks/useOpportunityStageDetailScreen";
import { useOpportunityStageDetail } from "./hooks/useOpportunityStageDetail";

const state = vi.hoisted(() => ({ readOnly: true, queryError: null as NormalizedApiError | null, reload: vi.fn().mockResolvedValue(true), toast: { success: vi.fn(), info: vi.fn(), outcomeFromApi: vi.fn() }, push: vi.fn() }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: { permissions: ["crm.pipelines.manage"] } }) }));
vi.mock("@/hooks/useAccessMode", () => ({ useAccessMode: () => ({ mode: state.readOnly ? "READ_ONLY" : "FULL", isResolved: true, canRead: true, canMutate: !state.readOnly, isRestricted: state.readOnly }) }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: state.push }) }));
vi.mock("@/design-system", async (original) => ({ ...await original<typeof import("@/design-system")>(), useToast: () => state.toast }));
vi.mock("../shared/hooks/useOpportunityStageCatalogue", () => ({ useOpportunityStageCatalogue: () => ({ items: [stage], setItems: vi.fn(), hasLoaded: true, isLoading: false, queryError: state.queryError, reload: state.reload }) }));

const stage = { id: "01900300-0000-7000-8000-000000000001", nameAr: "مراجعة", nameEn: "Review", flag: "DISCOVERY", category: "IN_PROGRESS", isActive: true, isSystem: false, createdAt: "2026-08-01T09:00:00.000Z", updatedAt: "2026-08-01T09:00:00.000Z" } as const;
const input = { nameAr: stage.nameAr, nameEn: "Commercial review", flag: stage.flag, category: stage.category, isActive: true };
const policyError = () => new TenantApiClientError("Server policy text must not render", { status: 403, statusText: "Forbidden", headers: new Headers(), data: { code: "CRM_SUBSCRIPTION_READ_ONLY" } });

beforeEach(() => {
  state.readOnly = true;
  state.queryError = null;
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

async function renderDetail() {
  const params = Promise.resolve({ id: stage.id });
  await act(async () => { render(<TooltipProvider><Suspense fallback={null}><OpportunityStageDetailPage params={params} /></Suspense></TooltipProvider>); });
}

describe("read-only Opportunity Stages", () => {
  it("retains the catalogue, search and View while hiding mutations and guarding screen handlers", async () => {
    const post = vi.spyOn(axiosClient, "post");
    const patch = vi.spyOn(axiosClient, "patch");
    const remove = vi.spyOn(axiosClient, "delete");
    render(<TooltipProvider><OpportunityStagesPage /></TooltipProvider>);
    expect(screen.getByText("Review")).toBeInTheDocument();
    expect(screen.getByText(en.crmOpportunityStages.readOnlyNotice)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: en.crmOpportunityStages.search })).toBeEnabled();
    expect(screen.getByRole("button", { name: "View stage: Review" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: en.crmOpportunityStages.add })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit stage: Review" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete: Review" })).not.toBeInTheDocument();
    const { result } = renderHook(() => useOpportunityStagesScreen());
    act(() => { result.current.openCreate(); result.current.openEdit(stage); result.current.openDelete(stage); });
    await act(async () => { await result.current.submit(input); await result.current.confirmDelete(); });
    expect(result.current.isDrawerOpen).toBe(false);
    expect(result.current.pendingDelete).toBeNull();
    expect(post).not.toHaveBeenCalled();
    expect(patch).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it("still GETs detail for a read-only manager and blocks direct save/delete handlers", async () => {
    const get = vi.spyOn(axiosClient, "get").mockResolvedValue({ status: 200, statusText: "OK", headers: new Headers(), data: stage });
    const patch = vi.spyOn(axiosClient, "patch");
    const remove = vi.spyOn(axiosClient, "delete");
    await renderDetail();
    expect(await screen.findByRole("heading", { name: "Review" })).toBeInTheDocument();
    expect(screen.getByText(en.crmOpportunityStages.readOnlyNotice)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: en.crmOpportunityStages.edit })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: en.common.delete })).not.toBeInTheDocument();
    expect(get).toHaveBeenCalledWith(`/api/tenant/crm/v1/opportunity-stages/${stage.id}`, expect.anything());
    const { result } = renderHook(() => useOpportunityStageDetailScreen(stage.id));
    await waitFor(() => expect(result.current.stage?.id).toBe(stage.id));
    act(() => { result.current.openEdit(); result.current.openDelete(); });
    await act(async () => { await result.current.save(input); await result.current.confirmDelete(); });
    expect(result.current.isEditOpen).toBe(false);
    expect(result.current.isDeleteOpen).toBe(false);
    const direct = renderHook(() => useOpportunityStageDetail(stage.id));
    await waitFor(() => expect(direct.result.current.stage?.id).toBe(stage.id));
    await expect(direct.result.current.save(input)).resolves.toMatchObject({ error: { status: 403 } });
    await expect(direct.result.current.remove()).resolves.toMatchObject({ error: { status: 403 } });
    expect(patch).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it("does not replace a successful catalogue read with PermissionGate after write-policy 403", async () => {
    state.readOnly = false;
    const patch = vi.spyOn(axiosClient, "patch").mockRejectedValue(policyError());
    render(<TooltipProvider><OpportunityStagesPage /></TooltipProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Edit stage: Review" }));
    fireEvent.change(screen.getByRole("textbox", { name: /English name/u }), { target: { value: "Commercial review" } });
    fireEvent.click(screen.getByRole("button", { name: en.common.save }));
    expect(await screen.findByText(en.crmOpportunityStages.readOnlyNotice)).toBeInTheDocument();
    expect(screen.getByText("Review")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View stage: Review" })).toBeEnabled();
    expect(screen.queryByText(en.permissionGate.title)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: en.crmOpportunityStages.add })).not.toBeInTheDocument();
    expect(patch).toHaveBeenCalledOnce();
  });

  it("does not hide successfully read detail after write-policy 403", async () => {
    state.readOnly = false;
    vi.spyOn(axiosClient, "get").mockResolvedValue({ status: 200, statusText: "OK", headers: new Headers(), data: stage });
    const patch = vi.spyOn(axiosClient, "patch").mockRejectedValue(policyError());
    await renderDetail();
    fireEvent.click(await screen.findByRole("button", { name: en.crmOpportunityStages.edit }));
    fireEvent.change(screen.getByRole("textbox", { name: /English name/u }), { target: { value: "Commercial review" } });
    fireEvent.click(screen.getByRole("button", { name: en.common.save }));
    expect(await screen.findByText(en.crmOpportunityStages.readOnlyNotice)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Review" })).toBeInTheDocument();
    expect(screen.queryByText(en.permissionGate.title)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: en.crmOpportunityStages.edit })).not.toBeInTheDocument();
    expect(patch).toHaveBeenCalledOnce();
  });

  it("keeps authoritative catalogue GET403 as a permission boundary", () => {
    state.queryError = { status: 403, code: "FORBIDDEN" };
    render(<TooltipProvider><OpportunityStagesPage /></TooltipProvider>);
    expect(screen.getByText(en.permissionGate.title)).toBeInTheDocument();
    expect(screen.queryByText("Review")).not.toBeInTheDocument();
  });

  it("keeps authoritative detail GET403 as a permission boundary", async () => {
    vi.spyOn(axiosClient, "get").mockRejectedValue(policyError());
    await renderDetail();
    expect(await screen.findByText(en.permissionGate.title)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Review" })).not.toBeInTheDocument();
  });
});
