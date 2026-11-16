import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createTemplateAssignment,
  deleteTemplateAssignment,
  fetchTemplateAssignment,
  fetchTemplateAssignments,
  fetchQuotationAssignmentTemplates,
  fetchQuotationAssignmentVersions,
  resolveTemplateAssignment,
  updateTemplateAssignment,
  SALES_QUOTATION_SELECTOR,
  type AssignmentScope,
} from "../template-assignments-contract";

const io = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), remove: vi.fn() }));
vi.mock("../../core-api", () => ({
  coreGetResponse: io.get,
  corePostResponse: io.post,
  corePatchResponse: io.patch,
  coreDelete: io.remove,
}));

const id = (number: number) => `019f0000-0000-7000-8000-${String(number).padStart(12, "0")}`;
const companyId = id(1);
const branchId = id(2);
const definitionId = id(3);
const versionId = id(4);
const currentVersionId = id(5);
const assignmentId = id(6);
const now = "2026-11-13T12:00:00.000Z";
const branch: AssignmentScope = { type: "BRANCH", companyId, branchId };
const signal = new AbortController().signal;
const assertCurrent = () => undefined;
const version = {
  templateDefinitionId: definitionId, templateVersionId: versionId, versionNumber: 1,
  documentType: "QUOTATION", outputChannel: "PRINT", layoutMode: "FLOW_DOCUMENT",
  lifecycleStatus: "PUBLISHED", publishedAt: now, locale: "ar-EG",
  dataSourceKey: SALES_QUOTATION_SELECTOR.adapterKey, templateContentChecksum: "a".repeat(64),
};

function page(items: unknown[]) {
  return { status: 200, data: { success: true, data: {
    items, pageInfo: { limit: 25, hasNextPage: false, nextCursor: null },
  } } };
}

function template(templateId: string, definitionScope: AssignmentScope, locale = "ar-EG") {
  return {
    templateId, definitionScope, locale, name: "Quotation", code: "QUOTATION",
    documentType: "QUOTATION", outputChannel: "PRINT", layoutMode: "FLOW_DOCUMENT",
    lifecycleStatus: "ACTIVE", direction: "AUTO", draft: { draftId: id(7), revision: 1, validationState: "PASSED" },
    currentPublishedVersion: { versionId: currentVersionId, versionNumber: 2, publishedAt: now },
    definitionRevision: 2, definitionEtag: '"2"', updatedAt: now,
  };
}

const selector = { ...SALES_QUOTATION_SELECTOR, locale: "ar-EG", scope: branch };
const assignment = { ...selector, versionId, priority: 20, isDefault: true, effectiveFrom: now, effectiveTo: null };
const createdRow = { ...assignment, assignmentId, definitionId, versionNumber: 1, status: "ACTIVE", revision: 1, etag: '"1"' };
const update = { priority: 21, isDefault: true, effectiveFrom: now, effectiveTo: null };
const updatedRow = { ...createdRow, priority: update.priority, revision: 2, etag: '"2"' };

type AssignmentRow = Omit<typeof createdRow, "locale" | "effectiveTo"> & {
  locale: string | null;
  effectiveTo: string | null;
};

function commandReceipt(status: number, row: AssignmentRow, headerEtag = row.etag) {
  return {
    status, headers: new Headers({ ETag: headerEtag }),
    data: { success: true, data: { assignment: row, impact: { effectiveNow: true, affectedSelectors: [] } } },
  };
}

