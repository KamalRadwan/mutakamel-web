"use client";
import { Button, Dialog, DialogDescription, DialogTitle, DialogTrigger } from "@/design-system";
import { TemplateDialogContent } from "../../feedback/TemplateDialogContent";
import type { InspectorDialogLifecycle } from "./inspector-ports";
import { TemplateDesignInspector, type TemplateDesignInspectorProps } from "./TemplateDesignInspector";
import { useInspectorCopy } from "./useInspectorForm";
import { useInspectorDialog } from "./useInspectorLocalState";

/** Ribbon integration preserves the reference design's central properties dialog. */
export function TemplateDesignInspectorDialog(props: TemplateDesignInspectorProps & { dialogLifecycle?: InspectorDialogLifecycle }) {
  const c = useInspectorCopy();
  const dialog = useInspectorDialog(props.onLocalStateChange);
  return <Dialog open={dialog.open} onOpenChange={dialog.change}>
    <DialogTrigger asChild><Button type="button" size="sm" variant="outline" disabled={!props.bridge.context().canRead}>{c.title}</Button></DialogTrigger>
    <TemplateDialogContent {...props.dialogLifecycle}>
      <DialogTitle className="pe-10">{c.title}</DialogTitle><DialogDescription>{c.geometrySeparate}</DialogDescription>
      <TemplateDesignInspector {...props} onLocalStateChange={dialog.localState} />
      {dialog.confirmClose && <div className="space-y-2"><p role="alert" className="text-sm">{c.pendingClose}</p><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={dialog.keepEditing}>{c.keepEditing}</Button><Button type="button" variant="outline" onClick={dialog.discardClose}>{c.discardClose}</Button></div></div>}
    </TemplateDialogContent>
  </Dialog>;
}
