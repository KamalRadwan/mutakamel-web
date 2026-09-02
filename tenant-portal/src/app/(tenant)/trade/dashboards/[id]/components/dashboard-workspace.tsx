"use client";

import { useState } from "react";
import { Play, Plus, Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  DegradedBanner,
  DetailHeader,
  DetailSection,
  EmptyState,
  ErrorState,
  Field,
  IdentifierText,
  Input,
  NotFoundState,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatDateTime } from "@/lib/format/date";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { tradeStatusLabel } from "../../../trade-advanced-validation";
import { WidgetTile } from "../../components/WidgetTile";
import { useDashboardDetail } from "../hooks/useDashboardDetail";

export function DashboardWorkspace({ dashboardId }: { dashboardId: string }) {
  const { t } = useI18n();
  const [widgetId, setWidgetId] = useState("");
  const [shareSubjectId, setShareSubjectId] = useState("");
  const {
    lang,
    dashboard,
    run,
    shares,
    shareTargets,
    sharesUnavailable,
    isLoading,
    queryError,
    isNotFound,
    isPermissionRefusal,
    pending,
    actionError,
    execute,
    saveLayout,
    addPlacement,
    removePlacement,
    upsertShares,
    removeShare,
    reload,
  } = useDashboardDetail(dashboardId);

  const canEdit = dashboard?.accessLevel === "OWNER" || dashboard?.accessLevel === "EDIT";

  return (
    <div className="flex flex-col gap-4">
      <DetailHeader
        title={dashboard?.name ?? t.tradeAnalytics.dashboardDetailTitle}
        subtitle={dashboard?.description ?? undefined}
        status={
          dashboard ? (
            <Badge tone="neutral">{tradeStatusLabel(t.tradeStatus, dashboard.accessLevel, t.common.unknownCode)}</Badge>
          ) : undefined
        }
        backLabel={t.tradeAnalytics.backToDashboards}
        backHref={TENANT_ROUTES.tradeDashboards}
        secondaryActions={
          dashboard ? (
            <>
              <Button
                variant="outline"
                disabled={pending !== null}
                loading={pending === "run"}
                onClick={() => void execute()}
              >
                <Play className="size-4" aria-hidden="true" />
                {t.tradeAnalytics.run}
              </Button>
              {canEdit ? (
                <Button
                  variant="outline"
                  disabled={pending !== null}
                  loading={pending === "layout"}
                  onClick={() => void saveLayout(dashboard.placements)}
                >
                  {t.tradeAnalytics.saveLayout}
                </Button>
              ) : null}
            </>
          ) : undefined
        }
      />

      {isNotFound ? (
        <NotFoundState
          title={t.tradeAnalytics.dashboardNotFound}
          description={t.tradeAnalytics.dashboardNotFoundDescription}
          backLabel={t.tradeAnalytics.backToDashboards}
          backHref={TENANT_ROUTES.tradeDashboards}
        />
      ) : isLoading ? (
        <Skeleton className="h-96" />
      ) : queryError ? (
        <ErrorState
          title={
            isPermissionRefusal
              ? t.tradeAnalytics.serviceLevelRefusal
              : t.tradeAnalytics.dashboardLoadFailed
          }
          description={queryError.message}
          onRetry={() => void reload()}
          retryLabel={t.common.retry}
        />
      ) : dashboard ? (
        <>
          {actionError ? <DegradedBanner message={actionError} /> : null}
          {/* PARTIAL is a first-class outcome, not a failure: some tiles came
              back and some did not. */}
          {run?.status === "PARTIAL" ? (
            <DegradedBanner message={t.tradeAnalytics.runPartial} />
          ) : null}
          {dashboard.unavailablePlacements.length > 0 ? (
            <DegradedBanner
              message={dashboard.unavailablePlacements
                .map((entry) => tradeStatusLabel(t.tradeStatus, entry.reasonCode, t.common.unknownCode))
                .join(" · ")}
            />
          ) : null}

          {dashboard.placements.length === 0 ? (
            <EmptyState
              title={t.tradeAnalytics.noPlacements}
              description={t.tradeAnalytics.noPlacementsDescription}
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {dashboard.placements.map((placement) => (
                <div key={placement.id} className="flex flex-col gap-2">
                  <WidgetTile
                    title={placement.widget.name}
                    visualizationType={placement.widget.visualizationType}
                    result={run?.widgets.find((entry) => entry.widgetId === placement.widgetId)}
                    lang={lang}
                  />
                  {canEdit ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending !== null}
                      onClick={() => void removePlacement(placement.id)}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                      {t.tradeAnalytics.removePlacement}
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          )}

          {canEdit ? (
            <DetailSection
              title={t.tradeAnalytics.addPlacement}
              description={t.tradeAnalytics.addPlacementDescription}
            >
              <div className="flex items-end gap-3">
                <Field label={t.tradeAnalytics.widgetId} required>
                  <Input
                    value={widgetId}
                    disabled={pending !== null}
                    placeholder={t.tradeInventory.uuidPlaceholder}
                    onChange={(event) => setWidgetId(event.target.value)}
                  />
                </Field>
                <Button
                  variant="outline"
                  disabled={pending !== null}
                  loading={pending === "place"}
                  onClick={() => void addPlacement(widgetId)}
                >
                  <Plus className="size-4" aria-hidden="true" />
                  {t.tradeAnalytics.addPlacement}
                </Button>
              </div>
            </DetailSection>
          ) : null}

          <DetailSection
            title={t.tradeAnalytics.shares}
            description={t.tradeAnalytics.sharesDescription}
          >
            {sharesUnavailable ? (
              <DegradedBanner message={t.tradeAnalytics.sharesUnavailable} />
            ) : null}

            {canEdit && shareTargets.length > 0 ? (
              <div className="mb-3 flex items-end gap-3">
                <Field label={t.tradeAnalytics.subjectId} hint={t.tradeAnalytics.subjectIdHint}>
                  <Select
                    value={shareSubjectId === "" ? undefined : shareSubjectId}
                    disabled={pending !== null}
                    onValueChange={setShareSubjectId}
                  >
                    <SelectTrigger aria-label={t.tradeAnalytics.subjectId}>
                      <SelectValue placeholder={t.tradeAnalytics.subjectPlaceholder} />
                    </SelectTrigger>
                    <SelectContent>
                      {shareTargets.map((target) => (
                        <SelectItem key={target.subjectId} value={target.subjectId}>
                          {target.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Button
                  variant="outline"
                  disabled={pending !== null || shareSubjectId === ""}
                  loading={pending === "share"}
                  onClick={() => {
                    const target = shareTargets.find(
                      (entry) => entry.subjectId === shareSubjectId,
                    );
                    if (!target) return;
                    void upsertShares([
                      {
                        subjectId: target.subjectId,
                        // OWNER is not assignable; VIEW is the safe default.
                        subjectType: target.subjectType === "TEAM" ? "TEAM" : "USER",
                        accessLevel: "VIEW",
                      },
                    ]);
                  }}
                >
                  <Plus className="size-4" aria-hidden="true" />
                  {t.tradeAnalytics.addShare}
                </Button>
              </div>
            ) : null}

            {shares.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.tradeAnalytics.sharesEmpty}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {shares.map((share) => (
                  <li key={share.id} className="flex items-center gap-2 text-sm">
                    <Badge tone="neutral">
                      {tradeStatusLabel(t.tradeStatus, share.subjectType, t.common.unknownCode)}
                    </Badge>
                    <IdentifierText className="text-xs">{share.subjectId}</IdentifierText>
                    <Badge tone="brand">
                      {tradeStatusLabel(t.tradeStatus, share.accessLevel, t.common.unknownCode)}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending !== null}
                      onClick={() => void removeShare(share.id)}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </DetailSection>

          <p className="text-xs text-muted-foreground">
            {`${t.tradeCommon.revision} ${dashboard.revision} · ${formatDateTime(dashboard.updatedAt, lang)}`}
          </p>
        </>
      ) : null}
    </div>
  );
}
