import { describe, expect, it } from "vitest";
import { outboundEmailTimeline } from "./outbound-email-timeline";
import type { OutboundEmailDetail } from "./outbound-email-contract";

describe("outbound email feedback timeline", () => {
  it("merges feedback with the matching lifecycle event instead of showing the bounce twice", () => {
    const occurredAt = "2026-11-03T10:00:00.000Z";
    const email = {
      timeline: [{ state: "SENT", occurredAt: "2026-11-03T09:00:00.000Z" }, { state: "BOUNCED", occurredAt }],
      feedback: [{ type: "BOUNCE", occurredAt, reasonCode: "HARD_BOUNCE" }],
    } as OutboundEmailDetail;
    expect(outboundEmailTimeline(email)).toEqual([
      { state: "SENT", occurredAt: "2026-11-03T09:00:00.000Z", reason: undefined },
      { state: "BOUNCED", occurredAt, reason: "HARD_BOUNCE" },
    ]);
  });
});
