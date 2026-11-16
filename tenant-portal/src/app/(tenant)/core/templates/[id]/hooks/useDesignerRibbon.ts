import { useState, type FocusEvent, type KeyboardEvent } from "react";
import type { useTemplateDesignEditor } from "./useTemplateDesignEditor";
type Editor = ReturnType<typeof useTemplateDesignEditor>;

export function useDesignerLayers(editor: Editor) {
  const [search, setSearch] = useState("");
  const unnamed = editor.t.quotationPdf.designer.unnamed;
  const nodes = editor.nodes.filter(node => (node.name ?? unnamed).toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  return { search, setSearch, nodes };
}
export function useDesignerPropertyGesture(editor: Editor) {
  return {
    onFocusCapture: (event: FocusEvent<HTMLFieldSetElement>) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) editor.beginGesture();
    },
    onBlurCapture: editor.commitGesture,
    onPointerCancelCapture: editor.cancelGesture,
    onKeyDownCapture: (event: KeyboardEvent<HTMLFieldSetElement>) => { if (event.key === "Escape") editor.cancelGesture(); },
  };
}
