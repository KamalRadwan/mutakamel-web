// @vitest-environment jsdom
import { normalizeTemplateDocument, validateTemplateDocument } from "@mutakamel/template-schema";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchTemplateDraft } from "@/app/(tenant)/core/templates/template-design-api";
import { fetchTemplate, updateTemplate } from "@/app/(tenant)/core/templates/templates-api";

const transport = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn() }));
vi.mock("@/lib/api/axiosClient", () => ({ axiosClient: transport }));

const templateId = "01890000-0000-7000-8000-000000000001";
const draftId = "01890000-0000-7000-8000-000000000002";
const otherId = "01890000-0000-7000-8000-000000000003";
const versionId = "01890000-0000-7000-8000-000000000004";
const validationRunId = "01890000-0000-7000-8000-000000000005";
const nodeId = "01890000-0000-7000-8000-000000000006";
const endpoint = "/api/tenant/core/v1/templates/" + templateId;
const timestamp = "2026-11-09T12:00:00.000Z";
const tuple = {
  documentType: "QUOTATION",
  outputChannel: "PRINT",
  layoutMode: "HYBRID_DOCUMENT",
  dataSourceKey: "TRADE_QUOTATION_PRINT_V1",
  locale: "en-US",
} as const;

function documentFor(direction: "LTR" | "RTL", textNodeCount = 0) {
  const input = normalizeTemplateDocument({
    ...tuple,
    schemaVersion: 1,
    direction,
    page: {
      unit: "MM", preset: "A4", widthMm: 210, heightMm: 297, orientation: "PORTRAIT",
      marginMm: { top: 10, end: 10, bottom: 10, start: 10 },
    },
    theme: {
      fontFamilyToken: "SYSTEM_SANS", baseFontSizePx: 16, textColor: "#111827",
      accentColor: "#2563EB", surfaceColor: "#FFFFFF", lineHeight: 1.5,
    },
    rootNodeIds: [nodeId],
    nodes: {
      [nodeId]: {
        id: nodeId, type: "container", parentId: null, childIds: [], locked: false, hidden: false,
        layout: { kind: "FLOW", order: 0, keepTogether: false, breakBefore: false, breakAfter: false },
        style: {},
        props: { semanticRole: "BODY" },
      },
    },
  });
  for (let index = 0; index < textNodeCount; index++) {
    const childId = `01890000-0000-7000-9000-${(index + 100).toString(16).padStart(12, "0")}`;
    input.nodes[nodeId].childIds.push(childId);
    input.nodes[childId] = {
      id: childId, type: "text", parentId: nodeId, childIds: [], locked: false, hidden: false,
      layout: { kind: "FLOW", order: index, keepTogether: false, breakBefore: false, breakAfter: false },
      style: {}, props: { text: "x".repeat(8_100) },
    };
  }
  const result = validateTemplateDocument(input);
  if (!result.valid || !result.document || !result.contentChecksum) throw new Error("Invalid test document");
  return { editorDocument: result.document, contentChecksum: result.contentChecksum };
}

function draftFor(direction: "LTR" | "RTL", textNodeCount?: number) {
  const changed = direction === "RTL";
  return {
    templateId, draftId, schemaVersion: 1,
    revision: changed ? 8 : 7, etag: changed ? '"8"' : '"7"',
    ...documentFor(direction, textNodeCount),
    baseVersionId: versionId, restoreSourceVersionId: null,
    validation: {
      state: changed ? "STALE" : "PASSED",
      lastValidationRunId: changed ? null : validationRunId,
      validatedDraftRevision: changed ? null : 7,
      errorCount: 0, warningCount: 0,
    },
    updatedAt: timestamp, updatedBy: { kind: "USER", actorId: otherId, displayName: "User" },
  };
}

