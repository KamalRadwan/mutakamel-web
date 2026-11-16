"use client";

import { useAccessMode } from "@/hooks/useAccessMode";
import { usePipelineDetail } from "./usePipelineDetail";
import { usePipelineEditor } from "./usePipelineEditor";

export function usePipelineRowEditor(pipelineId: string, onClose: () => void, onSaved: () => void) {
  const detail = usePipelineDetail(pipelineId);
  const { canMutate } = useAccessMode();
  const canManage = detail.canManage && canMutate && !!detail.pipeline && !detail.queryError && !detail.writeBlocked;
  const editor = usePipelineEditor(detail, canManage, () => { onClose(); onSaved(); });
  return {
    detail, editor,
    blocked: !canManage || editor.uncertain,
    close: (open: boolean) => { if (!open && !detail.isPending()) onClose(); },
  };
}
