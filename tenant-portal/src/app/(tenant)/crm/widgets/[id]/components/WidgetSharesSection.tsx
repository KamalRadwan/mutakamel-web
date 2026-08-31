"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  Combobox,
  DateTime,
  Field,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import {
  SHARE_ACCESS_LEVELS,
  type ShareAccessLevel,
  type ShareRecord,
  type ShareTarget,
} from "../../../dashboards/share-contract";

interface WidgetSharesSectionProps {
  shares: ShareRecord[];
  targets: ShareTarget[];
  isLoading: boolean;
  isSubmitting: boolean;
  onSearchTargets: (query: string) => void;
  onShare: (input: {
    subjectType: ShareTarget["type"];
    subjectId: string;
    accessLevel: ShareAccessLevel;
  }) => void;
  onRevoke: (shareId: string) => void;
}

/**
 * Sharing, in the body of the widget detail screen.
 *
 * No expiry field here, unlike a dashboard's share drawer: a widget grant
 * exists to let someone place the widget, and a placement that silently stops
 * resolving when the grant lapses is the `WIDGET_ACCESS_REVOKED` state a
 * dashboard then has to explain. The route accepts `expiresAt`; this screen
 * does not offer it (Q106).
 */
export function WidgetSharesSection({
  shares,
  targets,
  isLoading,
  isSubmitting,
  onSearchTargets,
  onShare,
  onRevoke,
}: WidgetSharesSectionProps) {
  const { t } = useI18n();
  const [subjectId, setSubjectId] = useState<string | undefined>(undefined);
  const [accessLevel, setAccessLevel] = useState<ShareAccessLevel>("VIEW");
  const selected = targets.find((target) => target.id === subjectId);

  return (
    <section className="flex flex-col gap-2 rounded-sm border border-border bg-card p-3">
      <h2 className="text-sm font-medium text-foreground">{t.crmWidgets.sharesTitle}</h2>
      <p className="text-xs text-muted-foreground">{t.crmWidgets.sharesDescription}</p>

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-56 flex-1">
          <Field label={t.crmDashboards.shareTarget}>
            <Combobox
              value={subjectId}
              selectedLabel={selected?.name}
              onValueChange={setSubjectId}
              options={targets.map((target) => ({
                value: target.id,
                label: `${target.name} · ${t.crmDashboards.subjectTypes[target.type]}`,
              }))}
              onSearch={onSearchTargets}
              loading={isLoading}
              placeholder={t.crmDashboards.shareTargetPlaceholder}
              searchPlaceholder={t.crmDashboards.shareTargetSearch}
              loadingLabel={t.common.loading}
              emptyLabel={t.crmDashboards.shareTargetEmpty}
            />
          </Field>
        </div>
        <div className="min-w-36">
          <Field label={t.crmDashboards.shareAccessLevel}>
            <Select
              value={accessLevel}
              onValueChange={(next) => setAccessLevel(next as ShareAccessLevel)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SHARE_ACCESS_LEVELS.map((level) => (
                  <SelectItem key={level} value={level}>
                    {t.crmDashboards.shareAccessLevels[level]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Button
          variant="outline"
          disabled={!selected || isSubmitting}
          onClick={() => {
            if (!selected) return;
            onShare({ subjectType: selected.type, subjectId: selected.id, accessLevel });
            setSubjectId(undefined);
          }}
        >
          {t.crmDashboards.shareSubmit}
        </Button>
      </div>

      {shares.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t.crmDashboards.noShares}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {shares.map((share) => (
            <li
              key={share.id}
              className="flex items-center justify-between gap-2 rounded-sm border border-border p-2"
            >
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-foreground">
                  {share.subjectName ?? share.subjectEmail ?? share.subjectId}
                </p>
                <p className="truncate text-2xs text-muted-foreground">
                  {t.crmDashboards.subjectTypes[share.subjectType]}
                  {share.expiresAt ? " · " : ""}
                  {share.expiresAt ? <DateTime value={share.expiresAt} precision="date" /> : null}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Badge tone="neutral">
                  {t.crmDashboards.shareAccessLevels[share.accessLevel]}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isSubmitting}
                  aria-label={`${t.crmDashboards.revokeShare}: ${share.subjectName ?? share.subjectId}`}
                  onClick={() => onRevoke(share.id)}
                >
                  <Trash2 className="size-4 text-destructive" aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
