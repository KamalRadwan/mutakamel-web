import { describe, expect, it } from "vitest";
import {
  EXTENSION_FIELDS_MAX,
  EXTENSION_PROFILES_PATH,
  EXTENSION_SCOPE_TARGETS,
  EXTENSION_VERSION_STATUSES,
  EMPTY_EXTENSION_FIELD_DRAFT,
  buildCreateExtensionProfileRequest,
  buildUpdateExtensionProfileRequest,
  extensionMessage,
  extensionProfileActionPath,
  extensionProfileVersionsPath,
  extensionProfilesListPath,
  parseExtensionProfileDetail,
  parseExtensionTargets,
  toFieldDrafts,
} from "./extension-contract";
import { ar } from "@/i18n/dictionaries/ar";
import {
  buildCreateDocumentProfileRequest,
  buildCreateDocumentProfileVersionRequest,
  buildPublishDocumentProfileVersionRequest,
  CREATABLE_DOCUMENT_TYPES,
  documentProfileVersionActionPath,
  documentProfileVersionsPath,
  FILTERABLE_DOCUMENT_TYPES,
  parseDocumentProfilesResponse,
} from "../document-profiles/document-profile-contract";

const profileId = "01902001-3000-7000-8000-000000000001";
const versionId = "01902001-3000-7000-8000-000000000002";
const fieldId = "01902001-3000-7000-8000-000000000003";

describe("Trade extension profiles contract", () => {
  it("builds canonical paths", () => {
    expect(extensionProfilesListPath(1, "CATALOG_ITEM", "ACTIVE")).toBe(
      `${EXTENSION_PROFILES_PATH}?page=1&limit=25&targetCode=CATALOG_ITEM&status=ACTIVE`,
    );
    expect(extensionProfileActionPath(profileId, "validate")).toBe(
      `${EXTENSION_PROFILES_PATH}/${profileId}/validate`,
    );
    expect(extensionProfileVersionsPath(profileId, 2)).toBe(
      `${EXTENSION_PROFILES_PATH}/${profileId}/versions?page=2&limit=25`,
    );
  });

  it("cannot scope an extension profile to a branch", () => {
    expect(EXTENSION_SCOPE_TARGETS).toEqual(["TENANT", "COMPANY"]);
  });

  it("filters versions on a five-value subset of the seven-state ladder", () => {
    expect(EXTENSION_VERSION_STATUSES).toHaveLength(5);
    expect(EXTENSION_VERSION_STATUSES).not.toContain("APPROVAL_PENDING");
    expect(EXTENSION_VERSION_STATUSES).not.toContain("SCHEDULED");
  });

  it("sends the whole field set on an update, because there is no partial", () => {
    const fields = [
      { ...EMPTY_EXTENSION_FIELD_DRAFT, fieldKey: "warranty", decimalScale: "2" },
    ];
    expect(buildUpdateExtensionProfileRequest(fields)).toEqual({
      fields: [
        {
          fieldKey: "warranty",
          valueKind: "SCALAR",
          visibilityCode: "INTERNAL",
          isRequired: false,
          isSearchable: false,
          defaultStrategy: "NONE",
          scalarType: "STRING",
          decimalScale: 2,
        },
      ],
    });
    expect(() => buildUpdateExtensionProfileRequest([])).toThrow("EXTENSION_FORM_FIELDS");
  });

  it("bounds decimalScale at eight places", () => {
    expect(() =>
      buildUpdateExtensionProfileRequest([
        { ...EMPTY_EXTENSION_FIELD_DRAFT, fieldKey: "x", decimalScale: "9" },
      ]),
    ).toThrow("EXTENSION_FORM_BOUNDS");
    expect(EXTENSION_FIELDS_MAX).toBe(100);
  });

  it("creates a profile with an uppercase code", () => {
    expect(
      buildCreateExtensionProfileRequest({
        code: "item.extras",
        targetCode: "CATALOG_ITEM",
        scopeTarget: "COMPANY",
        fields: [{ ...EMPTY_EXTENSION_FIELD_DRAFT, fieldKey: "warranty" }],
      }).code,
    ).toBe("ITEM.EXTRAS");
  });

  it("separates the three failures that share DEFINITION_INVALID", () => {
    // One code, three statuses: 404, 409 and 422 are distinct outcomes.
    const code = "TRADE.EXTENSION.DEFINITION_INVALID";
    expect(extensionMessage({ status: 404, code }, ar)).toBe(
      ar.tradeAutomation.errorExtensionNotFound,
    );
    expect(extensionMessage({ status: 409, code }, ar)).toBe(
      ar.tradeAutomation.errorExtensionConflict,
    );
    expect(extensionMessage({ status: 422, code }, ar)).toBe(
      ar.tradeAutomation.errorExtensionInvalid,
    );
  });

  it("reads a profile detail with the fields of both versions", () => {
    const detail = parseExtensionProfileDetail({
      id: profileId,
      code: "ITEM_EXTRAS",
      targetCode: "CATALOG_ITEM",
      scopeTarget: "COMPANY",
      status: "ACTIVE",
      version: 3,
      updatedAt: "2026-08-31T00:00:00.000Z",
      currentPublishedVersion: {
        id: versionId,
        versionNumber: 2,
        version: 1,
        status: "PUBLISHED",
        definitionHash: "c".repeat(64),
        publishedAt: "2026-08-30T00:00:00.000Z",
        updatedAt: "2026-08-30T00:00:00.000Z",
        fields: [
          {
            id: fieldId,
            fieldKey: "warranty",
            valueKind: "SCALAR",
            scalarType: "DECIMAL",
            isRequired: true,
            isSearchable: false,
            visibilityCode: "USER",
            maxLength: null,
            maxItems: null,
            decimalScale: 2,
            minimumDecimal: "0",
            maximumDecimal: "99.99",
            defaultStrategy: "NONE",
          },
        ],
      },
      editableDraftVersion: null,
    });
    expect(detail.currentPublishedFields[0].maximumDecimal).toBe("99.99");
    expect(toFieldDrafts(detail.currentPublishedFields)[0].decimalScale).toBe("2");
    expect(detail.draftFields).toEqual([]);
  });

  it("reads the target catalogue with its registry limits", () => {
    expect(
      parseExtensionTargets({
        registryVersion: 3,
        targets: [{ code: "CATALOG_ITEM" }],
        limits: { fieldsPerProfile: 100, valueBytes: 16384 },
      }),
    ).toEqual({
      registryVersion: 3,
      targets: [{ code: "CATALOG_ITEM" }],
      fieldsPerProfile: 100,
      valueBytes: 16384,
    });
  });
});

