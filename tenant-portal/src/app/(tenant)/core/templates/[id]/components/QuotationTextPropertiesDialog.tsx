"use client";

import { validateTemplateDocumentModel } from "@mutakamel/template-schema/browser-safe";
import { useCallback, useEffect, useState } from "react";
import { Button, Dialog, DialogDescription, DialogTitle, DialogTrigger, Field, Input } from "@/design-system";
import { TemplateDialogContent } from "../../feedback/TemplateDialogContent";
import { parseEditorDocument } from "../../template-editor-model";
import type { useTemplateDesignEditor } from "../hooks/useTemplateDesignEditor";
import type { InspectorBridge, InspectorNative } from "../inspector/inspector-contract";
import type { InspectorLocalState } from "../inspector/inspector-ports";
import { useInspectorCopy, useInspectorForm } from "../inspector/useInspectorForm";
import { useInspectorDialog, useInspectorLocalState } from "../inspector/useInspectorLocalState";

const validator: InspectorNative = {
  validateTemplateDocumentModel(value) {
    const result = validateTemplateDocumentModel(value);
    return { ...result, document: result.document ? parseEditorDocument(result.document) : undefined };
  },
};

type Editor = Pick<ReturnType<typeof useTemplateDesignEditor>, "inspectorBridge" | "localSessions">;

export function QuotationTextPropertiesDialog({ editor, nodeId }: { editor: Editor; nodeId: string }) {
  const copy = useInspectorCopy();
  const [reporter] = useState(() => editor.localSessions.reporter("inspector"));
  const report = useCallback((state: InspectorLocalState) => reporter.report(state.ownerKey, state.dirty), [reporter]);
  const dialog = useInspectorDialog(report);
  useEffect(() => () => reporter.dispose(), [reporter]);

  return <Dialog open={dialog.open} onOpenChange={dialog.change}>
    <DialogTrigger asChild><Button type="button" size="sm" variant="outline">{copy.title}</Button></DialogTrigger>
    <TemplateDialogContent>
      <DialogTitle>{copy.title}</DialogTitle>
      <DialogDescription>{copy.typography}</DialogDescription>
      {dialog.open && <TextPropertiesForm bridge={editor.inspectorBridge} nodeId={nodeId} onStateChange={dialog.localState} />}
      {dialog.confirmClose && <div className="space-y-2">
        <p role="alert" className="text-sm">{copy.pendingClose}</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={dialog.keepEditing}>{copy.keepEditing}</Button>
          <Button type="button" variant="outline" onClick={dialog.discardClose}>{copy.discardClose}</Button>
        </div>
      </div>}
    </TemplateDialogContent>
  </Dialog>;
}

function TextPropertiesForm({ bridge, nodeId, onStateChange }: {
  bridge: InspectorBridge; nodeId: string; onStateChange: (state: InspectorLocalState) => void;
}) {
  const copy = useInspectorCopy();
  const form = useInspectorForm(bridge, validator, nodeId);
  useInspectorLocalState({ ownerKey: bridge.context().key, nodeId, dirty: form.dirty, stale: form.stale, disabled: form.disabled }, onStateChange);
  const node = form.draft?.node;
  if (!node) return null;

  return <form className="space-y-3" onSubmit={form.submit}>
    <fieldset className="grid gap-3 sm:grid-cols-2" disabled={form.disabled}>
      <Field label={copy.name} showLabel>
        <Input maxLength={120} value={node.name ?? ""} onChange={event => form.name(event.target.value)} />
      </Field>
      <Field label={copy.size} showLabel>
        <Input type="number" min={8} max={96} step={0.01} required
          value={Number(node.style.fontSizePx ?? form.theme.baseFontSizePx ?? 14)}
          onChange={event => form.style("fontSizePx")(event.currentTarget.value === "" ? undefined : event.currentTarget.valueAsNumber)} />
      </Field>
      <Field label={copy.color} showLabel>
        <Input type="color" value={String(node.style.color ?? form.theme.textColor ?? "#111827")}
          onChange={event => form.style("color")(event.currentTarget.value)} />
      </Field>
    </fieldset>
    {form.stale && <p role="alert" className="text-sm text-destructive">{copy.stale}</p>}
    {form.result && <p role={form.result === "applied" || form.result === "unchanged" ? "status" : "alert"} className="text-sm">{copy[form.result]}</p>}
    <div className="flex flex-wrap gap-2">
      <Button type="submit" size="sm" disabled={form.disabled || !form.dirty}>{copy.apply}</Button>
      <Button type="button" size="sm" variant="outline" disabled={!form.dirty} onClick={form.reset}>{copy.reset}</Button>
    </div>
  </form>;
}
