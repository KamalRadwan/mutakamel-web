"use client";

import { useTemplateDetailPdfPort, type TemplateDetailPdfPortInput } from "../hooks/useTemplateDetailPdfPort";
import { TemplatePdfPreviewBridge } from "./TemplatePdfPreviewBridge";

/** Replaces the legacy detail preview caller with the genuine localized pinned session panel. */
export function TemplateDetailPdfPort(props: TemplateDetailPdfPortInput) {
  const port=useTemplateDetailPdfPort(props);
  return <TemplatePdfPreviewBridge {...port}/>;
}
