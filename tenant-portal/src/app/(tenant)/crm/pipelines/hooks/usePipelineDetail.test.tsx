// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { EditPipelineModal } from "../components/EditPipelineModal";
import { PipelineRowEditor } from "../components/PipelineRowEditor";
import type { Pipeline } from "../pipeline-contract";
import { usePipelineDetail } from "./usePipelineDetail";

const { get, patch, auth } = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
  auth: { id: "detail", permissions: ["crm.pipelines.read", "crm.pipelines.manage"] },
}));
vi.mock("@/lib/api/axiosClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/axiosClient")>();
  return { ...actual, axiosClient: { ...actual.axiosClient, get, patch } };
});
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: auth }) }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
vi.mock("../../shared/hooks/useOpportunityStageCatalogue", () => ({
  useOpportunityStageCatalogue: () => ({ items: [], queryError: null, reload: vi.fn() }),
}));
vi.mock("./usePipelineFeedback", () => ({ usePipelineFeedback: () => ({
  report: vi.fn(), describeFailure: () => en.crmPipelines.actionFailed, outcome: vi.fn(),
}) }));

const id = "01900200-0000-7000-8000-000000000001";
const detailPath = `/api/tenant/crm/v1/pipelines/${id}`;
const configurationPath = `${detailPath}/configuration`;
const inactive: Pipeline = {
  id,
  code: "RESTRICTED",
  nameAr: "Sales",
  nameEn: "Sales",
  description: "Restricted sales pipeline",
  isDefault: false,
  isActive: false,
  accessMode: "RESTRICTED",
  stages: [],
  assignments: {
    accessMode: "RESTRICTED",
    userIds: ["01900200-0000-7000-8000-000000000002"],
    teamIds: [],
  },
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
};

let actorCounter = 0;
beforeEach(() => {
  auth.id = `detail-${++actorCounter}`;
  // The real Radix switch measures its form control; jsdom has no layout API.
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
  auth.permissions = ["crm.pipelines.read", "crm.pipelines.manage"];
  get.mockResolvedValue({ status: 200, data: inactive });
  patch.mockResolvedValue({ status: 200, data: { ...inactive, isActive: true }, headers: new Headers() });
});
afterEach(() => { cleanup(); vi.resetAllMocks(); vi.unstubAllGlobals(); });

function ConfigurationEditor() {
  const detail = usePipelineDetail(id);
  if (!detail.pipeline) return null;
  return <>
    <output data-testid="saved-status">{String(detail.pipeline.isActive)}</output>
    <EditPipelineModal
      open
      onOpenChange={() => {}}
      pipeline={detail.pipeline}
      isSubmitting={detail.isSaving}
      onSubmit={(input) => { void detail.save(input); }}
    />
  </>;
}