describe("Trade document profiles contract", () => {
  it("can filter six document types but create only three", () => {
    expect(CREATABLE_DOCUMENT_TYPES).toHaveLength(3);
    expect(FILTERABLE_DOCUMENT_TYPES).toHaveLength(6);
    expect(FILTERABLE_DOCUMENT_TYPES).toContain("POS_SALE");
    expect(CREATABLE_DOCUMENT_TYPES).not.toContain("POS_SALE");
  });

  it("builds the two action paths as full literals", () => {
    expect(documentProfileVersionsPath(profileId)).toBe(
      `/api/tenant/trade/v1/document-profiles/${profileId}/versions`,
    );
    expect(documentProfileVersionActionPath(versionId, "publish")).toBe(
      `/api/tenant/trade/v1/document-profile-versions/${versionId}/publish`,
    );
  });

  it("defaults requiredCases to an empty list, unlike the policy ladder", () => {
    const request = buildCreateDocumentProfileVersionRequest({
      content: '{"sections":[]}',
      requiredCases: "[]",
      effectiveFrom: "2026-09-01T00:00:00.000Z",
      effectiveTo: "",
    });
    expect(request.requiredCases).toEqual([]);
    expect(request).not.toHaveProperty("effectiveTo");
  });

  it("requires the second concurrency token a publish needs", () => {
    // expectedActivePointerVersion rides in the body alongside If-Match; this
    // is the only Trade route that needs two tokens at once.
    expect(buildPublishDocumentProfileVersionRequest("0")).toEqual({
      expectedActivePointerVersion: 0,
    });
    expect(() => buildPublishDocumentProfileVersionRequest("-1")).toThrow(
      "DOCUMENT_PROFILE_FORM_POINTER",
    );
  });

  it("creates a profile with an uppercase governed code", () => {
    expect(
      buildCreateDocumentProfileRequest({
        code: "quote.default",
        documentType: "QUOTATION",
        scopeTarget: "COMPANY",
      }),
    ).toEqual({
      code: "QUOTE.DEFAULT",
      documentType: "QUOTATION",
      scopeTarget: "COMPANY",
    });
  });

  it("reads the list, which is the only read this family has", () => {
    const page = parseDocumentProfilesResponse({
      items: [
        {
          id: profileId,
          code: "QUOTE_DEFAULT",
          documentType: "QUOTATION",
          scopeTarget: "COMPANY",
          version: 2,
          versions: [
            {
              id: versionId,
              profileVersion: 1,
              status: "PUBLISHED",
              checksum: "d".repeat(64),
              effectiveFrom: "2026-09-01T00:00:00.000Z",
              effectiveTo: null,
              version: 1,
            },
          ],
        },
      ],
      total: 1,
      page: 1,
      limit: 25,
    });
    expect(page.items[0].versions[0].profileVersion).toBe(1);
  });
});
