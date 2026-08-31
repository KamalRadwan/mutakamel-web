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
  onSave: () => void;
}

/**
 * `PUT /pipelines/:id/assignments` replaces the whole assignment set, so the
 * removals are invisible in the payload — the confirm shows them before the
 * write. docs/design/patterns.md#atomicreplacementconfirm.
 */
export function PipelineAssignmentsSection({
  state,
  canManage,
  onSave,
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

  if (state.loadError) {
    return (
      <DetailSection title={t.crmPipelines.assignmentsTitle}>
        <ErrorState
          title={t.crmPipelines.assignmentsUnavailable}
          description={t.crmPipelines.assignmentsUnavailableHint}
          retryLabel={t.common.retry}
          onRetry={() => void state.reload()}
        />
      </DetailSection>
    );
  }

  const restricted = state.accessMode === "RESTRICTED";

  return (
    <DetailSection
      title={t.crmPipelines.assignmentsTitle}
      description={t.crmPipelines.assignmentsDescription}
      columns={1}
      action={
        <div className="flex items-center gap-2">
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
            disabled={!state.isDirty || state.isSaving}
            onClick={() => setConfirming(true)}
          >
            {t.crmPipelines.saveAssignments}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {state.optionsError ? (
          <DegradedBanner message={t.crmPipelines.optionsUnavailable} />
        ) : null}

        <Field
          label={t.crmPipelines.accessMode}
          hint={t.crmPipelines.accessModeHint}
        >
          <Select
            value={state.accessMode}
            onValueChange={(next) => {
              if (PIPELINE_ACCESS_MODES.includes(next as "ALL")) {
                state.setAccessMode(next as "ALL" | "RESTRICTED");
              }
            }}
          >
            <SelectTrigger>
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
            <Field
              label={t.crmPipelines.optionsSearch}
              hint={formatTemplate(t.crmPipelines.optionsLimitHint, {
                limit: formatNumber(50, lang),
              })}
            >
              <Input
                value={state.optionsQuery}
                autoComplete="off"
                onChange={(event) => state.searchOptions(event.target.value)}
              />
            </Field>

            <Field label={t.crmPipelines.assignmentUsers}>
              <MultiSelect
                values={state.userIds}
                onValuesChange={state.setUserIds}
                options={state.users.map((user) => ({
                  value: user.id,
                  label: user.label,
                  description: user.status,
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

            <Field label={t.crmPipelines.assignmentTeams}>
              <MultiSelect
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

      <AtomicReplacementConfirm
        open={confirming}
        onOpenChange={setConfirming}
        diff={combinedDiff}
        loading={state.isSaving}
        formatCount={(count) => formatNumber(count, lang)}
        onConfirm={() => {
          setConfirming(false);
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
