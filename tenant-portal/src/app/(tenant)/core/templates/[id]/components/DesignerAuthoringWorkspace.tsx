"use client";
import { supportsBasicSalesPageSetup } from "../../designer-page-host";
import type { DescriptorBoundDesignerProvider, DesignerNativeSource } from "../../designer-native-context";
import { useDescriptorBoundDesignerProvider } from "../hooks/useDescriptorBoundDesignerProvider";
import { useDesignerPageHost } from "../hooks/useDesignerPageHost";
import type { useTemplateDesignEditor } from "../hooks/useTemplateDesignEditor";
import { DesignerRibbon } from "./DesignerRibbon";
import { DesignerViewport } from "./DesignerViewport";

type Editor = ReturnType<typeof useTemplateDesignEditor>;
export function DesignerAuthoringWorkspace({ editor, nativeSource, layoutMode }: { editor: Editor; nativeSource?: DesignerNativeSource; layoutMode: string }) {
  const provider = useDescriptorBoundDesignerProvider(editor.interactionBridge, nativeSource) ?? undefined;
  if (provider || supportsBasicSalesPageSetup(editor.document)) {
    return <PageWorkspace key={provider?.bindingKey ?? editor.interactionExit.ticket.generation} editor={editor} provider={provider} layoutMode={layoutMode} />;
  }
  return <>
    <DesignerRibbon editor={editor} /><DesignerViewport editor={editor} layoutMode={layoutMode} />
  </>;
}
function PageWorkspace({ editor, provider, layoutMode }: { editor: Editor; provider?: DescriptorBoundDesignerProvider; layoutMode: string }) {
  const pages = useDesignerPageHost(editor, provider);
  return <><DesignerRibbon editor={editor} provider={provider} pages={provider || pages.state.document ? pages.controller : undefined} />
    <DesignerViewport editor={editor} layoutMode={layoutMode} activePage={pages.activePage} /></>;
}
