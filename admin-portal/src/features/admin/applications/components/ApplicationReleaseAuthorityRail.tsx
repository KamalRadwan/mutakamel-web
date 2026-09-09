"use client";

import {
  BookOpenCheck,
  CheckCircle2,
  CircleDashed,
  GitBranch,
  PackageCheck,
  Route,
  ShieldAlert,
} from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { Card, Button, Badge } from "@/design-system";
import type {
  ApplicationTechnicalReadinessView,
  ApplicationView,
} from "../types";

interface Props {
  application: ApplicationView;
  readiness: ApplicationTechnicalReadinessView | null;
  isReadinessLoading: boolean;
  hasReadinessError: boolean;
  canPublish: boolean;
  isPublishing: boolean;
  onPublish: () => void;
}

export function ApplicationReleaseAuthorityRail({
  application,
  readiness,
  isReadinessLoading,
  hasReadinessError,
  canPublish,
  isPublishing,
  onPublish,
}: Props) {
  const { t, lang } = useI18n();
  const copy = t.applications.detail.releaseAuthority;
  const hasAttributablePublication =
    application.publicationStatus === "PUBLISHED" &&
    Boolean(application.publishedAt) &&
    Boolean(application.publishedBy);
  const readinessUnavailable =
    isReadinessLoading || hasReadinessError || readiness === null;
  // The action is now publish *and* activate, then bind databases, so it stays
  // available to an already-published DRAFT that still has to be activated.
  const canOfferPublish =
    (application.publicationStatus === "UNPUBLISHED" ||
      application.hasPendingDraft === true ||
      application.lifecycleStatus === "DRAFT") &&
    application.lifecycleStatus !== "DISABLED";

  return (
    <Card aria-labelledby="release-authority-title">
      <header className="flex flex-col justify-between gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-semibold text-primary">
            {copy.eyebrow}
          </p>
          <h2 id="release-authority-title" className="mt-1 text-sm font-semibold text-foreground">
            {copy.title}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">{copy.subtitle}</p>
          {application.hasPendingDraft === true && <div className="mt-2 space-y-1"><Badge tone="warn">{copy.pendingDraft}</Badge><p className="text-xs text-muted-foreground">{copy.pendingDraftHint}</p></div>}
          {typeof application.hasPendingDraft !== "boolean" && application.publicationStatus === "PUBLISHED" && <p className="mt-2 text-xs text-muted-foreground">{copy.pendingDraftUnknown}</p>}
        </div>
        {canOfferPublish && canPublish && (
          <Button type="button" variant="primary" loading={isPublishing} onClick={onPublish} className="shrink-0">
            {!isPublishing && (
              <BookOpenCheck className="size-3.5" aria-hidden="true" />
            )}
            {isPublishing
              ? copy.publishing
              : application.hasPendingDraft === true && application.lifecycleStatus !== "DRAFT" ? copy.republish : t.applications.detail.publishActivate.title}
          </Button>
        )}
      </header>

      <div className="p-5">
        <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <AuthorityStage
            icon={GitBranch}
            label={copy.definition}
            value={`${copy.revision} ${application.technicalDefinitionRevision}`}
            detail={`${copy.runtimeTarget}: ${application.runtimeTarget ?? copy.notAdopted}`}
            state={
              readinessUnavailable
                ? "neutral"
                : readiness.checks.runtimeTarget
                  ? "ready"
                  : "blocked"
            }
          />
          <AuthorityStage
            icon={PackageCheck}
            label={copy.publication}
            value={`${application.publicationStatus} · ${copy.revision} ${application.publicationRevision}`}
            detail={hasAttributablePublication ? copy.publishedHint : copy.unpublishedHint}
            state={hasAttributablePublication ? "ready" : "blocked"}
          />
          <AuthorityStage
            icon={Route}
            label={copy.lifecycle}
            value={application.lifecycleStatus}
            detail={`${copy.revision} ${application.catalogueRevision}`}
            state={application.lifecycleStatus === "ACTIVE" ? "ready" : "neutral"}
          />
          <AuthorityStage
            icon={ShieldAlert}
            label={copy.tenantSelection}
            value={
              readinessUnavailable
                ? copy.unavailable
                : readiness.selectionAllowed
                  ? copy.allowed
                  : copy.blocked
            }
            detail={
              readinessUnavailable
                ? copy.unavailable
                : `${readiness.selectionBlockers.length} ${copy.blockers}`
            }
            state={
              readinessUnavailable
                ? "neutral"
                : readiness.selectionAllowed
                  ? "ready"
                  : "blocked"
            }
          />
        </ol>

        <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4 text-xs text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          {hasAttributablePublication ? (
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              <span>
                {copy.publishedBy}: <code className="font-mono" dir="ltr">{application.publishedBy}</code>
              </span>
              <span>
                {copy.publishedAt}:{" "}
                <time dateTime={application.publishedAt ?? undefined}>
                  {new Date(application.publishedAt as string).toLocaleString(
                    lang === "ar" ? "ar-EG" : "en-US",
                  )}
                </time>
              </span>
            </div>
          ) : (
            <p className="text-warning-subtle-foreground">{copy.unpublishedHint}</p>
          )}
          {canOfferPublish && !canPublish && (
            <p className="font-mono text-warning-subtle-foreground">{copy.permissionRequired}</p>
          )}
        </div>
      </div>
    </Card>
  );
}

function AuthorityStage({
  icon: Icon,
  label,
  value,
  detail,
  state,
}: {
  icon: typeof CircleDashed;
  label: string;
  value: string;
  detail: string;
  state: "ready" | "blocked" | "neutral";
}) {
  const tone = {
    ready: "border-success/30 bg-success-subtle",
    blocked: "border-warning/30 bg-warning-subtle",
    neutral: "border-border bg-muted",
  }[state];
  const StateIcon = state === "ready" ? CheckCircle2 : state === "blocked" ? ShieldAlert : CircleDashed;
  const stateIconTone =
    state === "ready"
      ? "text-success"
      : state === "blocked"
        ? "text-warning"
        : "text-muted-foreground";

  return (
    <li className={`rounded-md border p-3 ${tone}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <Icon className="size-3.5" aria-hidden="true" />
          {label}
        </div>
        <StateIcon className={`size-3.5 ${stateIconTone}`} aria-hidden="true" />
      </div>
      <p className="mt-2 break-words font-mono text-xs font-semibold text-foreground" dir="auto">{value}</p>
      <p className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">{detail}</p>
    </li>
  );
}
