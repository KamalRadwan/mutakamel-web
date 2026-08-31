import { describe, expect, it } from "vitest";
import {
  TEMPLATES_PATH,
  parseTemplateCursorPage,
  parseTemplateDetail,
  parseTemplateListItem,
  templatePath,
} from "./templates-contract";
import { parsePreviewJob, parseValidationRun } from "./template-lifecycle-contract";
import { parseTemplateAsset } from "./template-assets-contract";
import { parseResolvedAssignment } from "./template-assignments-contract";

const templateId = "01902001-3000-7000-8000-000000000001";
const draftId = "01902001-3000-7000-8000-000000000002";
const versionId = "01902001-3000-7000-8000-000000000003";
const runId = "01902001-3000-7000-8000-000000000004";
const jobId = "01902001-3000-7000-8000-000000000005";
const assetId = "01902001-3000-7000-8000-000000000006";
const assignmentId = "01902001-3000-7000-8000-000000000007";

const listRow = {
  templateId,
  code: "SALES_QUOTATION",
  name: "Sales quotation",
  documentType: "QUOTATION",
  outputChannel: "PRINT",
  layoutMode: "HYBRID_DOCUMENT",
  lifecycleStatus: "ACTIVE",
  locale: "en-US",
  direction: "AUTO",
  draft: { draftId, revision: 7, validationState: "PASSED" },
  currentPublishedVersion: {
    versionId,
    versionNumber: 3,
    status: "PUBLISHED",
    publishedAt: "2026-08-20T09:00:00.000Z",
  },
  definitionRevision: 12,
  definitionEtag: '"12"',
  createdAt: "2026-08-01T09:00:00.000Z",
  updatedAt: "2026-08-30T09:00:00.000Z",
};

