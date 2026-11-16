"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useTenantAuth } from "@/context/AuthContext";
import type { Language } from "@/i18n/useLanguage";
import { localizedValue } from "@/lib/format/localized";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import type {
  RolePermissionMode,
  TenantRole,
  TenantRoleDetail,
} from "../../contracts/role-contract";
import type { RoleBranchPermissionsDocument } from "../contracts/role-branch-contract";

export interface RoleBranchSummaryEntry {
  permissionMode: RolePermissionMode;
  branchCount: number;
}

interface RoleBranchModalTarget {
  roleId: string;
  roleName: string;
  isSystem: boolean;
  mode: "edit" | "view";
  session: number;
}

interface RoleBranchSavedReceipt {
  roleId: string;
  roleName: string;
  isSystem: boolean;
  lines: string[];
}

export function useRoleBranchListController(options: {
  canUpdate: boolean;
  lang: Language;
  onReloadList: () => void;
}) {
  const { canUpdate, lang, onReloadList } = options;
  const router = useRouter();
  const { user } = useTenantAuth();

  const isTenantOwner = Boolean(user?.isTenantOwner);
  const canReadPermissions = Boolean(user?.permissions.includes("roles.permission.read"));
  const canViewBranchPermissions = isTenantOwner && canReadPermissions;
  const canAssignBranchPermissions = isTenantOwner && canUpdate && canReadPermissions;

  const [createdRole, setCreatedRole] = useState<TenantRoleDetail | null>(null);
  const [systemDialogRole, setSystemDialogRole] = useState<TenantRole | null>(null);
  const [branchModalTarget, setBranchModalTarget] = useState<RoleBranchModalTarget | null>(null);
  const [savedReceipt, setSavedReceipt] = useState<RoleBranchSavedReceipt | null>(null);
  const [roleBranchSummaries, setRoleBranchSummaries] = useState<
    Record<string, RoleBranchSummaryEntry>
  >({});

  const launchBranchModal = useCallback(
    (target: { roleId: string; roleName: string; isSystem: boolean; mode: "edit" | "view" }) => {
      setBranchModalTarget((prev) => ({
        ...target,
        session: (prev?.session ?? 0) + 1,
      }));
    },
    [],
  );

  const openAssignPermissions = useCallback(
    (role: TenantRole) => {
      const roleName = localizedValue(role.nameAr, role.nameEn, lang);
      if (role.isSystem) {
        router.push(`${TENANT_ROUTES.coreRoles}/${role.id}`);
        return;
      }
      if (canAssignBranchPermissions) {
        launchBranchModal({ roleId: role.id, roleName, isSystem: false, mode: "edit" });
      } else if (canViewBranchPermissions) {
        launchBranchModal({ roleId: role.id, roleName, isSystem: false, mode: "view" });
      }
    },
    [canAssignBranchPermissions, canViewBranchPermissions, lang, launchBranchModal, router],
  );

  const assignCreatedRolePermissions = useCallback(() => {
    if (!createdRole) return;
    const roleName = localizedValue(createdRole.nameAr, createdRole.nameEn, lang);
    setCreatedRole(null);
    if (canAssignBranchPermissions) {
      launchBranchModal({ roleId: createdRole.id, roleName, isSystem: false, mode: "edit" });
    }
  }, [canAssignBranchPermissions, createdRole, lang, launchBranchModal]);

  const viewSystemRolePermissions = useCallback(() => {
    if (!systemDialogRole) return;
    const target = systemDialogRole;
    setSystemDialogRole(null);
    router.push(`${TENANT_ROUTES.coreRoles}/${target.id}`);
  }, [router, systemDialogRole]);

  const handleBranchPermissionsSaved = useCallback(
    (doc: RoleBranchPermissionsDocument, receiptLines: string[]) => {
      setRoleBranchSummaries((current) => ({
        ...current,
        [doc.roleId]: {
          permissionMode: doc.permissionMode,
          branchCount: doc.profiles.length,
        },
      }));
      setBranchModalTarget(null);
      setSavedReceipt({
        roleId: doc.roleId,
        roleName: doc.roleName,
        isSystem: doc.isSystem,
        lines: receiptLines,
      });
      onReloadList();
    },
    [onReloadList],
  );

  const viewSavedPermissions = useCallback(() => {
    if (!savedReceipt) return;
    const receipt = savedReceipt;
    setSavedReceipt(null);
    launchBranchModal({
      roleId: receipt.roleId,
      roleName: receipt.roleName,
      isSystem: receipt.isSystem,
      mode: "view",
    });
  }, [launchBranchModal, savedReceipt]);

  return {
    canViewBranchPermissions,
    canAssignBranchPermissions,
    roleBranchSummaries,
    createdRole,
    notifyRoleCreated: setCreatedRole,
    closeCreatedRole: () => setCreatedRole(null),
    assignCreatedRolePermissions,
    systemDialogRole,
    openSystemRoleDialog: setSystemDialogRole,
    closeSystemRoleDialog: () => setSystemDialogRole(null),
    viewSystemRolePermissions,
    branchModalTarget,
    openAssignPermissions,
    closeBranchModal: () => setBranchModalTarget(null),
    savedReceipt,
    closeSavedReceipt: () => setSavedReceipt(null),
    handleBranchPermissionsSaved,
    viewSavedPermissions,
  };
}
