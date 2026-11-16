"use client";
import { useState, type SyntheticEvent } from "react";
import { assetContentHref, type TemplateAsset } from "../../template-assets-contract";
import type { EditorNode } from "../../template-editor-model";
import { inspectorRecord } from "./inspector-contract";
import type { InspectorImageCropPort } from "./inspector-ports";

export function inspectorImagePreview(node: EditorNode, assets: TemplateAsset[]) {
  const asset = assets.find(asset => asset.id === node.props.assetId && asset.status === "ACTIVE");
  const focal = inspectorRecord(node.props.crop);
  const fit = { CONTAIN: "contain", COVER: "cover", FILL: "fill" }[String(node.style.objectFit ?? "CONTAIN")];
  const x = Number(focal.focalX ?? 0.5), y = Number(focal.focalY ?? 0.5);
  if (!asset || !fit || !Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1) return null;
  const width = Number(node.layout.width), height = Number(node.layout.height);
  const fixed = node.layout.kind === "ABSOLUTE" && Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0;
  return { href: assetContentHref(asset.id), revision: asset.revision, fit: fit as "contain" | "cover" | "fill",
    aspectRatio: fixed ? `${width} / ${height}` : undefined, inlineSize: fixed ? `min(100%, ${12 * width / height}rem)` : "100%" };
}
export function inspectorCropFrame(node: EditorNode, href: string, source: { width: number; height: number } | null, port?: InspectorImageCropPort) {
  if (!port || !source) return null;
  try {
    const frame = port.contentFrame(node, href);
    if (!frame || !Number.isFinite(frame.width) || !Number.isFinite(frame.height) || frame.width <= 0 || frame.height <= 0) return null;
    const focal = inspectorRecord(node.props.crop), fit = node.style.objectFit === "COVER" ? "COVER" : "CONTAIN";
    const placement = port.computeImageCropPlacement(source, frame, fit, { focalX: Number(focal.focalX ?? 0.5), focalY: Number(focal.focalY ?? 0.5) });
    const image = placement.image;
    if (![image.x, image.y, image.width, image.height].every(Number.isFinite) || image.width <= 0 || image.height <= 0) return null;
    return { aspectRatio: `${frame.width} / ${frame.height}`, inlineSize: `min(100%, ${12 * frame.width / frame.height}rem)`, image: {
      inlineSize: `${100 * image.width / frame.width}%`, blockSize: `${100 * image.height / frame.height}%`, insetInlineStart: `${100 * image.x / frame.width}%`, insetBlockStart: `${100 * image.y / frame.height}%`,
    } };
  } catch { return null; }
}
export function useInspectorMedia() {
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [source, setSource] = useState<{ width: number; height: number } | null>(null);
  return { state, source, loaded: (event: SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth: width, naturalHeight: height } = event.currentTarget;
    if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0) { setState("failed"); return; }
    setSource(old => old?.width === width && old.height === height ? old : { width, height }); setState("ready");
  }, failed: () => { setSource(null); setState("failed"); } };
}
