import type { OutboundEmailDetail } from "./outbound-email-contract";

export function outboundEmailTimeline(email: OutboundEmailDetail) {
  const feedback = email.feedback.map((entry) => ({
    state: entry.type === "BOUNCE" ? "BOUNCED" : "COMPLAINED",
    occurredAt: entry.occurredAt, reason: entry.reasonCode,
  }));
  return [
    ...email.timeline.map((entry) => ({ ...entry,
      reason: feedback.find((item) => item.state === entry.state && item.occurredAt === entry.occurredAt)?.reason,
    })),
    ...feedback.filter((entry) => !email.timeline.some((item) => item.state === entry.state && item.occurredAt === entry.occurredAt)),
  ].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
}