function definitionFor(revision: 12 | 13, draft: ReturnType<typeof draftFor>) {
  return {
    templateId, code: "QUOTATION_TEST", name: "Original name", description: "Original description",
    ...tuple,
    direction: draft.editorDocument.direction,
    lifecycleStatus: "ACTIVE", scope: { type: "TENANT" }, systemProtected: false,
    revision, etag: revision === 12 ? '"12"' : '"13"',
    currentDraft: {
      draftId, revision: draft.revision, etag: draft.etag,
      contentChecksum: draft.contentChecksum, validationState: draft.validation.state,
    },
    currentPublishedVersion: { templateVersionId: versionId, versionNumber: 2, publishedAt: timestamp },
    createdAt: timestamp, updatedAt: timestamp,
  };
}

function response(data: unknown, etag: string | null, status = 200) {
  return {
    data: { success: true, data, correlationId: "inert-update-test" },
    headers: new Headers(etag === null ? {} : { ETag: etag }),
    status,
  };
}

const metadataPatch = { name: "Updated name", description: null };
const directionPatch = { direction: "RTL", expectedDraftRevision: 7 };
const previousEtag = '"12"';
const invalidResponse = "Invalid Core identity response.";

function metadataReceipt() {
  const savedDraft = draftFor("LTR");
  const definition = { ...definitionFor(13, savedDraft), ...metadataPatch };
  return { definition, draft: null };
}

function directionReceipt(textNodeCount?: number) {
  const draft = draftFor("RTL", textNodeCount);
  return { definition: definitionFor(13, draft), draft };
}

