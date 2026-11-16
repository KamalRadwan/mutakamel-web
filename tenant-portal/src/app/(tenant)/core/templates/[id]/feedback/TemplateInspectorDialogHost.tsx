"use client";

import { Button, Dialog, DialogDescription, DialogTitle, DialogTrigger } from "@/design-system";
import { TemplateDialogContent } from "../../feedback/TemplateDialogContent";
import { TemplateDesignInspector, type TemplateDesignInspectorProps } from "../inspector/TemplateDesignInspector";
import { useInspectorCopy } from "../inspector/useInspectorForm";
import { useTemplateInspectorCloseDialog, type TemplateInspectorDialogLifecycle } from "./useTemplateInspectorDialog";

/** Owns only the modal shell; T02 still owns the property form and close-confirmation state. */
export function TemplateInspectorDialogHost({ inspector, lifecycle }: {
  inspector: TemplateDesignInspectorProps;
  lifecycle: TemplateInspectorDialogLifecycle;
}) {
  const c = useInspectorCopy();
  const { open, change, localState, confirmClose, keepEditing, discardClose } = useTemplateInspectorCloseDialog(lifecycle, inspector.onLocalStateChange);
  if (!inspector.bridge.context().canRead) return null;
  return <Dialog open={open} onOpenChange={change}>
    <DialogTrigger asChild><Button type="button" size="sm" variant="outline">{c.title}</Button></DialogTrigger>
    <TemplateDialogContent onOpenAutoFocus={lifecycle.onOpenAutoFocus} onCloseAutoFocus={lifecycle.onCloseAutoFocus} onEscapeKeyDown={lifecycle.onEscapeKeyDown}>
      <DialogTitle className="pe-10">{c.title}</DialogTitle><DialogDescription>{c.geometrySeparate}</DialogDescription>
      <TemplateDesignInspector {...inspector} onLocalStateChange={localState} />
      {confirmClose && <div className="space-y-2"><p role="alert" className="text-sm">{c.pendingClose}</p>
        <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={keepEditing}>{c.keepEditing}</Button>
          <Button type="button" variant="outline" onClick={discardClose}>{c.discardClose}</Button></div>
      </div>}
    </TemplateDialogContent>
  </Dialog>;
}
