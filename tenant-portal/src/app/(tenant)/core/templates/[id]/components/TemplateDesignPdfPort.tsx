"use client";

import { useTemplateDesignPdfPort, type TemplateDesignPdfPortInput } from "../hooks/useTemplateDesignPdfPort";
import { TemplatePdfPreviewBridge } from "./TemplatePdfPreviewBridge";

/** Mount beside T01's viewport; draft/save/guard and the existing HTML sample hook remain with T01. */
export function TemplateDesignPdfPort(props: TemplateDesignPdfPortInput) {
  const port = useTemplateDesignPdfPort(props);
  return <TemplatePdfPreviewBridge {...port} />;
}
