import { normalizeApiError } from "@/lib/api/errors";
import { invalidCoreResponse, isMember, record } from "../../core/contracts/core-page";
import { coreGetResponse } from "../../core/core-api";
import { fetchTemplateDataSchema } from "../../core/templates/template-design-api";
import { previewTemplateHtml } from "../../core/templates/template-lifecycle-api";
import { parseTemplateVersion } from "../../core/templates/template-lifecycle-contract";
import { readTemplateResponse } from "../../core/templates/template-wire";
import { fetchTemplates } from "../../core/templates/templates-api";
import { TEMPLATE_LOCALES, parseTemplateDetail, templatePath, type TemplateDetail, type TemplateListItem, type TemplateLocale } from "../../core/templates/templates-contract";

const QUOTATION_SOURCE = "TRADE_QUOTATION_PRINT_V1";
const QUOTATION_LAYOUTS = ["HYBRID_DOCUMENT", "FLOW_DOCUMENT", "FIXED_CANVAS"] as const;

export interface QuotationTemplateChoice {
  templateId: string;
  templateVersionId: string;
  name: string;
  locale: TemplateLocale;
  layoutMode: (typeof QUOTATION_LAYOUTS)[number];
  version: number;
  contentChecksum: string;
  canPreview: boolean;
  detail: TemplateDetail;
}

export async function fetchQuotationTemplates(
  companyId: string, branchId: string, locale: string, search: string, cursor?: string, signal?: AbortSignal, assertCurrent?: () => void,
) {
  assertCurrent?.();
  if (!isMember(TEMPLATE_LOCALES, locale)) invalidCoreResponse();
  const page = await fetchTemplates({
    assignmentScopeType: "BRANCH",
    assignmentCompanyId: companyId,
    assignmentBranchId: branchId,
    locale,
    name: search.trim() || undefined,
    documentType: "QUOTATION",
    outputChannel: "PRINT",
    lifecycleStatus: "ACTIVE",
    hasPublishedVersion: true,
    sortBy: "name",
    sortDirection: "asc",
    cursor,
  }, signal, assertCurrent);
  signal?.throwIfAborted();
  assertCurrent?.();
  const choices = await Promise.all(page.items.map((item) => resolveChoice(item, companyId, locale, signal, assertCurrent)));
  return { items: choices.filter((choice): choice is QuotationTemplateChoice => choice !== null), nextCursor: page.nextCursor };
}

async function resolveChoice(
  item: TemplateListItem, companyId: string, locale: TemplateLocale, signal?: AbortSignal, assertCurrent?: () => void,
): Promise<QuotationTemplateChoice | null> {
  const published = item.currentPublishedVersion;
  if (!published || item.locale !== locale || item.lifecycleStatus !== "ACTIVE" ||
    item.documentType !== "QUOTATION" || item.outputChannel !== "PRINT" || !isMember(QUOTATION_LAYOUTS, item.layoutMode)) return null;

  try {
    const path = templatePath(item.id);
    const config = { signal, maxResponseBytes: 400_000, requireExactResponseTarget: true, suppressForbiddenToast: true,
      ...(assertCurrent ? { assertCurrent } : {}) };
    const definitionResponse = await coreGetResponse(path, config);
    const definition = record(readTemplateResponse(definitionResponse, [200]));
    const detail = parseTemplateDetail(definition);
    if (detail.id !== item.id) invalidCoreResponse();
    if (detail.lifecycleStatus !== "ACTIVE" || detail.locale !== locale || detail.documentType !== "QUOTATION" ||
      detail.outputChannel !== "PRINT" || detail.dataSourceKey !== QUOTATION_SOURCE || detail.layoutMode !== item.layoutMode) return null;

    // Core's list uses actor-wide definition grants. Trade resolves explicit versions within the quotation company.
    const { type, companyId: ownerCompanyId, branchId } = detail.scope;
    const tenantOwned = type === "TENANT" && ownerCompanyId === undefined;
    const companyOwned = type === "COMPANY" && ownerCompanyId === companyId;
    if (branchId || (!tenantOwned && !companyOwned)) return null;

    signal?.throwIfAborted();
    assertCurrent?.();
    const response = await coreGetResponse(`${path}/versions/${published.versionId}`, config);
    const payload = record(readTemplateResponse(response, [200]));
    const version = parseTemplateVersion(payload);
    if (!payload || payload.templateDefinitionId !== item.id || version.id !== published.versionId ||
      version.versionNumber !== published.versionNumber || version.publishedAt !== published.publishedAt ||
      version.locale !== locale || payload.documentType !== detail.documentType ||
      payload.outputChannel !== detail.outputChannel || payload.layoutMode !== detail.layoutMode ||
      version.dataSourceKey !== QUOTATION_SOURCE) invalidCoreResponse();
    if (version.lifecycleStatus !== "PUBLISHED" || !version.rendererTargets.includes("PDF")) return null;
    if (!/^[0-9a-f]{64}$/u.test(version.templateContentChecksum)) invalidCoreResponse();

    const document = record(payload.editorDocument);
    if (!document || document.documentType !== detail.documentType || document.outputChannel !== detail.outputChannel ||
      document.layoutMode !== item.layoutMode || document.locale !== locale || document.dataSourceKey !== QUOTATION_SOURCE) invalidCoreResponse();
    // The Trade quotation adapter supports the implicit fixed page. Explicit pages require a different execution bundle.
    if (item.layoutMode === "FIXED_CANVAS" && Object.hasOwn(document, "canvasPages")) return null;

    const preview = record(record(definition?.capabilities)?.preview);

    return {
      templateId: detail.id,
      templateVersionId: version.id,
      name: detail.name,
      locale,
      layoutMode: item.layoutMode,
      version: version.versionNumber,
      contentChecksum: version.templateContentChecksum,
      canPreview: preview?.state === "ENABLED" && preview.reason === null && version.rendererTargets.includes("HTML"),
      detail,
    };
  } catch (cause) {
    const error = normalizeApiError(cause);
    if (error.status === 404 && error.code === "CORE.TEMPLATE.NOT_FOUND") return null;
    throw cause;
  }
}

export async function previewQuotationTemplate(
  choice: QuotationTemplateChoice, locale: string, timeZone: string, signal?: AbortSignal, assertCurrent?: () => void,
): Promise<string> {
  const check = () => { signal?.throwIfAborted(); assertCurrent?.(); };
  check();
  if (!choice.canPreview || locale !== choice.locale) invalidCoreResponse();
  const schema = await fetchTemplateDataSchema(choice.detail.dataSourceKey, choice.detail.scope, signal);
  check();
  const fixture = schema.syntheticFixtures.find((candidate) => candidate.locale === locale);
  if (!fixture) throw new Error("No compatible template fixture.");
  const preview = await previewTemplateHtml(choice.templateId, {
    source: { kind: "VERSION", versionId: choice.templateVersionId },
    fixtureKey: fixture.fixtureKey,
    locale,
    timeZone,
  }, signal);
  check();
  if (preview.templateId !== choice.templateId || preview.sourceKind !== "VERSION" ||
    preview.versionId !== choice.templateVersionId || preview.versionEvidence?.versionNumber !== choice.version ||
    preview.templateContentChecksum !== choice.contentChecksum) invalidCoreResponse();
  return preview.html;
}
