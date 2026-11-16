import { useI18n } from "@/i18n/I18nContext";
import { templateConflictAr, templateConflictEn } from "@/i18n/dictionaries/template-conflict";
import type { useTemplateDesignEditor } from "./useTemplateDesignEditor";

/** Recovery-only T18 route; never creates another properties/controller host. */
export function useDesignerConflictRecovery(editor: ReturnType<typeof useTemplateDesignEditor>) {
  const { lang } = useI18n();
  const generation = editor.commandStore.getSnapshot().generation;
  const bridgeKey = editor.inspectorBridge.context().key;
  const readable = editor.inspectorBridge.context().canRead && editor.inspectorBridge.read().document === editor.document;
  const current = () => editor.recoveryAuthority.current() && editor.commandStore.getSnapshot().generation === generation && editor.inspectorBridge.context().key === bridgeKey;
  return { current,
    review: editor.conflict && editor.draft && editor.document ? {
      authority: { ...editor.recoveryAuthority, readable }, base: editor.draft, local: editor.document,
      blocked: editor.hasPending || editor.localPending || editor.gestureActive,
      copy: { ar: templateConflictAr, en: templateConflictEn }[lang],
      locale: { ar: "ar-EG-u-nu-latn", en: "en-US" }[lang],
      interaction: { active: () => editor.interactionExit.hasActive(), cancel: () => { editor.interactionExit.cancelAllCurrent({ bridgeKey, generation }); } },
      onReload: () => {
        if (current() && !editor.hasPending && !editor.localSessions.has() && editor.interactionExit.cancelAllCurrent({ bridgeKey, generation })) editor.reload();
      },
    } : null,
  };
}
