// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { CURSOR_INVALID_CODE, type TemplateRecoverySnapshot, type TemplateVersion } from "../../template-lifecycle-contract";
import type { TemplateCursorPage, TemplateDetail } from "../../templates-contract";
import type { TemplateGrants } from "./useTemplateDetail";
import { useTemplateRecovery } from "./useTemplateRecovery";
import { useTemplateRelease } from "./useTemplateRelease";

const io = vi.hoisted(() => ({
  versions: vi.fn(), snapshots: vi.fn(), view: vi.fn(),
  restoreVersion: vi.fn(), retire: vi.fn(), restoreSnapshot: vi.fn(),
}));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en }) }));
vi.mock("@/design-system", () => ({ useToast: () => ({
  success: vi.fn(), errorFromApi: vi.fn(), outcomeFromApi: vi.fn(),
}) }));
vi.mock("../../template-lifecycle-api", () => ({
  fetchTemplateVersions: io.versions,
  fetchRecoverySnapshots: io.snapshots,
  fetchTemplateVersion: io.view,
  restoreTemplateVersion: io.restoreVersion,
  retireTemplateVersion: io.retire,
  restoreRecoverySnapshot: io.restoreSnapshot,
  publishTemplate: vi.fn(), validateTemplateDraft: vi.fn(),
}));

