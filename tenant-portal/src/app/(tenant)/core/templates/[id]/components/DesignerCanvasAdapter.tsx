"use client";
import { lazy, Suspense } from "react";
import { Skeleton } from "@/design-system";
import type { TemplateAsset } from "../../template-assets-contract";
import type { EditorDocument } from "../../template-editor-model";

const Flow = lazy(() => import("./adapters/FlowDocumentAdapter").then(module => ({ default: module.FlowDocumentAdapter })));
const Email = lazy(() => import("./adapters/EmailDocumentAdapter").then(module => ({ default: module.EmailDocumentAdapter })));
const Fixed = lazy(() => import("./adapters/FixedDocumentAdapter").then(module => ({ default: module.FixedDocumentAdapter })));
export interface DesignerCanvasProps { document: EditorDocument; assets?: TemplateAsset[]; selectedId?: string; select?: (id: string) => void; label: string; unavailableLabel: string; ordinaryFixed?: boolean }

export function DesignerCanvasAdapter({ layoutMode, ...props }: DesignerCanvasProps & { layoutMode: string }) {
  const Adapter = layoutMode === "FIXED_CANVAS" ? Fixed : layoutMode === "EMAIL_FLOW" ? Email
    : ["HYBRID_DOCUMENT", "FLOW_DOCUMENT"].includes(layoutMode) ? Flow : null;
  if (!Adapter) return <p role="status" className="text-sm text-muted-foreground">{props.unavailableLabel}</p>;
  return <Suspense fallback={<Skeleton className="h-32 w-full" aria-busy="true" />}><Adapter {...props} /></Suspense>;
}
