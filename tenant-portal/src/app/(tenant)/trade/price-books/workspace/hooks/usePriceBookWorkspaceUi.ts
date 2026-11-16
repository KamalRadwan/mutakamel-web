"use client";
import { useEffect, useState } from "react";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import type { WorkspaceTabKey } from "../VersionWorkspaceTabs";
import type { ClonePriceBookVersionInput, UpdatePriceBookInput } from "../../pricing-contract";

interface Options {
  scopeKey: string;
  unknownWrite: boolean;
  isDirty: boolean;
  initialTab?: () => WorkspaceTabKey;
  onDiscardDraft?: () => void;
  clearActionError?: () => void;
  onUpdateBook?: (input: UpdatePriceBookInput) => Promise<boolean>;
  onCreateDraft?: (input: ClonePriceBookVersionInput) => Promise<boolean>;
}
const initial = (scopeKey: string, activeTab: WorkspaceTabKey) => ({
  scopeKey, activeTab, createDraftOpen: false, createSourceVersionId: undefined as string | undefined,
  createSession: 0, editSession: 0, editBookOpen: false, publishOpen: false, retireOpen: false, deleteOpen: false,
});

export function usePriceBookWorkspaceUi({ scopeKey, unknownWrite, isDirty, initialTab, onDiscardDraft, clearActionError, onUpdateBook, onCreateDraft }: Options) {
  const [state, setState] = useState(() => initial(scopeKey, initialTab?.() ?? "prices"));
  const leaveGuard = useUnsavedChangesGuard(isDirty || unknownWrite);
  const current = state.scopeKey === scopeKey ? state : initial(scopeKey, initialTab?.() ?? "prices");
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setState(previous => {
        const base = previous.scopeKey === scopeKey ? previous : initial(scopeKey, initialTab?.() ?? "prices");
        return unknownWrite ? { ...base, createDraftOpen: false, editBookOpen: false, publishOpen: false, retireOpen: false, deleteOpen: false } : base;
      });
    });
    return () => { cancelled = true; };
  }, [scopeKey, unknownWrite, initialTab]);
  const patch = (changes: Partial<typeof state>) => setState(previous => ({
    ...(previous.scopeKey === scopeKey ? previous : initial(scopeKey, initialTab?.() ?? "prices")), ...changes,
  }));
  const openCreateDraft = (versionId?: string) => {
    if (unknownWrite) return;
    const open = () => {
      onDiscardDraft?.(); clearActionError?.();
      setState(previous => ({ ...previous, scopeKey, createDraftOpen: true, createSourceVersionId: versionId, createSession: previous.createSession + 1 }));
    };
    leaveGuard.requestDiscard(open);
  };
  return {
    ...current, leaveGuard, openCreateDraft,
    setActiveTab: (activeTab: WorkspaceTabKey) => patch({ activeTab }),
    setCreateDraftOpen: (createDraftOpen: boolean) => patch({ createDraftOpen }),
    setEditBookOpen: (editBookOpen: boolean) => patch({ editBookOpen }),
    openEditBook: () => { if (unknownWrite) return; clearActionError?.(); setState(previous => ({ ...previous, scopeKey, editBookOpen: true, editSession: previous.editSession + 1 })); },
    setPublishOpen: (publishOpen: boolean) => patch({ publishOpen }),
    setRetireOpen: (retireOpen: boolean) => patch({ retireOpen }),
    setDeleteOpen: (deleteOpen: boolean) => patch({ deleteOpen }),
    saveBook: async (input: UpdatePriceBookInput) => { const ok = await onUpdateBook?.(input); if (ok) patch({ editBookOpen: false }); return Boolean(ok); },
    createDraft: async (input: ClonePriceBookVersionInput) => { const ok = await onCreateDraft?.(input); if (ok) patch({ createDraftOpen: false }); return Boolean(ok); },
  };
}
