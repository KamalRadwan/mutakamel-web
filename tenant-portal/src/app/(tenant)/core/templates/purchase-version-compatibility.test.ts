import { createHash } from "node:crypto";
import { canonicalJson } from "@mutakamel/template-schema/browser-safe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveOrganizationScope } from "@/lib/api/organization-scope";
import { fetchTemplateVersion, publishTemplate } from "./template-lifecycle-api";
import { parseTemplateVersion } from "./template-lifecycle-contract";

const transport = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("../core-api", () => ({
  coreGet: vi.fn(),
  coreGetResponse: transport.get,
  corePost: transport.post,
  corePostResponse: transport.post,
}));

const COMPANY = "0195f4d8-7e3a-7b20-8f59-44d76de18301";
const OTHER_DEFINITION = "0195f4d8-7e3a-7b20-8f59-44d76de18303";
const OTHER_VERSION = "0195f4d8-7e3a-7b20-8f59-44d76de18305";
const RUN = "0195f4d8-7e3a-7b20-8f59-44d76de18306";
const base = "/api/tenant/core/v1/templates";
const tuples = [
  ["PURCHASE_QUOTATION", "TRADE_PURCHASE_QUOTATION_PRINT_V1",
    "0195f4d8-7e3a-7b20-8f59-44d76de18312", "0195f4d8-7e3a-7b20-8f59-44d76de18314", "0195f4d8-7e3a-7b20-8f59-44d76de18316"],
  ["PURCHASE_ORDER", "TRADE_PURCHASE_ORDER_PRINT_V1",
    "0195f4d8-7e3a-7b20-8f59-44d76de18322", "0195f4d8-7e3a-7b20-8f59-44d76de18324", "0195f4d8-7e3a-7b20-8f59-44d76de18326"],
] as const;

function readScope() {
  const scope = resolveOrganizationScope("OPTIONAL_COMPANY_BRANCH", { companyId: COMPANY, branchId: null });
  if (!scope.ok) throw new Error("Fixture Company scope is invalid.");
  return { headers: scope.headers, locale: "ar-EG" };
}

function versionWire(documentType: string, dataSourceKey: string, definitionId: string, versionId: string) {
  const editorDocument = {
    schemaVersion: 1, locale: "ar-EG", direction: "RTL",
    documentType, dataSourceKey, outputChannel: "PRINT", layoutMode: "FLOW_DOCUMENT",
  };
  return {
    templateDefinitionId: definitionId, templateVersionId: versionId, versionNumber: 1,
    lifecycleStatus: "PUBLISHED", publishedAt: "2026-11-15T00:00:00.000Z",
    retiredAt: null, changeNote: null, locale: "ar-EG", documentType, dataSourceKey,
    outputChannel: "PRINT", layoutMode: "FLOW_DOCUMENT",
    editorSchemaVersion: 1, editorDocument,
    templateContentChecksum: createHash("sha256").update(canonicalJson(editorDocument)).digest("hex"),
    compilerVersion: "template-engine-0.10.0", validationRunId: RUN, rendererTargets: ["HTML", "PDF"],
  };
}

beforeEach(() => { vi.resetAllMocks(); });

describe.each(tuples)("%s company-scoped version compatibility", (documentType, adapterKey, definitionId, versionId, currentVersionId) => {
  const path = `${base}/${definitionId}`;
  const wire = versionWire(documentType, adapterKey, definitionId, versionId);
  const publishBody = {
    definitionRevision: 1, draftRevision: 7, validationRunId: RUN, setAsDefinitionPublished: true as const,
  };
  const publication = () => publishTemplate(definitionId, publishBody, '"7"', {
    scope: readScope(), dataSourceKey: adapterKey, currentVersionId, assertCurrent: vi.fn(),
  });
  const receiptRevisions = { definitionRevision: 2, definitionEtag: '"2"', consumedDraftRevision: 7, draftEtag: '"8"' };
  function respond(version: typeof wire, location: string, revisions: Partial<typeof receiptRevisions> = {}, etag = '"2"') {
    transport.post.mockResolvedValue({
      status: 201,
      headers: new Headers({ location, etag }),
      data: { success: true, data: { version, ...receiptRevisions, ...revisions } },
    });
  }

  it("forwards the exact Company on History GET and rejects a different definition or version", async () => {
    const verification = { selected: parseTemplateVersion(wire), scope: readScope() };
    const response = (data: typeof wire) => ({ status: 200, data: { success: true, data } });
    transport.get.mockResolvedValueOnce(response(wire))
      .mockResolvedValueOnce(response({ ...wire, templateDefinitionId: OTHER_DEFINITION }))
      .mockResolvedValueOnce(response({ ...wire, templateVersionId: OTHER_VERSION }));

    await expect(fetchTemplateVersion(definitionId, versionId, undefined, verification))
      .resolves.toMatchObject({ id: versionId, validationRunId: RUN });
    expect(transport.get).toHaveBeenNthCalledWith(1, `${path}/versions/${versionId}`,
      expect.objectContaining({
        headers: { "x-mutakamel-company-id": COMPANY }, requireExactResponseTarget: true,
      }));
    await expect(fetchTemplateVersion(definitionId, versionId, undefined, verification))
      .rejects.toThrow("Invalid Core identity response.");
    await expect(fetchTemplateVersion(definitionId, versionId, undefined, verification))
      .rejects.toThrow("Invalid Core identity response.");
  });

  it("rejects a 201 acknowledgement for a different definition and immutable version", async () => {
    respond({ ...wire, templateDefinitionId: OTHER_DEFINITION, templateVersionId: OTHER_VERSION },
      `${base}/${OTHER_DEFINITION}/versions/${OTHER_VERSION}`);
    await expect(publication()).rejects.toThrow("Invalid Core identity response.");
  });

  it("rejects the current immutable version even at its exact Location", async () => {
    respond({ ...wire, templateVersionId: currentVersionId }, `${path}/versions/${currentVersionId}`);
    await expect(publication()).rejects.toThrow("Invalid Core identity response.");
  });

  it("rejects a noncanonical Location for an otherwise matching new version", async () => {
    respond(wire, `${path}/versions/${versionId}?extra=true`);
    await expect(publication()).rejects.toThrow("Invalid Core identity response.");
  });

  it.each([
    { name: "older definition revision", revisions: { definitionRevision: 1 } },
    { name: "older definition ETag", revisions: { definitionEtag: '"1"' } },
    { name: "another consumed draft revision", revisions: { consumedDraftRevision: 8 } },
    { name: "unchanged draft ETag", revisions: { draftEtag: '"7"' } },
    { name: "combined response ETags", revisions: {}, etag: '"2", "2"' },
  ])("rejects an otherwise matching 201 with $name", async ({ revisions, etag }) => {
    respond(wire, `${path}/versions/${versionId}`, revisions, etag);
    await expect(publication()).rejects.toThrow("Invalid Core identity response.");
  });

  it("accepts a new version at its exact Location using Company scope", async () => {
    respond(wire, `${path}/versions/${versionId}`);
    await expect(publication()).resolves.toBeUndefined();
    expect(transport.post).toHaveBeenCalledExactlyOnceWith(`${path}/publish`, publishBody, expect.objectContaining({
      headers: { "x-mutakamel-company-id": COMPANY, "If-Match": '"7"' },
      requireExactResponseTarget: true,
      redirect: "error",
    }));
  });
});
