import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { DescriptorBoundDesignerProvider } from "../../designer-native-context";
import type { DesignerInteractionController } from "../../designer-interaction-controller";
import type { InspectorLocalState } from "../inspector/inspector-ports";
import { useInspectorCopy } from "../inspector/useInspectorForm";
import { DesignerFocusScopeContext } from "../components/designer-focus-scope";
import { useTemplateInspectorDialog } from "../feedback/useTemplateInspectorDialog";
import { bindTemplateInspectorInteractionExit } from "../feedback/template-inspector-interaction-exit";
import { createTemplateInspectorExitAdmission } from "../feedback/template-inspector-exit-admission";
import { useInspectorDialog } from "../inspector/useInspectorLocalState";
import { designerBindingDescriptor } from "../../designer-extension-data";
import type { useTemplateDesignEditor } from "./useTemplateDesignEditor";
import { createDesignerInspectorData } from "../../designer-inspector-data";

export function useDesignerInspectorHost(editor: ReturnType<typeof useTemplateDesignEditor>, provider: DescriptorBoundDesignerProvider, controller: DesignerInteractionController) {
  const root = useRef<HTMLDivElement>(null), copy = useInspectorCopy();
  const [propertyReporter] = useState(() => editor.localSessions.reporter("inspector"));
  const property = useRef<InspectorLocalState | null>(null);
  const owner = editor.localSessions.ownerKey;
  const generation = editor.inspectorBridge.read().generation;
  const selectedKey = editor.commandStore.getViewport().selectedIds.join(",");
  const data = useMemo(() => createDesignerInspectorData(provider, editor.commandStore, () => !editor.localSessions.hasOther("inspector"), { generation, selectedKey }), [provider, editor.commandStore, editor.localSessions, generation, selectedKey]);
  const current = () => provider.isCurrent() && editor.inspectorBridge.context().canRead && editor.inspectorBridge.context().key === owner && editor.inspectorBridge.read().generation === generation;
  const focusScope = useContext(DesignerFocusScopeContext);
  const originalLifecycle = useTemplateInspectorDialog(current, focusScope ?? root, controller);
  const lifecycle = bindTemplateInspectorInteractionExit(originalLifecycle, editor.interactionExit, current);
  const dialog = useInspectorDialog();
  const publish = dialog.localState;
  const onLocalStateChange = useCallback((state: InspectorLocalState) => {
    if (state.ownerKey !== owner || editor.commandStore.getSnapshot().generation !== generation) return;
    property.current = state;
    propertyReporter.report(owner, state.dirty);
    publish({ ...state, dirty: state.dirty || editor.localSessions.has("richText") });
  }, [owner, generation, editor.commandStore, editor.localSessions, propertyReporter, publish]);
  const onRichSession = useCallback((pending: boolean) => {
    if (editor.commandStore.getSnapshot().generation !== generation) return;
    publish({ ownerKey: owner, nodeId: property.current?.nodeId ?? "", stale: false, disabled: false,
      ...property.current, dirty: pending || property.current?.dirty === true });
  }, [owner, generation, editor.commandStore, publish]);
  useEffect(() => () => propertyReporter.dispose(), [propertyReporter]);
  const descriptor = designerBindingDescriptor(provider.descriptor);
  const exit = createTemplateInspectorExitAdmission(lifecycle, {
    change: dialog.change,
    discardClose: () => { editor.localSessions.closeRichText(); dialog.discardClose(); },
  });
  return { root, copy, dialog: { ...dialog, change: exit.change, discardClose: exit.discardClose }, lifecycle: exit.contentLifecycle, onLocalStateChange,
    data,
    feedback: { root, current },
    extensions: { editor, provider, onRichSession },
    validation: descriptor ? { ownerKey: owner, dataSourceKey: descriptor.key, descriptorChecksum: descriptor.checksum, ready: current() } : undefined,
  };
}
