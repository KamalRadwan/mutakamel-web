"use client";

import { useState } from "react";
import { Laptop, Loader2, LogOut, RefreshCw, ShieldAlert, ShieldOff } from "lucide-react";
import { Badge, Button, ConfirmActionModal } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { AuthSessionSummary } from "@/lib/auth/sessionApi";
import { useAuthSessions } from "../hooks/useAuthSessions";

export function AuthSessionsPanel() {
  const { lang, t } = useI18n();
  const copy = t.authActions.sessions;
  const {
    sessions,
    isLoading,
    revokingId,
    isLoggingOutAll,
    error,
    reload,
    revoke,
    logoutEverywhere,
  } = useAuthSessions();
  const [pendingSession, setPendingSession] = useState<AuthSessionSummary | null>(null);
  const [isLogoutAllOpen, setIsLogoutAllOpen] = useState(false);
  const locale = lang === "ar" ? "ar-EG" : "en-US";
  const isConfirmingSession = pendingSession?.id === revokingId;
  const isBusy = revokingId !== null || isLoggingOutAll;

  const closeSessionConfirmation = () => {
    if (!isConfirmingSession) setPendingSession(null);
  };

  const confirmRevocation = async () => {
    if (!pendingSession || isConfirmingSession) return;
    if (await revoke(pendingSession)) setPendingSession(null);
  };

  const closeLogoutAllConfirmation = () => {
    if (!isLoggingOutAll) setIsLogoutAllOpen(false);
  };

  const confirmLogoutAll = async () => {
    if (isLoggingOutAll) return;
    if (await logoutEverywhere()) setIsLogoutAllOpen(false);
  };

  return (
    <>
      <section
        aria-busy={isLoading || isBusy}
        className="space-y-4 rounded-lg border border-border bg-card p-5"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Laptop className="size-4 text-muted-foreground" />
              {copy.title}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {copy.description}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsLogoutAllOpen(true)}
              disabled={isLoading || isBusy}
              className="border-destructive/40 text-destructive hover:bg-destructive-subtle"
            >
              <LogOut className="size-4" />
              {copy.logoutAllButton}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void reload()}
              disabled={isLoading || isBusy}
              className="w-9 p-0"
              aria-label={copy.refresh}
            >
              <RefreshCw className={`size-4 ${isLoading ? "animate-spin motion-reduce:animate-none" : ""}`} aria-hidden="true" />
            </Button>
          </div>
        </div>

        {error && (
          <p role="alert" className="text-xs font-medium text-destructive">
            {copy.error}
          </p>
        )}

        {isLoading ? (
          <div role="status" className="flex items-center justify-center p-8 text-muted-foreground">
            <Loader2 className="size-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            <span className="sr-only">{copy.loading}</span>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {sessions.map((session) => (
              <article
                key={session.id}
                className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">
                      {session.deviceLabel ?? session.clientId}
                    </span>
                    {session.current && <Badge tone="brand">{copy.current}</Badge>}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {copy.lastUsed}: {formatDate(
                      session.lastUserActivityAt ??
                        session.lastAccessIssuedAt ??
                        session.lastRefreshAt ??
                        session.createdAt,
                      locale,
                    )}
                    {" · "}
                    {copy.refreshes}: {session.refreshUseCount}
                    {" · "}
                    {copy.accessIssuances}: {session.accessIssueCount}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {session.clientId} · {session.clientType}
                  </p>
                </div>
                {!session.endedAt && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPendingSession(session)}
                    disabled={isBusy}
                    loading={revokingId === session.id}
                    className="border-destructive/40 text-destructive hover:bg-destructive-subtle"
                  >
                    {revokingId !== session.id && <ShieldOff className="size-4" />}
                    {session.current ? copy.endCurrent : copy.revoke}
                  </Button>
                )}
              </article>
            ))}
            {sessions.length === 0 && (
              <p className="py-6 text-center text-xs text-muted-foreground">
                {copy.empty}
              </p>
            )}
          </div>
        )}
      </section>

      <ConfirmActionModal
        isOpen={pendingSession !== null}
        onClose={closeSessionConfirmation}
        onConfirm={() => void confirmRevocation()}
        titleEn={pendingSession?.current ? copy.endCurrentTitle : copy.revokeTitle}
        titleAr={pendingSession?.current ? copy.endCurrentTitle : copy.revokeTitle}
        descriptionEn={pendingSession?.current
          ? copy.endCurrentDescription
          : copy.revokeDescription}
        descriptionAr={pendingSession?.current
          ? copy.endCurrentDescription
          : copy.revokeDescription}
        variant="danger"
        icon={ShieldAlert}
        isLoading={isConfirmingSession}
        confirmTextEn={pendingSession?.current ? copy.endCurrent : copy.revoke}
        confirmTextAr={pendingSession?.current ? copy.endCurrent : copy.revoke}
        loadingLabel={pendingSession?.current ? copy.endingCurrent : copy.revoking}
      />

      <ConfirmActionModal
        isOpen={isLogoutAllOpen}
        onClose={closeLogoutAllConfirmation}
        onConfirm={() => void confirmLogoutAll()}
        titleEn={copy.logoutAllTitle}
        titleAr={copy.logoutAllTitle}
        descriptionEn={copy.logoutAllDescription}
        descriptionAr={copy.logoutAllDescription}
        variant="danger"
        icon={ShieldAlert}
        isLoading={isLoggingOutAll}
        confirmTextEn={copy.logoutAllConfirm}
        confirmTextAr={copy.logoutAllConfirm}
        loadingLabel={copy.logoutAllSubmitting}
      />
    </>
  );
}

function formatDate(value: string, locale: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}
