"use client";

import {
  CircleCheck,
  CloudAlert,
  GitCompareArrows,
  LockKeyhole,
  RefreshCw,
  ShieldAlert,
  ShieldMinus,
  WifiOff,
} from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { formatTemplate } from "@/lib/format/template";
import type { RoleBranchOutcomeDialogKind } from "../hooks/useRoleBranchSaveFlow";
import {
  CompactStatusDialog,
  type CompactStatusDialogProps,
} from "./CompactStatusDialog";

export function RoleCreatedDialog({
  open,
  roleName,
  canAssign,
  t,
  onAssign,
  onClose,
}: {
  open: boolean;
  roleName: string;
  canAssign: boolean;
  t: Dictionary;
  onAssign: () => void;
  onClose: () => void;
}) {
  const copy = t.coreIdentity.roleBranch.dialogs.roleCreated;
  return (
    <CompactStatusDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={copy.title}
      tone="positive"
      icon={<CircleCheck className="size-5" aria-hidden="true" />}
      headline={roleName}
      lines={
        canAssign ? [copy.noPermissionsYet, copy.chooseScopeHint] : [copy.noPermissionsYet]
      }
      primaryLabel={canAssign ? copy.assign : t.coreIdentity.actions.close}
      onPrimary={canAssign ? onAssign : onClose}
      secondaryLabel={canAssign ? copy.later : undefined}
      onSecondary={canAssign ? onClose : undefined}
      closeLabel={t.coreIdentity.actions.close}
    />
  );
}

export function SystemRoleProtectedDialog({
  open,
  roleName,
  t,
  onViewPermissions,
  onClose,
}: {
  open: boolean;
  roleName: string;
  t: Dictionary;
  onViewPermissions: () => void;
  onClose: () => void;
}) {
  const copy = t.coreIdentity.roleBranch.dialogs.systemRole;
  return (
    <CompactStatusDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={copy.title}
      tone="brand"
      icon={<LockKeyhole className="size-5" aria-hidden="true" />}
      headline={roleName}
      lines={[copy.managedByPlatform, copy.viewOnlyHint]}
      primaryLabel={copy.view}
      onPrimary={onViewPermissions}
      secondaryLabel={copy.close}
      onSecondary={onClose}
      closeLabel={copy.close}
    />
  );
}

export function RolePermissionsSavedDialog({
  open,
  roleName,
  summaryLines,
  t,
  onViewPermissions,
  onClose,
}: {
  open: boolean;
  roleName: string;
  summaryLines: string[];
  t: Dictionary;
  onViewPermissions: () => void;
  onClose: () => void;
}) {
  const copy = t.coreIdentity.roleBranch.dialogs.saved;
  return (
    <CompactStatusDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={copy.title}
      tone="positive"
      icon={<CircleCheck className="size-5" aria-hidden="true" />}
      headline={roleName}
      lines={summaryLines}
      primaryLabel={copy.viewPermissions}
      onPrimary={onViewPermissions}
      secondaryLabel={copy.close}
      onSecondary={onClose}
      closeLabel={copy.close}
    />
  );
}

