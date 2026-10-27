// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { STALE_REVISION_CODE } from "../../template-lifecycle-contract";
import type { TemplateValidationRun } from "../../template-lifecycle-contract";
import type { TemplateDetail } from "../../templates-contract";
import type { TemplateGrants } from "./useTemplateDetail";
import { useTemplateRelease } from "./useTemplateRelease";

const { io, toast } = vi.hoisted(() => ({
  io: { versions: vi.fn(), validate: vi.fn(), publish: vi.fn() },
  toast: { success: vi.fn(), errorFromApi: vi.fn(), outcomeFromApi: vi.fn() },
}));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en }) }));
vi.mock("@/design-system", () => ({ useToast: () => toast }));
vi.mock("../../template-lifecycle-api", () => ({
  fetchTemplateVersions: io.versions,
  fetchTemplateVersion: vi.fn(),
  publishTemplate: io.publish,
  restoreTemplateVersion: vi.fn(),
  retireTemplateVersion: vi.fn(),
  validateTemplateDraft: io.validate,
}));

const TEMPLATE_ID = "01900100-0000-7000-8000-000000000001";
const DRAFT_ID = "01900100-0000-7000-8000-000000000002";
const RUN_ID = "01900100-0000-7000-8000-000000000003";
const grants: TemplateGrants = {
  canRead: true, canUpdate: true, canPublish: true, canArchive: true,
  canRestore: true, canPreview: true, canManageAssets: true, canManageAssignments: true,
};

function detail(definitionRevision = 1, draftRevision = 1): TemplateDetail {
  const draft = { draftId: DRAFT_ID, revision: draftRevision, validationState: "PASSED" as const };
  return {
    id: TEMPLATE_ID, code: "QUOTE", name: "Quotation", description: null,
    documentType: "QUOTATION", outputChannel: "PRINT", layoutMode: "HYBRID_DOCUMENT",
    lifecycleStatus: "ACTIVE", locale: "en-US", direction: "LTR",
    dataSourceKey: "TRADE_QUOTATION_PRINT_V1", scope: { type: "TENANT" },
    systemProtected: false, definitionRevision,
    definitionEtag: `"${definitionRevision}"`, etag: `"${definitionRevision}"`,
    draft, currentDraft: { ...draft, contentChecksum: "a".repeat(64), etag: `"${draftRevision}"` },
    currentPublishedVersion: null,
    createdAt: "2026-10-17T00:00:00.000Z", updatedAt: "2026-10-17T00:00:00.000Z",
  };
}

function validationRun(draftRevision: number): TemplateValidationRun {
  return {
    id: RUN_ID, draftId: DRAFT_ID, draftRevision, status: "PASSED",
    rendererTargets: ["HTML", "PDF"], issues: [], completedAt: "2026-10-17T00:00:00.000Z",
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  io.versions.mockResolvedValue({ items: [], nextCursor: null, hasNextPage: false, limit: 25, totalCount: 0 });
  io.publish.mockResolvedValue(undefined);
});
afterEach(cleanup);

describe("template publish concurrency", () => {
  it.each([
    { change: "a metadata-only rename", definitionRevision: 2, draftRevision: 1 },
    { change: "a draft save", definitionRevision: 1, draftRevision: 3 },
  ])("publishes after $change with independent revisions", async ({ definitionRevision, draftRevision }) => {
    const onReload = vi.fn();
    const { result, rerender } = renderHook(
      ({ template }) => useTemplateRelease(template, grants, onReload),
      { initialProps: { template: detail() } },
    );
    const loaded = { ...detail(definitionRevision, draftRevision), name: "Renamed quotation" };
    rerender({ template: loaded });
    io.validate.mockResolvedValue(validationRun(draftRevision));

    await act(async () => { await result.current.validate(); });
    expect(io.validate).toHaveBeenCalledWith(TEMPLATE_ID,
      { draftRevision, rendererTargets: ["HTML", "PDF"] }, loaded.currentDraft.etag);
    expect(result.current.canPublish).toBe(true);
    onReload.mockClear();
    toast.success.mockClear();

    await act(async () => { await result.current.publish(" Release "); });
    expect(io.publish).toHaveBeenCalledWith(TEMPLATE_ID, {
      definitionRevision, draftRevision, validationRunId: RUN_ID,
      changeNote: "Release", setAsDefinitionPublished: true,
    }, loaded.currentDraft.etag);
    expect(toast.success).toHaveBeenCalledWith(en.coreOperations.templates.savedTitle, en.coreOperations.templates.published);
    expect(onReload).toHaveBeenCalledOnce();
    expect(result.current.run).toBeNull();
  });

  it("surfaces a server rejection when the validated draft became stale", async () => {
    const onReload = vi.fn();
    const loaded = detail(2, 1);
    const run = validationRun(1);
    io.validate.mockResolvedValue(run);
    const { result } = renderHook(() => useTemplateRelease(loaded, grants, onReload));
    await act(async () => { await result.current.validate(); });
    onReload.mockClear();
    toast.success.mockClear();
    io.publish.mockRejectedValue(new TenantApiClientError("Stale revision", {
      status: 409, statusText: "Conflict", headers: new Headers(),
      data: { errorCode: STALE_REVISION_CODE, message: "Stale revision" },
    }));

    await act(async () => { await result.current.publish(""); });
    expect(io.publish).toHaveBeenCalledWith(TEMPLATE_ID, expect.objectContaining({
      definitionRevision: 2, draftRevision: 1,
    }), loaded.currentDraft.etag);
    expect(toast.errorFromApi).toHaveBeenCalledWith(en.coreOperations.templates.publishFailed,
      expect.objectContaining({ status: 409, code: STALE_REVISION_CODE }));
    expect(toast.success).not.toHaveBeenCalled();
    expect(onReload).not.toHaveBeenCalled();
    expect(result.current.run).toEqual(run);
    expect(result.current.isPublishing).toBe(false);
  });
});
