import { validateTemplateDocumentModel } from "@mutakamel/template-schema/browser-safe";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { ASSET_MIME_TYPES, ASSET_TYPES } from "../../template-assets-contract";
import { supportsBasicSalesPageSetup } from "../../designer-page-host";
import { updateEditorNode, type EditorDocument } from "../../template-editor-model";
import { hasLockedAncestor } from "../inspector/inspector-commands";
import type { useTemplateDesignEditor } from "./useTemplateDesignEditor";

export type QuotationImageEditor = Pick<ReturnType<typeof useTemplateDesignEditor>,
  "assets" | "document" | "draft" | "editable" | "hasPending" | "localPending" | "conflict" | "gestureActive" |
  "commandStore" | "interactionBridge" | "viewport">;

function imageNode(document: EditorDocument | null, selection: readonly string[]) {
  if (!document || selection.length !== 1 || !supportsBasicSalesPageSetup(document)) return null;
  const node = document.nodes[selection[0]];
  return node?.type === "image" && typeof node.props.assetId === "string" && !node.locked && !node.hidden &&
    !hasLockedAncestor(document, node) ? node : null;
}

export function readQuotationImageReplacement(editor: QuotationImageEditor) {
  const { draft, document, viewport, interactionBridge: bridge } = editor;
  if (!draft || !editor.editable || editor.hasPending || editor.localPending || editor.conflict || editor.gestureActive || viewport.hand) return null;
  const node = imageNode(document, viewport.selectedIds);
  if (!node) return null;
  const snapshot = bridge.read(), { key: contextKey, canRead } = bridge.context();
  if (!canRead || !bridge.canEdit() || !snapshot.document || snapshot.gestureActive ||
      bridge.selection() !== viewport.selectedIds || snapshot.document.nodes[node.id]?.props.assetId !== node.props.assetId) return null;

  const assets = editor.assets.filter(asset => asset.status === "ACTIVE" &&
    (asset.definitionId === null || asset.definitionId === draft.templateId) &&
    ASSET_MIME_TYPES.some(mime => mime === asset.mimeType) && ASSET_TYPES.some(type => type === asset.assetType));
  if (!assets.some(asset => asset.id !== node.props.assetId)) return null;

  return {
    assets,
    currentAssetId: assets.some(asset => asset.id === node.props.assetId) ? String(node.props.assetId) : "",
    replace(assetId: string) {
      const currentContext = bridge.context(), current = bridge.read();
      if (!currentContext.canRead || currentContext.key !== contextKey || !bridge.canEdit() || current !== snapshot ||
          bridge.selection() !== viewport.selectedIds || editor.commandStore.getViewport().hand) return false;
      const currentNode = imageNode(current.document, viewport.selectedIds);
      if (!currentNode || !current.document || assetId === currentNode.props.assetId || !assets.some(asset => asset.id === assetId)) return false;
      const candidate = updateEditorNode(current.document, currentNode.id, { props: { ...currentNode.props, assetId } });
      return validateTemplateDocumentModel(candidate).valid && bridge.execute(candidate);
    },
  };
}

export function useQuotationImageReplacement(editor: QuotationImageEditor) {
  const replacement = useMemo(() => readQuotationImageReplacement(editor), [editor]);
  const active = useRef<typeof replacement>(null);
  const [failed, setFailed] = useState<typeof replacement>(null);
  useLayoutEffect(() => {
    active.current = replacement;
    return () => { active.current = null; };
  }, [replacement]);
  if (!replacement) return null;

  return { ...replacement, failed: failed === replacement, replace(assetId: string) {
    if (active.current !== replacement) return;
    setFailed(replacement.replace(assetId) ? null : replacement);
  } };
}
