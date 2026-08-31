import { describe, expect, it } from "vitest";
import {
  CRM_NOTE_SOURCE_TYPES,
  buildCreateCrmNoteRequest,
  buildCrmNotesListPath,
  buildUpdateCrmNoteRequest,
  crmNotePath,
  parseCrmNote,
  parseCrmNotesPageResponse,
} from "./notes-contract";

const BRANCH = "01900100-0000-7000-8000-000000000099";
const SOURCE = "01900100-0000-7000-8000-000000000001";
const NOTE_ID = "01900100-0000-7000-8000-000000000050";
const AUTHOR = "01900100-0000-7000-8000-000000000020";

const note = {
  id: NOTE_ID,
  branchId: BRANCH,
  sourceType: "LEAD",
  sourceId: SOURCE,
  body: "Customer asked for pricing by branch.",
  createdByUserId: AUTHOR,
  createdAt: "2026-06-24T15:00:00.000Z",
  updatedAt: "2026-06-24T15:15:00.000Z",
};

const page = {
  items: [note],
  total: 1,
  page: 1,
  limit: 25,
  totalPages: 1,
  hasNext: false,
  hasPrev: false,
};

const expected = { branchId: BRANCH, sourceType: "LEAD" as const, sourceId: SOURCE };

describe("CRM notes contract", () => {
  it("does not accept NOTE as a note source type", () => {
    // The attachment enum has six members and the note enum has five —
    // an attachment can hang off a note, a note cannot.
    expect(CRM_NOTE_SOURCE_TYPES).not.toContain("NOTE");
    expect(CRM_NOTE_SOURCE_TYPES).toHaveLength(5);
  });

  it("reads a note row off the raw entity", () => {
    expect(parseCrmNote(note)).toEqual({
      id: NOTE_ID,
      branchId: BRANCH,
      sourceType: "LEAD",
      sourceId: SOURCE,
      body: note.body,
      createdByUserId: AUTHOR,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    });
  });

  it("treats a missing author as null rather than as invalid", () => {
    expect(parseCrmNote({ ...note, createdByUserId: null }).createdByUserId).toBeNull();
  });

  it("rejects an empty body, an over-long body and a malformed id", () => {
    expect(() => parseCrmNote({ ...note, body: "" })).toThrow();
    expect(() => parseCrmNote({ ...note, body: "x".repeat(20_001) })).toThrow();
    expect(() => parseCrmNote({ ...note, id: "not-a-uuid" })).toThrow();
  });

  it("reads the raw CRM page shape, not a Core envelope", () => {
    expect(parseCrmNotesPageResponse(page, expected).items).toHaveLength(1);
    // `{ data: … }` is the Core shape and must not parse here (S1).
    expect(() => parseCrmNotesPageResponse({ data: page }, expected)).toThrow();
  });

  it("rejects a page whose rows belong to another record", () => {
    const foreign = { ...page, items: [{ ...note, sourceId: BRANCH }] };
    expect(() => parseCrmNotesPageResponse(foreign, expected)).toThrow();
    const otherType = { ...page, items: [{ ...note, sourceType: "OPPORTUNITY" }] };
    expect(() => parseCrmNotesPageResponse(otherType, expected)).toThrow();
  });

  it("rejects a page carrying more rows than its own limit", () => {
    expect(() =>
      parseCrmNotesPageResponse({ ...page, limit: 0 }, expected),
    ).toThrow();
  });

  it("sends exactly the four CreateNoteDto keys, trimmed", () => {
    expect(
      buildCreateCrmNoteRequest({
        branchId: BRANCH,
        sourceType: "LEAD",
        sourceId: SOURCE,
        body: "  a note  ",
      }),
    ).toEqual({
      branchId: BRANCH,
      sourceType: "LEAD",
      sourceId: SOURCE,
      body: "a note",
    });
  });

  it("refuses a whitespace-only body instead of letting the server 422", () => {
    expect(() =>
      buildCreateCrmNoteRequest({
        branchId: BRANCH,
        sourceType: "LEAD",
        sourceId: SOURCE,
        body: "   ",
      }),
    ).toThrow();
    expect(() => buildUpdateCrmNoteRequest("")).toThrow();
  });

  it("sends only `body` on update", () => {
    expect(buildUpdateCrmNoteRequest(" edited ")).toEqual({ body: "edited" });
  });

  it("builds the list path with every required filter", () => {
    const path = buildCrmNotesListPath({
      branchId: BRANCH,
      sourceType: "LEAD",
      sourceId: SOURCE,
      page: 1,
      limit: 25,
    });
    expect(path).toContain("/api/tenant/crm/v1/notes?");
    expect(path).toContain(`branchId=${BRANCH}`);
    expect(path).toContain("sourceType=LEAD");
    expect(path).toContain(`sourceId=${SOURCE}`);
  });

  it("refuses to build a path for a malformed note id", () => {
    expect(crmNotePath(NOTE_ID)).toBe(`/api/tenant/crm/v1/notes/${NOTE_ID}`);
    expect(() => crmNotePath("../attachments")).toThrow();
  });
});