describe("Template platform contract", () => {
  it("uses canonical Gateway literals", () => {
    expect(TEMPLATES_PATH).toBe("/api/tenant/core/v1/templates");
    expect(templatePath(templateId)).toBe(`${TEMPLATES_PATH}/${templateId}`);
  });

  it("preserves the cursor byte for byte and never invents a page number", () => {
    const cursor = "eyJpZCI6IjAxOTIifQ==.signature~with.punctuation";
    const page = parseTemplateCursorPage(
      { items: [listRow], totalCount: 40, pageInfo: { limit: 25, hasNextPage: true, nextCursor: cursor } },
      parseTemplateListItem,
    );
    expect(page.nextCursor).toBe(cursor);
    expect(page.hasNextPage).toBe(true);
    expect(page.limit).toBe(25);
    expect(page).not.toHaveProperty("page");
  });

  it("treats a missing next cursor as the end of the list", () => {
    const page = parseTemplateCursorPage(
      { items: [], pageInfo: { limit: 25, hasNextPage: false, nextCursor: null } },
      parseTemplateListItem,
    );
    expect(page.nextCursor).toBeNull();
    expect(page.totalCount).toBeNull();
  });

  it("keeps both revisions and both ETags a publish has to pin", () => {
    const detail = parseTemplateDetail({
      ...listRow,
      description: null,
      dataSourceKey: "TRADE_QUOTATION_PRINT_V1",
      scope: { type: "TENANT" },
      systemProtected: false,
      revision: 12,
      etag: '"12"',
      currentDraft: {
        draftId,
        revision: 7,
        contentChecksum: "a".repeat(64),
        validationState: "PASSED",
        etag: '"7"',
      },
    });
    expect(detail.definitionRevision).toBe(12);
    expect(detail.etag).toBe('"12"');
    expect(detail.currentDraft.revision).toBe(7);
    expect(detail.currentDraft.etag).toBe('"7"');
  });

  it("degrades an unrecognised validation state instead of failing the list", () => {
    const row = parseTemplateListItem({
      ...listRow,
      draft: { draftId, revision: 7, validationState: "SOMETHING_NEW" },
    });
    expect(row.draft.validationState).toBe("NOT_VALIDATED");
  });

  it("keeps the draft revision a validation run applies to", () => {
    const run = parseValidationRun({
      validationRunId: runId,
      templateId,
      draftId,
      draftRevision: 7,
      status: "PASSED",
      rendererTargets: ["HTML", "PDF"],
      issues: [],
      startedAt: "2026-08-30T09:00:00.000Z",
      completedAt: "2026-08-30T09:00:01.000Z",
    });
    // A run only applies to the exact revision it names — the publish screen
    // compares this against the live draft rather than trusting "passed".
    expect(run.draftRevision).toBe(7);
  });

  it("reads a completed PDF job whose artifact is still available", () => {
    const job = parsePreviewJob({
      templateId,
      source: { kind: "DRAFT", draftId, draftRevision: 7 },
      templateContentChecksum: "b".repeat(64),
      compiledArtifactChecksum: "c".repeat(64),
      renderJobId: jobId,
      renderTarget: "PDF",
      attemptCount: 1,
      createdAt: "2026-08-30T09:00:00.000Z",
      expiresAt: "2026-08-30T10:00:00.000Z",
      lifecycleRevision: 2,
      status: "COMPLETED",
      nextRetryAt: null,
      failure: null,
      artifact: {
        downloadUrl: "/api/v1/core/templates/preview-jobs/x/artifact",
        downloadUrlExpiresAt: "2026-08-30T09:30:00.000Z",
        checksum: "d".repeat(64),
        sizeBytes: 2048,
        pageCount: 2,
        rendererVersion: "1",
        browserBuildFingerprint: "1",
      },
    });
    expect(job.status).toBe("COMPLETED");
    expect(job.artifact?.pageCount).toBe(2);
  });

  it("reports a completed job with no artifact, which is a real fifth state", () => {
    const job = parsePreviewJob({
      templateId,
      source: { kind: "VERSION", versionId, versionNumber: 3 },
      templateContentChecksum: "b".repeat(64),
      compiledArtifactChecksum: "c".repeat(64),
      renderJobId: jobId,
      renderTarget: "PDF",
      attemptCount: 1,
      createdAt: "2026-08-30T09:00:00.000Z",
      expiresAt: "2026-08-30T10:00:00.000Z",
      lifecycleRevision: 2,
      status: "COMPLETED",
      nextRetryAt: null,
      failure: null,
      artifact: null,
    });
    expect(job.artifact).toBeNull();
  });

  it("keeps the namespaced asset ETag the retire route requires", () => {
    const asset = parseTemplateAsset({
      assetId,
      definitionId: null,
      assetType: "LOGO",
      originalFileName: "logo.png",
      mimeType: "image/png",
      sizeBytes: 1024,
      widthPx: 100,
      heightPx: 100,
      checksum: "e".repeat(64),
      deliveryClass: "EMAIL_PUBLIC",
      emailRendition: { kind: "READY", checksum: "f".repeat(64) },
      status: "ACTIVE",
      revision: 4,
      etag: `"asset:${assetId}:4"`,
      createdAt: "2026-08-30T09:00:00.000Z",
      createdBy: { kind: "USER" },
      updatedAt: "2026-08-30T09:00:00.000Z",
      updatedBy: { kind: "USER" },
    });
    expect(asset.etag).toBe(`"asset:${assetId}:4"`);
    expect(asset.deliveryClass).toBe("EMAIL_PUBLIC");
  });

  it("reads a resolve preview, including the answer that nothing applies", () => {
    const chosen = parseResolvedAssignment({
      evaluatedAt: "2026-08-30T09:00:00.000Z",
      selector: {},
      chosen: {
        assignmentId,
        matchedScope: { type: "TENANT" },
        localeMatch: "EXACT",
        priority: 500,
        version: { templateVersionId: versionId, versionNumber: 3 },
      },
      eligibleCandidateCount: 1,
      orderedSelectorEpochs: [],
      receiptChecksum: "0".repeat(64),
    });
    expect(chosen.chosen?.versionNumber).toBe(3);

    const none = parseResolvedAssignment({
      evaluatedAt: "2026-08-30T09:00:00.000Z",
      selector: {},
      chosen: null,
      eligibleCandidateCount: 0,
      orderedSelectorEpochs: [],
      receiptChecksum: "0".repeat(64),
    });
    expect(none.chosen).toBeNull();
    expect(none.eligibleCandidateCount).toBe(0);
  });
});
