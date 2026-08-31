"use client";

import {
  AtomicReplacementConfirm,
  Badge,
  Button,
  DataTable,
  type ColumnDef,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { useLanguage } from "@/i18n/useLanguage";
import { formatNumber } from "@/lib/format/number";
import type {
  ScopeRoleAssignment,
  ScopeRoleAssignmentInput,
} from "../../../contracts/role-assignment-contract";
import type { RemoteOptions } from "../../../hooks/useCoreOptions";
import type { useUserRoleGrants } from "../hooks/useUserRoleGrants";
import { listTableLabels } from "./list-table-labels";
import { ScopeRoleDraftEditor } from "./ScopeRoleDraftEditor";

interface ScopeRolesSectionProps {
  panel: ReturnType<typeof useUserRoleGrants>;
  roles: RemoteOptions;
  companies: RemoteOptions;
  branches: RemoteOptions;
  /** `PUT /users/:userId/scope-role-assignments` is refused for anyone else. */
  isTenantOwnerActor: boolean;
  describe: (assignment: ScopeRoleAssignmentInput) => { label: string; hint?: string };
  targetLabel: (assignment: ScopeRoleAssignment) => string;
}

/**
 * `tenant_user_scope_roles` — a role scoped to the tenant, one company, or one
 * branch, replaced atomically and only by an active tenant owner.
 */
export function ScopeRolesSection({
  panel,
  roles,
  companies,
  branches,
  isTenantOwnerActor,
  describe,
  targetLabel,
}: ScopeRolesSectionProps) {
  const { t } = useI18n();
  const lang = useLanguage();
  const copy = t.coreIdentity;

  const columns: ColumnDef<ScopeRoleAssignment>[] = [
    {
      id: "role",
      header: copy.roles.singular,
      // The stored row carries `null` where the DTO carries `undefined`.
      cell: (row) =>
        describe({
          scopeTarget: row.scopeTarget,
          roleId: row.roleId,
          companyId: row.companyId ?? undefined,
          branchId: row.branchId ?? undefined,
        }).label,
    },
    { id: "scope", header: copy.grants.scope, cell: (row) => copy.scopeTarget[row.scopeTarget] },
    { id: "target", header: copy.grants.target, cell: targetLabel },
  ];

  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-xs font-medium text-foreground">{copy.grants.scopeRolesTitle}</h3>
        <Badge tone="caution">{copy.grants.ownerOnly}</Badge>
      </div>
      <p className="text-2xs text-muted-foreground">{copy.grants.scopeRolesDescription}</p>

      <DataTable
        columns={columns}
        rows={panel.scopeRoles}
        isLoading={panel.isScopeLoading}
        error={panel.scopeError}
        onRetry={panel.reload}
        rowKey={(row) => row.id}
        labels={listTableLabels(t, copy.grants.scopeLoadFailed, copy.grants.scopeEmpty)}
      />

      {isTenantOwnerActor && panel.draft === null ? (
        <div>
          <Button variant="ghost" size="sm" onClick={panel.startScopeEdit}>
            {copy.grants.editScopeRoles}
          </Button>
        </div>
      ) : null}

      {isTenantOwnerActor && panel.draft !== null ? (
        <ScopeRoleDraftEditor
          draft={panel.draft}
          onDraftChange={panel.setDraft}
          roles={roles}
          companies={companies}
          branches={branches}
          describe={describe}
          onReview={panel.review}
          onCancel={panel.cancelScopeEdit}
          isSubmitting={panel.isSubmitting}
        />
      ) : null}

      {isTenantOwnerActor ? null : (
        <p className="text-2xs text-muted-foreground">{copy.grants.ownerOnlyExplanation}</p>
      )}

      <AtomicReplacementConfirm
        open={panel.isReviewing}
        onOpenChange={(open) => {
          if (!open) panel.closeReview();
        }}
        diff={panel.scopeDiff(describe)}
        onConfirm={() => void panel.commitScopeRoles()}
        loading={panel.isSubmitting}
        formatCount={(count) => formatNumber(count, lang)}
        labels={{
          title: copy.grants.replaceTitle,
          description: copy.grants.replaceDescription,
          addedHeading: t.atomicReplacement.addedHeading,
          removedHeading: t.atomicReplacement.removedHeading,
          unchangedHeading: t.atomicReplacement.unchangedHeading,
          noChanges: t.atomicReplacement.noChanges,
          confirm: t.atomicReplacement.confirm,
          cancel: t.common.cancel,
          acknowledge: t.atomicReplacement.acknowledge,
        }}
      />
    </section>
  );
}
