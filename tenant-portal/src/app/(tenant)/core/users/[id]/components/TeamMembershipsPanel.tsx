"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import {
  AtomicReplacementConfirm,
  Badge,
  Button,
  Combobox,
  ConfirmActionModal,
  DataTable,
  DetailSection,
  MultiSelect,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  type ColumnDef,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { useLanguage } from "@/i18n/useLanguage";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import {
  TEAM_MEMBERSHIP_ROLES,
  type TeamMembership,
  type TeamMembershipRole,
} from "../../../contracts/user-subresource-contract";
import { useCoreErrorText } from "../../../hooks/useCoreErrorText";
import { useOrgNodeOptions } from "../../../hooks/useCoreOptions";
import { useUserTeamMemberships } from "../hooks/useUserTeamMemberships";
import { listTableLabels } from "./list-table-labels";

interface TeamMembershipsPanelProps {
  userId: string;
  canManage: boolean;
  /** The user's home team — its membership is primary and cannot be removed. */
  homeTeamId: string | null;
}

export function TeamMembershipsPanel({ userId, canManage, homeTeamId }: TeamMembershipsPanelProps) {
  const { t } = useI18n();
  const lang = useLanguage();
  const copy = t.coreIdentity;
  const describeError = useCoreErrorText();
  const panel = useUserTeamMemberships(userId, true);
  const teams = useOrgNodeOptions("teams");
  const [newTeamId, setNewTeamId] = useState("");
  const [newRole, setNewRole] = useState<TeamMembershipRole>("MEMBER");

  const teamLabel = (teamId: string) => teams.labelFor(teamId) ?? teamId;

  function isPrimary(membership: TeamMembership): boolean {
    return membership.isPrimary || membership.teamId === homeTeamId;
  }

  const columns: ColumnDef<TeamMembership>[] = [
    {
      id: "team",
      header: copy.levels.teams.singular,
      cell: (membership) => (
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-foreground">{teamLabel(membership.teamId)}</span>
          {isPrimary(membership) ? <Badge tone="brand">{copy.memberships.primary}</Badge> : null}
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
                    <span className="text-2xs text-muted-foreground">{copy.users.protected}</span>
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

  return (
    <DetailSection
      title={copy.memberships.title}
      description={copy.memberships.description}
      columns={1}
    >
      <div className="flex flex-col gap-3">
        {writeText ? (
          <p
            role="alert"
            className="rounded-sm border border-negative-200 bg-negative-100 p-2.5 text-xs text-negative-800 dark:border-negative-800 dark:bg-negative-950 dark:text-negative-300"
          >
            {writeText}
          </p>
        ) : null}

        <DataTable
          columns={columns}
          rows={panel.memberships}
          isLoading={panel.isLoading}
          error={panel.loadError}
          onRetry={panel.reload}
          rowKey={(membership) => membership.id}
          labels={listTableLabels(t, copy.memberships.loadFailed, copy.memberships.empty)}
        />

        {canManage ? (
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-56 flex-1">
              <Combobox
                value={newTeamId || undefined}
                selectedLabel={teams.labelFor(newTeamId)}
                onValueChange={(next) => setNewTeamId(next ?? "")}
                options={teams.options}
                onSearch={teams.search}
                loading={teams.isLoading}
                placeholder={copy.memberships.addTeam}
                searchPlaceholder={copy.picker.searchPlaceholder}
                loadingLabel={copy.picker.loading}
                emptyLabel={copy.picker.empty}
                clearLabel={copy.picker.clear}
              />
            </div>
            <Select
              value={newRole}
              onValueChange={(next) =>
                setNewRole(TEAM_MEMBERSHIP_ROLES.find((role) => role === next) ?? "MEMBER")
              }
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEAM_MEMBERSHIP_ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    {copy.membershipRole[role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              disabled={newTeamId.length === 0 || panel.isSubmitting}
              onClick={() => {
                void panel.add({ teamId: newTeamId, role: newRole });
                setNewTeamId("");
              }}
            >
              {copy.memberships.add}
            </Button>
            <Button
              variant="ghost"
              disabled={panel.isSubmitting || panel.memberships.length === 0}
              onClick={panel.startReplace}
            >
              {copy.memberships.replaceAll}
            </Button>
          </div>
        ) : null}

        {canManage && panel.draftTeamIds !== null ? (
          <div className="flex flex-col gap-2 rounded-sm border border-border bg-muted p-3">
            <p className="text-xs font-medium text-foreground">{copy.memberships.replaceTitle}</p>
            <p className="text-2xs text-muted-foreground">{copy.memberships.replaceHint}</p>
            <MultiSelect
              values={panel.draftTeamIds}
              onValuesChange={panel.setDraftTeamIds}
              options={teams.options}
              placeholder={copy.memberships.addTeam}
              emptyLabel={copy.picker.empty}
              moreLabel={t.filters.more}
              removeLabel={t.filters.remove}
              overflowLabel={t.filters.overflow}
              clearAllLabel={t.filters.clearAll}
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={panel.draftTeamIds.length === 0 || panel.isSubmitting}
                onClick={panel.review}
              >
                {copy.memberships.review}
              </Button>
              <Button variant="ghost" size="sm" onClick={panel.cancelReplace}>
                {t.common.cancel}
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <ConfirmActionModal
        open={panel.pendingRemoval !== null}
        onOpenChange={(open) => {
          if (!open) panel.cancelRemoval();
        }}
        title={copy.memberships.removeTitle}
        description={formatTemplate(copy.memberships.removeMessage, {
          name: panel.pendingRemoval ? teamLabel(panel.pendingRemoval.teamId) : "",
        })}
        confirmLabel={t.common.delete}
        cancelLabel={t.common.cancel}
        onConfirm={() => void panel.remove()}
        loading={panel.isSubmitting}
      />

      <AtomicReplacementConfirm
        open={panel.isReviewing}
        onOpenChange={(open) => {
          if (!open) panel.closeReview();
        }}
        diff={panel.draftDiff(teamLabel)}
        onConfirm={() => void panel.commitDraft()}
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