const template: TemplateDetail = {
  id: "01900100-0000-7000-8000-000000000001", code: "QUOTE", name: "Quotation",
  description: null, documentType: "QUOTATION", outputChannel: "PRINT",
  layoutMode: "HYBRID_DOCUMENT", lifecycleStatus: "ACTIVE", locale: "en-US",
  direction: "LTR", dataSourceKey: "TRADE_QUOTATION_PRINT_V1", scope: { type: "TENANT" },
  systemProtected: false, definitionRevision: 2, definitionEtag: '"2"', etag: '"2"',
  draft: { draftId: "01900100-0000-7000-8000-000000000002", revision: 3, validationState: "PASSED" },
  currentDraft: { draftId: "01900100-0000-7000-8000-000000000002", revision: 3,
    validationState: "PASSED", contentChecksum: "a".repeat(64), etag: '"3"' },
  currentPublishedVersion: null,
  createdAt: "2026-10-17T00:00:00.000Z", updatedAt: "2026-10-17T00:00:00.000Z",
};
const grants: TemplateGrants = {
  canRead: true, canUpdate: true, canPublish: true, canArchive: true,
  canRestore: true, canPreview: true, canManageAssets: true, canManageAssignments: true,
};
const versions: TemplateVersion[] = Array.from({ length: 26 }, (_, index) => ({
  id: `version-${26 - index}`, versionNumber: 26 - index, lifecycleStatus: "PUBLISHED",
  publishedAt: template.createdAt, retiredAt: null, changeNote: null,
  templateContentChecksum: "a".repeat(64), dataSourceKey: template.dataSourceKey,
  compilerVersion: null, validationRunId: null, rendererTargets: [],
}));
const snapshots: TemplateRecoverySnapshot[] = Array.from({ length: 26 }, (_, index) => ({
  id: `snapshot-${26 - index}`, sourceDraftRevision: 26 - index,
  snapshotChecksum: String(index).padStart(64, "a"), captureReason: "AUTOSAVE",
  createdAt: template.createdAt, expiresAt: "2099-10-17T00:00:00.000Z",
  integrityStatus: "AVAILABLE", restoredAt: null, objectDeletedAt: null,
}));
const VERSION_CURSOR = "opaque.version+/==";
const SNAPSHOT_CURSOR = "opaque.snapshot+/==";
function page<T>(items: T[], nextCursor: string | null): TemplateCursorPage<T> {
  return { items, nextCursor, hasNextPage: nextCursor !== null, limit: 25, totalCount: 26 };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
function histories() {
  return renderHook(({ selected, allowed }) => ({
    release: useTemplateRelease(selected, { ...grants, canRead: allowed }, vi.fn()),
    recovery: useTemplateRecovery(selected, allowed, vi.fn()),
  }), { initialProps: { selected: template, allowed: true } });
}

beforeEach(() => {
  vi.resetAllMocks();
  io.versions.mockImplementation(async (_id: string, options: { cursor?: string }) =>
    options.cursor ? page(versions.slice(25), null) : page(versions.slice(0, 25), VERSION_CURSOR));
  io.snapshots.mockImplementation(async (_id: string, options: { cursor?: string }) =>
    options.cursor ? page(snapshots.slice(25), null) : page(snapshots.slice(0, 25), SNAPSHOT_CURSOR));
  io.view.mockResolvedValue(versions[25]);
});
afterEach(cleanup);

describe("template history pagination", () => {
  it("pages 26 versions and snapshots independently and preserves older-entry actions", async () => {
    const { result } = histories();
    await waitFor(() => {
      expect(result.current.release.versions).toEqual(versions.slice(0, 25));
      expect(result.current.recovery.snapshots).toEqual(snapshots.slice(0, 25));
    });
    expect(result.current.release.hasPreviousVersionPage).toBe(false);
    expect(result.current.recovery.hasPreviousSnapshotPage).toBe(false);

    act(() => result.current.release.nextVersionPage());
    await waitFor(() => expect(result.current.release.versions).toEqual([versions[25]]));
    expect(io.versions).toHaveBeenLastCalledWith(template.id,
      expect.objectContaining({ cursor: VERSION_CURSOR }));
    expect(result.current.release.hasNextVersionPage).toBe(false);
    expect(result.current.recovery.snapshots).toHaveLength(25);

    await act(async () => result.current.release.openVersion(versions[25]));
    await waitFor(() => expect(result.current.release.selected).toEqual(versions[25]));
    expect(io.view).toHaveBeenCalledWith(template.id, versions[25].id);
    act(() => result.current.release.openRestore(versions[25]));
    await act(async () => result.current.release.restoreVersion("Recover older version"));
    expect(io.restoreVersion).toHaveBeenCalledWith(template.id, versions[25].id,
      { reason: "Recover older version", discardCurrentDraft: true }, template.currentDraft.etag);
    act(() => result.current.release.openRetire(versions[25]));
    await act(async () => result.current.release.retireVersion());
    expect(io.retire).toHaveBeenCalledWith(template.id, versions[25].id, template.etag);
    await waitFor(() => expect(result.current.release.isLoadingVersions).toBe(false));

    act(() => result.current.release.previousVersionPage());
    await waitFor(() => expect(result.current.release.versions).toEqual(versions.slice(0, 25)));
    act(() => result.current.release.nextVersionPage());
    await waitFor(() => expect(result.current.release.versions).toEqual([versions[25]]));
    act(() => result.current.recovery.nextSnapshotPage());
    await waitFor(() => expect(result.current.recovery.snapshots).toEqual([snapshots[25]]));
    expect(io.snapshots).toHaveBeenLastCalledWith(template.id,
      expect.objectContaining({ cursor: SNAPSHOT_CURSOR }));
    expect(result.current.recovery.hasNextSnapshotPage).toBe(false);
    expect(result.current.release.versions).toEqual([versions[25]]);

    act(() => {
      result.current.recovery.setAcknowledgedDiscard(true);
      result.current.recovery.openRestore(snapshots[25]);
    });
    await act(async () => result.current.recovery.restore(" Recover older draft "));
    expect(io.restoreSnapshot).toHaveBeenCalledWith(template.id, snapshots[25].id, {
      expectedSnapshotChecksum: snapshots[25].snapshotChecksum,
      reason: "Recover older draft", discardCurrentDraft: true,
    }, template.currentDraft.etag);
    await waitFor(() => expect(result.current.recovery.isLoading).toBe(false));
    act(() => result.current.recovery.previousSnapshotPage());
    await waitFor(() => expect(result.current.recovery.snapshots).toEqual(snapshots.slice(0, 25)));
    act(() => result.current.recovery.nextSnapshotPage());
    await waitFor(() => expect(result.current.recovery.snapshots).toEqual([snapshots[25]]));
  });

  it("clears both cursor trails, rows and action selections when the definition changes", async () => {
    const { result, rerender } = histories();
    await waitFor(() => expect(result.current.release.versions).toHaveLength(25));
    await waitFor(() => expect(result.current.recovery.snapshots).toHaveLength(25));
    act(() => { result.current.release.nextVersionPage(); result.current.recovery.nextSnapshotPage(); });
    await waitFor(() => expect(result.current.release.versions).toHaveLength(1));
    await waitFor(() => expect(result.current.recovery.snapshots).toHaveLength(1));
    act(() => {
      result.current.release.openRestore(versions[25]);
      result.current.recovery.openRestore(snapshots[25]);
      result.current.recovery.setAcknowledgedDiscard(true);
    });
    const selected = { ...template, id: "01900100-0000-7000-8000-000000000099" };
    rerender({ selected, allowed: true });
    expect(result.current.release.versions).toEqual([]);
    expect(result.current.recovery.snapshots).toEqual([]);
    expect(result.current.release.restoring).toBeNull();
    expect(result.current.recovery.restoring).toBeNull();
    expect(result.current.recovery.acknowledgedDiscard).toBe(false);
    await waitFor(() => expect(result.current.release.versions).toHaveLength(25));
    await waitFor(() => expect(result.current.recovery.snapshots).toHaveLength(25));
    expect(io.versions).toHaveBeenLastCalledWith(selected.id, expect.objectContaining({ cursor: undefined }));
    expect(io.snapshots).toHaveBeenLastCalledWith(selected.id, expect.objectContaining({ cursor: undefined }));
    expect(result.current.release.hasPreviousVersionPage).toBe(false);
    expect(result.current.recovery.hasPreviousSnapshotPage).toBe(false);
  });

  it.each(["resolve", "reject"] as const)("ignores superseded requests that %s after a definition change", async (outcome) => {
    const oldVersions = deferred<TemplateCursorPage<TemplateVersion>>();
    const oldSnapshots = deferred<TemplateCursorPage<TemplateRecoverySnapshot>>();
    io.versions.mockReturnValueOnce(oldVersions.promise);
    io.snapshots.mockReturnValueOnce(oldSnapshots.promise);
    const { result, rerender } = histories();
    await waitFor(() => expect(io.versions).toHaveBeenCalledOnce());
    const oldSignal = io.versions.mock.calls[0][1].signal as AbortSignal;
    rerender({ selected: { ...template, id: "01900100-0000-7000-8000-000000000099" }, allowed: true });
    await waitFor(() => expect(result.current.release.versions).toHaveLength(25));
    await waitFor(() => expect(result.current.recovery.snapshots).toHaveLength(25));
    expect(oldSignal.aborted).toBe(true);
    await act(async () => {
      if (outcome === "resolve") {
        oldVersions.resolve(page([versions[25]], null));
        oldSnapshots.resolve(page([snapshots[25]], null));
      } else {
        oldVersions.reject(new Error("Old failure"));
        oldSnapshots.reject(new Error("Old failure"));
      }
    });
    expect(result.current.release.versions).toEqual(versions.slice(0, 25));
    expect(result.current.recovery.snapshots).toEqual(snapshots.slice(0, 25));
    expect(result.current.release.versionsError).toBeNull();
    expect(result.current.recovery.error).toBeNull();
    expect(result.current.release.isLoadingVersions).toBe(false);
    expect(result.current.recovery.isLoading).toBe(false);
  });

  it("restarts only the history whose signed cursor expired", async () => {
    const { result } = histories();
    await waitFor(() => expect(result.current.release.versions).toHaveLength(25));
    await waitFor(() => expect(result.current.recovery.snapshots).toHaveLength(25));
    io.versions.mockRejectedValueOnce(new TenantApiClientError("Expired", {
      status: 422, statusText: "Unprocessable Entity", headers: new Headers(),
      data: { errorCode: CURSOR_INVALID_CODE, message: "Expired" },
    }));
    act(() => result.current.release.nextVersionPage());
    await waitFor(() => expect(result.current.release.versionCursorWasReset).toBe(true));
    await waitFor(() => expect(result.current.release.versions).toHaveLength(25));
    expect(io.versions).toHaveBeenLastCalledWith(template.id, expect.objectContaining({ cursor: undefined }));
    expect(result.current.release.hasPreviousVersionPage).toBe(false);
    expect(io.snapshots).toHaveBeenCalledOnce();
    expect(result.current.recovery.snapshotCursorWasReset).toBe(false);
  });

  it("does not request history without its existing permission", async () => {
    const { rerender } = histories();
    rerender({ selected: template, allowed: false });
    await act(async () => {});
    expect(io.versions).not.toHaveBeenCalled();
    expect(io.snapshots).not.toHaveBeenCalled();
  });
});
