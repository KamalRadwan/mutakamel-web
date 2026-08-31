"use client";

import { useState } from "react";
import { RefreshCw, ShieldOff } from "lucide-react";
import {
  Badge,
  Button,
  ConfirmActionModal,
  DataTable,
  PageHeader,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  type ColumnDef,
} from "@/design-system";
import { formatDateTime } from "@/lib/format/date";
import { formatTemplate } from "@/lib/format/template";
import {
  useAuthenticationManagement,
  type AuthSessionItem,
} from "./hooks/useAuthenticationManagement";

const CLIENT_TYPE_KEY = {
  WEB: "clientTypeWeb",
  IOS: "clientTypeIos",
  ANDROID: "clientTypeAndroid",
  DESKTOP: "clientTypeDesktop",
} as const;

export default function AuthenticationManagementPage() {
  const { t, lang, items, isLoading, error, revokingId, reload, revoke } =
    useAuthenticationManagement();
  const [pendingSession, setPendingSession] = useState<AuthSessionItem | null>(null);
  const isConfirming = pendingSession?.id === revokingId;

  const closeConfirmation = () => {
    if (!isConfirming) setPendingSession(null);
  };

  const confirmRevocation = async () => {
    if (!pendingSession || isConfirming) return;
    if (await revoke(pendingSession)) setPendingSession(null);
  };

  const columns: ColumnDef<AuthSessionItem>[] = [
    {
      id: "device",
      header: t.authSessions.columnDevice,
      cell: (session) => (
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="font-medium text-foreground">{session.deviceLabel ?? session.clientId}</span>
          {session.current && <Badge tone="positive">{t.authSessions.thisDevice}</Badge>}
          {session.endedAt && <Badge tone="negative">{t.authSessions.ended}</Badge>}
        </span>
      ),
    },
    {
      id: "clientType",
      header: t.authSessions.columnClientType,
      cell: (session) => t.authSessions[CLIENT_TYPE_KEY[session.clientType]],
    },
    {
      id: "lastActivity",
      header: t.authSessions.columnLastActivity,
      cell: (session) =>
        formatDateTime(
          session.lastUserActivityAt ?? session.lastAccessIssuedAt ?? session.lastRefreshAt ?? session.createdAt,
          lang,
        ),
    },
    {
      id: "created",
      header: t.authSessions.columnCreated,
      cell: (session) => formatDateTime(session.createdAt, lang),
    },
    {
      id: "actions",
      header: t.authSessions.columnActions,
      align: "end",
      sticky: "end",
      cell: (session) => {
        if (session.endedAt) return null;
        const label = session.current ? t.authSessions.endThisSession : t.authSessions.revokeSession;
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                aria-label={label}
                disabled={revokingId !== null}
                loading={revokingId === session.id}
                onClick={() => setPendingSession(session)}
              >
                <ShieldOff className="size-4" aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t.authSessions.title}
        description={t.authSessions.subtitle}
        secondaryActions={
          <Button variant="outline" onClick={() => void reload()} disabled={isLoading}>
            <RefreshCw className={`size-4 ${isLoading ? "animate-spin" : ""}`} aria-hidden="true" />
            {t.authSessions.refresh}
          </Button>
        }
      />

      {/* No pagination: this endpoint returns the whole list and declares no
          page/limit query at all (verified in its controller). The fake
          single-page object this replaced rendered working-looking controls
          over data that could never advance —
          docs/design/states.md#pagination-is-real-or-absent. */}
      <DataTable
        columns={columns}
        rows={items}
        isLoading={isLoading}
        error={error ? { status: 0, code: error } : null}
        onRetry={() => void reload()}
        rowKey={(session) => session.id}
        labels={{
          retry: t.common.retry,
          errorTitle: t.authSessions.loadFailed,
          emptyTitle: t.authSessions.empty,
          selectAll: t.common.actions,
          selectRow: t.common.actions,
          sortAscending: t.common.actions,
          sortDescending: t.common.actions,
          notSorted: t.common.actions,
          pagination: {
            previous: t.common.previousPage,
            next: t.common.nextPage,
            summary: (from, to, total) => formatTemplate(t.common.showingOf, { from, to, total }),
          },
        }}
      />

      <ConfirmActionModal
        open={pendingSession !== null}
        onOpenChange={(open) => {
          if (!open) closeConfirmation();
        }}
        title={pendingSession?.current ? t.authSessions.confirmEndTitle : t.authSessions.confirmRevokeTitle}
        description={pendingSession?.current ? t.authSessions.confirmEndMessage : t.authSessions.confirmRevokeMessage}
        confirmLabel={pendingSession?.current ? t.authSessions.endThisSession : t.authSessions.revokeSession}
        cancelLabel={t.common.cancel}
        onConfirm={() => void confirmRevocation()}
        loading={isConfirming}
      />
    </div>
  );
}