describe("Sales quotation assignment selection", () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it("limits a branch catalogue to its company and tenant ownership for the selected locale", async () => {
    io.get.mockResolvedValueOnce(page([
      template(id(10), { type: "TENANT" }),
      template(id(11), { type: "COMPANY", companyId }),
      template(id(12), { type: "COMPANY", companyId: id(99) }),
      template(id(13), { type: "TENANT" }, "en-US"),
    ]));
    const result = await fetchQuotationAssignmentTemplates(branch, "ar-EG", undefined, signal, assertCurrent);
    expect(result.items.map(item => item.id)).toEqual([id(10), id(11)]);
    const query = new URL(io.get.mock.calls[0]?.[0], "http://tenant.test").searchParams;
    expect(Object.fromEntries(query)).toMatchObject({
      assignmentScopeType: "BRANCH", assignmentCompanyId: companyId, assignmentBranchId: branchId,
      locale: "ar-EG", documentType: "QUOTATION", outputChannel: "PRINT",
      lifecycleStatus: "ACTIVE", hasPublishedVersion: "true",
    });
  });

  it("keeps an earlier published version and excludes explicit-page Fixed Canvas versions", async () => {
    const fixed = { ...version, templateVersionId: id(8), versionNumber: 3, layoutMode: "FIXED_CANVAS" };
    io.get.mockResolvedValueOnce(page([version, fixed])).mockResolvedValueOnce({
      status: 200, data: { success: true, data: { ...fixed, editorDocument: { canvasPages: [] } } },
    });
    const result = await fetchQuotationAssignmentVersions(definitionId, "ar-EG", undefined, signal, assertCurrent);
    expect(result.items.map(item => item.id)).toEqual([versionId]);
  });

  it.each([
    { name: "the same branch and locale", matchedScope: branch, localeMatch: "EXACT", templateLocale: "ar-EG" },
    { name: "the branch locale default", matchedScope: branch, localeMatch: "DEFAULT", templateLocale: "en-US" },
    { name: "the parent company", matchedScope: { type: "COMPANY", companyId }, localeMatch: "EXACT", templateLocale: "ar-EG" },
  ])("reads the pinned runtime version from $name", async ({ matchedScope, localeMatch, templateLocale }) => {
    io.post.mockResolvedValueOnce({ status: 200, data: { success: true, data: {
      selector, evaluatedAt: now, eligibleCandidateCount: 1,
      chosen: {
        assignmentId, matchedScope, priority: 20, localeMatch,
        version: {
          definitionId, versionId, versionNumber: 1, documentType: "QUOTATION", outputChannel: "PRINT",
          locale: templateLocale, dataSourceKey: SALES_QUOTATION_SELECTOR.adapterKey,
        },
      },
    } } });

    await expect(resolveTemplateAssignment(selector)).resolves.toMatchObject({
      chosen: { assignmentId, matchedScope, localeMatch, version: { definitionId, id: versionId, locale: templateLocale } },
    });
  });

  it("reads back the same pinned version and uses the new ETag for exact cleanup", async () => {
    io.post.mockResolvedValueOnce(commandReceipt(201, createdRow));
    io.patch.mockResolvedValueOnce(commandReceipt(200, updatedRow));
    io.get.mockResolvedValueOnce(page([updatedRow]));
    io.remove.mockResolvedValueOnce({ status: 204, headers: new Headers(), data: null });
    const current = await createTemplateAssignment(assignment, id(9), assertCurrent);
    expect(current).toMatchObject({
      id: assignmentId, definitionId, versionId, versionNumber: 1, scope: branch, locale: selector.locale,
      isDefault: true, revision: 1, etag: '"1"',
    });
    expect(io.post.mock.calls[0]?.[1]).toMatchObject({ versionId, scope: branch, locale: selector.locale });
    const updated = await updateTemplateAssignment(current, update, id(10), assertCurrent);
    expect(io.patch.mock.calls[0]?.[2]).toMatchObject({ headers: { "If-Match": '"1"' } });
    expect(updated).toEqual({ ...current, priority: update.priority, revision: 2, etag: '"2"' });
    await expect(fetchTemplateAssignments({ scope: branch }, signal, assertCurrent)).resolves.toMatchObject({
      items: [updated],
    });
    await expect(deleteTemplateAssignment(updated.id, updated.etag, id(11), assertCurrent)).resolves.toBe(false);
    expect(io.remove).toHaveBeenCalledWith(expect.stringMatching(assignmentId), expect.objectContaining({
      headers: { "If-Match": '"2"', "x-idempotency-key": id(11) },
    }));
  });

  it("creates a branch locale default with a null selector locale and the chosen version UUID", async () => {
    const body = { ...assignment, locale: null };
    io.post.mockResolvedValueOnce(commandReceipt(201, { ...createdRow, locale: null }));
    await expect(createTemplateAssignment(body, id(9), assertCurrent)).resolves.toMatchObject({
      scope: branch, locale: null, versionId, isDefault: true, revision: 1, etag: '"1"',
    });
    expect(io.post.mock.calls[0]?.[1]).toEqual(body);
  });

  it("accepts a new pinned version when the update explicitly selects it", async () => {
    io.post.mockResolvedValueOnce(commandReceipt(201, createdRow));
    io.patch.mockResolvedValueOnce(commandReceipt(200, { ...updatedRow, versionId: currentVersionId, versionNumber: 2 }));
    const current = await createTemplateAssignment(assignment, id(9), assertCurrent);
    await expect(updateTemplateAssignment(current, { ...update, versionId: currentVersionId }, id(10), assertCurrent))
      .resolves.toMatchObject({ versionId: currentVersionId, versionNumber: 2, revision: 2, etag: '"2"' });
  });

  it.each([
    { body: { priority: 0 }, changes: { priority: 0 } },
    { body: { effectiveTo: null }, changes: { effectiveTo: null } },
    { body: { isDefault: false }, changes: { isDefault: false } },
    { body: { status: "INACTIVE" as const }, changes: { status: "INACTIVE" } },
  ])("accepts Core's full receipt for partial PATCH $body", async ({ body, changes }) => {
    const previousRow = { ...createdRow, effectiveTo: "2026-11-14T12:00:00.000Z" };
    io.post.mockResolvedValueOnce(commandReceipt(201, previousRow));
    io.patch.mockResolvedValueOnce(commandReceipt(200, { ...previousRow, revision: 2, etag: '"2"', ...changes }));
    const previous = await createTemplateAssignment({ ...assignment, effectiveTo: previousRow.effectiveTo }, id(9));
    await expect(updateTemplateAssignment(previous, body, id(10))).resolves.toEqual({
      ...previous, revision: 2, etag: '"2"', ...changes,
    });
    expect(io.patch.mock.calls[0]?.[1]).toEqual(body);
  });

  it("rejects a command receipt when the HTTP and body ETags disagree", async () => {
    io.post.mockResolvedValueOnce(commandReceipt(201, createdRow, '"2"'));
    await expect(createTemplateAssignment(assignment, id(9), assertCurrent)).rejects.toThrow();
  });

  it.each([
    { etag: '"2"' },
    { revision: 2, etag: '"2"' },
    { versionId: currentVersionId },
    { scope: { ...branch, branchId: id(99) } },
    { locale: "en-US" },
    { isDefault: false },
  ])("rejects a create receipt with mismatched data %o", async (changes) => {
    io.post.mockResolvedValueOnce(commandReceipt(201, { ...createdRow, ...changes }));
    await expect(createTemplateAssignment(assignment, id(9), assertCurrent)).rejects.toThrow();
  });

  it.each([
    { revision: 1, etag: '"1"' },
    { definitionId: id(99) },
    { versionId: currentVersionId },
    { versionNumber: 2 },
    { scope: { ...branch, branchId: id(99) } },
    { locale: null },
    { isDefault: false },
    { status: "INACTIVE" },
  ])("rejects an update receipt with mismatched data %o", async (changes) => {
    io.post.mockResolvedValueOnce(commandReceipt(201, createdRow));
    io.patch.mockResolvedValueOnce(commandReceipt(200, { ...updatedRow, ...changes }));
    const current = await createTemplateAssignment(assignment, id(9), assertCurrent);
    await expect(updateTemplateAssignment(current, update, id(10), assertCurrent)).rejects.toThrow();
  });

  it("requires HTTP 204 before confirming deactivation", async () => {
    io.remove.mockResolvedValueOnce({ status: 200 });
    await expect(deleteTemplateAssignment(assignmentId, '"2"', id(11), assertCurrent)).rejects.toThrow();
  });

  it.each([
    { status: "PENDING" },
    { assignmentId: id(99) },
    { success: false },
    { etag: '"2"' },
  ])("refuses incoherent assignment readback %o", async (changes) => {
    io.get.mockResolvedValueOnce({
      status: 200, headers: new Headers({ ETag: '"1"' }),
      data: { success: true, data: { ...createdRow, ...changes } },
    });
    await expect(fetchTemplateAssignment(assignmentId, assertCurrent)).rejects.toThrow();
  });
});
