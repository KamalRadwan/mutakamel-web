import { normalizeApiError } from "@/lib/api/errors";
import type { TemplateDetail } from "./templates-contract";

/** UI capability boundary, not a server enum or a promise of future routes. */
type UnavailablePreviewCapability<Reason extends string> = Readonly<{ state: "UNAVAILABLE"; reason: Reason }>;
export interface CurrentPreviewServiceCapabilities {
  serverCancel: UnavailablePreviewCapability<"NO_AUTHORIZED_CANCEL_ROUTE">;
  sourceSnapshot: UnavailablePreviewCapability<"NO_OWNER_SNAPSHOT_CONTRACT">;
  receipt: UnavailablePreviewCapability<"NO_PROTECTED_PAIRED_RECEIPT_ROUTE">;
  thumbnail: UnavailablePreviewCapability<"NO_DURABLE_THUMBNAIL_DELIVERY_ROUTE">;
  nativePrint: UnavailablePreviewCapability<"NO_QUALIFIED_PRINT_SURFACE">;
}

// Snapshot of the verified HTTP intake. New authorized owner implementations need an explicit route/DTO handoff before this changes.
// Worker custody/publication symbols alone do not implement browser delivery or cancellation APIs.
export const currentPreviewCapabilities: CurrentPreviewServiceCapabilities = {
  serverCancel: { state: "UNAVAILABLE", reason: "NO_AUTHORIZED_CANCEL_ROUTE" },
  sourceSnapshot: { state: "UNAVAILABLE", reason: "NO_OWNER_SNAPSHOT_CONTRACT" },
  receipt: { state: "UNAVAILABLE", reason: "NO_PROTECTED_PAIRED_RECEIPT_ROUTE" },
  thumbnail: { state: "UNAVAILABLE", reason: "NO_DURABLE_THUMBNAIL_DELIVERY_ROUTE" },
  nativePrint: { state: "UNAVAILABLE", reason: "NO_QUALIFIED_PRINT_SURFACE" },
};

type QuotationPdfFormat = Pick<TemplateDetail, "outputChannel" | "layoutMode" | "documentType" | "dataSourceKey">;

function supportsQuotationPdfFormat({ outputChannel, layoutMode, documentType, dataSourceKey }: QuotationPdfFormat): boolean {
  return outputChannel === "PRINT" &&
    (layoutMode === "HYBRID_DOCUMENT" || layoutMode === "FLOW_DOCUMENT" || layoutMode === "FIXED_CANVAS") &&
    ((documentType === "QUOTATION" && dataSourceKey === "TRADE_QUOTATION_PRINT_V1") ||
     (documentType === "PURCHASE_QUOTATION" && dataSourceKey === "TRADE_PURCHASE_QUOTATION_PRINT_V1"));
}

/** Draft eligibility uses Core's current definition capability. */
export function supportsCurrentPdfPreview(template: QuotationPdfFormat & Pick<TemplateDetail, "previewPdf">): boolean {
  if (!supportsQuotationPdfFormat(template)) return false;
  if (template.previewPdf) return template.previewPdf.state === "ENABLED";
  // Older Core responses omitted the capability for Sales Hybrid drafts.
  return template.layoutMode === "HYBRID_DOCUMENT" && template.documentType === "QUOTATION";
}

/** Published eligibility uses the immutable version, independently of the current draft capability. */
export function supportsPublishedPdfPreview(template: QuotationPdfFormat & Pick<TemplateDetail, "lifecycleStatus">): boolean {
  return template.lifecycleStatus === "ACTIVE" && supportsQuotationPdfFormat(template);
}

export type PreviewPreparationFailure = "denied" | "expired" | "stale" | "invalid" | "unavailable";
export function classifyPreviewFailure(error: unknown): PreviewPreparationFailure {
  const { status, code } = normalizeApiError(error);
  if (status === 401 || status === 403) return "denied";
  if (code === "CORE.TEMPLATE.PREVIEW.ARTIFACT_EXPIRED") return "expired";
  if (code === "CORE.TEMPLATE.PREVIEW.SOURCE_STALE" || code === "CORE.TEMPLATE.CONCURRENCY.STALE_REVISION") return "stale";
  if (error instanceof Error && error.message === "Invalid Core identity response.") return "invalid";
  return "unavailable";
}
