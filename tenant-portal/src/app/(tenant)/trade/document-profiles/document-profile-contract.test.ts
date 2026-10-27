import { describe, expect, it } from "vitest";
import {
  CREATABLE_DOCUMENT_TYPES,
  DOCUMENT_PROFILE_REGISTRIES,
  FILTERABLE_DOCUMENT_TYPES,
  MANDATORY_COMPILED_CASE_CODES,
  SERVER_OWNED_FIELDS,
  buildCreateDocumentProfileRequest,
  buildCreateDocumentProfileVersionRequest,
  buildDefaultVisualProfileConfig,
  buildPublishDocumentProfileVersionRequest,
  documentProfileVersionActionPath,
  documentProfileVersionsPath,
  documentProfilesListPath,
  parseDocumentProfilesResponse,
  serializeVisualProfileContent,
} from "./document-profile-contract";

const VALID_ID = "0195b5d0-1234-7000-8000-000000000001";
const VALID_VERSION_ID = "0195b5d0-1234-7000-8000-000000000002";

describe("document-profile-contract", () => {
  it("exposes the canonical document types, server-owned fields, and 4 compiled cases", () => {
    expect(CREATABLE_DOCUMENT_TYPES).toEqual(["QUOTATION", "SALES_ORDER", "PURCHASE_ORDER"]);
    expect(FILTERABLE_DOCUMENT_TYPES).toEqual([
      "QUOTATION",
      "SALES_ORDER",
      "PURCHASE_ORDER",
      "SALES_RETURN",
      "PURCHASE_RETURN",
      "POS_SALE",
    ]);
    expect(SERVER_OWNED_FIELDS).toEqual(["status", "totals", "version", "audit", "taxes"]);
    expect(MANDATORY_COMPILED_CASE_CODES).toEqual([
      "MINIMAL_VALID",
      "MISSING_REQUIRED_REJECTED",
      "SERVER_OWNED_REJECTED",
      "REGISTRY_COMPATIBLE",
    ]);
  });

  it("builds default visual profile config and serializes schema content with mandatory fields locked", () => {
    for (const docType of CREATABLE_DOCUMENT_TYPES) {
      const config = buildDefaultVisualProfileConfig(docType);
      const reg = DOCUMENT_PROFILE_REGISTRIES[docType];
      expect(config.fields.length).toBe(reg.headerFields.length + reg.lineFields.length);
      expect(config.components.length).toBe(reg.components.length);
      expect(config.evidence.length).toBe(reg.evidence.length);

      const serialized = JSON.parse(serializeVisualProfileContent(config)) as {
        fields: Array<{ code: string; required: boolean; visible: boolean }>;
      };
      for (const mandatoryCode of [...reg.mandatoryHeaderFields, ...reg.mandatoryLineFields]) {
        const field = serialized.fields.find((f) => f.code === mandatoryCode);
        expect(field?.required).toBe(true);
        expect(field?.visible).toBe(true);
      }
    }
  });

  it("constructs canonical document profile list and action paths", () => {
    expect(documentProfilesListPath(1, "SALES_ORDER", "PUBLISHED")).toBe(
      "/api/tenant/trade/v1/document-profiles?page=1&limit=25&documentType=SALES_ORDER&versionStatus=PUBLISHED",
    );
    expect(documentProfileVersionsPath(VALID_ID)).toBe(
      `/api/tenant/trade/v1/document-profiles/${VALID_ID}/versions`,
    );
    expect(documentProfileVersionActionPath(VALID_VERSION_ID, "validate")).toBe(
      `/api/tenant/trade/v1/document-profile-versions/${VALID_VERSION_ID}/validate`,
    );
    expect(documentProfileVersionActionPath(VALID_VERSION_ID, "publish")).toBe(
      `/api/tenant/trade/v1/document-profile-versions/${VALID_VERSION_ID}/publish`,
    );
  });

  it("validates and builds create profile, create version, and dual-lock publish requests", () => {
    expect(
      buildCreateDocumentProfileRequest({
        code: " so-standard-v1 ",
        documentType: "SALES_ORDER",
        scopeTarget: "COMPANY",
      }),
    ).toEqual({
      code: "SO-STANDARD-V1",
      documentType: "SALES_ORDER",
      scopeTarget: "COMPANY",
    });

    const versionReq = buildCreateDocumentProfileVersionRequest({
      content: JSON.stringify({ fields: [{ code: "partyId", required: true, visible: true }] }),
      requiredCases: JSON.stringify([{ name: "case-1", expectedValid: true }]),
      effectiveFrom: "2026-04-01T00:00:00.000Z",
      effectiveTo: "2026-12-31T23:59:59.000Z",
      restoredFromVersionId: VALID_VERSION_ID,
      restorationReason: "Restore prior schema baseline",
    });
    expect(versionReq.restoredFromVersionId).toBe(VALID_VERSION_ID);
    expect(versionReq.restorationReason).toBe("Restore prior schema baseline");
    expect(versionReq.requiredCases).toHaveLength(1);

    expect(buildPublishDocumentProfileVersionRequest("3")).toEqual({
      expectedActivePointerVersion: 3,
    });
    expect(() => buildPublishDocumentProfileVersionRequest("-1")).toThrow(
      "DOCUMENT_PROFILE_FORM_POINTER",
    );
  });

  it("parses document profile list responses with pointerVersion and version provenance", () => {
    const parsed = parseDocumentProfilesResponse({
      items: [
        {
          id: VALID_ID,
          code: "SO-ENT-PROFILE",
          documentType: "SALES_ORDER",
          scopeTarget: "COMPANY",
          version: 2,
          currentPublishedVersionId: VALID_VERSION_ID,
          pointerVersion: 4,
          versions: [
            {
              id: VALID_VERSION_ID,
              profileVersion: 1,
              status: "PUBLISHED",
              checksum: "sha256:abc123",
              effectiveFrom: "2026-01-01T00:00:00.000Z",
              effectiveTo: null,
              version: 3,
              content: { fields: [{ code: "partyId", required: true, visible: true }] },
              authorUserId: VALID_ID,
              publishedByUserId: VALID_ID,
              restoredFromVersionId: VALID_ID,
              restorationReason: "Verified restoration",
              publishedAt: "2026-01-02T00:00:00.000Z",
            },
          ],
        },
      ],
      total: 1,
      page: 1,
      limit: 25,
    });

    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0]?.pointerVersion).toBe(4);
    expect(parsed.items[0]?.currentPublishedVersionId).toBe(VALID_VERSION_ID);
    expect(parsed.items[0]?.versions[0]?.restorationReason).toBe("Verified restoration");
  });
});
