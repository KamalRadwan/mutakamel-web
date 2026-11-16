"use client";

import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { Badge, Button, Field, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/design-system";
import type { useTemplateDesignEditor } from "../hooks/useTemplateDesignEditor";

/** Selected element controls stay above the full-width document canvas. */
export function TemplateDesignProperties({ editor }: { editor: ReturnType<typeof useTemplateDesignEditor> }) {
  const c = editor.t.quotationPdf;
  const node = editor.selected;
  const document = editor.document;
  const busy = editor.saving || !!editor.unknown;
  const disabled = busy || !!node?.locked;

  return (
    <section className="flex min-w-0 flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-3" aria-label={c.selectElement}>
      <Field label={c.selectElement} showLabel className="min-w-48 max-w-64 flex-1">
        <Select value={node?.id ?? ""} onValueChange={editor.select} disabled={busy || !editor.nodes.length}>
          <SelectTrigger><SelectValue placeholder={c.selectElement} /></SelectTrigger>
          <SelectContent>
            {editor.nodes.map((element) => (
              <SelectItem key={element.id} value={element.id}>
                {element.name ?? element.type}{element.locked ? ` · ${c.locked}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      {node ? (
        <>
          <Field label={c.nodeName} showLabel className="min-w-36 max-w-56 flex-1">
            <Input value={node.name ?? ""} disabled={disabled} maxLength={200} onChange={(event) => editor.updateNode({ name: event.target.value })} />
          </Field>
          <Field label={c.fontSize} showLabel className="w-20">
            <Input
              type="number" min={6} max={96}
              value={Number(node.style.fontSizePx ?? document?.theme.baseFontSizePx ?? 14)}
              disabled={disabled}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (value >= 6 && value <= 96) editor.updateNode({ style: { ...node.style, fontSizePx: value } });
              }}
            />
          </Field>
          <Field label={c.color} showLabel className="w-20">
            <Input type="color" value={String(node.style.color ?? document?.theme.textColor ?? "#0f172a")} disabled={disabled} onChange={(event) => editor.updateNode({ style: { ...node.style, color: event.target.value } })} />
          </Field>
          <Field label={c.align} showLabel className="min-w-28 max-w-36 flex-1">
            <Select value={String(node.style.textAlign ?? "START")} disabled={disabled} onValueChange={(value) => editor.updateNode({ style: { ...node.style, textAlign: value } })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="START">{c.start}</SelectItem>
                <SelectItem value="CENTER">{c.center}</SelectItem>
                <SelectItem value="END">{c.end}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            {node.locked ? <Badge tone="neutral">{c.locked}</Badge> : null}
            <Button variant="outline" size="sm" disabled={disabled} aria-label={c.moveUp} onClick={() => editor.move(-1)}><ArrowUp className="size-4" aria-hidden="true" /></Button>
            <Button variant="outline" size="sm" disabled={disabled} aria-label={c.moveDown} onClick={() => editor.move(1)}><ArrowDown className="size-4" aria-hidden="true" /></Button>
            <Button variant="outline" size="sm" disabled={disabled} onClick={editor.remove}><Trash2 className="size-4 text-destructive" aria-hidden="true" />{c.remove}</Button>
          </div>
        </>
      ) : <p className="self-center text-xs text-muted-foreground">{c.selectElement}</p>}
    </section>
  );
}
