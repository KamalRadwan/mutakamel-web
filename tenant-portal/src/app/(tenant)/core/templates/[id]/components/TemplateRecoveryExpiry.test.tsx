// @vitest-environment jsdom
import { useLayoutEffect } from "react";
import { act, cleanup, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import {
  parseRecoverySnapshot,
  SNAPSHOT_EXPIRED_CODE,
  SNAPSHOT_STALE_CODE,
  type TemplateRecoverySnapshot,
} from "@/app/(tenant)/core/templates/template-lifecycle-contract";
import type { TemplateCursorPage, TemplateDetail } from "@/app/(tenant)/core/templates/templates-contract";
import { useTemplateRecovery } from "@/app/(tenant)/core/templates/[id]/hooks/useTemplateRecovery";
import { TemplateRecoveryPanel } from "@/app/(tenant)/core/templates/[id]/components/TemplateRecoveryPanel";

const io = vi.hoisted(() => ({
  fetch: vi.fn(),
  restore: vi.fn(),
  toast: { success: vi.fn(), errorFromApi: vi.fn(), outcomeFromApi: vi.fn() },
}));
vi.mock("@/app/(tenant)/core/templates/template-lifecycle-api", () => ({
  fetchRecoverySnapshots: io.fetch,
  restoreRecoverySnapshot: io.restore,
}));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ lang, t: lang === "ar" ? ar : en }) }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => recoveryAuth }));
const recoveryAuth = {
  authState: "AUTHENTICATED",
  readReadyProfileCommit: () => null,
  subscribeProfileReadiness: () => () => {},
};
vi.mock("@/design-system", async importOriginal => ({
  ...await importOriginal<typeof import("@/design-system")>(),
  useToast: () => io.toast,
}));

const boundary = Date.parse("2026-11-11T04:00:00.000Z");
const expiry = "2026-11-11T04:00:00.000Z";
const created = "2026-11-11T03:00:00.000Z";
const template: TemplateDetail = {
  id: "01900100-0000-7000-8000-000000000001",
  code: "QUOTE", name: "Quotation", description: null, documentType: "QUOTATION",
  outputChannel: "PRINT", layoutMode: "HYBRID_DOCUMENT", lifecycleStatus: "ACTIVE",
  locale: "en-US", direction: "LTR", dataSourceKey: "TRADE_QUOTATION_PRINT_V1", scope: { type: "TENANT" },
  systemProtected: false, definitionRevision: 2, definitionEtag: '"2"', etag: '"2"',
  draft: { draftId: "01900100-0000-7000-8000-000000000002", revision: 3, validationState: "STALE" },
  currentDraft: { draftId: "01900100-0000-7000-8000-000000000002", revision: 3,
    validationState: "STALE", contentChecksum: "b".repeat(64), etag: '"3"' },
  currentPublishedVersion: null, createdAt: created, updatedAt: created,
};
const wire = {
  snapshotId: "01900100-0000-7000-8000-000000000003", sourceDraftRevision: 2,
  snapshotChecksum: "a".repeat(64), captureReason: "SCHEMA_MIGRATION",
  createdAt: created, expiresAt: expiry, integrityStatus: "AVAILABLE",
  restoredAt: null, objectDeletedAt: null,
};
const snapshot = parseRecoverySnapshot(wire);
const copy = en.coreOperations.templates;
const page = (items: TemplateRecoverySnapshot[] = [snapshot]): TemplateCursorPage<TemplateRecoverySnapshot> =>
  ({ items, limit: 25, nextCursor: null, hasNextPage: false, totalCount: items.length });
let lang: "en" | "ar";
const reload = vi.fn();

function Panel() {
  const recovery = useTemplateRecovery(template, true, reload);
  return <TemplateRecoveryPanel recovery={recovery} />;
}

async function showPanel() {
  render(<Panel />);
  await act(async () => {});
}

