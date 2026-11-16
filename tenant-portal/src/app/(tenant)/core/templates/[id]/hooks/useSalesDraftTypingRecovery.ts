import { useCallback, useLayoutEffect, type RefObject } from "react";
import { canonicalJson, TEMPLATE_LIMITS, validateTemplateDocumentModel } from "@mutakamel/template-schema/browser-safe";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { getStoredTenantSessionMeta } from "@/lib/api/axiosClient";
import { safeSessionStorage } from "@/lib/safeStorage";
import type { DesignerCommandStore } from "../../designer-command-store";
import type { TemplateDraftDocument } from "../../template-design-api";
import { updateEditorNode, type EditorDocument, type EditorNode } from "../../template-editor-model";
import { restoreTemplateLocalDocument } from "../../template-recovery-policy";
import { TEMPLATE_DRAFT_RESPONSE_LIMIT_BYTES } from "../../template-wire";
import type { DraftOwner } from "./template-design-flight";
import { holdSalesDraftTypingRollover, readSalesDraftTyping, salesDraftTypingStorageKey, setSalesDraftTyping,
  takeSalesDraftTypingRollover, watchSalesDraftTypingRoute, type SalesDraftTyping } from "./sales-draft-typing-storage";

const checkpointDigests = new WeakMap<TemplateDraftDocument, string>();

function checkpointDigest(draft: TemplateDraftDocument): string {
  const cached = checkpointDigests.get(draft);
  if (cached) return cached;
  const digest = bytesToHex(sha256(new TextEncoder().encode(canonicalJson(draft))));
  checkpointDigests.set(draft, digest);
  return digest;
}

export function editableQuotationText(document: EditorDocument, nodeId: string) {
  if (document.documentType !== "QUOTATION" || document.outputChannel !== "PRINT" ||
    document.dataSourceKey !== "TRADE_QUOTATION_PRINT_V1") return null;
  const node = document.nodes[nodeId];
  if (node?.type !== "text" || typeof node.props.text !== "string" || node.props.textTemplate !== undefined) return null;
  for (let ancestor: EditorNode | undefined = node; ancestor; ancestor = ancestor.parentId ? document.nodes[ancestor.parentId] : undefined) {
    if (ancestor.hidden || ancestor.locked) return null;
  }
  return node;
}

