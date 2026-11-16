"use client";
import { TemplateDesignCanvas } from "../TemplateDesignCanvas";
import type { DesignerCanvasProps } from "../DesignerCanvasAdapter";
export function FlowDocumentAdapter({ unavailableLabel: _unavailableLabel, ...props }: DesignerCanvasProps) {
  return <TemplateDesignCanvas {...props} />;
}
