import type { DesignerCommandStore } from "./designer-command-store";
import type { EditorDocument } from "./template-editor-model";
import type { TemplateDraftDocument } from "./template-design-api";

/** Supplied by the existing editor owner. Never derive tenancy/session identity from a draft body. */
export interface TemplateRecoveryAuthority {
  key: string;
  epoch: number;
  readable: boolean;
  writable: boolean;
  current: () => boolean;
}
export function sameTemplateRecoveryAuthority(a: TemplateRecoveryAuthority, b: TemplateRecoveryAuthority): boolean {
  return a.key === b.key && a.epoch === b.epoch;
}
export function isCanonicalTemplateDraft(draft: TemplateDraftDocument): boolean {
  return Number.isSafeInteger(draft.revision) && draft.revision > 0 && draft.etag === `"${draft.revision}"`;
}
export function isNewerTemplateDraft(base: TemplateDraftDocument, saved: TemplateDraftDocument): boolean {
  return isCanonicalTemplateDraft(base) && isCanonicalTemplateDraft(saved) &&
    base.templateId === saved.templateId && base.draftId === saved.draftId && saved.revision > base.revision;
}

export type TemplateRecoveryNotice = "unavailable" | "saving" | "pending" | "conflict" | "dirty" | "saved";
export function templateRecoveryPolicy(state: {
  readable: boolean; writable: boolean; saving: boolean; unresolved: boolean; conflict: boolean; dirty: boolean; gestureActive: boolean;
}) {
  const pending = state.saving || state.unresolved;
  const notice: TemplateRecoveryNotice = !state.readable ? "unavailable" : state.saving ? "saving" :
    state.unresolved ? "pending" : state.conflict ? "conflict" : state.dirty ? "dirty" : "saved";
  return {
    notice,
    canSave: state.readable && state.writable && state.dirty && !pending && !state.conflict && !state.gestureActive,
    canRecover: state.readable && state.writable && state.unresolved && !state.saving && !state.gestureActive,
    canCompare: state.readable && state.conflict && !pending && !state.gestureActive,
    canReload: state.readable && !pending && !state.gestureActive,
    needsDiscardConfirmation: state.dirty,
  };
}

export interface TemplateLocalRecoveryCheckpoint {
  authority: TemplateRecoveryAuthority;
  draft: TemplateDraftDocument;
  generation: number;
  document: EditorDocument;
}

/** Local adoption only, after the host's body authorization and confirmation. Never sends or acknowledges a write. */
export function canApplyTemplateLocalRecovery({ checkpoint, authority, draft, store, pending }: {
  checkpoint: TemplateLocalRecoveryCheckpoint;
  authority: TemplateRecoveryAuthority;
  draft: TemplateDraftDocument;
  store: DesignerCommandStore;
  pending: boolean;
}): boolean {
  const snapshot = store.getSnapshot();
  if (pending || !authority.readable || !authority.writable || !sameTemplateRecoveryAuthority(checkpoint.authority, authority) ||
    !authority.current() || !isCanonicalTemplateDraft(draft) || !isCanonicalTemplateDraft(checkpoint.draft) ||
    draft.templateId !== checkpoint.draft.templateId || draft.draftId !== checkpoint.draft.draftId ||
    draft.revision !== checkpoint.draft.revision || draft.etag !== checkpoint.draft.etag ||
    snapshot.generation !== checkpoint.generation || snapshot.document !== checkpoint.document || snapshot.gestureActive) return false;
  return true;
}

export function restoreTemplateLocalDocument(context: Parameters<typeof canApplyTemplateLocalRecovery>[0], document: EditorDocument): boolean {
  if (!canApplyTemplateLocalRecovery(context)) return false;
  // Existing command admission enforces the immutable source tuple and preserves the complete JSON.
  return context.store.execute({ kind: "EDIT_DOCUMENT", document });
}
