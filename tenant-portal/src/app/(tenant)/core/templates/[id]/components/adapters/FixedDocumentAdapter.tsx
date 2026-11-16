"use client";
import { resolveTemplateTextDirection, templatePrintableBox, validateTemplateDocumentModel, type TemplateDocumentV1 } from "@mutakamel/template-schema/browser-safe";
import { useMemo, type CSSProperties } from "react";
import { Button } from "@/design-system";
import { absoluteFrame } from "../../../designer-geometry-commands";
import { ASSET_MIME_TYPES, ASSET_TYPES, type TemplateAsset } from "../../../template-assets-contract";
import type { EditorDocument, EditorNode } from "../../../template-editor-model";
import type { DesignerCanvasProps } from "../DesignerCanvasAdapter";
import { CanvasNodeContent, canvasNodeTextStyle, QuotationCanvasImage } from "../TemplateDesignCanvas";
import { fixedLiteralGrid, FixedStaticTableGrid } from "./FixedStaticTableGrid";

/** The authoring surface uses the document geometry. Final pagination and rendering are server-owned. */
export function FixedDocumentAdapter({ document, assets, label, unavailableLabel, selectedId, select, ordinaryFixed }: DesignerCanvasProps) {
  const admission = useMemo(() => validateTemplateDocumentModel(document), [document]);
  const imageAssets = useMemo(() => new Map(assets?.filter(asset => asset.status === "ACTIVE" &&
    ASSET_TYPES.some(type => type === asset.assetType) && ASSET_MIME_TYPES.some(type => type === asset.mimeType))
    .map(asset => [asset.id, asset])), [assets]);
  const stored = admission.valid ? admission.document : undefined;
  if (!stored || stored.layoutMode !== "FIXED_CANVAS" || !stored.page) {
    return <p role="status" className="rounded-lg border border-border bg-muted p-6 text-sm text-muted-foreground">{unavailableLabel}</p>;
  }
  const writingDirection = resolveTemplateTextDirection(stored.direction, stored.locale);
  const direction = writingDirection === "RTL" ? "rtl" : "ltr";
  const pages = stored.canvasPages ?? [{ id: "document", page: stored.page, rootNodeIds: stored.rootNodeIds }];
  const literalGridNodes = stored.documentType === "QUOTATION" && stored.outputChannel === "PRINT" &&
    stored.dataSourceKey === "TRADE_QUOTATION_PRINT_V1" && !stored.canvasPages ? stored.nodes : undefined;
  // The ordinary Engine 0.0.8 uses physical page padding and logical child insets.
  const legacyFrames = ordinaryFixed && literalGridNodes !== undefined;
  const frameDirection = legacyFrames ? direction : "ltr";
  return <div role="region" aria-label={label} className="mx-auto flex w-max flex-col gap-4">
    {pages.map(({ id, page, rootNodeIds }) => {
      const box = templatePrintableBox(page, writingDirection);
      const left = legacyFrames ? page.marginMm.start : box.x;
      return <div key={id} dir="ltr" className="relative overflow-hidden bg-white text-ink-800 shadow-sm outline outline-border"
        style={{ inlineSize: mm(page.widthMm), blockSize: mm(page.heightMm) }}>
        <div className="absolute" style={{ insetInlineStart: mm(left), insetBlockStart: mm(box.y), inlineSize: mm(box.width), blockSize: mm(box.height) }}>
          {rootNodeIds.map(rootId => <FixedObject key={rootId} node={document.nodes[rootId]} document={document} literalGridNodes={literalGridNodes} imageAssets={legacyFrames ? imageAssets : undefined}
            selectedId={selectedId} select={select} direction={direction} frameDirection={frameDirection} root />)}
        </div>
      </div>;
    })}
  </div>;
}

function mm(value: number) { return `${value}mm`; }

interface FixedObjectProps {
  node: EditorNode; document: EditorDocument; direction: "ltr" | "rtl";
  frameDirection: "ltr" | "rtl";
  literalGridNodes?: TemplateDocumentV1["nodes"];
  imageAssets?: ReadonlyMap<string, TemplateAsset>;
  selectedId?: string; select?: (id: string) => void; root?: boolean;
}

function FixedObject({ node, document, direction, frameDirection, literalGridNodes, imageAssets, selectedId, select, root }: FixedObjectProps) {
  if (node.hidden) return null;
  const { id, childIds, layout, style } = node;
  const textStyle = canvasNodeTextStyle(node);
  const frame = layout.kind === "ABSOLUTE" ? absoluteFrame(node) : null;
  const selected = id === selectedId;
  const positioned: CSSProperties = frame ? {
    insetInlineStart: mm(frame.x), insetBlockStart: mm(frame.y), inlineSize: mm(frame.width),
    blockSize: mm(frame.height), zIndex: frame.zIndex, transform: `rotate(${frame.rotationDeg}deg)`,
  } : {};
  const label = node.name || (typeof node.props.text === "string" && node.props.text) || node.type;
  const boxClass = `${frame ? "absolute" : "relative"} ${root ? "size-full" : ""} ${selected ? "outline outline-primary" : ""}`;
  const literalGrid = literalGridNodes && fixedLiteralGrid(literalGridNodes[id]);
  const fixedImage = !!frame && !!imageAssets && node.type === "image";
  const asset = fixedImage && typeof node.props.assetId === "string" ? imageAssets.get(node.props.assetId) : undefined;
  const imageContent = asset ? <QuotationCanvasImage key={`${asset.id}:${asset.revision}`} node={node} asset={asset} fixed /> : <CanvasNodeContent node={node} />;
  const content = literalGrid ? <FixedStaticTableGrid {...literalGrid} /> :
    fixedImage ? <span className="block size-full overflow-hidden">{imageContent}</span> : imageContent;
  const fillFrame = !!literalGrid || fixedImage;
  const controlsClass = `${fillFrame ? "h-full" : "h-auto"} min-h-0 w-full justify-start whitespace-normal rounded-none p-0 text-start`;
  const children = childIds.map(childId => document.nodes[childId]);
  return <div dir={frameDirection} className={boxClass} style={{ ...positioned, background: textStyle.background, opacity: typeof style.opacity === "number" ? style.opacity : undefined }}>
    {children.length ? (select && !root && <Button type="button" variant="ghost" aria-label={label} aria-pressed={selected} data-fixed-node-id={id}
      onClick={() => select(id)} className="absolute start-0 top-0 h-5 max-w-full truncate bg-card/80 px-1 py-0 text-xs opacity-0 hover:opacity-100 focus-visible:opacity-100">{label}</Button>)
      : select && !root ? <Button type="button" variant="ghost" dir={direction} aria-label={label} aria-pressed={selected} data-fixed-node-id={id}
        onClick={() => select(id)} className={controlsClass} style={textStyle}>{content}</Button>
        : <div dir={direction} className={fillFrame ? "size-full" : undefined} style={textStyle}>{content}</div>}
    {children.map(child => <FixedObject key={child.id} node={child} document={document} direction={direction} frameDirection={frameDirection}
      literalGridNodes={literalGridNodes} imageAssets={imageAssets} selectedId={selectedId} select={select} />)}
  </div>;
}
