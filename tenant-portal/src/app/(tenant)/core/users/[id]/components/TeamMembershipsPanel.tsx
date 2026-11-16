"use client";

import { Plus, Trash2 } from "lucide-react";
import {
  AtomicReplacementConfirm,
  Badge,
  Button,
  ConfirmActionModal,
  DataTable,
  DetailSection,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  type ColumnDef,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { useLanguage } from "@/i18n/useLanguage";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import type { TeamMembership } from "../../../contracts/user-subresource-contract";
import { useCoreErrorText } from "../../../hooks/useCoreErrorText";
import { useOrgNodeOptions } from "../../../hooks/useCoreOptions";
import {
  useUserTeamMemberships,
  type TeamMembershipDraftItem,
} from "../hooks/useUserTeamMemberships";
import { listTableLabels } from "./list-table-labels";
import {
  AddTeamMembershipModal,
  ReplaceTeamMembershipsModal,
} from "./TeamMembershipsModals";

interface TeamMembershipsPanelProps {
  userId: string;
  canManage: boolean;
  protectedTargetReason?: string;
  /** The user's home team — its membership is primary and cannot be removed. */
  homeTeamId: string | null;
}

export function TeamMembershipsPanel({
  userId,
  canManage: hasManagePermission,
  protectedTargetReason,
  homeTeamId,
}: TeamMembershipsPanelProps) {
  const { t } = useI18n();
  const lang = useLanguage();
  const copy = t.coreIdentity;
  const canManage = hasManagePermission && !protectedTargetReason;
  const describeError = useCoreErrorText();
  const panel = useUserTeamMemberships(userId, true, canManage);
  const teams = useOrgNodeOptions("teams");

  const unresolvedTeam = teams.isLoading
    ? copy.picker.loading
    : copy.grants.nameUnavailable;
  const teamLabel = (teamId: string) => teams.labelFor(teamId) ?? unresolvedTeam;

  function isPrimary(membership: TeamMembership): boolean {
    return membership.isPrimary || membership.teamId === homeTeamId;
  }

  const describeDraftItem = (item: TeamMembershipDraftItem) => ({
    label: teamLabel(item.teamId),
    hint: item.isPrimary
      ? `${copy.membershipRole[item.role]} · ${copy.memberships.primary}`
      : copy.membershipRole[item.role],
  });

  const columns: ColumnDef<TeamMembership>[] = [
    {
      id: "team",
      header: copy.levels.teams.singular,
      cell: (membership) => (
        <div className="flex items-center gap-1.5">
          <span className="text-foreground">{teamLabel(membership.teamId)}</span>
          {isPrimary(membership) ? (
            <Badge tone="brand">{copy.memberships.primary}</Badge>
          ) : null}
        </div>
      ),
    },
    {
      id: "role",
      header: copy.memberships.role,
      cell: (membership) => copy.membershipRole[membership.role],
    },
    ...(canManage
      ? [
          {
            id: "actions",
            header: t.common.actions,
            align: "end" as const,
            cell: (membership: TeamMembership) =>
              isPrimary(membership) ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      tabIndex={0}
                      className="cursor-default rounded-sm px-1.5 py-0.5 text-2xs text-muted-foreground"
                    >
                      {copy.users.protected}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{copy.memberships.primaryProtected}</TooltipContent>
                </Tooltip>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => panel.requestRemoval(membership)}
                  aria-label={`${t.common.delete}: ${teamLabel(membership.teamId)}`}
                >
                  <Trash2 className="size-4 text-destructive" aria-hidden="true" />
                </Button>
              ),
          },
        ]
      : []),
  ];

  const writeText = describeError(panel.writeError);
  const hasModalOpen =
    panel.isAddOpen || panel.draft !== null || panel.isReviewing;

  return (
    <DetailSection
      title={copy.memberships.title}
      description={copy.memberships.description}
      columns={1}
    >
      <div className="flex flex-col gap-3">
        {protectedTargetReason ? (
          <p className="text-xs text-muted-foreground">{protectedTargetReason}</p>
        ) : null}
        {writeText && !hasModalOpen ? (
          <p
            role="alert"
            className="rounded-sm border border-destructive/30 bg-destructive-subtle p-2.5 text-xs text-destructive-subtle-foreground"
          >
            {writeText}
          </p>
        ) : null}

        {canManage ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={panel.isSubmitting}
              onClick={panel.openAdd}
            >
              <Plus className="size-4" aria-hidden="true" />
              {copy.memberships.add}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={panel.isSubmitting || panel.memberships.length === 0}
              onClick={panel.startReplace}
            >
              {copy.memberships.replaceAll}
            </Button>
          </div>
        ) : null}

        <DataTable
          columns={columns}
          rows={panel.memberships}
          isLoading={panel.isLoading}
          error={panel.loadError}
          onRetry={panel.reload}
          rowKey={(membership) => membership.id}
          labels={listTableLabels(
            t,
            copy.memberships.loadFailed,
            copy.memberships.empty,
          )}
        />
      </div>

      {canManage && panel.isAddOpen ? (
        <AddTeamMembershipModal
          open={panel.isAddOpen}
          onClose={panel.closeAdd}
          panel={panel}
          teams={teams}
          writeError={writeText}
        />
      ) : null}

      {canManage && panel.draft !== null && !panel.isReviewing ? (
        <ReplaceTeamMembershipsModal
          draft={panel.draft}
          panel={panel}
          teams={teams}
          teamLabel={teamLabel}
          homeTeamId={homeTeamId}
          writeError={writeText}
        />
      ) : null}

      <ConfirmActionModal
        open={canManage && panel.pendingRemoval !== null}
        onOpenChange={(open) => {
          if (!open) panel.cancelRemoval();
        }}
        title={copy.memberships.removeTitle}
        description={formatTemplate(copy.memberships.removeMessage, {
          name: panel.pendingRemoval ? teamLabel(panel.pendingRemoval.teamId) : "",
        })}
        confirmLabel={copy.actions.delete}
        cancelLabel={t.common.cancel}
        onConfirm={() => {
          if (canManage) void panel.remove();
        }}
        loading={panel.isSubmitting}
      />

      <AtomicReplacementConfirm
        open={canManage && panel.isReviewing}
        onOpenChange={(open) => {
          if (!open) panel.closeReview();
        }}
        diff={panel.draftDiff(describeDraftItem)}
        onConfirm={() => {
          if (canManage) void panel.commitDraft();
        }}
        loading={panel.isSubmitting}
        formatCount={(count) => formatNumber(count, lang)}
        labels={{
          title: copy.memberships.replaceTitle,
          description: copy.memberships.replaceDescription,
          addedHeading: t.atomicReplacement.addedHeading,
          removedHeading: t.atomicReplacement.removedHeading,
          unchangedHeading: t.atomicReplacement.unchangedHeading,
          noChanges: t.atomicReplacement.noChanges,
          confirm: t.atomicReplacement.confirm,
          cancel: t.common.cancel,
          acknowledge: t.atomicReplacement.acknowledge,
        }}
      />
    </DetailSection>
  );
}
