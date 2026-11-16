// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { fetchTemplateVersion } from "../../template-lifecycle-api";
import type { TenantProfileCommit, useTenantAuth } from "@/context/AuthContext";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { subscribePermissionDenials, TenantApiClientError } from "@/lib/api/axiosClient";
import { isUUIDv7 } from "@/lib/uuid";
import { CURSOR_INVALID_CODE, type TemplateRecoverySnapshot, type TemplateVersion } from "../../template-lifecycle-contract";
import type { TemplateCursorPage, TemplateDetail } from "../../templates-contract";
import type { TemplateGrants } from "./useTemplateDetail";
import { useTemplateRecovery } from "./useTemplateRecovery";
import { useTemplateRelease } from "./useTemplateRelease";
import { useTemplateVersionAuthority } from "./useTemplateVersionAuthority";

const { io, toast } = vi.hoisted(() => ({
 io: {
  versions: vi.fn(), snapshots: vi.fn(), view: vi.fn<typeof fetchTemplateVersion>(),
  restoreVersion: vi.fn(), retire: vi.fn(), restoreSnapshot: vi.fn(),
 },
 toast: { success: vi.fn(), errorFromApi: vi.fn(), outcomeFromApi: vi.fn() },
}));
let arabicFeedback = false;
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => auth }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: arabicFeedback ? ar : en }) }));
vi.mock("@/design-system", () => ({ useToast: () => toast }));
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
// Inert profile input to the real authority hook; it grants no live session authority.
const profile: TenantProfileCommit = {
  user: {
    id: "01900100-0000-7000-8000-000000000003", email: "history@example.test",
    firstName: "History", lastName: "Test", isTenantOwner: false, status: "ACTIVE",
    accessibleBranches: [], accessibleCompanies: [], accessibleBranchCompanies: [],
    permissions: ["templates.read"], featureEntitlements: {},
    permissionScopes: { "templates.read": { tenantWide: true, companyIds: [], branchIds: [] } },
    teamMemberships: [], accessScope: { mode: "FULL", branchesTruncated: false,
      companiesTruncated: false, teamMembershipsTruncated: false, teamMembershipsTotal: 0 },
  },
  sessionRevision: "inert-history-test", sequence: 1,
};
let readiness: TenantProfileCommit | null = profile;
const readinessListeners = new Set<() => void>();
function setReadiness(next: TenantProfileCommit | null) {
  readiness = next;
  readinessListeners.forEach(listener => listener());
}
const auth: Pick<ReturnType<typeof useTenantAuth>, "user" | "authState" |
  "readReadyProfileCommit" | "subscribeProfileReadiness" | "recoverTemplateProfile"> = {
  user: profile.user, authState: "AUTHENTICATED", readReadyProfileCommit: () => readiness,
  subscribeProfileReadiness: listener => {
    readinessListeners.add(listener);
    return () => { readinessListeners.delete(listener); };
  },
  recoverTemplateProfile: async () => {},
};
const versions: TemplateVersion[] = Array.from({ length: 26 }, (_, index) => ({
  id: `01900100-0000-7000-8000-${String(26 - index).padStart(12, "0")}`, locale: "en-US", versionNumber: 26 - index, lifecycleStatus: "PUBLISHED",
  publishedAt: template.createdAt, retiredAt: null, changeNote: null,
  templateContentChecksum: "a".repeat(64), dataSourceKey: template.dataSourceKey,
  compilerVersion: null, validationRunId: null, rendererTargets: [],
}));
const versionDetail: TemplateVersion = {
  ...versions[25], compilerVersion: "inert-compiler",
  validationRunId: "01900100-0000-7000-8000-000000000004", rendererTargets: ["HTML", "PDF"],
};
function verifiedDetail(selected: TemplateVersion): TemplateVersion {
  return { ...versionDetail, ...selected, compilerVersion: versionDetail.compilerVersion,
    validationRunId: versionDetail.validationRunId, rendererTargets: versionDetail.rendererTargets };
}
const snapshots: TemplateRecoverySnapshot[] = Array.from({ length: 26 }, (_, index) => ({
  id: `snapshot-${26 - index}`, sourceDraftRevision: 26 - index,
  snapshotChecksum: String(index).padStart(64, "a"), captureReason: "AUTOSAVE",
  createdAt: template.createdAt, expiresAt: "2099-10-17T00:00:00.000Z",
  integrityStatus: "AVAILABLE", restoredAt: null, objectDeletedAt: null,
}));
const forbidden = () => new TenantApiClientError("Forbidden", {
  status: 403, statusText: "Forbidden", headers: new Headers(), data: { errorCode: "FORBIDDEN" },
});
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
  return renderHook(({ selected, allowed }) => {
    const { authority } = useTemplateVersionAuthority(selected.id, selected);
    return {
      release: useTemplateRelease(selected, { ...grants, canRead: allowed }, vi.fn(), authority),
      recovery: useTemplateRecovery(selected, allowed, vi.fn()),
    };
  }, { initialProps: { selected: template, allowed: true } });
}

