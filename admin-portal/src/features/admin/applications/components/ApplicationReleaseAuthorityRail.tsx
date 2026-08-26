"use client";

import {
  BookOpenCheck,
  CheckCircle2,
  CircleDashed,
  GitBranch,
  Loader2,
  PackageCheck,
  Route,
  ShieldAlert,
} from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
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
  const canOfferPublish =
    application.publicationStatus === "UNPUBLISHED" &&
    application.lifecycleStatus !== "DISABLED";

  return (
    <section
      aria-labelledby="release-authority-title"
      className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <header className="flex flex-col justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center dark:border-slate-800">
        <div>
          <p className="font-mono text-2xs font-semibold uppercase tracking-[0.2em] text-violet-600 dark:text-violet-300">
            {copy.eyebrow}
          </p>
          <h2 id="release-authority-title" className="mt-1 text-sm font-semibold">
            {copy.title}
          </h2>
          <p className="mt-1 text-xs text-slate-500">{copy.subtitle}</p>
        </div>
        {canOfferPublish && canPublish && (
          <button
            type="button"
            onClick={onPublish}
            disabled={isPublishing}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 disabled:opacity-50 dark:focus-visible:ring-offset-slate-900"
          >
            {isPublishing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <BookOpenCheck className="h-3.5 w-3.5" />
            )}
            {isPublishing ? copy.publishing : copy.publish}
          </button>
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

        <div className="mt-4 flex flex-col gap-2 border-t border-slate-200 pt-4 text-xs text-slate-500 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between dark:border-slate-800">
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
            <p className="text-amber-700 dark:text-amber-300">{copy.unpublishedHint}</p>
          )}
          {canOfferPublish && !canPublish && (
            <p className="font-mono text-amber-700 dark:text-amber-300">
              {copy.permissionRequired}
            </p>
          )}
        </div>
      </div>
    </section>
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
    ready: "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/20",
    blocked: "border-amber-200 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/20",
    neutral: "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950",
  }[state];
  const StateIcon = state === "ready" ? CheckCircle2 : state === "blocked" ? ShieldAlert : CircleDashed;

  return (
    <li className={`rounded-xl border p-3 ${tone}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-2xs font-semibold uppercase tracking-wider text-slate-500">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </div>
        <StateIcon className={`h-3.5 w-3.5 ${state === "ready" ? "text-emerald-600" : state === "blocked" ? "text-amber-600" : "text-slate-400"}`} />
      </div>
      <p className="mt-2 break-words font-mono text-xs font-semibold" dir="auto">{value}</p>
      <p className="mt-1 break-words text-xs leading-relaxed text-slate-500">{detail}</p>
    </li>
  );
}
