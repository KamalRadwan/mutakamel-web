"use client";

import { CircleMinus, Info, MapPin } from "lucide-react";
import { Badge, Button, Card } from "@/design-system";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { Language } from "@/i18n/useLanguage";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import type { RoleBranchPermissionsDocument } from "../contracts/role-branch-contract";
import {
  formatBranchAccessModeLabel,
  formatReviewDiffDescription,
  type BranchReviewItem,
} from "../hooks/branch-permissions-review";
import type { RoleBranchStatusBanner } from "../hooks/useRoleBranchSaveFlow";

interface RoleBranchReviewStepProps {
  t: Dictionary;
  lang: Language;
  readOnly: boolean;
  document: RoleBranchPermissionsDocument | null;
  items: BranchReviewItem[];
  isClearingAllSaved: boolean;
  statusBanner: RoleBranchStatusBanner;
  onAdoptServerVersion: () => void;
}

export function RoleBranchReviewStep({
  t,
  lang,
  readOnly,
  document,
  items,
  isClearingAllSaved,
  statusBanner,
  onAdoptServerVersion,
}: RoleBranchReviewStepProps) {
  const reviewCopy = t.coreIdentity.roleBranch.review;
  const scopeCopy = t.coreIdentity.roleBranch.scope;

  const showGlobalTransition =
    !readOnly &&
    document !== null &&
    document.permissionMode === "GLOBAL" &&
    document.globalPermissionIds.length > 0;

  return (
    <div className="flex min-w-0 flex-col gap-3.5">
      <div className="flex flex-col gap-0.5">
        <h3 className="text-base font-medium text-foreground">{reviewCopy.title}</h3>
        <p className="text-xs text-muted-foreground">{reviewCopy.subtitle}</p>
      </div>

      {statusBanner === "comparison" && document ? (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-warning-subtle px-3 py-2.5 text-xs text-warning-subtle-foreground"
        >
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="font-medium">{reviewCopy.comparisonBannerTitle}</span>
            <span>
              {formatTemplate(reviewCopy.comparisonBannerDescription, {
                branches: formatNumber(document.profiles.length, lang),
              })}
            </span>
          </div>
          {!readOnly ? (
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={onAdoptServerVersion}
            >
              {reviewCopy.adoptServerVersion}
            </Button>
          ) : null}
        </div>
      ) : null}

      {statusBanner === "not-applied" ? (
        <p
          role="status"
          className="rounded-md border border-border bg-info-subtle px-3 py-2 text-xs text-info-subtle-foreground"
        >
          {reviewCopy.notAppliedBanner}
        </p>
      ) : null}

      {showGlobalTransition ? (
        <div
          role="status"
          className="flex flex-col gap-0.5 rounded-md border border-border bg-warning-subtle px-3 py-2.5 text-xs text-warning-subtle-foreground"
        >
          <span className="font-medium">{reviewCopy.globalTransitionTitle}</span>
          <span>
            {formatTemplate(reviewCopy.globalTransitionDescription, {
              count: formatNumber(document.globalPermissionIds.length, lang),
            })}
          </span>
        </div>
      ) : null}

      {isClearingAllSaved ? (
        <div
          role="alert"
          className="flex flex-col gap-0.5 rounded-md border border-destructive/30 bg-destructive-subtle px-3 py-2.5 text-xs text-destructive-subtle-foreground"
        >
          <span className="font-medium">{reviewCopy.clearAllWarningTitle}</span>
          <span>{reviewCopy.clearAllWarningDescription}</span>
        </div>
      ) : null}

      <div className="flex flex-col gap-2.5">
        {items.map((item) => {
          const modeLabel = formatBranchAccessModeLabel(item.mode, t, lang);
          const diffLabel = formatReviewDiffDescription(item, t, lang);
          const badgeTone = !item.isIncluded
            ? "neutral"
            : item.mode.kind === "READ_ONLY"
              ? "caution"
              : item.mode.kind === "EMPTY"
                ? "neutral"
                : "brand";

          return (
            <Card key={item.branchId} className="p-3.5">
              <div className="grid gap-2 sm:grid-cols-2 sm:items-center">
                <div className="flex min-w-0 items-start gap-2.5">
                  {item.isIncluded ? (
                    <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  ) : (
                    <CircleMinus
                      className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                  )}
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-sans text-caption font-normal text-foreground">
                        <bdi dir="auto">{item.branchName === item.branchId ? t.common.nameUnavailable : item.branchName}</bdi>
                      </span>
                      {!item.isActive ? (
                        <Badge tone="caution" size="sm">
                          {scopeCopy.inactiveSavedBadge}
                        </Badge>
                      ) : null}
                    </div>
                    <span className="truncate text-xs text-muted-foreground">
                      <bdi dir="auto">{item.companyName}</bdi>
                    </span>
                  </div>
                </div>

                <div className="flex min-w-0 flex-col gap-1 sm:items-start">
                  <Badge tone={badgeTone} size="sm">
                    {modeLabel}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{diffLabel}</span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div
        role="note"
        className="flex items-center gap-2.5 rounded-md bg-info-subtle px-3.5 py-2.5 text-xs text-info-subtle-foreground"
      >
        <Info className="size-4 shrink-0" aria-hidden="true" />
        <span>{reviewCopy.unionBanner}</span>
      </div>
    </div>
  );
}