describe("pipeline configuration detail", () => {
  it("shows no submit action before the row editor has read current configuration", async () => {
    let resolve!: (value: unknown) => void;
    get.mockReturnValue(new Promise((done) => { resolve = done; }));
    render(<PipelineRowEditor pipelineId={id} onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.getByRole("dialog", { name: en.crmPipelines.editTitle })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: en.common.save })).toBeNull();
    await act(async () => { resolve({ status: 200, data: inactive }); });
    expect(await screen.findByRole("button", { name: en.common.save })).toBeEnabled();
  });

  it("saves a row edit through the configuration contract and refreshes the list", async () => {
    const onClose = vi.fn();
    const onSaved = vi.fn();
    render(<PipelineRowEditor pipelineId={id} onClose={onClose} onSaved={onSaved} />);
    const name = await screen.findByRole("textbox", { name: en.crmPipelines.nameEn });
    fireEvent.change(name, { target: { value: "Updated sales" } });
    patch.mockResolvedValue({ status: 200, data: { ...inactive, nameEn: "Updated sales" }, headers: new Headers() });
    fireEvent.click(screen.getByRole("button", { name: en.common.save }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(onClose).toHaveBeenCalledOnce();
    expect(patch).toHaveBeenCalledWith(detailPath, {
      nameAr: inactive.nameAr, nameEn: "Updated sales", description: inactive.description, isActive: false,
    }, expect.objectContaining({ nonReplayable: true }));
  });

  it("keeps an uncertain row edit and blocks a second submission when reconciliation fails", async () => {
    const onSaved = vi.fn();
    render(<PipelineRowEditor pipelineId={id} onClose={vi.fn()} onSaved={onSaved} />);
    const name = await screen.findByRole("textbox", { name: en.crmPipelines.nameEn });
    fireEvent.change(name, { target: { value: "Keep this draft" } });
    const failure = new TenantApiClientError("Unavailable", {
      status: 503, statusText: "Unavailable", headers: new Headers(), data: {},
    });
    patch.mockRejectedValue(failure);
    get.mockRejectedValue(failure);
    fireEvent.click(screen.getByRole("button", { name: en.common.save }));
    await waitFor(() => expect(screen.getByRole("button", { name: en.common.save })).toBeDisabled());
    expect(name).toHaveValue("Keep this draft");
    expect(await screen.findByText(en.crmPipelines.review.uncertainWrite)).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
    expect(patch).toHaveBeenCalledOnce();
  });

  it("renders a permission boundary inside the row modal after an authoritative 403", async () => {
    get.mockRejectedValue(new TenantApiClientError("Forbidden", {
      status: 403, statusText: "Forbidden", headers: new Headers(), data: {},
    }));
    render(<PipelineRowEditor pipelineId={id} onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(await screen.findByText(en.permissionGate.title)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: en.common.save })).toBeNull();
    expect(patch).not.toHaveBeenCalled();
  });

  it("guards a dirty row modal against dismissal", async () => {
    const onClose = vi.fn();
    render(<PipelineRowEditor pipelineId={id} onClose={onClose} onSaved={vi.fn()} />);
    fireEvent.change(await screen.findByRole("textbox", { name: en.crmPipelines.nameEn }), { target: { value: "Draft" } });
    fireEvent.click(screen.getByRole("button", { name: en.common.cancel }));
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: en.common.discardConfirm }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("lets a manager load an inactive restricted pipeline and toggle it active", async () => {
    render(<ConfigurationEditor />);
    const toggle = await screen.findByRole("switch", { name: en.common.active });
    expect(toggle).toBeEnabled();
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    expect(get).toHaveBeenCalledWith(configurationPath, expect.objectContaining({ cache: "no-store" }));

    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    expect(patch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: en.common.save }));

    await waitFor(() => expect(screen.getByTestId("saved-status").textContent).toBe("true"));
    expect(patch).toHaveBeenCalledWith(detailPath, {
      nameAr: inactive.nameAr,
      nameEn: inactive.nameEn,
      description: inactive.description,
      isActive: true,
    }, expect.objectContaining({ nonReplayable: true }));
  });

  it("keeps read-only users on the operational endpoint and refuses saves", async () => {
    auth.permissions = ["crm.pipelines.read"];
    get.mockResolvedValue({ status: 200, data: { ...inactive, isActive: true, assignments: undefined } });
    const { result } = renderHook(() => usePipelineDetail(id));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(get).toHaveBeenCalledWith(detailPath, expect.any(Object));
    expect(get).not.toHaveBeenCalledWith(configurationPath, expect.any(Object));
    await act(async () => {
      expect(await result.current.save({
        nameAr: inactive.nameAr, nameEn: inactive.nameEn,
        description: "", isActive: true,
      })).toMatchObject({ ok: false, error: { status: 403 } });
    });
    expect(patch).not.toHaveBeenCalled();
  });

  it("reloads through the appropriate endpoint when management permission changes", async () => {
    auth.permissions = ["crm.pipelines.read"];
    const { result, rerender } = renderHook(() => usePipelineDetail(id));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    auth.permissions = ["crm.pipelines.read", "crm.pipelines.manage"];
    rerender();
    await waitFor(() => expect(get).toHaveBeenLastCalledWith(configurationPath, expect.any(Object)));
    await act(async () => { await result.current.reload(); });
    expect(get).toHaveBeenLastCalledWith(configurationPath, expect.any(Object));
  });

  it("surfaces a refused configuration read without falling back to operational access", async () => {
    get.mockRejectedValue(new TenantApiClientError("Forbidden", {
      status: 403,
      statusText: "Forbidden",
      headers: new Headers(),
      data: { code: "CRM_PERMISSION_DENIED" },
    }));
    const { result } = renderHook(() => usePipelineDetail(id));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.pipeline).toBeNull();
    expect(result.current.queryError?.status).toBe(403);
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith(configurationPath, expect.any(Object));
  });
});
