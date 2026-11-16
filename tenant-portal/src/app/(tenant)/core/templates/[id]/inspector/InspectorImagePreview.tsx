"use client";
import Image from "next/image";
import type { InspectorCopy } from "@/i18n/dictionaries/template-inspector";
import type { TemplateAsset } from "../../template-assets-contract";
import type { EditorNode } from "../../template-editor-model";
import { inspectorCropFrame, inspectorImagePreview, useInspectorMedia } from "./useInspectorMedia";
import { useInspectorPorts } from "./useInspectorPorts";

export function InspectorImagePreview({ node, assets, copy: c }: { node: EditorNode; assets: TemplateAsset[]; copy: InspectorCopy }) {
  const preview = inspectorImagePreview(node, assets);
  if (!preview) return <p role="status" className="text-xs text-muted-foreground">{c.imagePreviewUnavailable}</p>;
  return <ProtectedImage key={`${preview.href}:${preview.revision}`} preview={preview} node={node} copy={c} />;
}
function ProtectedImage({ preview, node, copy: c }: { preview: NonNullable<ReturnType<typeof inspectorImagePreview>>; node: EditorNode; copy: InspectorCopy }) {
  const media = useInspectorMedia();
  const { imageCrop } = useInspectorPorts(), crop = inspectorCropFrame(node, preview.href, media.source, imageCrop);
  return <figure className="space-y-2">
    <figcaption className="text-sm font-medium">{c.cropPreview}</figcaption>
    <div dir="ltr" className="relative max-w-full overflow-hidden rounded-lg border border-border bg-muted" style={{ aspectRatio: crop?.aspectRatio ?? preview.aspectRatio ?? "2 / 1", inlineSize: crop?.inlineSize ?? preview.inlineSize }}>
      <div className="absolute" style={crop?.image ?? { inlineSize: "100%", blockSize: "100%", insetInlineStart: 0, insetBlockStart: 0 }}>
        {media.state !== "failed" && <Image unoptimized fill src={preview.href} alt={node.props.decorative ? "" : String(node.props.alt ?? "")} style={{ objectFit: crop || preview.fit === "fill" ? "fill" : "contain" }} onLoad={media.loaded} onError={media.failed} />}
      </div>
    </div>
    <p role="status" className="text-xs text-muted-foreground">{media.state === "failed" ? c.imagePreviewUnavailable : media.state === "loading" ? c.imagePreviewLoading : crop || preview.fit !== "cover" ? c.cropPreview : c.flowCropPreview}</p>
  </figure>;
}
