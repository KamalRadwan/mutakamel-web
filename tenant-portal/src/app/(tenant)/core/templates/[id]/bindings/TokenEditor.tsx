"use client";
import { Button } from "@/design-system";
import { BindingEditor } from "./BindingEditor";
import { dataRecord, type DataDescriptor, type DataValue } from "./binding-contract";
import { DataInput } from "./DataControls";
import { useDataCopy } from "./hooks/useDataControls";
import { moveToken, replaceRichParagraph, richParagraphs, tokenRows } from "./token-editing";

export function TokenEditor({ value, change, descriptor, rich = false }: { value: unknown; change(value: DataValue[]): void; descriptor: DataDescriptor; rich?: boolean }) {
  const c = useDataCopy(), rows = tokenRows(value);
  const patch = (index: number, next: DataValue) => change(rows.map((row, at) => at === index ? next : row));
  return <div className="space-y-3">
    {rows.map((row, index) => <section key={index} className="space-y-3 rounded-md border border-border p-3">
      {(rich ? row.type === "text" : row.kind === "TEXT") && <DataInput label={c.text} value={String(rich ? row.text ?? "" : row.value ?? "")} change={next => patch(index, { ...row, [rich ? "text" : "value"]: next })} />}
      {(rich ? row.type === "variable" : row.kind === "BINDING") && <BindingEditor descriptor={descriptor} value={rich ? dataRecord(row.attrs).binding : row.binding} change={binding => patch(index, rich ? { ...row, attrs: { ...dataRecord(row.attrs), binding } } : { ...row, binding })} />}
      {row.type === "hardBreak" && <p>{c.lineBreak}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" disabled={index === 0} onClick={() => change(moveToken(rows, index, -1))}>{c.up}</Button>
        <Button type="button" size="sm" variant="outline" disabled={index === rows.length - 1} onClick={() => change(moveToken(rows, index, 1))}>{c.down}</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => change(rows.filter((_, at) => at !== index))}>{c.remove}</Button>
      </div>
    </section>)}
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" variant="outline" onClick={() => change([...rows, rich ? { type: "text", text: "" } : { kind: "TEXT", value: "" }])}>{c.addText}</Button>
      <Button type="button" size="sm" variant="outline" onClick={() => change([...rows, rich ? { type: "variable", attrs: { binding: { path: "", nullBehavior: "EMPTY" } } } : { kind: "BINDING", binding: { path: "", nullBehavior: "EMPTY" } }])}>{c.addVariable}</Button>
    </div>
  </div>;
}
export function RichTokenEditor({ value, change, descriptor }: { value: unknown; change(value: DataValue): void; descriptor: DataDescriptor }) {
  const c = useDataCopy(), document = dataRecord(value);
  return <div className="space-y-4">{richParagraphs(value).map(({ path, paragraph }) => <section key={path.join(".")} className="space-y-2"><p>{c.paragraph} <bdi>{path.join(".")}</bdi></p><TokenEditor rich descriptor={descriptor} value={paragraph.content} change={content => change(replaceRichParagraph(value, path, content))} /></section>)}
    <Button type="button" size="sm" variant="outline" onClick={() => change({ ...document, type: "doc", content: [...tokenRows(document.content), { type: "paragraph", content: [] }] })}>{c.addParagraph}</Button>
  </div>;
}