beforeEach(() => {
  vi.resetAllMocks();
  arabicFeedback = false;
  io.versions.mockImplementation(async (_id: string, options: { cursor?: string }) =>
    options.cursor ? page(versions.slice(25), null) : page(versions.slice(0, 25), VERSION_CURSOR));
  io.snapshots.mockImplementation(async (_id: string, options: { cursor?: string }) =>
    options.cursor ? page(snapshots.slice(25), null) : page(snapshots.slice(0, 25), SNAPSHOT_CURSOR));
  setReadiness(profile);
  io.view.mockImplementation(async (_templateId, _versionId, _signal, verification) => {
    verification?.assertCurrent?.();
    return verifiedDetail(verification?.selected ?? versionDetail);
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const recoverySnapshot = { ...snapshots[0], id: "01900100-0000-7000-8000-000000000040" };
const foreignRecoveryOwner = "01900100-0000-7000-8000-000000000099";
const recoveryCorrelation = "01900100-0000-7000-8000-000000000050";
const recoveryReplies = [
  "wrong snapshot", "wrong checksum", "wrong definition", "wrong draft", "wrong draft revision",
  "wrong recovered revision", "wrong body ETag", "weak header ETag", "missing header ETag",
  "denied", "idempotent replay",
] as const;
type RecoveryReply = typeof recoveryReplies[number];

async function mockActualSnapshotRestore() {
  const api = await vi.importActual<typeof import("../../template-lifecycle-api")>("../../template-lifecycle-api");
  io.restoreSnapshot.mockImplementation(api.restoreRecoverySnapshot);
}

function snapshotRestoreWire(url: URL, expected: TemplateDetail, reply: RecoveryReply) {
  const revision = expected.currentDraft.revision + 1;
  const etag = `"${revision}"`;
  const headers = new Headers({ ETag: etag, "X-Correlation-Id": recoveryCorrelation });
  if (reply === "weak header ETag") headers.set("ETag", "W/" + etag);
  if (reply === "missing header ETag") {
    headers.delete("ETag");
    headers.delete("X-Correlation-Id");
  }
  if (reply === "idempotent replay") headers.set("Idempotency-Replayed", "true");
  const draft = {
    draftId: reply === "wrong draft" ? foreignRecoveryOwner : expected.currentDraft.draftId,
    templateId: reply === "wrong definition" ? foreignRecoveryOwner : expected.id,
    revision: reply === "wrong draft revision" ? revision + 1 : revision,
    etag: reply === "wrong body ETag" ? `"${revision + 1}"` : etag,
    editorDocument: { schemaVersion: 1, documentType: expected.documentType, layoutMode: expected.layoutMode,
      outputChannel: expected.outputChannel, locale: expected.locale, dataSourceKey: expected.dataSourceKey,
      direction: expected.direction, theme: {}, rootNodeIds: [], nodes: {} },
  };
  const recoveredFrom = {
    snapshotId: reply === "wrong snapshot" ? foreignRecoveryOwner : recoverySnapshot.id,
    snapshotChecksum: reply === "wrong checksum" ? "b".repeat(64) : recoverySnapshot.snapshotChecksum,
    sourceDraftRevision: recoverySnapshot.sourceDraftRevision, captureReason: recoverySnapshot.captureReason,
    createdAt: recoverySnapshot.createdAt, expiresAt: recoverySnapshot.expiresAt,
    integrityStatus: "AVAILABLE", objectDeletedAt: null, restoredAt: expected.updatedAt,
    restoredToDraftRevision: reply === "wrong recovered revision" ? revision - 1 : revision,
  };
  const response = reply === "denied"
    ? Response.json({ success: false, statusCode: 403, errorCode: "GW.AUTH.FORBIDDEN" }, { status: 403, headers })
    : Response.json({ success: true, correlationId: recoveryCorrelation,
      data: { draft, migrationRecovery: null, recoveredFrom, replacedDraftRecovery: null } }, { status: 200, headers });
  Object.defineProperty(response, "url", { value: url.href });
  return response;
}

it.each(recoveryReplies)("binds the Sales Quotation Recovery Snapshot Restore receipt (%s)", async reply => {
  arabicFeedback = reply === "wrong snapshot";
  const t = arabicFeedback ? ar : en;
  const copy = t.coreOperations.templates;
  const reload = vi.fn();
  await mockActualSnapshotRestore();
  const fetchRestore = vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(String(input), window.location.origin);
    expect(url.pathname).toBe(`/api/tenant/core/v1/templates/${template.id}/draft/recovery-snapshots/${recoverySnapshot.id}/restore`);
    expect(init?.method).toBe("POST");
    const headers = new Headers(init?.headers);
    expect(headers.get("if-match")).toBe(template.currentDraft.etag);
    expect(isUUIDv7(headers.get("x-idempotency-key"))).toBe(true);
    expect(JSON.parse(String(init?.body))).toEqual({
      expectedSnapshotChecksum: recoverySnapshot.snapshotChecksum, reason: "Recover original draft", discardCurrentDraft: true,
    });
    return snapshotRestoreWire(url, template, reply);
  });
  vi.stubGlobal("fetch", fetchRestore);
  const { result } = renderHook(() => useTemplateRecovery(template, true, reload));
  act(() => { result.current.openRestore(recoverySnapshot); result.current.setAcknowledgedDiscard(true); });
  await act(async () => { await result.current.restore(" Recover original draft "); });
  expect(fetchRestore).toHaveBeenCalledOnce();
  expect(result.current.isSubmitting).toBe(false);
  if (reply === "idempotent replay") {
    expect(toast.success).toHaveBeenCalledExactlyOnceWith(copy.savedTitle, copy.snapshotRestored);
    expect(result.current.restoring).toBeNull();
    expect(reload).toHaveBeenCalledOnce();
  } else {
    expect(toast.success).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
    expect(result.current.restoring?.id).toBe(recoverySnapshot.id);
    expect(result.current.formError).toBe(reply === "denied" ? null
      : `${copy.invalidLifecycleReply} — ${t.errors.reference}: ${recoveryCorrelation}`);
  }
});

it.each(["before confirmation", "after accepted request", "after denied request", "after profile change"] as const)(
  "retires a Sales Quotation Recovery Snapshot Restore intent (%s)",
  async timing => {
    await mockActualSnapshotRestore();
    const reload = vi.fn();
    const waiting = deferred<Response>();
    const fetchRestore = vi.fn<typeof fetch>(() => waiting.promise);
    vi.stubGlobal("fetch", fetchRestore);
    const { result, rerender } = renderHook(({ selected }) => useTemplateRecovery(selected, true, reload), {
      initialProps: { selected: template },
    });
    act(() => { result.current.openRestore(recoverySnapshot); result.current.setAcknowledgedDiscard(true); });
    const confirm = result.current.restore;
    let oldFlight: Promise<void> | undefined;
    if (timing !== "before confirmation") {
      act(() => { oldFlight = confirm("Recover original draft"); });
      await waitFor(() => expect(fetchRestore).toHaveBeenCalledOnce());
    }
    if (timing === "after profile change") {
      act(() => setReadiness({ ...profile, sequence: profile.sequence + 1 }));
    } else {
      rerender({ selected: { ...template, currentDraft: { ...template.currentDraft, revision: 4, etag: '"4"' } } });
    }
    expect(result.current.restoring).toBeNull();
    expect(result.current.acknowledgedDiscard).toBe(false);
    expect(result.current.isSubmitting).toBe(false);
    act(() => { result.current.openRestore(recoverySnapshot); result.current.setAcknowledgedDiscard(true); });
    if (timing === "before confirmation") {
      await act(async () => { await confirm("Recover original draft"); });
      expect(fetchRestore).not.toHaveBeenCalled();
    } else {
      const denial = vi.fn();
      const unsubscribe = subscribePermissionDenials(denial);
      try {
        const url = new URL(String(fetchRestore.mock.calls[0][0]), window.location.origin);
        await act(async () => {
          waiting.resolve(snapshotRestoreWire(url, template, timing === "after denied request" ? "denied" : "idempotent replay"));
          await oldFlight;
        });
        expect(denial).not.toHaveBeenCalled();
      } finally {
        unsubscribe();
      }
      expect(fetchRestore).toHaveBeenCalledOnce();
    }
    expect(result.current.restoring?.id).toBe(recoverySnapshot.id);
    expect(result.current.formError).toBeNull();
    expect(toast.success).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  },
);

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
    await waitFor(() => expect(result.current.release.versionDetail).toEqual(expect.objectContaining({
      state: "ready", row: versions[25], version: versionDetail,
    })));
    expect(io.view).toHaveBeenCalledWith(template.id, versions[25].id, expect.any(AbortSignal), {
      selected: versions[25], scope: { headers: {}, locale: template.locale }, assertCurrent: expect.any(Function),
    });
    act(() => result.current.release.openRestore(versions[25]));
    await act(async () => result.current.release.restoreVersion("Recover older version"));
    expect(io.restoreVersion).toHaveBeenCalledWith(template.id, versions[25].id,
      { reason: "Recover older version", discardCurrentDraft: true }, {
        draftId: template.currentDraft.draftId, revision: template.currentDraft.revision,
        etag: template.currentDraft.etag, assertCurrent: expect.any(Function),
      });
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
    }, { draftId: template.currentDraft.draftId, revision: template.currentDraft.revision,
      etag: template.currentDraft.etag, assertCurrent: expect.any(Function) });
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
        oldVersions.reject(forbidden());
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

