"use client";

import Link from "next/link";
import { ChevronRight, ShieldAlert, type LucideIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ErrorState,
  EmptyState,
  Skeleton,
  cn,
  proseMeasure,
} from "@/design-system";
import { SEARCH_SOURCES, type SearchSourceId } from "../search-contract";
import type { SearchSourceState } from "../hooks/useGlobalSearch";

interface SearchSourceLabels {
  name: string;
  /** What this endpoint actually matches on — never left for the user to guess. */
  matches: string;
  openList: string;
  emptyTitle: string;
  emptyDescription: string;
  deniedTitle: string;
  deniedDescription: string;
  needsBranchTitle: string;
  needsBranchDescription: string;
  errorTitle: string;
  retry: string;
  countLabel: string;
  moreLabel: string;
}

interface SearchSourceSectionProps {
  sourceId: SearchSourceId;
  icon: LucideIcon;
  state: SearchSourceState;
  labels: SearchSourceLabels;
  onRetry: () => void;
}

/**
 * One record family's slice of the results.
 *
 * The 403 branch renders its own surface rather than `PermissionGate`, for the
 * reason recorded as defect D11: `PermissionGate` decides from `/auth/me`
 * permission strings, and a CRM read grant carries a scope suffix that says
 * nothing about WHICH records it reaches. An actor holding
 * `crm.leads.read.own` satisfies that check for every lead in the tenant,
 * including the ones the server just refused — so wrapping a server 403 in it
 * would render the children and swallow the refusal.
 */
export function SearchSourceSection({
  sourceId,
  icon: Icon,
  state,
  labels,
  onRetry,
}: SearchSourceSectionProps) {
  const source = SEARCH_SOURCES[sourceId];

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
          <CardTitle className="text-sm">{labels.name}</CardTitle>
          {state.kind === "ready" ? (
            <span className="text-xs text-muted-foreground">{labels.countLabel}</span>
          ) : null}
        </div>
        <Link
          href={source.listHref}
          className="inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline"
        >
          {labels.openList}
          <ChevronRight className="size-3 rtl:-scale-x-100" aria-hidden="true" />
        </Link>
      </CardHeader>

      <CardContent className="pt-0">
        <p className={cn("mb-3 text-xs text-muted-foreground", proseMeasure)}>
          {labels.matches}
        </p>
        <SectionBody
          sourceId={sourceId}
          state={state}
          labels={labels}
          onRetry={onRetry}
        />
      </CardContent>
    </Card>
  );
}

function SectionBody({
  sourceId,
  state,
  labels,
  onRetry,
}: Omit<SearchSourceSectionProps, "icon">) {
  const source = SEARCH_SOURCES[sourceId];

  switch (state.kind) {
    case "unauthorized":
      // Never rendered — the workspace filters these out before mapping. The
      // case is kept so a new state cannot be added without deciding this one.
      return null;

    case "loading":
      return (
        <div className="flex flex-col gap-2" aria-busy="true">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-4/5" />
          <Skeleton className="h-8 w-3/5" />
        </div>
      );

    case "needsBranch":
      return (
        <EmptyState
          title={labels.needsBranchTitle}
          description={labels.needsBranchDescription}
        />
      );

    case "denied":
      return (
        <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center">
          <ShieldAlert className="size-6 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm font-medium text-foreground">{labels.deniedTitle}</p>
          <p className={cn("text-xs text-muted-foreground", proseMeasure)}>
            {labels.deniedDescription}
          </p>
        </div>
      );

    case "failed":
      // Error REPLACES empty; it never stacks with it — docs/design/states.md.
      return (
        <ErrorState
          title={labels.errorTitle}
          description={state.error.message}
          onRetry={onRetry}
          retryLabel={labels.retry}
        />
      );

    case "ready":
      if (state.page.items.length === 0) {
        return (
          <EmptyState
            title={labels.emptyTitle}
            description={labels.emptyDescription}
          />
        );
      }
      return (
        <ul className="flex flex-col">
          {state.page.items.map((row) => (
            <li key={row.id}>
              <Link
                href={source.detailHref(row.id)}
                className="flex flex-col gap-0.5 rounded-sm px-2 py-2 hover:bg-accent"
              >
                <span className="wrap-anywhere text-sm text-foreground">
                  {row.title}
                </span>
                {row.subtitle ? (
                  <span className="wrap-anywhere text-xs text-muted-foreground">
                    {row.subtitle}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
          {state.page.total > state.page.items.length ? (
            <li className="px-2 pt-2">
              <Link
                href={source.listHref}
                className="text-xs text-primary underline-offset-2 hover:underline"
              >
                {labels.moreLabel}
              </Link>
            </li>
          ) : null}
        </ul>
      );
  }
}
