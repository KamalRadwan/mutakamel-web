"use client";
import type { RefObject } from "react";
import { TemplateRecoveryFocusHost } from "../feedback/TemplateRecoveryFocusHost";
import { useDesignerConflictRecovery } from "../hooks/useDesignerConflictRecovery";
import type { useTemplateDesignEditor } from "../hooks/useTemplateDesignEditor";

export function DesignerConflictRecovery({ editor, focusScope }: { editor: ReturnType<typeof useTemplateDesignEditor>; focusScope: RefObject<HTMLElement | null> }) {
  const recovery = useDesignerConflictRecovery(editor);
  return recovery.review ? <TemplateRecoveryFocusHost review={recovery.review} current={recovery.current} focusScope={focusScope} /> : null;
}
