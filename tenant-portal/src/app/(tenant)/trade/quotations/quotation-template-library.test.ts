import { beforeEach, describe, expect, it, vi } from "vitest";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { fetchQuotationTemplates, previewQuotationTemplate } from "./quotation-template-library";
import type { TemplateListItem, TemplateLocale, TemplateScope } from "../../core/templates/templates-contract";

const api = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn(), schema: vi.fn(), preview: vi.fn() }));
vi.mock("../../core/templates/templates-api", () => ({ fetchTemplates: api.list }));
vi.mock("../../core/core-api", () => ({ coreGetResponse: api.get }));
vi.mock("../../core/templates/template-design-api", () => ({ fetchTemplateDataSchema: api.schema }));
vi.mock("../../core/templates/template-lifecycle-api", () => ({ previewTemplateHtml: api.preview }));

const templateId = "019f0000-0000-7000-8000-000000000001";
const versionId = "019f0000-0000-7000-8000-000000000002";
const newerVersionId = "019f0000-0000-7000-8000-000000000003";
const draftId = "019f0000-0000-7000-8000-000000000004";
const companyId = "019f0000-0000-7000-8000-000000000005";
const branchId = "019f0000-0000-7000-8000-000000000006";
const otherCompanyId = "019f0000-0000-7000-8000-000000000007";
const publishedAt = "2026-11-10T10:00:00.000Z";
const checksum = "a".repeat(64);
const source = "TRADE_QUOTATION_PRINT_V1";
const nextCursor = "signed.cursor";
const layouts = ["HYBRID_DOCUMENT", "FLOW_DOCUMENT", "FIXED_CANVAS"] as const;
const locales = ["ar-EG", "en-US"] as const;

function seed(layoutMode: (typeof layouts)[number], locale: TemplateLocale, scope: TemplateScope = { type: "TENANT" }) {
  const identity = { documentType: "QUOTATION", outputChannel: "PRINT", layoutMode, locale, dataSourceKey: source };
  const published = { versionId, versionNumber: 2, publishedAt };
  const draft = { draftId, revision: 1, validationState: "PASSED" as const };
  const item: TemplateListItem = {
    ...identity,
    id: templateId,
    name: "Quotation from Core",
    code: "SALES-001",
    lifecycleStatus: "ACTIVE",
    direction: "AUTO",
    draft,
    currentPublishedVersion: published,
    definitionRevision: 2,
    definitionEtag: '"2"',
    updatedAt: publishedAt,
  };
  const definition = {
    ...identity,
    templateId,
    name: item.name,
    code: item.code,
    scope,
    lifecycleStatus: "ACTIVE",
    direction: "AUTO",
    systemProtected: false,
    revision: 2,
    etag: '"2"',
    currentDraft: { ...draft, contentChecksum: checksum, etag: '"1"' },
    currentPublishedVersion: { ...published, versionId: newerVersionId, versionNumber: 3 },
    createdAt: publishedAt,
    updatedAt: publishedAt,
    capabilities: { preview: { state: "ENABLED", reason: null } },
  };
  const version = {
    ...identity,
    templateDefinitionId: templateId,
    templateVersionId: versionId,
    versionNumber: 2,
    publishedAt,
    lifecycleStatus: "PUBLISHED",
    templateContentChecksum: checksum,
    rendererTargets: ["HTML", "PDF"],
    editorDocument: { ...identity, schemaVersion: 1 },
  };
  api.list.mockResolvedValue({ items: [item], nextCursor });
  api.get.mockResolvedValueOnce({ status: 200, data: { success: true, data: definition } });
  return { definition, version };
}

function returnVersion(version: object) {
  api.get.mockResolvedValueOnce({ status: 200, data: { success: true, data: version } });
}

