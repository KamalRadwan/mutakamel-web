"use client";

import { use, useState } from "react";
import { Eye, Plus, Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  DegradedBanner,
  DetailHeader,
  DetailSection,
  ErrorState,
  Field,
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
import { tradeStatusLabel } from "../../trade-advanced-validation";
import {
  DASHBOARD_SHAREABLE_ACCESS_LEVELS,
  DASHBOARD_SHARE_SUBJECT_TYPES,
  type DashboardShareSubjectType,
  type DashboardShareableAccessLevel,
} from "../../dashboards/analytics-contract";
import { WidgetTile } from "../../dashboards/components/WidgetTile";
import { useWidgetDetail } from "./hooks/useWidgetDetail";

export default function TradeWidgetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { t } = useI18n();
  const [subjectId, setSubjectId] = useState("");
  const [subjectType, setSubjectType] = useState<DashboardShareSubjectType>("USER");
  const [accessLevel, setAccessLevel] = useState<DashboardShareableAccessLevel>("VIEW");
  const {
    lang,
    widget,
    shares,
    shareTargets,
    sharesUnavailable,
    preview,
    isLoading,
    queryError,
    isNotFound,
    isPermissionRefusal,
    pending,
    actionError,
    runPreview,
    upsertShares,
    removeShare,
    reload,
  } = useWidgetDetail(id);

  return (
    <div className="flex flex-col gap-4">
      <DetailHeader
        title={widget?.name ?? t.tradeAnalytics.widgetDetailTitle}
        subtitle={
          widget ? tradeStatusLabel(t.tradeStatus, widget.visualizationType) : undefined
        }
        status={
          widget ? (
            <Badge tone="neutral">{tradeStatusLabel(t.tradeStatus, widget.accessLevel)}</Badge>
          ) : undefined
        }
        backLabel={t.tradeAnalytics.backToWidgets}
        backHref={TENANT_ROUTES.tradeWidgets}
        secondaryActions={
          widget ? (
            <Button
              variant="outline"
              disabled={pending !== null}
              loading={pending === "preview"}
              onClick={() => void runPreview()}
            >
              <Eye className="size-4" aria-hidden="true" />
              {t.tradeAnalytics.preview}
            </Button>
          ) : undefined
        }
      />

      {isNotFound ? (
        <NotFoundState
          title={t.tradeAnalytics.widgetNotFound}
          description={t.tradeAnalytics.widgetNotFoundDescription}
          backLabel={t.tradeAnalytics.backToWidgets}
          backHref={TENANT_ROUTES.tradeWidgets}
        />
      ) : isLoading ? (
        <Skeleton className="h-80" />
      ) : queryError ? (
        <ErrorState
          title={
            isPermissionRefusal
              ? t.tradeAnalytics.serviceLevelRefusal
              : t.tradeAnalytics.widgetLoadFailed
          }
          description={queryError.message}
          onRetry={() => void reload()}
          retryLabel={t.common.retry}
        />
      ) : widget ? (
        <>
          {actionError ? <DegradedBanner message={actionError} /> : null}

          <DetailSection
            title={t.tradeCommon.overview}
            emptyValueLabel={t.tradeCommon.notSet}
            fields={[
              { label: t.tradeAnalytics.displayTitle, value: widget.displayTitle },
              {
                label: t.tradeAnalytics.series,
                wide: true,
                value:
                  widget.series.length === 0 ? null : (
                    <span className="flex flex-wrap gap-1">
                      {widget.series.map((series) => (
                        <Badge key={series.metricKey} tone="neutral">
                          {series.metricKey}
                        </Badge>
                      ))}
                    </span>
                  ),
              },
              { label: t.tradeCommon.revision, value: String(widget.revision) },
              {
                label: t.tradeCommon.updatedAt,
                value: formatDateTime(widget.updatedAt, lang),
              },
            ]}
          />

          <DetailSection
            title={t.tradeAnalytics.preview}
            description={t.tradeAnalytics.previewDescription}
          >
            <WidgetTile
              title={widget.displayTitle ?? widget.name}
              visualizationType={widget.visualizationType}
              result={preview ?? undefined}
              lang={lang}
            />
          </DetailSection>

          <DetailSection
            title={t.tradeAnalytics.shares}
            description={t.tradeAnalytics.widgetSharesDescription}
          >
            {sharesUnavailable ? (
              <DegradedBanner message={t.tradeAnalytics.sharesUnavailable} />
            ) : null}

            <div className="flex flex-wrap items-end gap-3">
              <Field
                label={t.tradeAnalytics.subjectId}
                required
                hint={t.tradeAnalytics.subjectIdHint}
              >
                {shareTargets.length > 0 ? (
                  <Select
                    value={subjectId === "" ? undefined : subjectId}
                    disabled={pending !== null}
                    onValueChange={(next) => {
                      const target = shareTargets.find((entry) => entry.subjectId === next);
                      setSubjectId(next);
                      // The catalogue states the subject's own type; keeping
                      // the two in step avoids a 422 SHARE_TARGET_INVALID.
                      if (target?.subjectType === "TEAM" || target?.subjectType === "USER") {
                        setSubjectType(target.subjectType);
                      }
                    }}
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
                ) : (
                  <Input
                    value={subjectId}
                    disabled={pending !== null}
                    placeholder={t.tradeInventory.uuidPlaceholder}
                    onChange={(event) => setSubjectId(event.target.value)}
                  />
                )}
              </Field>
              <Field label={t.tradeAnalytics.subjectType} required>
                <Select
                  value={subjectType}
                  disabled={pending !== null}
                  onValueChange={(next) => setSubjectType(next as DashboardShareSubjectType)}
                >
                  <SelectTrigger aria-label={t.tradeAnalytics.subjectType}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DASHBOARD_SHARE_SUBJECT_TYPES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {tradeStatusLabel(t.tradeStatus, value)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field
                label={t.tradeAnalytics.accessLevel}
                required
                hint={t.tradeAnalytics.accessLevelHint}
              >
                <Select
                  value={accessLevel}
                  disabled={pending !== null}
                  onValueChange={(next) =>
                    setAccessLevel(next as DashboardShareableAccessLevel)
                  }
                >
                  <SelectTrigger aria-label={t.tradeAnalytics.accessLevel}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {/* OWNER is not assignable: ShareChangeDto is
                        @IsIn(["VIEW","EDIT"]). */}
                    {DASHBOARD_SHAREABLE_ACCESS_LEVELS.map((value) => (
                      <SelectItem key={value} value={value}>
                        {tradeStatusLabel(t.tradeStatus, value)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Button
                variant="outline"
                disabled={pending !== null}
                loading={pending === "share"}
                onClick={() => void upsertShares([{ subjectId, subjectType, accessLevel }])}
              >
                <Plus className="size-4" aria-hidden="true" />
                {t.tradeAnalytics.addShare}
              </Button>
            </div>

            {shares.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.tradeAnalytics.sharesEmpty}</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {shares.map((share) => (
                  <li key={share.id} className="flex items-center gap-2 text-sm">
                    <Badge tone="neutral">
                      {tradeStatusLabel(t.tradeStatus, share.subjectType)}
                    </Badge>
                    <span className="font-mono text-xs">{share.subjectId}</span>
                    <Badge tone="brand">
                      {tradeStatusLabel(t.tradeStatus, share.accessLevel)}
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
        </>
      ) : null}
    </div>
  );
}
