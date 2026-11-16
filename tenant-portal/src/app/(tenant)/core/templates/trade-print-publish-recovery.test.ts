import { createHash } from "node:crypto";
import { canonicalJson } from "@mutakamel/template-schema/browser-safe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchTemplateVersion, publishTemplate } from "./template-lifecycle-api";
import { parseTemplateVersion } from "./template-lifecycle-contract";

const transport = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn() }));
vi.mock("../core-api", () => ({
  corePost: transport.post,
  corePostResponse: transport.post,
  coreGetResponse: transport.get,
}));

const companyId = "0195f4d8-7e3a-7b20-8f59-44d76de18601";
const priorVersionId = "0195f4d8-7e3a-7b20-8f59-44d76de18602";
const validationRunId = "0195f4d8-7e3a-7b20-8f59-44d76de18603";
const body = { definitionRevision: 3, draftRevision: 8, validationRunId, setAsDefinitionPublished: true as const };
const scope = { headers: { "x-mutakamel-company-id": companyId }, locale: "ar-EG" };
const families = [
  ["SALES_ORDER", "TRADE_SALES_ORDER_PRINT_V1", "0195f4d8-7e3a-7b20-8f59-44d76de18611", "0195f4d8-7e3a-7b20-8f59-44d76de18612"],
  ["INVOICE", "TRADE_INVOICE_PRINT_V1", "0195f4d8-7e3a-7b20-8f59-44d76de18621", "0195f4d8-7e3a-7b20-8f59-44d76de18622"],
  ["CONTRACT", "TRADE_CONTRACT_PRINT_V1", "0195f4d8-7e3a-7b20-8f59-44d76de18631", "0195f4d8-7e3a-7b20-8f59-44d76de18632"],
] as const;

beforeEach(() => { vi.resetAllMocks(); });

describe.each(families)("%s publish recovery", (documentType, dataSourceKey, definitionId, versionId) => {
  const path = `/api/tenant/core/v1/templates/${definitionId}`;
  const location = `${path}/versions/${versionId}`;
  const submit = () => publishTemplate(definitionId, body, '"8"', {
    scope, dataSourceKey, currentVersionId: priorVersionId, assertCurrent: vi.fn(),
  });

  function persistedVersion(outputChannel: "PRINT" | "EMAIL" = "PRINT", immutableVersionId: string = versionId) {
    const layoutMode = outputChannel === "PRINT" ? "FLOW_DOCUMENT" : "EMAIL_FLOW";
    const editorDocument = {
      schemaVersion: 1, documentType, dataSourceKey, outputChannel, layoutMode,
      locale: scope.locale, direction: "RTL",
    };
    return {
      templateDefinitionId: definitionId, templateVersionId: immutableVersionId, versionNumber: 2,
      lifecycleStatus: "PUBLISHED", publishedAt: "2026-11-15T00:00:00.000Z", retiredAt: null,
      changeNote: null, documentType, dataSourceKey, outputChannel, layoutMode, locale: scope.locale,
      editorDocument, editorSchemaVersion: 1,
      templateContentChecksum: createHash("sha256").update(canonicalJson(editorDocument)).digest("hex"),
      validationRunId, compilerVersion: "template-engine-0.10.0",
      rendererTargets: outputChannel === "PRINT" ? ["HTML", "PDF"] : ["EMAIL_HTML", "EMAIL_TEXT"],
    };
  }

  function acknowledgement(version: ReturnType<typeof persistedVersion>, versionLocation = location) {
    return {
      status: 201,
      headers: new Headers({ location: versionLocation, "Idempotency-Replayed": "true" }),
      data: { success: true, data: { version, definitionRevision: 4, definitionEtag: '"4"',
        consumedDraftRevision: 8, draftEtag: '"9"' } },
    };
  }

  it("admits the replay acknowledgement and reads the same immutable identity in the Company", async () => {
    const version = persistedVersion();
    transport.post.mockResolvedValueOnce(acknowledgement(version));
    transport.get.mockResolvedValueOnce({ status: 200, data: { success: true, data: structuredClone(version) } });

    await expect(submit()).resolves.toBeUndefined();
    expect(transport.post).toHaveBeenCalledExactlyOnceWith(`${path}/publish`, body, expect.objectContaining({
      headers: { ...scope.headers, "If-Match": '"8"' }, requireExactResponseTarget: true,
    }));
    await expect(fetchTemplateVersion(definitionId, versionId, undefined, { selected: parseTemplateVersion(version), scope }))
      .resolves.toMatchObject({ id: versionId, versionNumber: 2, validationRunId,
        dataSourceKey, templateContentChecksum: version.templateContentChecksum });
    expect(transport.get).toHaveBeenCalledExactlyOnceWith(location, expect.objectContaining({
      headers: scope.headers, requireExactResponseTarget: true,
    }));
  });

  it("rejects an alternate output channel even with matching IDs and Location", async () => {
    transport.post.mockResolvedValueOnce(acknowledgement(persistedVersion("EMAIL")));
    await expect(submit()).rejects.toThrow("Invalid Core identity response.");
  });

  it("rejects a replay that names the previous immutable version", async () => {
    transport.post.mockResolvedValueOnce(acknowledgement(
      persistedVersion("PRINT", priorVersionId), `${path}/versions/${priorVersionId}`,
    ));
    await expect(submit()).rejects.toThrow("Invalid Core identity response.");
  });
});
