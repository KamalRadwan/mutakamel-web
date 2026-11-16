"use client";

import { useMemo, useState } from "react";
import {
  AtomicReplacementConfirm,
  Button,
  DegradedBanner,
  DetailSection,
  ErrorState,
  Field,
  Input,
  MultiSelect,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  PermissionGate,
  type ReplacementDiff,
  type ReplacementItem,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import { PIPELINE_ACCESS_MODES } from "../pipeline-contract";
import type { usePipelineAssignments } from "../hooks/usePipelineAssignments";

interface PipelineAssignmentsSectionProps {
  state: ReturnType<typeof usePipelineAssignments>;
  canManage: boolean;
  isDefault: boolean;
  onSave: () => void;
  error?: string;
  blocked?: boolean;
  onReconcile?: () => void;
}

/**
 * `PUT /pipelines/:id/assignments` replaces the whole assignment set, so the
 * removals are invisible in the payload — the confirm shows them before the
 * write. docs/design/patterns.md#atomicreplacementconfirm.
 */
export function PipelineAssignmentsSection({
  state,
  canManage,
  isDefault,
  onSave,
  error,
  blocked,
  onReconcile,
}: PipelineAssignmentsSectionProps) {
  const { t, lang } = useI18n();
  const [confirming, setConfirming] = useState(false);

  const combinedDiff = useMemo<ReplacementDiff>(
    () => ({
      added: [
        ...withHint(state.userDiff.added, t.crmPipelines.assignmentUsers),
        ...withHint(state.teamDiff.added, t.crmPipelines.assignmentTeams),
      ],
      removed: [
        ...withHint(state.userDiff.removed, t.crmPipelines.assignmentUsers),
        ...withHint(state.teamDiff.removed, t.crmPipelines.assignmentTeams),
      ],
      unchanged: [
        ...withHint(state.userDiff.unchanged, t.crmPipelines.assignmentUsers),
        ...withHint(state.teamDiff.unchanged, t.crmPipelines.assignmentTeams),
      ],
    }),
    [state.userDiff, state.teamDiff, t],
  );

  if (!canManage) {
    return (
      <DetailSection
        title={t.crmPipelines.assignmentsTitle}
        description={t.crmPipelines.assignmentsManageOnly}
      />
    );
  }

  if (state.isLoading && !state.assignments) {
    return (
      <DetailSection title={t.crmPipelines.assignmentsTitle}>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-2/3" />
        </div>
      </DetailSection>
    );
  }

  if (state.loadError && (!state.assignments || state.loadError.status === 403)) {
    return (
      <DetailSection title={t.crmPipelines.assignmentsTitle}>
        <PermissionGate require="crm.pipelines.manage" denied={state.loadError.status === 403}><ErrorState
          title={t.crmPipelines.assignmentsUnavailable}
          description={t.crmPipelines.assignmentsUnavailableHint}
          retryLabel={t.common.retry}
          onRetry={() => void state.reload()}
        /></PermissionGate>
      </DetailSection>
    );
  }

  const restricted = state.accessMode === "RESTRICTED";
  const draftError = restricted && state.userIds.length + state.teamIds.length === 0
    ? t.crmPipelines.review.accessRequired
    : state.userIds.length > 100 || state.teamIds.length > 100 ? t.crmPipelines.review.accessLimit : undefined;

  return (
    <DetailSection
      title={t.crmPipelines.assignmentsTitle}
      description={t.crmPipelines.assignmentsDescription}
      columns={1}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={!state.isDirty || state.isSaving}
            onClick={state.revert}
          >
            {t.crmPipelines.revertAssignments}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!state.isDirty || state.isSaving || blocked || Boolean(draftError) || (isDefault && state.accessMode !== "ALL")}
            onClick={() => setConfirming(true)}
          >
            {t.crmPipelines.saveAssignments}
          </Button>
        </div>
        {state.loadError && <DegradedBanner message={t.crmPipelines.assignmentsUnavailableHint} />}
        {state.optionsError ? (
          <div className="space-y-2"><DegradedBanner message={t.crmPipelines.optionsUnavailable} />
            <Button variant="outline" onClick={() => void state.reloadOptions()} disabled={state.isLoadingOptions}>{t.common.retry}</Button>
          </div>
        ) : null}

        <Field showLabel
          label={t.crmPipelines.accessMode}
          hint={isDefault ? t.crmPipelines.defaultAccessModeHint : t.crmPipelines.accessModeHint}
        >
          <Select
            value={state.accessMode}
            disabled={isDefault || state.isSaving}
            onValueChange={(next) => {
              if (!isDefault && PIPELINE_ACCESS_MODES.includes(next as "ALL")) {
                state.setAccessMode(next as "ALL" | "RESTRICTED");
              }
            }}
          >
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PIPELINE_ACCESS_MODES.map((mode) => (
                <SelectItem key={mode} value={mode}>
                  {t.crmPipelines.accessModeValues[mode]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {restricted ? (
          <>
            <Field showLabel
              label={t.crmPipelines.optionsSearch}
              hint={formatTemplate(t.crmPipelines.optionsLimitHint, {
                limit: formatNumber(50, lang),
              })}
            >
              <Input size="sm" placeholder={t.crmPipelines.optionsSearch} maxLength={80} disabled={state.isSaving}
                value={state.optionsQuery}
                autoComplete="off"
                onChange={(event) => state.searchOptions(event.target.value)}
              />
            </Field>

            <Field showLabel label={t.crmPipelines.assignmentUsers}>
              <MultiSelect
                disabled={state.isSaving}
                values={state.userIds}
                onValuesChange={state.setUserIds}
                options={state.users.map((user) => ({
                  value: user.id,
                  label: user.label,
                  description: user.status === "ACTIVE" ? t.common.active : t.crmPipelines.review.invited,
                }))}
                placeholder={t.crmPipelines.assignmentUsersPlaceholder}
                searchPlaceholder={t.common.search}
                emptyLabel={
                  state.isLoadingOptions
                    ? t.common.loading
                    : t.crmPipelines.optionsEmpty
                }
                moreLabel={t.crmPipelines.moreChips}
                removeLabel={t.crmPipelines.removeChip}
                overflowLabel={t.crmPipelines.overflowChips}
                clearAllLabel={t.common.dismiss}
              />
            </Field>

            <Field showLabel label={t.crmPipelines.assignmentTeams}>
              <MultiSelect
                disabled={state.isSaving}
                values={state.teamIds}
                onValuesChange={state.setTeamIds}
                options={state.teams.map((team) => ({
                  value: team.id,
                  label: team.label,
                  description: team.code ?? undefined,
                }))}
                placeholder={t.crmPipelines.assignmentTeamsPlaceholder}
                searchPlaceholder={t.common.search}
                emptyLabel={
                  state.isLoadingOptions
                    ? t.common.loading
                    : t.crmPipelines.optionsEmpty
                }
                moreLabel={t.crmPipelines.moreChips}
                removeLabel={t.crmPipelines.removeChip}
                overflowLabel={t.crmPipelines.overflowChips}
                clearAllLabel={t.common.dismiss}
              />
            </Field>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            {t.crmPipelines.accessModeAllNote}
          </p>
        )}
      </div>

      {draftError && <p role="alert" className="text-sm text-destructive">{draftError}</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {blocked && onReconcile && <Button variant="outline" onClick={onReconcile}>{t.crmPipelines.review.checkCurrent}</Button>}

      <AtomicReplacementConfirm
        open={confirming}
        onOpenChange={setConfirming}
        diff={combinedDiff}
        loading={state.isSaving}
        formatCount={(count) => formatNumber(count, lang)}
        onConfirm={() => {
          setConfirming(false);
          if (isDefault && state.accessMode !== "ALL") return;
          onSave();
        }}
        labels={{
          title: t.crmPipelines.replaceTitle,
          description: t.crmPipelines.replaceDescription,
          addedHeading: t.crmPipelines.addedHeading,
          removedHeading: t.crmPipelines.removedHeading,
          unchangedHeading: t.crmPipelines.unchangedHeading,
          noChanges: t.crmPipelines.noChanges,
          confirm: t.crmPipelines.confirmReplace,
          cancel: t.common.cancel,
          // Gated only when something is being taken away — the consent is
          // about the removal, not about saving.
          acknowledge:
            combinedDiff.removed.length > 0
              ? t.crmPipelines.acknowledgeRemoval
              : undefined,
        }}
      />
    </DetailSection>
  );
}

function withHint(items: ReplacementItem[], hint: string): ReplacementItem[] {
  return items.map((item) => ({ ...item, hint }));
}
