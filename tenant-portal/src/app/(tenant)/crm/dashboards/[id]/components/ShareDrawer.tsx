"use client";
import { DashboardRecoveryNotice, type DashboardRecoveryProps } from "../../components/DashboardRecoveryNotice";

import { useDashboardShareForm } from "../hooks/useDashboardShareForm";
import { Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  Combobox,
  DatePicker,
  DateTime,
  ErrorState,
  Field,
  FormDrawer,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { NormalizedApiError } from "@/lib/api/errors";
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
  sharesError?: NormalizedApiError | null;
  targetSearchError?: NormalizedApiError | null;
  onSearchTargets: (query: string) => void;
  onRetryShares: () => void;
  onRetryTargetSearch: () => void;
  onShare: (input: {
    subjectType: ShareTarget["type"];
    subjectId: string;
    accessLevel: ShareAccessLevel;
    expiresAt: string;
  }) => Promise<boolean>;
  onRevoke: (shareId: string) => void;
  blocked?: boolean;
  recovery?: DashboardRecoveryProps;
}

export function ShareDrawer({
  open,
  onOpenChange,
  shares,
  targets,
  isLoading,
  isSubmitting,
  error,
  sharesError,
  targetSearchError,
  onSearchTargets,
  onRetryShares,
  onRetryTargetSearch,
  onShare,
  onRevoke,
  blocked = false,
  recovery,
}: ShareDrawerProps) {
  const { t } = useI18n();
  const form = useDashboardShareForm(targets, onShare, blocked);
  const { selected, accessLevel, expiresAt } = form;

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={t.crmDashboards.shareTitle}
      description={t.crmDashboards.shareDescription}
      isDirty={form.dirty}
      isSubmitting={isSubmitting}
      submitDisabled={blocked || !selected}
      onSubmit={form.submit}
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
    {recovery && <DashboardRecoveryNotice {...recovery} />}
      <Field showLabel label={t.crmDashboards.shareTarget} required>
        <Combobox
          value={selected?.id}
          selectedLabel={selected?.name}
          onValueChange={form.select}
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
      {targetSearchError ? (
        <div role="alert">
          <ErrorState
            title={t.crmDashboards.shareTargetSearchFailed}
            description={t.crmDashboards.errors[targetSearchError.code ?? ""] ?? t.crmDashboards.actionFailed}
            onRetry={onRetryTargetSearch}
            retryLabel={t.common.retry}
            className="py-4"
          />
        </div>
      ) : null}

      <Field showLabel label={t.crmDashboards.shareAccessLevel}>
        <Select
          value={accessLevel}
          disabled={isSubmitting || blocked}
          onValueChange={(next) => form.setAccessLevel(next as ShareAccessLevel)}
        >
          <SelectTrigger size="sm">
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

      <Field showLabel label={t.crmDashboards.shareExpiry} hint={t.crmDashboards.shareExpiryHint} error={form.invalidExpiry ? t.crmDashboards.errors.CRM_SHARE_EXPIRY_INVALID : undefined}>
        <DatePicker
          value={expiresAt}
          disabled={isSubmitting || blocked}
          onValueChange={form.changeExpiry}
          placeholder={t.crmDashboards.shareExpiryPlaceholder}
          clearLabel={t.crmDashboards.clearExpiry}
          startMonth={new Date()}
        />
      </Field>

      <section className="flex flex-col gap-1.5">
        <h3 className="text-sm font-medium text-foreground">{t.crmDashboards.currentShares}</h3>
        {sharesError ? (
          <div role="alert">
            <ErrorState
              title={t.crmDashboards.shareLoadFailed}
              description={t.crmDashboards.errors[sharesError.code ?? ""] ?? t.crmDashboards.actionFailed}
              onRetry={onRetryShares}
              retryLabel={t.common.retry}
              className="py-4"
            />
          </div>
        ) : isLoading ? (
          <p className="text-xs text-muted-foreground" role="status">{t.common.loading}</p>
        ) : shares.length === 0 ? (
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
                    disabled={isSubmitting || blocked}
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