export function useSalesDraftTypingRecovery(owner: DraftOwner, salesSaveKey: string | null, store: DesignerCommandStore,
  readyDraft: RefObject<TemplateDraftDocument | null>, writeAccess: RefObject<boolean>, isCurrent: () => boolean,
  rolloverChecksum: string | null) {
  const key = salesSaveKey ? salesDraftTypingStorageKey(salesSaveKey) : null;
  const discard = useCallback(() => {
    if (key && isCurrent()) setSalesDraftTyping(key, null);
  }, [key, isCurrent]);

  useLayoutEffect(() => {
    if (!key || !salesSaveKey) return;
    let generation = store.getSnapshot().generation;
    let checkpoint: { raw: string; sessionId: string; authorizationVersion: number; profileVersion: number;
      draft: Pick<TemplateDraftDocument, "templateId" | "draftId" | "revision" | "etag">; typing: SalesDraftTyping } | null = null;
    const href = window.location.href;
    let routeRetired = false;
    const stopWatching = rolloverChecksum ? watchSalesDraftTypingRoute(href, () => {
      routeRetired = true;
    }) : null;
    const unsubscribe = store.subscribe(() => {
      const snapshot = store.getSnapshot();
      if (snapshot.generation !== generation) {
        // A load or save updates the baseline before any authored change.
        generation = snapshot.generation;
        checkpoint = null;
        return;
      }
      const base = readyDraft.current;
      if (!base || !snapshot.document || snapshot.gestureActive || !writeAccess.current || !isCurrent()) return;
      const session = getStoredTenantSessionMeta();
      if (!session) return;
      const { authorizationVersion, profileVersion, sessionId } = session;
      const edits: [string, string][] = [];
      if (snapshot.dirty) {
        for (const node of Object.values(base.editorDocument.nodes)) {
          const next = snapshot.document.nodes[node.id]?.props.text;
          if (typeof next === "string" && next !== node.props.text && next.length <= TEMPLATE_LIMITS.maxTextCharsPerNode &&
            editableQuotationText(base.editorDocument, node.id) && editableQuotationText(snapshot.document, node.id)) {
            edits.push([node.id, next]);
          }
        }
      }
      checkpoint = null;
      if (!edits.length) { discard(); return; }
      const draft = { templateId: base.templateId, draftId: base.draftId, revision: base.revision, etag: base.etag };
      const typing = { digest: checkpointDigest(base), edits };
      const raw = JSON.stringify({ ...draft, ...typing, authorizationVersion });
      if (raw.length > TEMPLATE_DRAFT_RESPONSE_LIMIT_BYTES) { discard(); return; }
      setSalesDraftTyping(key, raw);
      if (rolloverChecksum) {
        checkpoint = { raw, sessionId, authorizationVersion, profileVersion, draft, typing };
      }
    });
    return () => {
      unsubscribe();
      stopWatching?.();
      if (!rolloverChecksum || !checkpoint || safeSessionStorage.getItem(key) !== checkpoint.raw) return;
      const next = getStoredTenantSessionMeta();
      if (next?.sessionId === checkpoint.sessionId && next.authorizationVersion <= checkpoint.authorizationVersion) return;
      if (stopWatching && !routeRetired && href === window.location.href && next?.authEventId &&
        next.sessionId === checkpoint.sessionId && next.profileVersion >= checkpoint.profileVersion &&
        safeSessionStorage.getItem(salesSaveKey) === null) {
        holdSalesDraftTypingRollover({ key, href, sessionId: next.sessionId,
          authorizationVersion: next.authorizationVersion, profileVersion: next.profileVersion, eventId: next.authEventId,
          draft: checkpoint.draft, descriptorChecksum: rolloverChecksum, typing: checkpoint.typing });
      }
      setSalesDraftTyping(key, null);
    };
  }, [key, salesSaveKey, store, readyDraft, writeAccess, isCurrent, discard, rolloverChecksum]);

  const applyTyping = useCallback((draft: TemplateDraftDocument, retained: SalesDraftTyping, current: () => boolean) => {
    const snapshot = store.getSnapshot();
    if (!snapshot.document || snapshot.dirty || retained.digest !== checkpointDigest(draft) || !current()) return false;
    let document = snapshot.document;
    for (const [id, text] of retained.edits) {
      const node = editableQuotationText(document, id);
      if (!node) return false;
      document = updateEditorNode(document, id, { props: { ...node.props, text } });
    }
    if (document.layoutMode === "FIXED_CANVAS" && !validateTemplateDocumentModel(document).valid) return false;
    const authority = { key: owner.key, epoch: owner.epoch, readable: true, writable: writeAccess.current, current };
    return restoreTemplateLocalDocument({
      checkpoint: { authority, draft, generation: snapshot.generation, document: snapshot.document },
      authority, draft, store, pending: false,
    }, document);
  }, [owner, store, writeAccess]);

  const restore = useCallback((draft: TemplateDraftDocument) => {
    if (!key || !writeAccess.current || !isCurrent() || readyDraft.current !== draft) return;
    if (safeSessionStorage.getItem(key) === null) return;
    const authorizationVersion = getStoredTenantSessionMeta()?.authorizationVersion;
    try {
      const retained = readSalesDraftTyping(key, draft, authorizationVersion);
      if (!retained || retained.digest !== checkpointDigest(draft)) { discard(); return; }
      const snapshot = store.getSnapshot();
      if (!snapshot.document || snapshot.dirty) return;
      const current = () => readyDraft.current === draft && writeAccess.current && isCurrent() &&
        getStoredTenantSessionMeta()?.authorizationVersion === authorizationVersion;
      if (!applyTyping(draft, retained, current) && current()) discard();
    } catch {
      // A malformed local record cannot prevent the saved draft from opening.
      discard();
    }
  }, [key, store, readyDraft, writeAccess, isCurrent, discard, applyTyping]);

  const restoreRollover = useCallback((draft: TemplateDraftDocument, readCurrentChecksum: () => string | null) => {
    const held = takeSalesDraftTypingRollover();
    if (!held || !salesSaveKey || held.key !== key || held.href !== window.location.href ||
      held.draft.templateId !== draft.templateId || held.draft.draftId !== draft.draftId ||
      held.draft.revision !== draft.revision || held.draft.etag !== draft.etag) return;
    const current = () => {
      const session = getStoredTenantSessionMeta();
      return session?.sessionId === held.sessionId && session.authorizationVersion === held.authorizationVersion &&
        session.profileVersion === held.profileVersion && session.authEventId === held.eventId &&
        readyDraft.current === draft && writeAccess.current && isCurrent() &&
        readCurrentChecksum() === held.descriptorChecksum && safeSessionStorage.getItem(salesSaveKey) === null;
    };
    applyTyping(draft, held.typing, current);
  }, [key, salesSaveKey, readyDraft, writeAccess, isCurrent, applyTyping]);

  return { discard, restore, restoreRollover };
}
