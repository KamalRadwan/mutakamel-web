"use client";

import { use, useState } from "react";
import { RefreshCw } from "lucide-react";
import {
  Badge,
  Button,
  DateTime,
  DegradedBanner,
  DetailHeader,
  DetailSection,
  ErrorState,
  IdentifierText,
  NotFoundState,
  PermissionGate,
  ReasonDialog,
  Skeleton,
  Timeline,
  useToast,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import {
  RETRY_REASON_MAX_LENGTH,
  isPendingDelivery,
  type OutboundEmailStatus,
} from "../outbound-email-contract";
import { useOutboundEmailDetail } from "../hooks/useOutboundEmailDetail";

const EMAILS_HREF = "/crm/outbound-emails";

const STATUS_TONE: Record<OutboundEmailStatus, "positive" | "negative" | "caution"> = {
  SENT: "positive",
  FAILED: "negative",
  QUEUED: "caution",
  DISPATCHING: "caution",
};

export default function OutboundEmailDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { t } = useI18n();
  const toast = useToast();
  const detail = useOutboundEmailDetail(id);
  const [isRetryOpen, setIsRetryOpen] = useState(false);
  const [retryError, setRetryError] = useState<string | undefined>(undefined);

  const email = detail.detail;

  return (
    <PermissionGate require="crm.activities.read" scoped>
      <div className="flex flex-col gap-4">
        {detail.notFound ? (
          <NotFoundState
            title={t.crmOutboundEmails.notFoundTitle}
            description={t.crmOutboundEmails.notFoundDescription}
            backLabel={t.crmOutboundEmails.backToList}
            backHref={EMAILS_HREF}
          />
        ) : detail.queryError ? (
          <ErrorState
            title={t.crmOutboundEmails.loadFailed}
            description={t.crmOutboundEmails.loadFailedHint}
            retryLabel={t.common.retry}
            onRetry={() => void detail.reload()}
          />
        ) : detail.isLoading && !email ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : email ? (
          <>
            <DetailHeader
              title={
                email.content.state === "AVAILABLE"
                  ? email.content.subject
                  : t.crmOutboundEmails.redactedSubject
              }
              subtitle={`${email.recipient.displayName} · ${email.recipient.maskedAddress}`}
              status={
                <Badge tone={STATUS_TONE[email.status]}>
                  {t.crmOutboundEmails.statusValues[email.status] ?? email.status}
                </Badge>
              }
              backLabel={t.crmOutboundEmails.backToList}
              backHref={EMAILS_HREF}
              breadcrumbs={[
                { label: t.crmOutboundEmails.title, href: EMAILS_HREF },
                {
                  label:
                    email.content.state === "AVAILABLE"
                      ? email.content.subject
                      : t.crmOutboundEmails.redactedSubject,
                },
              ]}
              primaryAction={
                // Retry is offered only on a FAILED message: the route exists
                // for a delivery that did not happen, and offering it on a
                // queued or delivered one promises a duplicate send.
                detail.canSend && email.status === "FAILED"
                  ? {
                      label: t.crmOutboundEmails.retry,
                      onClick: () => {
                        setRetryError(undefined);
                        setIsRetryOpen(true);
                      },
                    }
                  : undefined
              }
              secondaryActions={
                <Button
                  variant="outline"
                  onClick={() => void detail.reload()}
                  disabled={detail.isLoading}
                >
                  <RefreshCw
                    className={`size-4 ${detail.isLoading ? "animate-spin" : ""}`}
                    aria-hidden="true"
                  />
                  {t.common.retry}
                </Button>
              }
            />

            {detail.isPending ? (
              <DegradedBanner message={t.crmOutboundEmails.pendingBanner} />
            ) : null}

            <DetailSection
              title={t.crmOutboundEmails.summaryTitle}
              emptyValueLabel={t.common.noData}
              fields={[
                {
                  label: t.crmOutboundEmails.sender,
                  value: `${email.sender.displayName} · ${email.sender.maskedAddress}`,
                },
                {
                  label: t.crmOutboundEmails.requestedAt,
                  value: <DateTime value={email.requestedAt} />,
                },
                {
                  label: t.crmOutboundEmails.sentAt,
                  value: email.sentAt ? <DateTime value={email.sentAt} /> : null,
                },
                {
                  label: t.crmOutboundEmails.failedAt,
                  value: email.failedAt ? (
                    <DateTime value={email.failedAt} />
                  ) : null,
                },
                {
                  label: t.crmOutboundEmails.failureCode,
                  value: email.failure ? (
                    <IdentifierText className="text-xs">{email.failure.code}</IdentifierText>
                  ) : null,
                },
              ]}
            />

            <DetailSection
              title={t.crmOutboundEmails.contentTitle}
              description={
                email.content.state === "REDACTED_BY_RETENTION"
                  ? t.crmOutboundEmails.redactedNotice
                  : t.crmOutboundEmails.contentDescription
              }
              columns={1}
            >
              {email.content.state === "AVAILABLE" ? (
                <div className="flex flex-col gap-1.5">
                  {email.content.preheader ? (
                    <p className="text-xs text-muted-foreground">
                      {email.content.preheader}
                    </p>
                  ) : null}
                  {/* The stored plain-text alternative. The HTML body is
                      server-authored markup and is never injected into this
                      document. */}
                  <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-sm border border-border bg-muted p-2.5 font-sans text-xs text-foreground">
                    {email.content.text}
                  </pre>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  <DateTime value={email.content.redactedAt} />
                </p>
              )}
            </DetailSection>

            <DetailSection
              title={t.crmOutboundEmails.timelineTitle}
              description={t.crmOutboundEmails.timelineDescription}
              columns={1}
            >
              <Timeline
                label={t.crmOutboundEmails.timelineTitle}
                emptyTitle={t.crmOutboundEmails.timelineEmpty}
                events={[
                  ...email.timeline.map((entry) => ({
                    id: `${entry.state}-${entry.occurredAt}`,
                    title:
                      t.crmOutboundEmails.timelineStates[entry.state] ??
                      entry.state,
                    timestamp: <DateTime value={entry.occurredAt} />,
                    // A delivery state is a category, not an outcome — only
                    // a failure takes a hue. docs/design/patterns.md#timeline.
                    tone:
                      entry.state === "FAILED"
                        ? ("negative" as const)
                        : undefined,
                    pending: entry.state === "QUEUED" || entry.state === "DISPATCHING",
                  })),
                  ...email.feedback.map((entry) => ({
                    id: `${entry.type}-${entry.occurredAt}`,
                    title:
                      t.crmOutboundEmails.feedbackTypes[entry.type] ?? entry.type,
                    description: entry.reasonCode,
                    timestamp: <DateTime value={entry.occurredAt} />,
                    tone: "negative" as const,
                  })),
                ]}
              />
            </DetailSection>

            {/* The retry reason is a real DTO field (@IsNotEmpty,
                @MaxLength(500)), so ReasonDialog's captured text is sent
                rather than discarded. */}
            <ReasonDialog
              open={isRetryOpen}
              onOpenChange={setIsRetryOpen}
              title={t.crmOutboundEmails.retryTitle}
              description={t.crmOutboundEmails.retryDescription}
              reasonRequired
              maxLength={RETRY_REASON_MAX_LENGTH}
              loading={detail.isRetrying}
              error={retryError}
              onConfirm={(reason) => {
                void detail.retry(reason).then((result) => {
                  if (result.ok) {
                    setIsRetryOpen(false);
                    if (result.replayed) {
                      toast.info(
                        t.errors.idempotencyReplayedTitle,
                        t.errors.idempotencyReplayedDescription,
                      );
                    } else {
                      toast.success(
                        t.crmOutboundEmails.retryQueuedTitle,
                        t.crmOutboundEmails.retryQueuedDescription,
                      );
                    }
                    return;
                  }
                  if (result.error) {
                    if (!toast.outcomeFromApi(result.error)) {
                      setRetryError(
                        t.crmOutboundEmails.errors[result.error.code ?? ""] ??
                          t.crmOutboundEmails.retryFailed,
                      );
                    }
                  }
                });
              }}
              labels={{
                reason: t.crmOutboundEmails.retryReason,
                reasonHint: t.crmOutboundEmails.retryReasonHint,
                confirm: t.crmOutboundEmails.retry,
                cancel: t.common.cancel,
              }}
            />
          </>
        ) : null}
      </div>
    </PermissionGate>
  );
}
