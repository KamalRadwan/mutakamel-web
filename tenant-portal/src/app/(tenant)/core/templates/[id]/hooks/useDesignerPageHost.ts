import { useLayoutEffect, useState, useSyncExternalStore } from "react";
import { createDesignerPageHost } from "../../designer-page-host";
import type { DescriptorBoundDesignerProvider } from "../../designer-native-context";
import type { useTemplateDesignEditor } from "./useTemplateDesignEditor";

export function useDesignerPageHost(editor: ReturnType<typeof useTemplateDesignEditor>, provider?: DescriptorBoundDesignerProvider) {
  const [controller] = useState(() => createDesignerPageHost(editor.commandStore, editor.pageBridge, provider, () => !editor.localSessions.hasOther("pages")));
  useLayoutEffect(() => { controller.setBridge(editor.pageBridge); });
  useLayoutEffect(() => controller.connect(), [controller]);
  // Authority/permission may change without an authored-document notification.
  useLayoutEffect(() => { controller.refresh(); }, [controller, editor.editable, editor.hasPending, editor.conflict, editor.localPending]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  return { controller, state, activePage: state.pages.find(page => page.key === state.activeKey)?.page ?? editor.document?.page ?? null };
}
