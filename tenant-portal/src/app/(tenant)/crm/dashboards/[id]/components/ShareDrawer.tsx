"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  Combobox,
  DatePicker,
  DateTime,
  Field,
  FormDrawer,
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
} from "../../share-contract";

interface ShareDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shares: ShareRecord[];
  targets: ShareTarget[];
  isLoading: boolean;
  isSubmitting: boolean;
  error?: string;
  onSearchTargets: (query: string) => void;
  onShare: (input: {
    subjectType: ShareTarget["type"];
    subjectId: string;
    accessLevel: ShareAccessLevel;
    expiresAt: string;
  }) => void;
  onRevoke: (shareId: string) => void;
}

export function ShareDrawer({
  open,
  onOpenChange,
  shares,
  targets,
  isLoading,
  isSubmitting,
  error,
  onSearchTargets,
  onShare,
  onRevoke,
}: ShareDrawerProps) {
  const { t } = useI18n();
  const [subjectId, setSubjectId] = useState<string | undefined>(undefined);
  const [accessLevel, setAccessLevel] = useState<ShareAccessLevel>("VIEW");
  const [expiresAt, setExpiresAt] = useState<Date | undefined>(undefined);

  const selected = targets.find((target) => target.id === subjectId);

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={t.crmDashboards.shareTitle}
      description={t.crmDashboards.shareDescription}
      isDirty={subjectId !== undefined}
      isSubmitting={isSubmitting}
      submitDisabled={!selected}
      onSubmit={() => {
        if (!selected) return;
        onShare({
          subjectType: selected.type,
          subjectId: selected.id,
          accessLevel,
          // A date-only pick becomes an instant; the server refuses a past one
          // with `422 CRM_SHARE_EXPIRY_INVALID`.
          expiresAt: expiresAt ? expiresAt.toISOString() : "",
        });
        setSubjectId(undefined);
        setExpiresAt(undefined);
      }}
      error={error}
      labels={{
        submit: t.crmDashboards.shareSubmit,
        cancel: t.common.cancel,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
      }}
    >
      <Field label={t.crmDashboards.shareTarget} required>
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

      <Field label={t.crmDashboards.shareExpiry} hint={t.crmDashboards.shareExpiryHint}>
        <DatePicker
          value={expiresAt}
          onValueChange={setExpiresAt}
          placeholder={t.crmDashboards.shareExpiryPlaceholder}
          clearLabel={t.crmDashboards.clearExpiry}
          startMonth={new Date()}
        />
      </Field>

      <section className="flex flex-col gap-1.5">
        <h3 className="text-sm font-medium text-foreground">{t.crmDashboards.currentShares}</h3>
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
    </FormDrawer>
  );
}
