"use client";

import { useState } from "react";
import { moveAcquisitionSourceToPosition, type AcquisitionSource } from "../acquisition-source-contract";
import { useAcquisitionSources } from "./useAcquisitionSources";
import { useAcquisitionSourceEdit } from "./useAcquisitionSourceEdit";
import { useAcquisitionSourceIcon } from "./useAcquisitionSourceIcon";
import { useAcquisitionSourceDialogFocus } from "./useAcquisitionSourceDialogFocus";

export function useAcquisitionSourcesWorkspace() {
  const state = useAcquisitionSources();
  const canWrite = state.canManage && !state.writeBlocked && !state.isReordering;
  const editor = useAcquisitionSourceEdit(canWrite, state.applyUpdatedSource, state.reload);
  const icon = useAcquisitionSourceIcon(canWrite, state.applyUpdatedSource);
  const [movingSourceId, setMovingSourceId] = useState<string | null>(null);
  const selectedForMove = state.allItems.find(({ id }) => id === movingSourceId) ?? null;
  const busy = state.isCreating || state.isDeleting || state.isReordering || editor.isSaving || icon.isUploading;
  const hasOpenForm = state.isCreateOpen || !!state.selectedForDelete || !!editor.selected || !!icon.selected;
  const reorderBlocked = !state.canManage || busy || state.writeBlocked || state.isFiltered || hasOpenForm;
  const dialogFocus = useAcquisitionSourceDialogFocus(hasOpenForm || !!selectedForMove);
  const canOpen = canWrite && !busy && !hasOpenForm && !selectedForMove;
  return {
    state: {
      ...state,
      openCreate: () => {
        if (!canOpen || state.isAtLimit) return;
        dialogFocus.capture();
        state.openCreate();
      },
      selectForDelete: (source: AcquisitionSource) => {
        if (!canOpen) return;
        dialogFocus.captureAction(source.id, "menu");
        state.selectForDelete(source);
      },
    },
    editor: { ...editor, select: (source: AcquisitionSource) => {
      if (!canOpen) return;
      dialogFocus.captureAction(source.id, "edit");
      editor.select(source);
    } },
    icon: { ...icon, select: (source: AcquisitionSource) => {
      if (!canOpen) return;
      dialogFocus.captureAction(source.id, "icon");
      icon.select(source);
    } },
    openIconFromEditor: () => {
      if (!canWrite || busy || !editor.selected || editor.isDirty) return;
      const source = editor.selected;
      // Keep the original row opener while switching between controlled dialogs.
      editor.close();
      icon.select(source);
    },
    busy, selectedForMove, reorderBlocked, hasOpenForm, dialogFocus,
    handleReorder: (ids: string[]) => {
      if (reorderBlocked || selectedForMove) return;
      void state.handleReorder(ids);
    },
    openMove: (source: AcquisitionSource) => {
      if (!canWrite || reorderBlocked) return;
      dialogFocus.captureAction(source.id, "menu");
      state.setMutationError(null);
      setMovingSourceId(source.id);
    },
    closeMove: () => { if (!state.isReordering) setMovingSourceId(null); },
    moveSelected: async (position: number) => {
      if (!selectedForMove || reorderBlocked) return false;
      const ids = moveAcquisitionSourceToPosition(state.allItems, selectedForMove.id, position);
      if (!ids) return false;
      const saved = await state.handleReorder(ids);
      if (saved) setMovingSourceId(null);
      return saved;
    },
    editBlockedSource: () => {
      if (!state.selectedForDelete) return;
      const source = state.selectedForDelete;
      state.closeDelete();
      editor.select(source);
    },
  };
}