function acknowledge() {
  const current = lang === "ar" ? ar : en;
  fireEvent.click(screen.getByRole("checkbox", { name: current.coreOperations.templates.discardAcknowledgement }));
}

function openReason() {
  fireEvent.click(screen.getByRole("button", { name: copy.snapshotRestore }));
  const dialog = screen.getByRole("dialog", { name: copy.snapshotRestoreTitle });
  const confirm = within(dialog).getByRole("button", { name: copy.snapshotRestore });
  fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: " Restore the saved draft " } });
  return { dialog, confirm };
}

function rejection(status: number, code: string) {
  return new TenantApiClientError("Recovery rejected", {
    status, statusText: "Recovery rejected", headers: new Headers(), data: { errorCode: code },
  });
}

describe("Recovery expiry from the snapshot timestamp", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    vi.setSystemTime(boundary - 1);
    lang = "en";
    reload.mockReset();
    io.fetch.mockReset().mockResolvedValue(page());
    io.restore.mockReset().mockResolvedValue(undefined);
    io.toast.outcomeFromApi.mockReset().mockReturnValue(false);
    io.toast.success.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("disables an already expired row after acknowledgement", async () => {
    vi.setSystemTime(boundary + 1);
    await showPanel();
    acknowledge();
    expect(screen.getByRole("button", { name: copy.snapshotRestore })).toBeDisabled();
    expect(screen.getByText(en.quotationPdf.draftRecovery.expired)).toBeVisible();
    expect(io.restore).not.toHaveBeenCalled();
  });

  it("switches the mounted row and reason confirmation at the exact boundary", async () => {
    await showPanel();
    acknowledge();
    expect(screen.getByRole("button", { name: copy.snapshotRestore })).toBeEnabled();
    const { dialog, confirm } = openReason();
    expect(confirm).toBeEnabled();
    act(() => confirm.focus());
    expect(confirm).toHaveFocus();
    act(() => vi.advanceTimersByTime(1));
    expect(within(dialog).getByRole("alert")).toHaveTextContent(copy.snapshotExpired);
    expect(confirm).toBeDisabled();
    expect(within(dialog).getByRole("textbox")).toHaveFocus();
    fireEvent.click(confirm);
    expect(io.restore).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(within(dialog).getByRole("alert")).toHaveTextContent(copy.snapshotExpired);
    expect(confirm).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("button", { name: en.common.cancel }));
    expect(screen.getByText(en.quotationPdf.draftRecovery.expired)).toBeVisible();
    expect(screen.getByRole("button", { name: copy.snapshotRestore })).toBeDisabled();
  });

  it.each([
    { locale: "en", replay: "none" },
    { locale: "ar", replay: "none" },
    { locale: "en", replay: "before" },
    { locale: "ar", replay: "before" },
    { locale: "en", replay: "after" },
    { locale: "ar", replay: "after" },
    { locale: "en", replay: "current" },
    { locale: "ar", replay: "current" },
  ] as const)("isolates a fresh Snapshot dialog and stale Confirm ($locale, $replay)", async ({ locale, replay }) => {
    lang = locale;
    const t = locale === "ar" ? ar : en;
    const current = t.coreOperations.templates;
    const oldReason = locale === "ar" ? "  سبب اللقطة السابقة  " : "  Previous snapshot reason  ";
    const newReason = locale === "ar" ? "  سبب اللقطة الجديدة  " : "  Fresh snapshot reason  ";
    const freshDeadline = boundary + 30;
    vi.setSystemTime(boundary - 30);
    const fresh = parseRecoverySnapshot({
      ...wire,
      snapshotId: "01900100-0000-7000-8000-000000000004",
      snapshotChecksum: "c".repeat(64),
      sourceDraftRevision: 1,
      expiresAt: new Date(freshDeadline).toISOString(),
    });
    io.fetch.mockReset().mockResolvedValueOnce(page([snapshot])).mockResolvedValueOnce(page([fresh]));
    io.restore.mockRejectedValue(rejection(409, SNAPSHOT_STALE_CODE));
    let currentRecovery: ReturnType<typeof useTemplateRecovery> | undefined;
    function ObservedHost() {
      const recovery = useTemplateRecovery(template, true, reload);
      useLayoutEffect(() => { currentRecovery = recovery; }, [recovery]);
      return <TemplateRecoveryPanel recovery={recovery} />;
    }
    const state = () => {
      if (!currentRecovery) throw Error("Recovery has not committed");
      return currentRecovery;
    };
    const advanceTo = (when: number) => act(() => vi.advanceTimersByTime(when - Date.now()));
    const dialogFor = () => screen.getByRole("dialog", { name: current.snapshotRestoreTitle });

    render(<ObservedHost />);
    await act(async () => {});
    acknowledge();
    fireEvent.click(screen.getByRole("button", { name: current.snapshotRestore }));
    const oldDialog = dialogFor();
    const oldInput = within(oldDialog).getByRole("textbox");
    fireEvent.change(oldInput, { target: { value: oldReason } });
    expect(state().restoring?.id).toBe(snapshot.id);
    const oldConfirm = state().restore;
    await act(async () => { state().reload(); });
    expect(state().snapshots.map(item => item.id)).toEqual([fresh.id]);
    expect(state().restoring?.id).toBe(snapshot.id);
    expect(oldInput).toHaveValue(oldReason);

    fireEvent.click(within(oldDialog).getByRole("button", { name: t.common.cancel }));
    act(() => vi.advanceTimersByTime(1));
    expect(state().restoring).toBeNull();
    expect(oldDialog).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: current.snapshotRestore }));
    const nextDialog = dialogFor();
    const reason = within(nextDialog).getByRole("textbox");
    const confirm = within(nextDialog).getByRole("button", { name: current.snapshotRestore });
    expect(nextDialog).not.toBe(oldDialog);
    expect(reason).not.toBe(oldInput);
    expect(reason).toHaveFocus();
    expect(reason).toHaveValue("");
    expect(confirm).toBeDisabled();
    expect(state().restoring).toMatchObject({ id: fresh.id, snapshotChecksum: fresh.snapshotChecksum, expiresAt: fresh.expiresAt });
    fireEvent.change(reason, { target: { value: newReason } });
    expect(confirm).toBeEnabled();

    if (replay === "current") {
      io.restore.mockResolvedValueOnce(undefined);
      await act(async () => { fireEvent.click(confirm); });
      expect(io.restore).toHaveBeenCalledExactlyOnceWith(template.id, fresh.id, {
        expectedSnapshotChecksum: fresh.snapshotChecksum,
        discardCurrentDraft: true,
        reason: newReason.trim(),
      }, {
        draftId: template.currentDraft.draftId, revision: template.currentDraft.revision,
        etag: template.currentDraft.etag, assertCurrent: expect.any(Function),
      });
      expect(reload).toHaveBeenCalledOnce();
      expect(state().restoring).toBeNull();
      return;
    }

    const replayOld = async () => {
      await act(async () => { await oldConfirm(newReason); });
      expect.soft(io.restore.mock.calls.map(([, id, command]) => ({ id, reason: command.reason }))).toEqual([]);
      expect.soft(within(nextDialog).queryByRole("alert")).toBeNull();
      expect.soft(state().restoring?.id).toBe(fresh.id);
      expect.soft(reason).toHaveValue(newReason);
      expect.soft(confirm).toBeEnabled();
      expect.soft(reload).not.toHaveBeenCalled();
    };
    if (replay === "before") {
      expect(Date.now()).toBeLessThan(boundary);
      await replayOld();
      return;
    }

    advanceTo(boundary);
    expect(state().restoring?.id).toBe(fresh.id);
    expect(state().snapshotExpiry(fresh)).toBe("current");
    expect(confirm).toBeEnabled();
    expect(reason).toHaveValue(newReason);
    expect(within(nextDialog).queryByRole("alert")).toBeNull();
    if (replay === "after") {
      await replayOld();
      return;
    }

    advanceTo(freshDeadline - 1);
    expect(confirm).toBeEnabled();
    expect(within(nextDialog).queryByRole("alert")).toBeNull();
    confirm.focus();
    advanceTo(freshDeadline);
    expect(state().snapshotExpiry(fresh)).toBe("expired");
    expect(within(nextDialog).getByRole("alert")).toHaveTextContent(current.snapshotExpired);
    expect(confirm).toBeDisabled();
    expect(reason).toHaveFocus();
    expect(reason).toHaveValue(newReason);
    expect(io.restore).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it.each([
    { locale: "en", replaceSnapshot: false },
    { locale: "ar", replaceSnapshot: false },
    { locale: "en", replaceSnapshot: true },
    { locale: "ar", replaceSnapshot: true },
  ] as const)("ignores Cancel retained from an earlier Snapshot dialog ($locale, replacement: $replaceSnapshot)",
    async ({ locale, replaceSnapshot }) => {
      lang = locale;
      const t = locale === "ar" ? ar : en;
      const current = t.coreOperations.templates;
      const typed = locale === "ar" ? "  سبب الاستعادة الجديدة  " : "  Reason in the reopened dialog  ";
      vi.setSystemTime(boundary - 30);
      const nextSnapshot = replaceSnapshot ? parseRecoverySnapshot({
        ...wire,
        snapshotId: "01900100-0000-7000-8000-000000000004",
        snapshotChecksum: "c".repeat(64),
        sourceDraftRevision: 1,
        expiresAt: new Date(boundary + 30_000).toISOString(),
      }) : snapshot;
      io.fetch.mockReset().mockResolvedValueOnce(page([snapshot])).mockResolvedValueOnce(page([nextSnapshot]));
      let currentRecovery: ReturnType<typeof useTemplateRecovery> | undefined;
      function ObservedHost() {
        const recovery = useTemplateRecovery(template, true, reload);
        useLayoutEffect(() => { currentRecovery = recovery; }, [recovery]);
        return <TemplateRecoveryPanel recovery={recovery} />;
      }
      const state = () => {
        if (!currentRecovery) throw Error("Recovery has not committed");
        return currentRecovery;
      };
      const dialogFor = () => screen.getByRole("dialog", { name: current.snapshotRestoreTitle });

      render(<ObservedHost />);
      await act(async () => {});
      acknowledge();
      fireEvent.click(screen.getByRole("button", { name: current.snapshotRestore }));
      const oldDialog = dialogFor();
      expect(state().restoring?.id).toBe(snapshot.id);
      const oldCancel = state().closeRestore;
      fireEvent.click(within(oldDialog).getByRole("button", { name: t.common.cancel }));
      act(() => vi.advanceTimersByTime(1));
      expect(oldDialog).not.toBeInTheDocument();
      expect(state().restoring).toBeNull();
      if (replaceSnapshot) await act(async () => { state().reload(); });
      expect(state().snapshots[0]?.id).toBe(nextSnapshot.id);

      fireEvent.click(screen.getByRole("button", { name: current.snapshotRestore }));
      const opened = dialogFor();
      const reason = within(opened).getByRole("textbox");
      const cancel = within(opened).getByRole("button", { name: t.common.cancel });
      expect(opened).not.toBe(oldDialog);
      expect(reason).toHaveValue("");
      fireEvent.change(reason, { target: { value: typed } });
      reason.focus();
      expect(reason).toHaveFocus();
      expect(state().restoring?.id).toBe(nextSnapshot.id);

      act(() => oldCancel());

      expect(io.restore).not.toHaveBeenCalled();
      expect(reload).not.toHaveBeenCalled();
      expect.soft(state().restoring?.id).toBe(nextSnapshot.id);
      expect(opened).toBeInTheDocument();
      expect(reason).toHaveValue(typed);
      expect(reason).toHaveFocus();
      fireEvent.click(cancel);
      expect(state().restoring).toBeNull();
      expect(screen.queryByRole("dialog", { name: current.snapshotRestoreTitle })).toBeNull();
      expect(io.restore).not.toHaveBeenCalled();
      expect(reload).not.toHaveBeenCalled();
    });

  it("rechecks time on both the captured open and confirm callbacks before any timer runs", async () => {
    const { result } = renderHook(() => useTemplateRecovery(template, true, reload));
    await act(async () => {});
    act(() => result.current.setAcknowledgedDiscard(true));
    const open = result.current.openRestore;
    act(() => open(snapshot));
    expect(result.current.restoring?.id).toBe(snapshot.id);
    const confirm = result.current.restore;
    vi.setSystemTime(boundary);
    await act(async () => confirm("Keep the record"));
    expect(result.current.formError).toBe(copy.snapshotExpired);
    expect(io.restore).not.toHaveBeenCalled();
    act(() => result.current.closeRestore());
    act(() => open(snapshot));
    expect(result.current.restoring).toBeNull();
  });

  it("uses existing Arabic retention feedback at the boundary", async () => {
    lang = "ar";
    vi.setSystemTime(boundary);
    await showPanel();
    acknowledge();
    expect(screen.getByText(ar.quotationPdf.draftRecovery.expired)).toBeVisible();
    expect(screen.getByRole("button", { name: ar.coreOperations.templates.snapshotRestore })).toBeDisabled();
  });

  it.each([
    ["invalid", { ...wire, expiresAt: "not-a-date" }],
    ["absent", Object.fromEntries(Object.entries(wire).filter(([key]) => key !== "expiresAt"))],
  ])("keeps %s expiry in the load-error and retry path", async (_label, raw) => {
    expect(() => parseRecoverySnapshot(raw)).toThrow();
    io.fetch.mockImplementationOnce(async () => page([parseRecoverySnapshot(raw)]));
    await showPanel();
    expect(screen.getByText(copy.recoveryLoadFailed)).toBeVisible();
    expect(screen.queryByRole("button", { name: copy.snapshotRestore })).toBeNull();
    expect(screen.queryByText(en.quotationPdf.draftRecovery.expired)).toBeNull();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: en.common.retry })));
    acknowledge();
    expect(screen.getByRole("button", { name: copy.snapshotRestore })).toBeEnabled();
  });

  it("keeps the unexpired checksum, acknowledgement, reason and draft ETag on retry", async () => {
    io.restore.mockRejectedValueOnce(rejection(409, SNAPSHOT_STALE_CODE));
    await showPanel();
    acknowledge();
    const { dialog, confirm } = openReason();
    await act(async () => fireEvent.click(confirm));
    expect(within(dialog).getByRole("alert")).toHaveTextContent(copy.snapshotStale);
    expect(reload).not.toHaveBeenCalled();
    await act(async () => fireEvent.click(confirm));
    expect(io.restore.mock.calls).toEqual(Array.from({ length: 2 }, () => [
      template.id, snapshot.id, {
        expectedSnapshotChecksum: snapshot.snapshotChecksum, reason: "Restore the saved draft", discardCurrentDraft: true,
      }, { draftId: template.currentDraft.draftId, revision: template.currentDraft.revision,
        etag: template.currentDraft.etag, assertCurrent: expect.any(Function) },
    ]));
    expect(reload).toHaveBeenCalledOnce();
  });

  it("retains Core's expiry feedback when it rejects before the local clock does", async () => {
    io.restore.mockRejectedValueOnce(rejection(410, SNAPSHOT_EXPIRED_CODE));
    await showPanel();
    acknowledge();
    const { dialog, confirm } = openReason();
    await act(async () => fireEvent.click(confirm));
    expect(within(dialog).getByRole("alert")).toHaveTextContent(copy.snapshotExpired);
    expect(io.restore).toHaveBeenCalledOnce();
    expect(reload).not.toHaveBeenCalled();
  });
});
