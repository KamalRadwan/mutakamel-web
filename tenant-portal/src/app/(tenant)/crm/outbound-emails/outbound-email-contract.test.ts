import { describe, expect, it } from "vitest";
import {
  buildOptionsRequest,
  buildOutboundEmailListQuery,
  buildRetryRequest,
  buildSendRequest,
  isPendingDelivery,
  outboundEmailRetryPath,
  parseAcceptedResponse,
  parseDetailResponse,
  parseListResponse,
  parseOptionsResponse,
  parsePreviewResponse,
} from "./outbound-email-contract";

const EMAIL_ID = "01900500-0000-7000-8000-000000000001";
const SOURCE_ID = "01900500-0000-7000-8000-000000000002";
const PARTY_ID = "01900500-0000-7000-8000-000000000003";
const CONTACT_ID = "01900500-0000-7000-8000-000000000004";
const TEMPLATE_VERSION_ID = "01900500-0000-7000-8000-000000000005";

describe("CRM outbound-email contract", () => {
  it("treats QUEUED and DISPATCHING as not-yet-delivered", () => {
    expect(isPendingDelivery("QUEUED")).toBe(true);
    expect(isPendingDelivery("DISPATCHING")).toBe(true);
    expect(isPendingDelivery("SENT")).toBe(false);
    expect(isPendingDelivery("FAILED")).toBe(false);
  });

  it("parses the 202 body as accepted-and-queued, never as sent", () => {
    const accepted = parseAcceptedResponse({
      outboundEmailId: EMAIL_ID,
      status: "QUEUED",
      requestedAt: "2026-09-01T09:00:00.000Z",
      recipient: { displayName: "Sara", maskedAddress: "s***@example.com" },
    });
    expect(accepted.status).toBe("QUEUED");
    // Anything other than QUEUED out of the create route is not the accepted
    // shape and must not be reported as one.
    expect(() =>
      parseAcceptedResponse({
        outboundEmailId: EMAIL_ID,
        status: "SENT",
        requestedAt: "2026-09-01T09:00:00.000Z",
      }),
    ).toThrow("Invalid CRM outbound-email response.");
  });

  it("sends the recipient discriminant without the keys it does not own", () => {
    // CrmRecipientReferenceDto validates partyId/contactId ONLY for
    // PARTY_CONTACT; sending them otherwise is an unknown-key 400 under
    // forbidNonWhitelisted.
    expect(
      buildSendRequest(
        "LEAD",
        SOURCE_ID,
        { kind: "SOURCE_PRIMARY_CONTACT" },
        null,
      ),
    ).toEqual({
      sourceType: "LEAD",
      sourceId: SOURCE_ID,
      recipient: { kind: "SOURCE_PRIMARY_CONTACT" },
    });

    expect(
      buildSendRequest(
        "OPPORTUNITY",
        SOURCE_ID,
        { kind: "PARTY_CONTACT", partyId: PARTY_ID, contactId: CONTACT_ID },
        TEMPLATE_VERSION_ID,
      ),
    ).toEqual({
      sourceType: "OPPORTUNITY",
      sourceId: SOURCE_ID,
      recipient: {
        kind: "PARTY_CONTACT",
        partyId: PARTY_ID,
        contactId: CONTACT_ID,
      },
      templateVersionId: TEMPLATE_VERSION_ID,
    });
  });

  it("refuses a PARTY_CONTACT reference with no ids", () => {
    expect(() =>
      buildSendRequest("LEAD", SOURCE_ID, { kind: "PARTY_CONTACT" }, null),
    ).toThrow("CRM_EMAIL_RECIPIENT_INVALID");
  });

  it("never invents a locale on the options request", () => {
    expect(buildOptionsRequest("LEAD", SOURCE_ID)).toEqual({
      sourceType: "LEAD",
      sourceId: SOURCE_ID,
    });
  });

  it("passes the cursor back verbatim and sends no branchId", () => {
    const cursor = "eyJyZXF1ZXN0ZWRBdCI6IjIwMjYtMDktMDEifQ==";
    const query = buildOutboundEmailListQuery({ status: "FAILED" }, cursor);
    const params = new URLSearchParams(query);
    expect(params.get("cursor")).toBe(cursor);
    expect(params.get("status")).toBe("FAILED");
    expect(params.get("limit")).toBe("25");
    // ListCrmOutboundEmailsQueryDto has no branchId — this is the one CRM list
    // in this module that is not branch-scoped.
    expect(params.get("branchId")).toBeNull();
  });

  it("sends a source filter only when both halves are present", () => {
    const partial = new URLSearchParams(
      buildOutboundEmailListQuery({ sourceType: "LEAD" }, null),
    );
    expect(partial.get("sourceType")).toBeNull();
    const complete = new URLSearchParams(
      buildOutboundEmailListQuery(
        { sourceType: "LEAD", sourceId: SOURCE_ID },
        null,
      ),
    );
    expect(complete.get("sourceId")).toBe(SOURCE_ID);
  });

  it("bounds the retry reason exactly as RetryCrmOutboundEmailDto does", () => {
    expect(buildRetryRequest("  provider outage  ")).toEqual({
      reason: "provider outage",
    });
    expect(() => buildRetryRequest("   ")).toThrow(
      "CRM_EMAIL_RETRY_REASON_INVALID",
    );
    expect(() => buildRetryRequest("x".repeat(501))).toThrow(
      "CRM_EMAIL_RETRY_REASON_INVALID",
    );
    expect(outboundEmailRetryPath(EMAIL_ID)).toBe(
      `/api/tenant/crm/v1/outbound-emails/${EMAIL_ID}/retry`,
    );
  });

  it("keeps the server's availability reasons and masked addresses intact", () => {
    const options = parseOptionsResponse({
      sourceType: "LEAD",
      sourceId: SOURCE_ID,
      resolvedLocale: "ar-EG",
      recipients: [
        {
          reference: { kind: "SOURCE_PRIMARY_CONTACT" },
          displayName: "Sara",
          maskedAddress: "s***@example.com",
          isPrimary: true,
        },
      ],
      templates: [],
      assignedTemplateVersionId: null,
      availability: ["NO_COMPATIBLE_TEMPLATE", "SOMETHING_NEW"],
    });
    expect(options.recipients[0].maskedAddress).toBe("s***@example.com");
    // An unknown availability reason is dropped rather than rendered as a raw
    // wire string with no message behind it.
    expect(options.availability).toEqual(["NO_COMPATIBLE_TEMPLATE"]);
  });

  it("reads a redacted body as a state, not as a failure", () => {
    const detail = parseDetailResponse({
      outboundEmailId: EMAIL_ID,
      activityId: SOURCE_ID,
      sourceType: "LEAD",
      sourceId: SOURCE_ID,
      status: "SENT",
      recipient: { displayName: "Sara", maskedAddress: "s***@example.com" },
      sender: { displayName: "CRM", maskedAddress: "n***@example.com" },
      content: {
        state: "REDACTED_BY_RETENTION",
        redactedAt: "2026-09-10T09:00:00.000Z",
      },
      failure: null,
      feedback: [],
      timeline: [{ state: "SENT", occurredAt: "2026-09-01T09:05:00.000Z" }],
      requestedAt: "2026-09-01T09:00:00.000Z",
      sentAt: "2026-09-01T09:05:00.000Z",
    });
    expect(detail.content.state).toBe("REDACTED_BY_RETENTION");
    expect(detail.failure).toBeNull();
    expect(detail.timeline).toHaveLength(1);
  });

  it("parses a cursor page and the preview body", () => {
    const page = parseListResponse({
      items: [
        {
          outboundEmailId: EMAIL_ID,
          sourceType: "LEAD",
          sourceId: SOURCE_ID,
          subjectPreview: "Welcome",
          status: "QUEUED",
          recipient: { displayName: "Sara", maskedAddress: "s***@example.com" },
          requestedAt: "2026-09-01T09:00:00.000Z",
          sentAt: null,
          failedAt: null,
          requestedBy: { id: PARTY_ID, displayName: "Kamal" },
          retryOfId: null,
        },
      ],
      nextCursor: null,
      hasNext: false,
      limit: 25,
    });
    expect(page.items[0].status).toBe("QUEUED");
    expect(page.nextCursor).toBeNull();

    const preview = parsePreviewResponse({
      subject: "Welcome",
      preheader: null,
      bodyHtml: "<p>Hello</p>",
      bodyText: "Hello",
      direction: "RTL",
      resolvedLocale: "ar-EG",
      templateVersionNumber: 3,
    });
    expect(preview.bodyText).toBe("Hello");
    expect(preview.direction).toBe("RTL");
  });
});