export function RoleBranchRemoveProfileDialog({
  open,
  branchLabel,
  roleName,
  t,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  branchLabel: string;
  roleName: string;
  t: Dictionary;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const copy = t.coreIdentity.roleBranch.dialogs.removeProfile;
  return (
    <CompactStatusDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
      title={copy.title}
      tone="negative"
      icon={<ShieldMinus className="size-5" aria-hidden="true" />}
      headline={formatTemplate(copy.branchRoleLine, { branch: branchLabel, role: roleName })}
      lines={[copy.contributionRemoved, copy.branchRemainsHint]}
      primaryLabel={copy.confirm}
      primaryVariant="destructive"
      onPrimary={onConfirm}
      secondaryLabel={copy.cancel}
      onSecondary={onCancel}
      closeLabel={copy.cancel}
    />
  );
}

export function RoleBranchOutcomeDialog({
  kind,
  errorText,
  correlationId,
  loading,
  t,
  onRetryRead,
  onCheckAuthority,
  onRefreshCatalogue,
  onReviewLatest,
  onCheckUncertain,
  onClose,
}: {
  kind: RoleBranchOutcomeDialogKind | null;
  errorText?: string;
  correlationId?: string;
  loading?: boolean;
  t: Dictionary;
  onRetryRead: () => void;
  onCheckAuthority: () => void;
  onRefreshCatalogue: () => void;
  onReviewLatest: () => void;
  onCheckUncertain: () => void;
  onClose: () => void;
}) {
  const dialogs = t.coreIdentity.roleBranch.dialogs;
  if (!kind) return null;

  const configByKind: Record<
    RoleBranchOutcomeDialogKind,
    {
      title: string;
      tone: CompactStatusDialogProps["tone"];
      icon: React.ReactNode;
      lines: string[];
      primary: string;
      onPrimary: () => void;
      secondary: string;
      showCorrelation?: boolean;
    }
  > = {
    "read-error": {
      title: dialogs.readError.title,
      tone: "caution",
      icon: <WifiOff className="size-5" aria-hidden="true" />,
      lines: [errorText ?? dialogs.readError.connectionHint, dialogs.readError.unchangedHint],
      primary: dialogs.readError.retry,
      onPrimary: onRetryRead,
      secondary: dialogs.readError.close,
    },
    "authority-changed": {
      title: dialogs.authorityChanged.title,
      tone: "caution",
      icon: <ShieldAlert className="size-5" aria-hidden="true" />,
      lines: [
        errorText ?? dialogs.authorityChanged.selectionDenied,
        dialogs.authorityChanged.recheckHint,
        dialogs.authorityChanged.notSavedHint,
      ],
      primary: dialogs.authorityChanged.checkAccess,
      onPrimary: onCheckAuthority,
      secondary: dialogs.authorityChanged.close,
    },
    "catalogue-changed": {
      title: dialogs.catalogueChanged.title,
      tone: "brand",
      icon: <RefreshCw className="size-5" aria-hidden="true" />,
      lines: [
        dialogs.catalogueChanged.unavailableHint,
        dialogs.catalogueChanged.refreshHint,
        dialogs.catalogueChanged.notSavedHint,
      ],
      primary: dialogs.catalogueChanged.refresh,
      onPrimary: onRefreshCatalogue,
      secondary: dialogs.catalogueChanged.close,
    },
    "concurrent-edit": {
      title: dialogs.concurrentEdit.title,
      tone: "caution",
      icon: <GitCompareArrows className="size-5" aria-hidden="true" />,
      lines: [
        dialogs.concurrentEdit.editedElsewhere,
        dialogs.concurrentEdit.reviewLatestHint,
        dialogs.concurrentEdit.draftRetainedHint,
      ],
      primary: dialogs.concurrentEdit.reviewLatest,
      onPrimary: onReviewLatest,
      secondary: dialogs.concurrentEdit.close,
    },
    "save-uncertain": {
      title: dialogs.saveUncertain.title,
      tone: "caution",
      icon: <CloudAlert className="size-5" aria-hidden="true" />,
      lines: [
        dialogs.saveUncertain.interruptedHint,
        dialogs.saveUncertain.checkStateHint,
        dialogs.saveUncertain.draftRetainedHint,
      ],
      primary: dialogs.saveUncertain.checkState,
      onPrimary: onCheckUncertain,
      secondary: dialogs.saveUncertain.close,
      showCorrelation: true,
    },
  };

  const cfg = configByKind[kind];
  return (
    <CompactStatusDialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={cfg.title}
      tone={cfg.tone}
      icon={cfg.icon}
      lines={cfg.lines}
      correlationId={cfg.showCorrelation ? correlationId : undefined}
      correlationLabel={cfg.showCorrelation ? dialogs.saveUncertain.correlationLabel : undefined}
      primaryLabel={cfg.primary}
      onPrimary={cfg.onPrimary}
      primaryLoading={loading}
      secondaryLabel={cfg.secondary}
      onSecondary={onClose}
      closeLabel={cfg.secondary}
    />
  );
}
