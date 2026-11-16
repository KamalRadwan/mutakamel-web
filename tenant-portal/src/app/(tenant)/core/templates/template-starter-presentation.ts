import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import type { Language } from "@/i18n/useLanguage";
import { findStarterCatalogueMetadata, type StarterCatalogueMetadata, type StarterCatalogueTuple } from "./starter-catalogue";
import { getTemplateStarterRegistryFingerprint, type TemplateStarter } from "./template-discovery-contract";

// R32 isolated R25 and R58 source-qualified roster fingerprints, respectively.
const R25_REGISTRY = "58a164867c99b89a854edc010e908f8fad62b3e0bc886c3c6a6764fc8fa7a6ef";
const R58_REGISTRY = "2f1331726d4f3067325992c804cb59c3e8115e9d709e0f00acbac2fab32aeae4";
const CRM_SUCCESSOR_REGISTRY = "46cb6ab94cfc2370d530f3945f705c1d479acf590b5d064fa80ac926512eb76d";
const R25_STARTER = "trade.quotation.classic-hybrid.en-US.v1";

// The two display strings from the sealed T16 picker, scoped to this feature.
const copy = {
  en: { page: "Original design page: {width} × {height} mm", email: "Responsive design width: {width} px" },
  ar: { page: "صفحة التصميم الأصلية: {width} × {height} مم", email: "عرض التصميم المتجاوب: {width} بكسل" },
};

export function selectStarterPresentation(
  items: readonly TemplateStarter[],
  selectedKey: string,
  requested: StarterCatalogueTuple,
  sourceSchemaChecksum: string,
): StarterCatalogueMetadata["thumbnailSource"] | null {
  const registry = getTemplateStarterRegistryFingerprint(items);
  const r58Tuple = (requested.documentType === "QUOTATION" && requested.layoutMode === "HYBRID_DOCUMENT") ||
    requested.documentType === "CRM_OUTBOUND_EMAIL";
  const crmSuccessor = registry === CRM_SUCCESSOR_REGISTRY && requested.documentType === "CRM_OUTBOUND_EMAIL" &&
    requested.outputChannel === "EMAIL" && requested.layoutMode === "EMAIL_FLOW";
  const admitted = registry === R25_REGISTRY ? selectedKey === R25_STARTER : crmSuccessor || (registry === R58_REGISTRY && r58Tuple);
  if (!selectedKey || !admitted) return null;

  const direction = requested.direction === "AUTO" ? (requested.locale === "ar-EG" ? "RTL" : "LTR") : requested.direction;
  const seen = new Set<string>();
  let selectedSource: StarterCatalogueMetadata["thumbnailSource"] | null = null;
  for (const starter of items) {
    if (seen.has(starter.starterKey) || starter.documentType !== requested.documentType ||
        starter.outputChannel !== requested.outputChannel || starter.layoutMode !== requested.layoutMode ||
        starter.dataSourceKey !== requested.dataSourceKey || starter.dataSourceSchemaVersion !== requested.dataSourceSchemaVersion ||
        starter.dataSourceSchemaChecksum !== sourceSchemaChecksum || starter.locale !== requested.locale ||
        starter.resolvedDirection !== direction) return null;
    seen.add(starter.starterKey);
    const selected = starter.starterKey === selectedKey;
    if (crmSuccessor || selected) {
      const metadata = findStarterCatalogueMetadata(starter, requested, crmSuccessor);
      if (crmSuccessor && !metadata) return null;
      if (selected) selectedSource = metadata?.thumbnailSource ?? null;
    }
  }
  return selectedSource;
}

export function formatStarterPresentation(source: StarterCatalogueMetadata["thumbnailSource"], lang: Language): string {
  const labels = copy[lang];
  if (source.kind === "PRINT_DOCUMENT") {
    return formatTemplate(labels.page, {
      width: formatNumber(source.page.widthMm, lang),
      height: formatNumber(source.page.heightMm, lang),
    });
  }
  return formatTemplate(labels.email, { width: formatNumber(source.maxWidthPx, lang) });
}
