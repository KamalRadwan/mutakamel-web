"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, Field, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea } from "@/design-system";
import { record } from "../../../contracts/core-page";
import type { useTemplateDesignEditor } from "../hooks/useTemplateDesignEditor";

/** Longer content and page settings use full-width disclosures below the canvas. */
export function TemplateDesignDetails({ editor }: { editor: ReturnType<typeof useTemplateDesignEditor> }) {
  const c = editor.t.quotationPdf;
  const node = editor.selected;
  const document = editor.document;
  const busy = editor.saving || !!editor.unknown;
  const disabled = busy || !!node?.locked;
  const hasContent = node && ["text", "dataField", "image", "dynamicTable", "totals"].includes(node.type);

  return (
    <Accordion type="multiple" defaultValue={["element"]} className="w-full rounded-lg border border-border bg-card px-4">
      {hasContent && node ? (
        <AccordionItem value="element">
          <AccordionTrigger>{c.content} · {node.name ?? node.type}</AccordionTrigger>
          <AccordionContent>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {node.type === "text" ? (
                <Field label={c.content} showLabel className="sm:col-span-2 xl:col-span-4">
                  <Textarea value={String(node.props.text ?? "")} disabled={disabled} maxLength={20000} onChange={(event) => editor.updateNode({ props: { ...node.props, text: event.target.value } })} rows={3} />
                </Field>
              ) : null}
              {node.type === "dataField" ? (
                <Field label={c.binding} showLabel className="sm:col-span-2">
                  <Select value={node.binding?.path} disabled={disabled} onValueChange={(path) => editor.updateNode({ binding: { ...node.binding, path, nullBehavior: node.binding?.nullBehavior ?? "EMPTY" } })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {editor.schema?.fields.filter((field) => !field.path.includes("[]") && !["ARRAY", "OBJECT", "IMAGE"].includes(field.dataType)).map((field) => <SelectItem key={field.path} value={field.path}>{field.path}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
              ) : null}
              {node.type === "image" ? (
                <>
                  <Field label={c.image} showLabel className="sm:col-span-2">
                    <Select value={String(node.props.assetId ?? "")} disabled={disabled} onValueChange={(assetId) => editor.updateNode({ props: { ...node.props, assetId } })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{editor.assets.map((asset) => <SelectItem key={asset.id} value={asset.id}>{asset.originalFileName}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label={c.alt} showLabel className="sm:col-span-2">
                    <Input value={String(node.props.alt ?? "")} disabled={disabled} maxLength={500} onChange={(event) => editor.updateNode({ props: { ...node.props, alt: event.target.value } })} />
                  </Field>
                </>
              ) : null}
              {node.type === "dynamicTable" ? editor.columns.map((column, index) => (
                <Field key={String(column.id)} label={`${c.table} ${index + 1}`} showLabel>
                  <Input value={String(record(column.header)?.value ?? "")} maxLength={300} disabled={disabled || record(column.header)?.kind !== "TEXT"} onChange={(event) => editor.updateCollection("columns", index, { header: { kind: "TEXT", value: event.target.value } })} />
                </Field>
              )) : null}
              {node.type === "totals" ? editor.rows.map((row, index) => (
                <Field key={String(row.id)} label={`${c.totals} ${index + 1}`} showLabel>
                  <Input value={String(row.label ?? "")} maxLength={300} disabled={disabled} onChange={(event) => editor.updateCollection("rows", index, { label: event.target.value })} />
                </Field>
              )) : null}
            </div>
          </AccordionContent>
        </AccordionItem>
      ) : null}
      {document ? (
        <AccordionItem value="page" className="border-b-0">
          <AccordionTrigger>{c.pageSettings}</AccordionTrigger>
          <AccordionContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={c.accent} showLabel>
                <Input type="color" value={String(document.theme.accentColor ?? "#6d28d9")} disabled={busy} onChange={(event) => editor.change({ ...document, theme: { ...document.theme, accentColor: event.target.value } })} />
              </Field>
              {document.page ? (
                <>
                  <Field label={c.orientation} showLabel>
                    <Select value={document.page.orientation} disabled={busy} onValueChange={(orientation) => {
                      const page = document.page;
                      if (page && page.orientation !== orientation) editor.change({ ...document, page: { ...page, orientation, widthMm: page.heightMm, heightMm: page.widthMm } });
                    }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="PORTRAIT">{c.portrait}</SelectItem><SelectItem value="LANDSCAPE">{c.landscape}</SelectItem></SelectContent>
                    </Select>
                  </Field>
                  <Field label={c.margin} showLabel>
                    <Input type="number" min={0} max={50} value={document.page.marginMm.top} disabled={busy} onChange={(event) => {
                      const value = Number(event.target.value);
                      if (document.page && value >= 0 && value <= 50) editor.change({ ...document, page: { ...document.page, marginMm: { top: value, end: value, bottom: value, start: value } } });
                    }} />
                  </Field>
                </>
              ) : null}
            </div>
          </AccordionContent>
        </AccordionItem>
      ) : null}
    </Accordion>
  );
}
