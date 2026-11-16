"use client";

import Link from "next/link";
import { DateTime, DegradedBanner, DetailSection, IdentifierText, Timeline } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { OutboundEmailDetail } from "../outbound-email-contract";
import { outboundEmailTimeline } from "../outbound-email-timeline";

export function OutboundEmailDetailContent({ email }: { email: OutboundEmailDetail }) {
  const { t } = useI18n();
  const copy = t.crmOutboundEmails;
  return <>
    {email.retriedById ? <DetailSection title={copy.retryTitle} columns={1}>
      <p className="text-sm text-foreground">{copy.retryAlreadyCreated}</p>
      <Link className="text-sm text-primary underline" href={`/crm/outbound-emails/${encodeURIComponent(email.retriedById)}`}>{copy.viewRetry}</Link>
    </DetailSection> : email.status === "FAILED" && email.content.state !== "AVAILABLE" ? <DegradedBanner message={copy.retryContentUnavailable} /> : null}
    <div className="grid gap-3 lg:grid-cols-2">
      <DetailSection title={copy.summaryTitle} emptyValueLabel={t.common.noData} fields={[
        { label: copy.sender, value: <><span>{email.sender.displayName}</span><p><IdentifierText>{email.sender.maskedAddress}</IdentifierText></p></> },
        { label: copy.recipient, value: <><span>{email.recipient.displayName}</span><p><IdentifierText>{email.recipient.maskedAddress}</IdentifierText></p></> },
        { label: copy.requestedAt, value: <DateTime value={email.requestedAt} /> },
        { label: copy.sentAt, value: email.sentAt ? <DateTime value={email.sentAt} /> : null },
        { label: copy.failedAt, value: email.failedAt ? <DateTime value={email.failedAt} /> : null },
        { label: copy.failureCode, value: email.failure ? <IdentifierText>{email.failure.code}</IdentifierText> : null },
      ]} />
      <DetailSection title={copy.contentTitle} columns={1}
        description={email.content.state === "REDACTED_BY_RETENTION" ? copy.redactedNotice : copy.contentDescription}>
        {email.content.state === "AVAILABLE" ? <>
          {email.content.preheader && <p className="text-xs text-muted-foreground">{email.content.preheader}</p>}
          <pre dir="auto" className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-muted p-3 font-sans text-sm text-foreground">{email.content.text}</pre>
        </> : <p className="text-xs text-muted-foreground"><DateTime value={email.content.redactedAt} /></p>}
      </DetailSection>
    </div>
    {email.status === "SENT" && <p className="text-xs text-muted-foreground">{copy.sentMeaning}</p>}
    <DetailSection title={copy.timelineTitle} description={copy.timelineDescription} columns={1}>
      <Timeline label={copy.timelineTitle} emptyTitle={copy.timelineEmpty}
        events={outboundEmailTimeline(email).map((entry, index) => ({
          id: `${entry.state}:${entry.occurredAt}:${index}`,
          title: copy.timelineStates[entry.state] ?? copy.timelineEvent,
          description: entry.reason,
          timestamp: <DateTime value={entry.occurredAt} />,
          tone: ["FAILED", "BOUNCED", "COMPLAINED"].includes(entry.state) ? "negative" as const : undefined,
          pending: ["QUEUED", "DISPATCHING"].includes(entry.state) && ["QUEUED", "DISPATCHING"].includes(email.status),
        }))} />
    </DetailSection>
  </>;
}