describe("Core template definition PATCH", () => {
  beforeEach(() => vi.resetAllMocks());

  it("reads native metadata receipts and preserves the draft and validation", async () => {
    const beforeDraft = draftFor("LTR");
    const beforeDefinition = definitionFor(12, beforeDraft);
    const receipt = metadataReceipt();
    transport.get
      .mockResolvedValueOnce(response(beforeDefinition, beforeDefinition.etag))
      .mockResolvedValueOnce(response(beforeDraft, beforeDraft.etag))
      .mockResolvedValueOnce(response(receipt.definition, receipt.definition.etag))
      .mockResolvedValueOnce(response(beforeDraft, beforeDraft.etag));
    transport.patch.mockResolvedValueOnce(response(receipt, receipt.definition.etag));

    const before = await fetchTemplate(templateId);
    const originalDocument = await fetchTemplateDraft(templateId);
    const saved = await updateTemplate(templateId, metadataPatch, before.etag);
    expect(transport.patch).toHaveBeenCalledExactlyOnceWith(endpoint, metadataPatch, {
      cache: "no-store", headers: { "If-Match": previousEtag }, maxResponseBytes: 400_000,
    });
    expect(saved).toMatchObject({
      id: templateId, name: metadataPatch.name, description: null, direction: "LTR",
      definitionRevision: 13, etag: '"13"', definitionEtag: '"13"',
      currentDraft: { draftId, revision: 7, etag: '"7"', validationState: "PASSED" },
    });
    expect(saved.currentDraft).toEqual(before.currentDraft);
    expect(saved.currentPublishedVersion).toEqual(before.currentPublishedVersion);
    expect(await fetchTemplate(templateId)).toEqual(saved);
    expect(await fetchTemplateDraft(templateId)).toEqual(originalDocument);
    expect(beforeDraft.validation).toMatchObject({ lastValidationRunId: validationRunId, validatedDraftRevision: 7 });
  });

  it("accepts the authoritative draft summary when metadata and draft revisions advance independently", async () => {
    const draft = draftFor("LTR");
    const currentDraft = {
      ...draft, revision: 9, etag: '"9"',
      validation: { ...draft.validation, validatedDraftRevision: 9 },
    };
    const definition = { ...definitionFor(13, currentDraft), ...metadataPatch };
    transport.patch.mockResolvedValueOnce(response({ definition, draft: null }, null));
    await expect(updateTemplate(templateId, metadataPatch, previousEtag)).resolves.toMatchObject({
      etag: '"13"', currentDraft: { draftId, revision: 9, etag: '"9"' },
    });
  });

  it("checks submitted metadata after Core's Unicode and whitespace normalization", async () => {
    const receipt = metadataReceipt();
    const body = { name: "  Cafe\u0301 ", description: "  Resume\u0301 " };
    const definition = { ...receipt.definition, name: "Café", description: "Resumé" };
    transport.patch.mockResolvedValueOnce(response({ ...receipt, definition }, definition.etag));
    await expect(updateTemplate(templateId, body, previousEtag)).resolves.toMatchObject({
      name: "Café", description: "Resumé",
    });
    expect(transport.patch.mock.calls[0]?.[1]).toEqual(body);
  });

  it("accepts an explicit null receipt for a blank description", async () => {
    const receipt = metadataReceipt();
    transport.patch.mockResolvedValueOnce(response(receipt, receipt.definition.etag));
    await expect(updateTemplate(templateId, { description: "   " }, previousEtag))
      .resolves.toMatchObject({ description: null });
  });

  it("requires the explicit null description in a clear receipt", async () => {
    const receipt = metadataReceipt();
    const definition: Record<string, unknown> = { ...receipt.definition };
    delete definition.description;
    transport.patch.mockResolvedValueOnce(response({ ...receipt, definition }, receipt.definition.etag));
    await expect(updateTemplate(templateId, metadataPatch, previousEtag)).rejects.toThrow(invalidResponse);
  });

  it("rejects an error code on an otherwise successful envelope", async () => {
    const receipt = metadataReceipt();
    const wrapped = response(receipt, receipt.definition.etag);
    transport.patch.mockResolvedValueOnce({
      ...wrapped, data: { ...wrapped.data, errorCode: "INERT_CONTRADICTION" },
    });
    await expect(updateTemplate(templateId, metadataPatch, previousEtag)).rejects.toThrow(invalidResponse);
  });

  it("reads a genuine direction revision and reconciles it with definition and draft GETs", async () => {
    const beforeDraft = draftFor("LTR");
    const beforeDefinition = definitionFor(12, beforeDraft);
    const receipt = directionReceipt();
    transport.get
      .mockResolvedValueOnce(response(beforeDefinition, beforeDefinition.etag))
      .mockResolvedValueOnce(response(receipt.definition, receipt.definition.etag))
      .mockResolvedValueOnce(response(receipt.draft, receipt.draft.etag));
    transport.patch.mockResolvedValueOnce(response(receipt, receipt.definition.etag));

    const before = await fetchTemplate(templateId);
    const saved = await updateTemplate(templateId, directionPatch, before.etag);
    expect(transport.patch).toHaveBeenCalledExactlyOnceWith(endpoint, directionPatch, {
      cache: "no-store", headers: { "If-Match": previousEtag }, maxResponseBytes: 3_000_000,
    });
    expect(saved).toMatchObject({
      id: templateId, direction: "RTL", definitionRevision: 13, etag: '"13"',
      currentDraft: {
        draftId, revision: 8, etag: '"8"', validationState: "STALE",
        contentChecksum: receipt.draft.contentChecksum,
      },
    });
    expect(saved.currentDraft.contentChecksum).not.toBe(before.currentDraft.contentChecksum);
    expect(saved.currentPublishedVersion).toEqual(before.currentPublishedVersion);
    expect(await fetchTemplate(templateId)).toEqual(saved);
    expect(await fetchTemplateDraft(templateId)).toEqual({
      templateId, draftId, revision: 8, etag: '"8"', editorDocument: receipt.draft.editorDocument,
    });
    expect(receipt.draft.editorDocument).toEqual({ ...beforeDraft.editorDocument, direction: "RTL" });
    expect(receipt.draft.validation).toMatchObject({
      state: "STALE", lastValidationRunId: null, validatedDraftRevision: null,
    });
  });

  it("accepts a direction receipt above the metadata limit through the tenant transport", async () => {
    const receipt = directionReceipt(50);
    const body = JSON.stringify(response(receipt, receipt.definition.etag).data);
    expect(new TextEncoder().encode(body).byteLength).toBeGreaterThan(400_000);

    const { axiosClient } = await vi.importActual<typeof import("@/lib/api/axiosClient")>("@/lib/api/axiosClient");
    transport.patch.mockImplementationOnce(axiosClient.patch);
    sessionStorage.setItem("tenant_session_meta", JSON.stringify({
      sessionId: "template-direction-test-session", savedAt: Date.now(),
      expiresIn: 300, sessionExpiresIn: 300, tokenType: "Bearer", remember: false,
      authorizationVersion: 1, profileVersion: 1, authEventId: "template-direction-test-event",
    }));
    const fetch = vi.fn().mockResolvedValue(new Response(body, {
      status: 200, headers: { "Content-Type": "application/json", ETag: receipt.definition.etag },
    }));
    vi.stubGlobal("fetch", fetch);
    try {
      await expect(updateTemplate(templateId, directionPatch, previousEtag)).resolves.toMatchObject({
        direction: "RTL", definitionRevision: 13, etag: '"13"',
        currentDraft: { revision: 8, etag: '"8"', contentChecksum: receipt.draft.contentChecksum },
      });
      expect(fetch).toHaveBeenCalledExactlyOnceWith(endpoint, expect.objectContaining({ method: "PATCH" }));
    } finally {
      vi.unstubAllGlobals();
      sessionStorage.removeItem("tenant_session_meta");
    }
  });

  it.each([
    ["flat definition", () => metadataReceipt().definition],
    ["extra envelope", () => ({ data: metadataReceipt() })],
    ["omitted draft field", () => ({ definition: metadataReceipt().definition })],
    ["malformed definition", () => ({ definition: [], draft: null })],
    ["different definition", () => ({ ...metadataReceipt(), definition: { ...metadataReceipt().definition, templateId: otherId } })],
    ["unexpected non-null metadata draft", () => ({ ...metadataReceipt(), draft: draftFor("LTR") })],
    ["skipped definition revision", () => ({ ...metadataReceipt(), definition: { ...metadataReceipt().definition, revision: 14, etag: '"14"' } })],
  ])("rejects %s", async (_label, payload) => {
    transport.patch.mockResolvedValueOnce(response(payload(), null));
    await expect(updateTemplate(templateId, metadataPatch, previousEtag)).rejects.toThrow(invalidResponse);
  });

  it.each([
    ["missing direction draft", () => null],
    ["cross-definition draft", (draft) => ({ ...draft, templateId: otherId })],
    ["different draft ID", (draft) => ({ ...draft, draftId: otherId })],
    ["different draft revision", (draft) => ({ ...draft, revision: 9 })],
    ["different draft ETag", (draft) => ({ ...draft, etag: '"9"' })],
    ["different draft checksum", (draft) => ({ ...draft, contentChecksum: "0".repeat(64) })],
    ["missing editor document", (draft) => ({ ...draft, editorDocument: null })],
    ["wrong document source", (draft) => ({ ...draft, editorDocument: { ...draft.editorDocument, dataSourceKey: "OTHER" } })],
    ["wrong editor direction", (draft) => ({ ...draft, editorDocument: { ...draft.editorDocument, direction: "LTR" } })],
    ["retained validation pin", (draft) => ({ ...draft, validation: { ...draft.validation, lastValidationRunId: validationRunId } })],
  ] satisfies [string, (draft: ReturnType<typeof draftFor>) => unknown][])("rejects %s", async (_label, mutate) => {
    const receipt = directionReceipt();
    transport.patch.mockResolvedValueOnce(response({ ...receipt, draft: mutate(receipt.draft) }, receipt.definition.etag));
    await expect(updateTemplate(templateId, directionPatch, previousEtag)).rejects.toThrow(invalidResponse);
  });

  it("rejects a coherent draft that did not advance from the supplied revision", async () => {
    const receipt = directionReceipt();
    transport.patch.mockResolvedValueOnce(response(receipt, receipt.definition.etag));
    await expect(updateTemplate(templateId, { ...directionPatch, expectedDraftRevision: 6 }, previousEtag))
      .rejects.toThrow(invalidResponse);
  });

  it.each([[201, '"13"'], [200, '"14"']])("rejects HTTP status %s with ETag %s when inconsistent", async (status, etag) => {
    transport.patch.mockResolvedValueOnce(response(metadataReceipt(), etag, status));
    await expect(updateTemplate(templateId, metadataPatch, previousEtag)).rejects.toThrow(invalidResponse);
  });
});

