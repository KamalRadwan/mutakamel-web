"use client";

import { Plus, Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  Checkbox,
  Field,
  FormModal,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { TEAM_MEMBERSHIP_ROLES } from "../../../contracts/user-subresource-contract";
import type { RemoteOptions } from "../../../hooks/useCoreOptions";
import { useTeamMembershipModalForm } from "../hooks/useTeamMembershipModalForm";
import type {
  TeamMembershipDraftItem,
  useUserTeamMemberships,
} from "../hooks/useUserTeamMemberships";
import { CascadeTeamSelector } from "./CascadeTeamSelector";

export function AddTeamMembershipModal({
  open,
  onClose,
  panel,
  teams,
  writeError,
}: {
  open: boolean;
  onClose: () => void;
  panel: ReturnType<typeof useUserTeamMemberships>;
  teams: RemoteOptions;
  writeError?: string;
}) {
  const { t } = useI18n();
  const copy = t.coreIdentity;
  const form = useTeamMembershipModalForm({ enabled: open, panel, onClose });

  return (
    <FormModal
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          form.reset();
          onClose();
        }
      }}
      size="wide"
      title={copy.memberships.title}
      description={copy.memberships.description}
      isDirty={Boolean(form.selection.teamId) || form.role !== "MEMBER"}
      isSubmitting={panel.isSubmitting}
      submitDisabled={!form.selection.teamId}
      onSubmit={() => void form.submitAdd()}
      error={writeError}
      labels={{
        submit: copy.memberships.add,
        cancel: t.common.cancel,
        close: copy.actions.close,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
        sections: t.common.general,
        sectionInvalid: copy.errors.UNKNOWN,
      }}
    >
      <div className="flex flex-col gap-4">
        <CascadeTeamSelector
          canCascade={form.canCascade}
          state={form.selection}
          cascade={form.cascade}
          fallbackTeams={teams}
          disabled={panel.isSubmitting}
          onFallbackTeamChange={(teamId) => form.patchSelection({ teamId })}
        />
        <Field label={copy.memberships.role} showLabel required>
          <Select value={form.role} onValueChange={form.setRole}>
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TEAM_MEMBERSHIP_ROLES.map((item) => (
                <SelectItem key={item} value={item}>
                  {copy.membershipRole[item]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
    </FormModal>
  );
}

export function ReplaceTeamMembershipsModal({
  draft,
  panel,
  teams,
  teamLabel,
  homeTeamId,
  writeError,
}: {
  draft: TeamMembershipDraftItem[];
  panel: ReturnType<typeof useUserTeamMemberships>;
  teams: RemoteOptions;
  teamLabel: (id: string) => string;
  homeTeamId: string | null;
  writeError?: string;
}) {
  const { t } = useI18n();
  const copy = t.coreIdentity;
  const form = useTeamMembershipModalForm({ enabled: true, panel, draft });

  const initialSerialized = panel.memberships
    .map((m) => `${m.teamId}:${m.role}:${String(m.isPrimary)}`)
    .join("|");
  const draftSerialized = draft
    .map((m) => `${m.teamId}:${m.role}:${String(m.isPrimary)}`)
    .join("|");

  return (
    <FormModal
      open
      onOpenChange={(open) => {
        if (!open) panel.cancelReplace();
      }}
      size="wide"
      title={copy.memberships.replaceTitle}
      description={copy.memberships.replaceDescription}
      isDirty={initialSerialized !== draftSerialized}
      isSubmitting={panel.isSubmitting}
      submitDisabled={draft.length === 0}
      onSubmit={panel.review}
      error={writeError}
      labels={{
        submit: copy.memberships.review,
        cancel: t.common.cancel,
        close: copy.actions.close,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
        sections: t.common.general,
        sectionInvalid: copy.errors.UNKNOWN,
      }}
    >
      <div className="flex flex-col gap-3">
        <p className="text-xs text-muted-foreground">{copy.memberships.replaceHint}</p>
        <CascadeTeamSelector
          canCascade={form.canCascade}
          state={form.selection}
          cascade={form.cascade}
          fallbackTeams={teams}
          disabled={panel.isSubmitting}
          onFallbackTeamChange={(teamId) => form.patchSelection({ teamId })}
        />
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="w-44">
            <Field label={copy.memberships.role} showLabel>
              <Select value={form.role} onValueChange={form.setRole}>
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEAM_MEMBERSHIP_ROLES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {copy.membershipRole[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={!form.selection.teamId || panel.isSubmitting}
            onClick={form.addDraftItem}
          >
            <Plus className="size-4" aria-hidden="true" />
            {copy.memberships.add}
          </Button>
        </div>

        <ul className="flex flex-col gap-2 rounded-sm border border-border p-2.5">
          {draft.map((item) => {
            const lockedPrimary = item.teamId === homeTeamId;
            return (
              <li
                key={item.teamId}
                className="flex flex-wrap items-center justify-between gap-2 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">
                    {teamLabel(item.teamId)}
                  </span>
                  {item.isPrimary ? (
                    <Badge tone="brand">{copy.memberships.primary}</Badge>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-2xs text-muted-foreground">
                    <Checkbox
                      checked={item.isPrimary}
                      disabled={panel.isSubmitting || Boolean(homeTeamId)}
                      onCheckedChange={(checked) => {
                        if (checked === true) panel.setPrimaryTeam(item.teamId);
                      }}
                    />
                    {copy.memberships.primary}
                  </label>
                  <Select
                    value={item.role}
                    onValueChange={(next) => form.updateDraftRole(item.teamId, next)}
                  >
                    <SelectTrigger size="sm" className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TEAM_MEMBERSHIP_ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {copy.membershipRole[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="xs"
                    disabled={panel.isSubmitting || lockedPrimary || draft.length <= 1}
                    onClick={() => form.removeDraftItem(item.teamId)}
                    aria-label={`${t.common.delete}: ${teamLabel(item.teamId)}`}
                  >
                    <Trash2 className="size-3.5 text-destructive" aria-hidden="true" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </FormModal>
  );
}
