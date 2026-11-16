"use client";
import { Button, Dialog, DialogDescription, DialogTitle, DialogTrigger } from "@/design-system";
import { TemplateDialogContent } from "../../feedback/TemplateDialogContent";
import { TemplateDesignInspector } from "../inspector/TemplateDesignInspector";
import { InspectorFeedbackContext } from "../feedback/inspector-feedback-context";
import type { DesignerInteractionController } from "../../designer-interaction-controller";
import type { DescriptorBoundDesignerProvider } from "../../designer-native-context";
import { useDesignerInspectorHost } from "../hooks/useDesignerInspectorHost";
import type { useTemplateDesignEditor } from "../hooks/useTemplateDesignEditor";
import { DesignerExtensionContext } from "./designer-extension-context";
import { designerInspectorExtensions } from "./DesignerInspectorExtensions";

/** One DS dialog/trap; T02 owns its property form, T14 owns its text session. */
export function DesignerInspectorHost({ editor, provider, controller }: {
  editor: ReturnType<typeof useTemplateDesignEditor>; provider: DescriptorBoundDesignerProvider; controller: DesignerInteractionController;
}) {
  const { root, copy: c, dialog, lifecycle, feedback, extensions, validation, onLocalStateChange, data } = useDesignerInspectorHost(editor, provider, controller);
  return <div ref={root}><InspectorFeedbackContext.Provider value={feedback}><DesignerExtensionContext.Provider value={extensions}>
    <Dialog open={dialog.open} onOpenChange={dialog.change}>
      <DialogTrigger asChild><Button type="button" size="sm" variant="outline" disabled={!editor.inspectorBridge.context().canRead}>{c.title}</Button></DialogTrigger>
      <TemplateDialogContent {...lifecycle}>
        <DialogTitle className="pe-10">{c.title}</DialogTitle><DialogDescription>{c.geometrySeparate}</DialogDescription>
        {dialog.open && <TemplateDesignInspector bridge={editor.inspectorBridge} native={data?.native ?? provider.native} arrangement={controller}
          schema={editor.schema} assets={editor.assets} validation={validation} eligibility={data?.eligibility}
          extensions={{ ...designerInspectorExtensions, ...data?.ports }} onLocalStateChange={onLocalStateChange} />}
        {dialog.confirmClose && <div className="space-y-2"><p role="alert" className="text-sm">{c.pendingClose}</p><div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={dialog.keepEditing}>{c.keepEditing}</Button>
          <Button type="button" variant="outline" onClick={dialog.discardClose}>{c.discardClose}</Button>
        </div></div>}
      </TemplateDialogContent>
    </Dialog>
  </DesignerExtensionContext.Provider></InspectorFeedbackContext.Provider></div>;
}