describe("independent receipt rejection controls", () => {
  beforeEach(() => vi.resetAllMocks());

  it("rejects a contradictory HTTP 200 failure envelope that carries otherwise valid data", async () => {
    const receipt = metadataReceipt();
    transport.patch.mockResolvedValueOnce({
      ...response(receipt, receipt.definition.etag),
      data: { success: false, errorCode: "INERT_FAILURE_CONTROL", data: receipt },
    });
    await expect(updateTemplate(templateId, metadataPatch, previousEtag)).rejects.toThrow(invalidResponse);
  });

  it("rejects an unwrapped nested object on the enveloped Core PATCH route", async () => {
    const receipt = metadataReceipt();
    transport.patch.mockResolvedValueOnce({ ...response(receipt, receipt.definition.etag), data: receipt });
    await expect(updateTemplate(templateId, metadataPatch, previousEtag)).rejects.toThrow(invalidResponse);
  });

  it("rejects an acknowledged name that disagrees with the submitted metadata", async () => {
    const receipt = metadataReceipt();
    receipt.definition.name = "Different name";
    transport.patch.mockResolvedValueOnce(response(receipt, receipt.definition.etag));
    await expect(updateTemplate(templateId, metadataPatch, previousEtag)).rejects.toThrow(invalidResponse);
  });

  it("rejects an acknowledged description that disagrees with an explicit clear", async () => {
    const receipt = metadataReceipt();
    const changed = { ...receipt, definition: { ...receipt.definition, description: "Still present" } };
    transport.patch.mockResolvedValueOnce(response(changed, receipt.definition.etag));
    await expect(updateTemplate(templateId, metadataPatch, previousEtag)).rejects.toThrow(invalidResponse);
  });

  it("rejects a malformed metadata draft summary instead of falling back to NOT_VALIDATED", async () => {
    const receipt = metadataReceipt();
    const changed = { ...receipt, definition: {
      ...receipt.definition, currentDraft: { ...receipt.definition.currentDraft, validationState: "UNRECOGNIZED" },
    } };
    transport.patch.mockResolvedValueOnce(response(changed, receipt.definition.etag));
    await expect(updateTemplate(templateId, metadataPatch, previousEtag)).rejects.toThrow(invalidResponse);
  });

  it("rejects a direction receipt whose document would fail the ordinary draft GET parser", async () => {
    const receipt = directionReceipt();
    const { schemaVersion, direction, locale, documentType, outputChannel, layoutMode, dataSourceKey } = receipt.draft.editorDocument;
    const invalidDraft = { ...receipt.draft, editorDocument: {
      schemaVersion, direction, locale, documentType, outputChannel, layoutMode, dataSourceKey,
    } };
    transport.get.mockResolvedValueOnce(response(invalidDraft, invalidDraft.etag));
    await expect(fetchTemplateDraft(templateId)).rejects.toThrow(invalidResponse);
    transport.patch.mockResolvedValueOnce(response({ ...receipt, draft: invalidDraft }, receipt.definition.etag));
    await expect(updateTemplate(templateId, directionPatch, previousEtag)).rejects.toThrow(invalidResponse);
  });
});