describe("sales quotation published template library", () => {
  beforeEach(() => vi.resetAllMocks());

  it.each(layouts.flatMap((layoutMode) => locales.map((locale) => ({ layoutMode, locale }))))(
    "retains the listed $layoutMode version in $locale even when the definition has a newer publication",
    async ({ layoutMode, locale }) => {
      const { version } = seed(layoutMode, locale, { type: "COMPANY", companyId });
      returnVersion(version);
      const signal = new AbortController().signal;
      const assertCurrent = vi.fn();
      const page = await fetchQuotationTemplates(companyId, branchId, locale, "  sales  ", nextCursor, signal, assertCurrent);

      expect(api.list).toHaveBeenCalledWith(expect.objectContaining({
        assignmentScopeType: "BRANCH", assignmentCompanyId: companyId, assignmentBranchId: branchId,
        locale, documentType: "QUOTATION", outputChannel: "PRINT", hasPublishedVersion: true, name: "sales", cursor: nextCursor,
      }), signal, assertCurrent);
      expect(api.get).toHaveBeenLastCalledWith(`/api/tenant/core/v1/templates/${templateId}/versions/${versionId}`,
        expect.objectContaining({ signal, assertCurrent }));
      expect(page.nextCursor).toBe(nextCursor);
      expect(page.items).toMatchObject([{
        templateId, templateVersionId: versionId, version: 2, layoutMode, locale, name: "Quotation from Core",
        detail: { code: "SALES-001", scope: { type: "COMPANY", companyId } },
      }]);
    },
  );

  it("excludes company definitions outside the quotation company before reading versions", async () => {
    seed("FLOW_DOCUMENT", "en-US", { type: "COMPANY", companyId: otherCompanyId });
    await expect(fetchQuotationTemplates(companyId, branchId, "en-US", "")).resolves.toEqual({ items: [], nextCursor });
    expect(api.get).toHaveBeenCalledTimes(1);
  });

  it("omits a version that became inaccessible after the list read", async () => {
    seed("FLOW_DOCUMENT", "en-US");
    api.get.mockRejectedValueOnce(new TenantApiClientError("Not found", {
      status: 404, statusText: "Not found", headers: new Headers(), data: { errorCode: "CORE.TEMPLATE.NOT_FOUND" },
    }));
    await expect(fetchQuotationTemplates(companyId, branchId, "en-US", "")).resolves.toEqual({ items: [], nextCursor });
  });

  it("propagates an authoritative library refusal", async () => {
    seed("FLOW_DOCUMENT", "en-US");
    const error = new TenantApiClientError("Forbidden", {
      status: 403, statusText: "Forbidden", headers: new Headers(), data: { errorCode: "FORBIDDEN" },
    });
    api.get.mockRejectedValueOnce(error);
    await expect(fetchQuotationTemplates(companyId, branchId, "en-US", "")).rejects.toBe(error);
  });

  it.each([
    { lifecycleStatus: "RETIRED" },
    { rendererTargets: ["HTML"] },
  ])("excludes versions outside Trade's PDF eligibility %o", async (change) => {
    const { version } = seed("FIXED_CANVAS", "en-US");
    returnVersion({ ...version, ...change });
    await expect(fetchQuotationTemplates(companyId, branchId, "en-US", "")).resolves.toEqual({ items: [], nextCursor });
  });

  it("excludes Fixed Canvas versions with explicit pages that Trade cannot render", async () => {
    const { version } = seed("FIXED_CANVAS", "en-US");
    returnVersion({ ...version, editorDocument: { ...version.editorDocument, canvasPages: [{ id: "page" }] } });
    await expect(fetchQuotationTemplates(companyId, branchId, "en-US", "")).resolves.toEqual({ items: [], nextCursor });
  });

  it.each([
    { templateDefinitionId: otherCompanyId },
    { templateVersionId: newerVersionId },
    { locale: "ar-EG" },
  ])("rejects a substituted version receipt %o", async (change) => {
    const { version } = seed("HYBRID_DOCUMENT", "en-US");
    returnVersion({ ...version, ...change });
    await expect(fetchQuotationTemplates(companyId, branchId, "en-US", "")).rejects.toThrow();
  });

  it("previews the selected version using the matching Core fixture and rejects unrelated HTML", async () => {
    const { version } = seed("FLOW_DOCUMENT", "ar-EG");
    returnVersion(version);
    const { items: [choice] } = await fetchQuotationTemplates(companyId, branchId, "ar-EG", "");
    api.schema.mockResolvedValue({ syntheticFixtures: [
      { fixtureKey: "english.fixture", locale: "en-US" }, { fixtureKey: "arabic.fixture", locale: "ar-EG" },
    ] });
    const receipt = { templateId, versionId, sourceKind: "VERSION", templateContentChecksum: checksum, versionEvidence: { versionNumber: 2 }, html: "<p>Sample</p>" };
    api.preview.mockResolvedValueOnce(receipt).mockResolvedValueOnce({ ...receipt, versionId: newerVersionId });
    const signal = new AbortController().signal;

    await expect(previewQuotationTemplate(choice, "ar-EG", "Africa/Cairo", signal)).resolves.toBe(receipt.html);
    expect(api.schema).toHaveBeenCalledWith(source, choice.detail.scope, signal);
    expect(api.preview).toHaveBeenCalledWith(templateId, {
      source: { kind: "VERSION", versionId }, fixtureKey: "arabic.fixture", locale: "ar-EG", timeZone: "Africa/Cairo",
    }, signal);
    await expect(previewQuotationTemplate(choice, "ar-EG", "Africa/Cairo")).rejects.toThrow();
  });

  it.each(["aborted request", "retired authority"])("stops before the preview request after %s", async (retirement) => {
    const { version } = seed("FLOW_DOCUMENT", "ar-EG");
    returnVersion(version);
    const { items: [choice] } = await fetchQuotationTemplates(companyId, branchId, "ar-EG", "");
    const schema = Promise.withResolvers<{ syntheticFixtures: { fixtureKey: string; locale: string }[] }>();
    api.schema.mockReturnValueOnce(schema.promise);
    const controller = new AbortController();
    let active = true;
    const assertCurrent = () => { if (!active) throw new DOMException("Authority changed.", "AbortError"); };
    const response = previewQuotationTemplate(choice, "ar-EG", "Africa/Cairo", controller.signal, assertCurrent);
    expect(api.schema).toHaveBeenCalledTimes(1);
    if (retirement === "aborted request") controller.abort();
    else active = false;
    schema.resolve({ syntheticFixtures: [{ fixtureKey: "arabic.fixture", locale: "ar-EG" }] });
    await expect(response).rejects.toMatchObject({ name: "AbortError" });
    expect(api.preview).not.toHaveBeenCalled();
  });
});
