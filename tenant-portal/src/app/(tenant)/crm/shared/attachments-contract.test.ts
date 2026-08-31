import { describe, expect, it } from "vitest";
import {
  CRM_ATTACHMENT_MAX_BYTES,
  CRM_ATTACHMENT_MIME_TYPES,
  CRM_ATTACHMENT_SOURCE_TYPES,
  buildCrmAttachmentsListPath,
  classifyAttachmentUploadFailure,
  crmAttachmentDownloadPath,
  crmAttachmentPath,
  parseCrmAttachment,
  parseCrmAttachmentsPageResponse,
} from "./attachments-contract";

const BRANCH = "01900100-0000-7000-8000-000000000099";
const SOURCE = "01900100-0000-7000-8000-000000000001";
const ATTACHMENT_ID = "01900100-0000-7000-8000-000000000060";

const attachment = {
  id: ATTACHMENT_ID,
  branchId: BRANCH,
  sourceType: "LEAD",
  sourceId: SOURCE,
  fileName: "proposal.pdf",
  mimeType: "application/pdf",
  sizeBytes: 123_456,
  uploadedByUserId: null,
  createdAt: "2026-06-24T15:00:00.000Z",
};

const expected = { branchId: BRANCH, sourceType: "LEAD" as const, sourceId: SOURCE };

describe("CRM attachment limits", () => {
  it("caps a file at 25 MiB, the per-bucket storage cap", () => {
    // MAX_SIZE_BYTES[BUCKETS.ATTACHMENTS] = 25 * 1024 * 1024 in
    // shared-libs/packages/storage/src/constants/buckets.constant.ts.
    // MASTER-PLAN 8.25 says "26 MiB", which is the GATEWAY body ceiling
    // (MAX_ATTACHMENT_BODY_BYTES = 27_262_976) — file plus multipart envelope.
    expect(CRM_ATTACHMENT_MAX_BYTES).toBe(26_214_400);
    expect(CRM_ATTACHMENT_MAX_BYTES).toBeLessThan(27_262_976);
  });

  it("mirrors the bucket MIME allowlist exactly", () => {
    expect([...CRM_ATTACHMENT_MIME_TYPES]).toEqual([
      "image/png",
      "image/jpeg",
      "image/webp",
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/csv",
      "text/plain",
    ]);
    // A near-miss that the server would refuse with 415.
    expect(CRM_ATTACHMENT_MIME_TYPES).not.toContain("application/msword");
  });

  it("accepts NOTE as an attachment source, which the note enum does not", () => {
    expect(CRM_ATTACHMENT_SOURCE_TYPES).toContain("NOTE");
    expect(CRM_ATTACHMENT_SOURCE_TYPES).toHaveLength(6);
  });
});

describe("upload failure classification", () => {
  it("keeps the three outcomes apart", () => {
    expect(
      classifyAttachmentUploadFailure({ status: 400, code: "CRM_ATTACHMENT_FILE_REQUIRED" }),
    ).toBe("missingFile");
    expect(
      classifyAttachmentUploadFailure({ status: 400, code: "CRM_ATTACHMENT_FILE_EMPTY" }),
    ).toBe("missingFile");
    expect(
      classifyAttachmentUploadFailure({
        status: 415,
        code: "CRM_ATTACHMENT_FILE_TYPE_UNSUPPORTED",
      }),
    ).toBe("wrongType");
    expect(
      classifyAttachmentUploadFailure({ status: 413, code: "CRM_ATTACHMENT_FILE_TOO_LARGE" }),
    ).toBe("tooLarge");
  });

  it("classifies the Gateway body ceiling as too large as well", () => {
    expect(
      classifyAttachmentUploadFailure({ status: 413, code: "GW.BODY.TOO_LARGE" }),
    ).toBe("tooLarge");
  });

  it("falls back to status when the code is lost in transit", () => {
    expect(classifyAttachmentUploadFailure({ status: 415 })).toBe("wrongType");
    expect(classifyAttachmentUploadFailure({ status: 413 })).toBe("tooLarge");
    // 400 means more than one thing on this route, so it is deliberately
    // not mapped to a specific sentence.
    expect(classifyAttachmentUploadFailure({ status: 400 })).toBe("other");
    expect(classifyAttachmentUploadFailure({ status: 500 })).toBe("other");
  });
});

describe("CRM attachments contract", () => {
  it("reads an attachment row", () => {
    expect(parseCrmAttachment(attachment)).toEqual({
      ...attachment,
      uploadedByUserId: null,
    });
  });

  it("rejects a size outside the storage cap", () => {
    expect(() => parseCrmAttachment({ ...attachment, sizeBytes: 0 })).toThrow();
    expect(() =>
      parseCrmAttachment({ ...attachment, sizeBytes: CRM_ATTACHMENT_MAX_BYTES + 1 }),
    ).toThrow();
  });

  it("reads the raw page and rejects rows from another record", () => {
    const page = {
      items: [attachment],
      total: 1,
      page: 1,
      limit: 50,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    };
    expect(parseCrmAttachmentsPageResponse(page, expected).items).toHaveLength(1);
    expect(() =>
      parseCrmAttachmentsPageResponse(
        { ...page, items: [{ ...attachment, branchId: SOURCE }] },
        expected,
      ),
    ).toThrow();
  });

  it("builds the list, item and download paths", () => {
    expect(
      buildCrmAttachmentsListPath({
        branchId: BRANCH,
        sourceType: "LEAD",
        sourceId: SOURCE,
        page: 1,
        limit: 50,
      }),
    ).toContain("/api/tenant/crm/v1/attachments?");
    expect(crmAttachmentPath(ATTACHMENT_ID)).toBe(
      `/api/tenant/crm/v1/attachments/${ATTACHMENT_ID}`,
    );
    expect(crmAttachmentDownloadPath(ATTACHMENT_ID)).toBe(
      `/api/tenant/crm/v1/attachments/${ATTACHMENT_ID}/download`,
    );
    expect(() => crmAttachmentPath("../notes")).toThrow();
  });
});
