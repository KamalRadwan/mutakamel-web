"use client";

import Image from "next/image";
import { useState, type CSSProperties } from "react";
import { ImageIcon, Table2 } from "lucide-react";
import { Button } from "@/design-system";
import type { EditorDocument, EditorNode } from "../../template-editor-model";
import { record } from "../../../contracts/core-page";
import { assetContentHref, type TemplateAsset } from "../../template-assets-contract";

interface Props { document: EditorDocument; assets?: TemplateAsset[]; selectedId?: string; select?: (id: string) => void; label: string }

/** A structure canvas; server HTML preview remains authoritative for pagination. */
export function TemplateDesignCanvas({ document, assets, selectedId, select, label }: Props) {
  const quotationAssets = document.documentType === "QUOTATION" && document.outputChannel === "PRINT" &&
    document.dataSourceKey === "TRADE_QUOTATION_PRINT_V1" ? assets : undefined;
  return <div className="min-w-0 overflow-auto rounded-card bg-muted/60 p-4 sm:p-6">
    <div className="mx-auto min-h-[650px] w-full min-w-[320px] max-w-[650px] border border-border bg-white p-7 text-ink-800 shadow-sm" dir={document.direction === "RTL" ? "rtl" : "ltr"} aria-label={label}>
      {document.rootNodeIds.map((id) => <CanvasNode key={id} node={document.nodes[id]} document={document}
        assets={quotationAssets} selectedId={selectedId} select={select} depth={0} />)}
    </div>
  </div>;
}

export function canvasNodeTextStyle(node: EditorNode): CSSProperties {
  return { fontSize: typeof node.style.fontSizePx === "number" ? node.style.fontSizePx : undefined, color: typeof node.style.color === "string" ? node.style.color : undefined, background: typeof node.style.backgroundColor === "string" ? node.style.backgroundColor : undefined, textAlign: node.style.textAlign === "CENTER" ? "center" : node.style.textAlign === "END" ? "end" : "start", fontWeight: node.style.fontWeight === "SEMIBOLD" || node.style.fontWeight === "BOLD" ? 600 : node.style.fontWeight === "MEDIUM" ? 500 : 400 };
}

export function CanvasNodeContent({ node }: { node: EditorNode }) {
  const columns = Array.isArray(node.props.columns) ? node.props.columns : [];
  const rows = Array.isArray(node.props.rows) ? node.props.rows : [];
  return (
    node.type === "text" ? <span className="whitespace-pre-wrap">{String(node.props.text ?? "")}</span> : node.type === "dataField" ? <span className="inline-flex flex-wrap gap-1 text-sm"><span>{String(node.props.label ?? "")}</span><span className="rounded bg-ink-100 px-1.5 text-xs text-ink-500">{`{{${node.binding?.path ?? ""}}}`}</span></span> : node.type === "divider" ? <span className="my-2 block border-t" style={{ borderColor: String(node.props.color ?? "#e2e8f0") }} /> : node.type === "image" ? <span className="flex min-h-20 items-center justify-center gap-2 rounded-lg bg-ink-50 text-xs text-ink-500"><ImageIcon className="size-6" aria-hidden="true" />{String(node.props.alt ?? node.name ?? "")}</span> : node.type === "dynamicTable" || node.type === "staticTable" ? <span className="block overflow-hidden rounded-lg border border-ink-200"><span className="flex bg-ink-50">{columns.map((value: unknown, index: number) => { const column = record(value); const header = record(column?.header); return <span key={String(column?.id ?? index)} className="flex-1 border-e border-ink-200 px-2 py-3 text-xs font-medium">{String(header?.value ?? index + 1)}</span>; })}</span><span className="flex items-center justify-center gap-2 py-6 text-xs text-ink-400"><Table2 className="size-4" aria-hidden="true" />{String(node.props.sourcePath ?? "")}</span></span> : node.type === "totals" ? <span className="ms-auto block max-w-64">{rows.map((value: unknown, index: number) => { const row = record(value); const binding = record(row?.binding); return <span key={String(row?.id ?? index)} className="flex justify-between gap-4 border-b border-ink-100 py-2 text-xs"><span>{String(row?.label ?? "")}</span><span className="text-ink-400">{`{{${String(binding?.path ?? "")}}}`}</span></span>; })}</span> : <span className="text-xs text-ink-500">{node.name ?? node.type}</span>
  );
}

export function QuotationCanvasImage({ node, asset, fixed = false }: { node: EditorNode; asset: TemplateAsset; fixed?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <CanvasNodeContent node={node} />;
  const fit = node.style.objectFit === "COVER" ? "cover" : node.style.objectFit === "FILL" ? "fill" : "contain";
  return <span className={`relative block w-full overflow-hidden ${fixed ? "h-full" : "h-24"}`}>
    <Image unoptimized fill src={assetContentHref(asset.id)} alt={node.props.decorative ? "" : String(node.props.alt ?? "")}
      draggable={fixed ? false : undefined}
      style={{ objectFit: fit }} onError={() => setFailed(true)} />
  </span>;
}

function CanvasNode({ node, document, assets, selectedId, select, depth }: {
  node: EditorNode; document: EditorDocument; assets?: TemplateAsset[]; selectedId?: string;
  select?: (id: string) => void; depth: number;
}) {
  if (!node || depth > 30) return null;
  const style = canvasNodeTextStyle(node);
  const asset = node.type === "image" ? assets?.find(row => row.id === node.props.assetId && row.status === "ACTIVE") : undefined;
  const content = asset && !node.hidden
    ? <QuotationCanvasImage key={`${asset.id}:${asset.revision}`} node={node} asset={asset} /> : <CanvasNodeContent node={node} />;
  const nodeClass = "block h-auto min-h-8 w-full whitespace-normal rounded-md p-2 text-start";
  return <div className={`my-1 rounded-md border transition-colors ${node.id === selectedId ? "border-primary bg-primary/5 ring-1 ring-primary" : select ? "border-transparent hover:border-primary/30" : "border-transparent"} ${node.hidden ? "opacity-40" : ""}`}>
    {select ? <Button variant="ghost" type="button" onClick={() => select(node.id)}
      className={`${nodeClass} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
      style={style} aria-pressed={node.id === selectedId} aria-label={asset ? String(node.props.alt || asset.originalFileName) : undefined}>{content}</Button> :
      <div className={nodeClass} style={style}>{content}</div>}
    {node.childIds.length ? <div className={`px-2 ${node.type === "row" ? "flex flex-wrap" : ""}`}>{node.childIds.map((id) => <div key={id} className={node.type === "row" ? "min-w-0 flex-1" : undefined}><CanvasNode node={document.nodes[id]} document={document} assets={assets} selectedId={selectedId} select={select} depth={depth + 1} /></div>)}</div> : null}
  </div>;
}