describe("verified version selection lifetime", () => {
  it("current 403 aborts a pending detail and disables retained History handlers", async () => {
    const { result } = histories();
    await waitFor(() => expect(result.current.release.versions).toHaveLength(25));
    act(() => { result.current.release.openRestore(versions[0]); result.current.release.openRetire(versions[0]); });
    const old = result.current.release;
    const pendingDetail = deferred<ReturnType<typeof verifiedDetail>>();
    const denied = deferred<TemplateCursorPage<TemplateVersion>>();
    io.view.mockReturnValueOnce(pendingDetail.promise);
    io.versions.mockReturnValueOnce(denied.promise);
    let pending!: Promise<void>;
    await act(async () => {
      pending = old.openVersion(versions[0]);
      old.reloadVersions();
    });
    expect(result.current.release.versionDetail?.state).toBe("pending");
    const signal = io.view.mock.calls.at(-1)?.[2] as AbortSignal;
    await act(async () => { denied.reject(forbidden()); });
    expect(signal.aborted).toBe(true);
    expect(result.current.release.versions).toEqual([]);
    expect(result.current.release.versionDetail).toBeNull();
    expect(result.current.release.versionsError?.status).toBe(403);
    expect(result.current.release.restoring).toBeNull();
    expect(result.current.release.retiring).toBeNull();
    expect(result.current.release.canOpenVersion).toBe(false);
    await act(async () => {
      pendingDetail.resolve(verifiedDetail(versions[0]));
      await pending;
      await old.openVersion(versions[1]);
      await old.restoreVersion("Older retained command");
      await old.retireVersion();
      old.reloadVersions();
    });
    expect(result.current.release.versionDetail).toBeNull();
    expect(io.view).toHaveBeenCalledOnce();
    expect(io.versions).toHaveBeenCalledTimes(2);
    expect(io.restoreVersion).not.toHaveBeenCalled();
    expect(io.retire).not.toHaveBeenCalled();
  });

  it("new selection replaces ready detail immediately and callback refs preserve focus", async () => {
    const { result } = histories();
    await waitFor(() => expect(result.current.release.versions).toHaveLength(25));
    const history = document.createElement("nav"), detail = document.createElement("div"), button = document.createElement("button");
    history.tabIndex = -1;
    detail.tabIndex = -1;
    document.body.append(history, detail, button);
    try {
      result.current.release.registerVersionHistory(history);
      result.current.release.registerVersionDetail(detail);
      button.focus();
      await act(async () => { await result.current.release.openVersion(versions[0], button); });
      expect(result.current.release.versionDetail?.state).toBe("ready");
      expect(document.activeElement).toBe(detail);
      act(() => result.current.release.closeVersion());
      expect(document.activeElement).toBe(button);
      await act(async () => { await result.current.release.openVersion(versions[0], button); });
      const next = deferred<ReturnType<typeof verifiedDetail>>();
      io.view.mockReturnValueOnce(next.promise);
      let pending!: Promise<void>;
      await act(async () => { pending = result.current.release.openVersion(versions[1]); });
      expect(result.current.release.versionDetail).toEqual(expect.objectContaining({ state: "pending", row: versions[1] }));
      await act(async () => { next.resolve(verifiedDetail(versions[1])); await pending; });
      expect(result.current.release.versionDetail).toEqual(expect.objectContaining({ state: "ready", row: versions[1] }));
      button.remove();
      detail.focus();
      act(() => result.current.release.closeVersion());
      expect(document.activeElement).toBe(history);
    } finally {
      history.remove(); detail.remove(); button.remove();
    }
  });

  it("retires the old selection on readiness loss and admits a new verified selection", async () => {
    const { result } = histories();
    await waitFor(() => expect(result.current.release.versions).toHaveLength(25));
    await act(async () => { await result.current.release.openVersion(versions[0]); });
    const old = result.current.release;
    const detail = old.versionDetail;
    expect(detail?.state).toBe("ready");
    if (detail?.state !== "ready") throw new Error("Expected verified detail");
    const signal = io.view.mock.calls.at(-1)?.[2];
    expect(signal?.aborted).toBe(false);
    await act(async () => { setReadiness(null); });
    expect(signal?.aborted).toBe(true);
    expect(result.current.release.versionDetail).toBeNull();
    expect(result.current.release.canOpenVersion).toBe(false);
    await act(async () => { await old.openVersion(versions[1]); });
    expect(io.view).toHaveBeenCalledOnce();

    await act(async () => { setReadiness({ ...profile, sequence: profile.sequence + 1 }); });
    await waitFor(() => expect(result.current.release.versions).toHaveLength(25));
    const retired = { ...versions[1], lifecycleStatus: "RETIRED", retiredAt: template.createdAt };
    await act(async () => { await result.current.release.openVersion(retired); });
    expect(result.current.release.versionDetail).toEqual(expect.objectContaining({
      state: "ready", row: retired, version: verifiedDetail(retired),
    }));
  });
});
