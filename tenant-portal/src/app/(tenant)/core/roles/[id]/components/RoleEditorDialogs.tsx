"use client";

import {
  AtomicReplacementConfirm,
  ConfirmActionModal,
  DeletionBlockerDialog,
  type ReplacementDiff,
} from "@/design-system";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { formatTemplate } from "@/lib/format/template";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import type { TenantRoleDetail } from "../../../contracts/role-contract";
import { RolePermissionsSavedDialog } from "../../components/RoleBranchDialogs";
import { RoleBranchPermissionsModal } from "../../components/RoleBranchPermissionsModal";
import { RoleFormModal } from "../../components/RoleFormDrawer";
import type { RoleBranchPermissionsDocument } from "../../contracts/role-branch-contract";

interface RoleEditorDialogsProps {
  t: Dictionary;
  role: TenantRoleDetail;
  roleName: string;
  roleDescription: string;
  diff: ReplacementDiff;
  formatCount: (count: number) => string;
  isSubmitting: boolean;
  writeText?: string;
  blockerText: string;
  canReadUsers: boolean;
  isRenameOpen: boolean;
  onCloseRename: () => void;
  onRename: (body: { name?: string; description?: string }) => Promise<boolean>;
  isConfirmOpen: boolean;
  onConfirmOpenChange: (open: boolean) => void;
  onConfirmSave: () => void;
  isDeleteOpen: boolean;
  onDeleteOpenChange: (open: boolean) => void;
  onConfirmDelete: () => void;
  isDeleteBlocked: boolean;
  onDeleteBlockerOpenChange: (open: boolean) => void;
  branchModalSession: { mode: "edit" | "view"; session: number } | null;
  onCloseBranchModal: () => void;
  onBranchSaved: (doc: RoleBranchPermissionsDocument, receiptLines: string[]) => void;
  savedBranchReceipt: string[] | null;
  onCloseSavedBranchReceipt: () => void;
  onViewSavedBranchPermissions: () => void;
}

export function RoleEditorDialogs({
  t,
  role,
  roleName,
  roleDescription,
  diff,
  formatCount,
  isSubmitting,
  writeText,
  blockerText,
  canReadUsers,
  isRenameOpen,
  onCloseRename,
  onRename,
  isConfirmOpen,
  onConfirmOpenChange,
  onConfirmSave,
  isDeleteOpen,
  onDeleteOpenChange,
  onConfirmDelete,
  isDeleteBlocked,
  onDeleteBlockerOpenChange,
  branchModalSession,
  onCloseBranchModal,
  onBranchSaved,
  savedBranchReceipt,
  onCloseSavedBranchReceipt,
  onViewSavedBranchPermissions,
}: RoleEditorDialogsProps) {
  const copy = t.coreIdentity.roles;

  return (
    <>
      <RoleFormModal
        key={isRenameOpen ? `rename-${role.updatedAt}` : "rename-closed"}
        mode="edit"
        isOpen={isRenameOpen}
        initial={{
          name: role.name,
          description: roleDescription,
        }}
        title={copy.renameTitle}
        description={copy.renameDescription}
        onClose={onCloseRename}
        onSubmit={onRename}
        isSubmitting={isSubmitting}
        error={isRenameOpen ? writeText : undefined}
      />

      <RoleBranchPermissionsModal
        key={
          branchModalSession
            ? `detail-branch-${role.id}-${branchModalSession.session}`
            : "detail-branch-closed"
        }
        open={branchModalSession !== null}
        roleId={role.id}
        roleDisplayName={roleName}
        isSystemHint={role.isSystem}
        initialMode={branchModalSession?.mode ?? "view"}
        onClose={onCloseBranchModal}
        onSaved={onBranchSaved}
      />

      <RolePermissionsSavedDialog
        open={savedBranchReceipt !== null}
        roleName={roleName}
        summaryLines={savedBranchReceipt ?? []}
        t={t}
        onViewPermissions={onViewSavedBranchPermissions}
        onClose={onCloseSavedBranchReceipt}
      />

      <AtomicReplacementConfirm
        open={isConfirmOpen}
        onOpenChange={onConfirmOpenChange}
        diff={diff}
        onConfirm={onConfirmSave}
        loading={isSubmitting}
        formatCount={formatCount}
        labels={{
          title: copy.savePermissionsTitle,
          description: copy.savePermissionsDescription,
          addedHeading: t.atomicReplacement.addedHeading,
          removedHeading: t.atomicReplacement.removedHeading,
          unchangedHeading: t.atomicReplacement.unchangedHeading,
          noChanges: t.atomicReplacement.noChanges,
          confirm: copy.savePermissions,
          cancel: t.common.cancel,
          acknowledge: t.atomicReplacement.acknowledge,
        }}
      />

      <ConfirmActionModal
        open={isDeleteOpen}
        onOpenChange={onDeleteOpenChange}
        title={copy.deleteTitle}
        description={formatTemplate(copy.deleteMessage, { name: roleName })}
        confirmLabel={t.coreIdentity.actions.delete}
        cancelLabel={t.common.cancel}
        onConfirm={onConfirmDelete}
        loading={isSubmitting}
      />

      <DeletionBlockerDialog
        open={isDeleteBlocked}
        onOpenChange={onDeleteBlockerOpenChange}
        recordName={roleName}
        blockers={[
          {
            id: "role-in-use",
            label: blockerText,
            href: canReadUsers ? TENANT_ROUTES.coreUsers : undefined,
          },
        ]}
        labels={{
          title: t.deletionBlocker.title,
          description: t.deletionBlocker.description,
          blockersHeading: t.deletionBlocker.blockersHeading,
          view: t.deletionBlocker.view,
          close: t.deletionBlocker.close,
        }}
      />
    </>
  );
}
