"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { replaceSearchParams, useConnectivity, useRealtimeResync, useToast } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useAccessMode } from "@/hooks/useAccessMode";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError } from "@/lib/api/errors";
import { canPerformTradeAction, TRADE_PERMISSIONS } from "../../trade-scope";
import { isUuidV7 } from "../../trade-validation";
import { readCategory, readCategoryTree, type CategoryCommand } from "../category-api";
import type { CategoryDetail, CategoryReceipt, CategoryStatus } from "../category-contract";
import { useCategoryCommand } from "./useCategoryCommand";
import type { CategoryEditorRequest } from "./useCategoryEditor";
import { useCategoryDetail, useCategoryList } from "./useCategoryReads";
import { useCategoryTree } from "./useCategoryTree";

export function useCategoryWorkspace(initialId?: string) {
  const { t, lang } = useI18n(); const toast = useToast();
  const { user } = useTenantAuth(); const access = useAccessMode(); const connectivity = useConnectivity();
  const query = useSearchParams();
  const mode = query.get("view") === "list" ? "list" : "tree";
  const search = query.get("search") ?? "";
  const rawStatus = query.get("status");
  const status: CategoryStatus | undefined = rawStatus === "ACTIVE" || rawStatus === "INACTIVE" ? rawStatus : undefined;
  const rawPage = query.get("page") ?? "1";
  const page = /^[1-9]\d{0,2}$/u.test(rawPage) && Number(rawPage) <= 200 ? Number(rawPage) : 1;
  const selectedId = query.has("selected") ? query.get("selected") || null : initialId ?? null;
  const [editor, setEditor] = useState<CategoryEditorRequest | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [mobileBrowse, setMobileBrowse] = useState(false);
  const canRead = canPerformTradeAction(user, TRADE_PERMISSIONS.itemsRead) && access.canRead;
  const canManage = canPerformTradeAction(user, TRADE_PERMISSIONS.catalogMasterManage);
  const canWrite = canManage && access.canMutate && connectivity.status !== "offline";
  const command = useCategoryCommand(canWrite);
  const tree = useCategoryTree(lang, canRead);
  const list = useCategoryList(page, search, status, lang, canRead && mode === "list");
  const detail = useCategoryDetail(canRead && selectedId && isUuidV7(selectedId) ? selectedId : null, lang);
  const [reviewing, setReviewing] = useState(false);
  const [conflictCurrent, setConflictCurrent] = useState<CategoryDetail | null>(null);
  const busy = command.state.kind === "pending";
  const uncertain = command.state.kind === "uncertain";
  const reported = useRef(command.state);
  const retryFromToast = useRef<(key: string) => void>(() => undefined);
  const conflict = command.state.kind === "rejected" && command.state.error.code === "TRADE.CONCURRENCY.STALE_VERSION";
  const conflictId = conflict ? editor?.source?.id : undefined;
  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setConflictCurrent(null);
      if (conflictId) void readCategory(conflictId, lang, controller.signal)
        .then((current) => { if (!controller.signal.aborted) setConflictCurrent(current); })
        .catch(() => { /* The review action retries the read and retains the draft. */ });
    });
    return () => controller.abort();
  }, [conflictId, lang]);

  useEffect(() => {
    if (reported.current === command.state) return;
    reported.current = command.state;
    if (command.state.kind === "saved") toast.success(t.trade.savedTitle, command.state.replayed ? t.trade.replayedDescription : t.trade.savedDescription);
    if (command.state.kind === "uncertain") toast.warning(t.trade.categories.unknownOutcome,
      `${t.trade.categories.unknownDescription}\n${command.state.submission.key}${command.state.error.correlationId ? `\n${command.state.error.correlationId}` : ""}`, 0,
      { label: t.trade.categories.retryOriginal, onClick: () => {
        if (command.state.kind === "uncertain") retryFromToast.current(command.state.submission.key);
      } });
    if (command.state.kind === "rejected" && command.state.error.status !== 403) {
      if (!toast.outcomeFromApi(command.state.error)) toast.errorFromApi(t.trade.categories.saveFailed, command.state.error);
    }
  }, [command.state, t, toast]);
  useEffect(() => {
    if (!busy && !uncertain) return;
    const prevent = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [busy, uncertain]);

  const select = (id: string | null) => { setMobileBrowse(false); replaceSearchParams({ selected: id ?? (initialId ? "" : null) }); };
  const afterSaved = async (receipt: CategoryReceipt | null) => {
    if (!receipt) return;
    setEditor(null);
    select("deleted" in receipt ? null : receipt.id);
    await Promise.all([tree.reload(), list.reload(), ...((selectedId === receipt.id && !("deleted" in receipt)) ? [detail.reload()] : [])]);
    // The deleted record's action and the final tree root may both disappear.
    if ("deleted" in receipt) headingRef.current?.focus();
  };
  const reload = async () => { await Promise.all([tree.reload(), list.reload(), detail.reload()]); };
  useRealtimeResync(reload);
  useEffect(() => {
    retryFromToast.current = (key) => {
      if (canWrite && command.state.kind === "uncertain" && command.state.submission.key === key) void command.retry().then(afterSaved);
    };
    return () => { retryFromToast.current = () => undefined; };
  });

  const openEditor = (action: CategoryCommand["action"], child = false) => {
    if (!canWrite || busy || uncertain || tree.treeVersion === null) return;
    if (action !== "create" && !detail.data) return;
    if (action === "status" && detail.data?.status !== "ACTIVE" && detail.data?.status !== "INACTIVE") return;
    command.reset();
    setEditor({ action, source: action === "create" ? null : detail.data,
      treeVersion: child && detail.data ? detail.data.treeVersion : tree.treeVersion,
      parent: child ? detail.data : null });
  };
  const reviewConflict = async () => {
    if (!editor || reviewing) return;
    setReviewing(true);
    try {
      if (editor.source) {
        const current = await readCategory(editor.source.id, lang);
        setEditor({ ...editor, source: current, treeVersion: current.treeVersion });
      } else {
        const roots = await readCategoryTree(null, 1, lang);
        setEditor({ ...editor, treeVersion: roots.treeVersion });
      }
      command.reset();
      await detail.reload();
    } catch (error) { toast.errorFromApi(t.trade.categories.loadFailed, normalizeApiError(error)); }
    finally { setReviewing(false); }
  };
  return { t, lang, mode, search, status, page, selectedId, tree, list, detail, access, canManage, canWrite,
    mobileBrowse, headingRef,
    editor, command: command.state, busy, uncertain, reviewing, conflictCurrent,
    invalidId: selectedId !== null && !isUuidV7(selectedId),
    conflict,
    savedRefreshFailed: command.state.kind === "saved" && Boolean(detail.error || list.error || tree.errors.size),
    setMode: (view: "tree" | "list") => { setMobileBrowse(true); replaceSearchParams(view === "tree" ? { view, search: null, status: null, page: null } : { view }); },
    setSearch: (value: string) => replaceSearchParams({ search: value || null, page: null, view: "list" }),
    setStatus: (value: CategoryStatus | undefined) => replaceSearchParams({ status: value ?? null, page: null, view: "list" }),
    setPage: (value: number) => replaceSearchParams({ page: String(value) }), select, reload, openEditor, reviewConflict,
    dismissConflict: command.reset,
    closeEditor: () => { if (!busy && !uncertain) { setEditor(null); command.reset(); } },
    submit: async (intent: CategoryCommand) => afterSaved(await command.submit(intent)),
    retry: async () => afterSaved(await command.retry()),
    reveal: async () => {
      if (!detail.data) return;
      setMobileBrowse(true);
      replaceSearchParams({ view: "tree", search: null, status: null, page: null });
      if (await tree.reveal(detail.data)) await detail.reload();
    },
  };
}
