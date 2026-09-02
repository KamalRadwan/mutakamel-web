"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import {
  Badge,
  Button,
  DataTable,
  DateTime,
  DegradedBanner,
  FilterBar,
  IdentifierText,
  PageHeader,
  PermissionGate,
  type ColumnDef,
  useToast,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import {
  OUTBOUND_EMAIL_STATUSES,
  isPendingDelivery,
  type OutboundEmailListItem,
  type OutboundEmailStatus,
} from "./outbound-email-contract";
import { ComposeEmailDrawer } from "./components/ComposeEmailDrawer";
import { useOutboundEmailComposer } from "./hooks/useOutboundEmailComposer";
import { useOutboundEmails } from "./hooks/useOutboundEmails";

const STATUS_TONE: Record<OutboundEmailStatus, "positive" | "negative" | "caution" | "neutral"> = {
  SENT: "positive",
  FAILED: "negative",
  // Queued and dispatching are in-flight, not outcomes — caution reads as
  // "waiting", which is exactly what they mean.
  QUEUED: "caution",
  DISPATCHING: "caution",
};

export default function OutboundEmailsPage() {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const {
    items,
    hasLoaded,
    hasNext,
    isLoading,
    isLoadingMore,
    queryError,
    canSend,
    status,
    setStatus,
    loadMore,
    reload,
  } = useOutboundEmails();
  const composer = useOutboundEmailComposer();
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeError, setComposeError] = useState<string | undefined>(undefined);

  const columns: ColumnDef<OutboundEmailListItem>[] = [
    {
      id: "subject",
      header: t.crmOutboundEmails.subject,
      cell: (email) => (
        <span className="font-medium text-foreground">
          {email.subjectPreview ?? t.common.noData}
        </span>
      ),
    },
    {
      id: "recipient",
      header: t.crmOutboundEmails.recipient,
      cell: (email) => (
        <div className="min-w-0">
          <p className="truncate text-sm text-foreground">
            {email.recipient.displayName}
          </p>
          {/* Already masked by the server. Rendered exactly as received. */}
          <p className="truncate text-2xs text-muted-foreground">
            <IdentifierText>{email.recipient.maskedAddress}</IdentifierText>
          </p>
        </div>
      ),
    },
    {
      id: "status",
      header: t.common.status,
      cell: (email) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={STATUS_TONE[email.status]}>
            {t.crmOutboundEmails.statusValues[email.status] ?? email.status}
          </Badge>
          {isPendingDelivery(email.status) ? (
            <span className="text-2xs text-muted-foreground">
              {t.crmOutboundEmails.pendingHint}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: "requestedAt",
      header: t.crmOutboundEmails.requestedAt,
      cell: (email) => <DateTime value={email.requestedAt} />,
    },
  ];

  return (
    <PermissionGate require="crm.activities.read" scoped>
      <div className="flex flex-col gap-4">
        <PageHeader
          title={t.crmOutboundEmails.title}
          description={t.crmOutboundEmails.subtitle}
          primaryAction={
            canSend
              ? {
                  label: t.crmOutboundEmails.compose,
                  onClick: () => {
                    setComposeError(undefined);
                    setIsComposeOpen(true);
                  },
                }
              : undefined
          }
          secondaryActions={
            <Button
              variant="outline"
              onClick={() => void reload()}
              disabled={isLoading}
            >
              <RefreshCw
                className={`size-4 ${isLoading ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
              {t.common.retry}
            </Button>
          }
        />

        {/* The single most important thing on this screen: a row that says
            QUEUED has been accepted, not delivered. Delivery state arrives
            from the worker pipeline afterwards, so this list is eventually
            consistent and refreshing is how it catches up. */}
        <DegradedBanner message={t.crmOutboundEmails.eventualConsistency} />

        <FilterBar
          filters={[
            {
              id: "status",
              kind: "select",
              label: t.common.status,
              placeholder: t.crmOutboundEmails.allStatuses,
              options: OUTBOUND_EMAIL_STATUSES.map((value) => ({
                value,
                label: t.crmOutboundEmails.statusValues[value] ?? value,
              })),
            },
          ]}
          values={status ? { status: { kind: "select", value: status } } : {}}
          onChange={(next) => {
            const value = next.status;
            setStatus(
              value && value.kind === "select"
                ? (value.value as OutboundEmailStatus)
                : "",
            );
          }}
          onReset={() => setStatus("")}
          searchValue=""
          onSearchChange={() => undefined}
          clearAllLabel={t.common.dismiss}
        />

        {/* Cursor paging, so no page control: this endpoint returns an opaque
            nextCursor and no total, and a page/limit/total object built from
            neither would be fabricated. */}
        <DataTable
          columns={columns}
          rows={items}
          isLoading={isLoading && !hasLoaded}
          error={queryError}
          onRetry={() => void reload()}
          rowKey={(email) => email.outboundEmailId}
          onRowClick={(email) =>
            router.push(`/crm/outbound-emails/${email.outboundEmailId}`)
          }
          labels={{
            retry: t.common.retry,
            errorTitle: t.crmOutboundEmails.loadFailed,
            emptyTitle: status
              ? t.crmOutboundEmails.emptyFiltered
              : t.crmOutboundEmails.empty,
            selectAll: t.views.selectAll,
            selectRow: t.views.selectItem,
            sortAscending: t.views.sortAscending,
            sortDescending: t.views.sortDescending,
            notSorted: t.views.notSorted,
            pagination: {
              previous: t.common.previousPage,
              next: t.common.nextPage,
              summary: (from, to, total) =>
                formatTemplate(t.common.showingOf, { from, to, total }),
            },
          }}
        />

        {hasNext ? (
          <div className="flex justify-center">
            <Button
              variant="outline"
              onClick={loadMore}
              disabled={isLoadingMore}
              loading={isLoadingMore}
            >
              {t.crmOutboundEmails.loadMore}
            </Button>
          </div>
        ) : null}

        {/* Remounted per opening; the composer is cleared alongside it so a
            previous record's options and preview cannot survive into the
            next compose. */}
        <ComposeEmailDrawer
          key={isComposeOpen ? "open" : "closed"}
          open={isComposeOpen}
          onOpenChange={(open) => {
            if (!open) {
              setComposeError(undefined);
              composer.reset();
            }
            setIsComposeOpen(open);
          }}
          composer={composer}
          error={composeError}
          onSend={(sourceType, sourceId, recipient, templateVersionId) => {
            void composer
              .send(sourceType, sourceId, recipient, templateVersionId)
              .then((result) => {
                if (result.accepted) {
                  setIsComposeOpen(false);
                  if (result.replayed) {
                    toast.info(
                      t.errors.idempotencyReplayedTitle,
                      t.errors.idempotencyReplayedDescription,
                    );
                  } else {
                    // "Queued", never "sent" — the 202 says accepted for
                    // delivery and nothing more.
                    toast.success(
                      t.crmOutboundEmails.queuedTitle,
                      t.crmOutboundEmails.queuedDescription,
                    );
                  }
                  void reload();
                  return;
                }
                if (result.error) {
                  setComposeError(
                    t.crmOutboundEmails.errors[result.error.code ?? ""] ??
                      t.crmOutboundEmails.sendFailed,
                  );
                  toast.outcomeFromApi(result.error);
                }
              });
          }}
        />
      </div>
    </PermissionGate>
  );
}
