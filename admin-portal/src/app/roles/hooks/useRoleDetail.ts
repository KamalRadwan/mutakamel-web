"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/I18nContext";

export interface PermissionNode {
  id: string;
  key: string;
  group: string;
  labelEn: string;
  labelAr: string;
}

const mockCatalogue: PermissionNode[] = [
  { id: "p1", key: "admin.roles.read", group: "Roles Management", labelEn: "Read Roles", labelAr: "قراءة الأدوار" },
  { id: "p2", key: "admin.roles.manage", group: "Roles Management", labelEn: "Manage Roles", labelAr: "إدارة الأدوار" },
  { id: "p3", key: "admin.users.read", group: "Users Management", labelEn: "Read Users", labelAr: "قراءة المستخدمين" },
  { id: "p4", key: "admin.users.manage", group: "Users Management", labelEn: "Manage Users", labelAr: "إدارة المستخدمين" },
  { id: "p5", key: "admin.billing.read", group: "Billing", labelEn: "Read Billing", labelAr: "قراءة الفواتير" },
];

export function useRoleDetail(id: string) {
  const router = useRouter();
  const { lang, t } = useI18n();

  // Role Metadata State
  const [name, setName] = useState("Support Agent");
  const [description, setDescription] = useState("View-only access for support.");
  const [type, setType] = useState<"SUPER_ADMIN" | "ADMIN" | "USER">("USER");
  const [isSystem, setIsSystem] = useState(false);
  
  // Permissions State
  const [assignedPermissions, setAssignedPermissions] = useState<Set<string>>(new Set(["p1", "p3"]));
  
  // UI State
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Grouped Catalogue
  const groupedPermissions = mockCatalogue.reduce((acc, perm) => {
    if (!acc[perm.group]) acc[perm.group] = [];
    acc[perm.group].push(perm);
    return acc;
  }, {} as Record<string, PermissionNode[]>);

  // Auto-Save handlers
  const handleMetadataBlur = () => {
    if (isSystem) return;
    setIsSaving(true);
    // Simulate PATCH /admin/roles/:id
    setTimeout(() => {
      setIsSaving(false);
      setLastSaved(new Date());
    }, 500);
  };

  const togglePermission = (permId: string) => {
    if (isSystem) return;
    setIsSaving(true);
    
    setAssignedPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(permId)) {
        next.delete(permId);
      } else {
        next.add(permId);
      }
      return next;
    });

    // Simulate PUT /admin/roles/:id/permissions
    setTimeout(() => {
      setIsSaving(false);
      setLastSaved(new Date());
    }, 500);
  };

  const toggleGroup = (groupName: string, state: boolean) => {
    if (isSystem) return;
    setIsSaving(true);
    
    setAssignedPermissions((prev) => {
      const next = new Set(prev);
      mockCatalogue
        .filter((p) => p.group === groupName)
        .forEach((p) => {
          if (state) next.add(p.id);
          else next.delete(p.id);
        });
      return next;
    });

    setTimeout(() => {
      setIsSaving(false);
      setLastSaved(new Date());
    }, 500);
  };

  return {
    lang,
    t,
    router,
    name,
    setName,
    description,
    setDescription,
    type,
    setType,
    isSystem,
    groupedPermissions,
    assignedPermissions,
    isSaving,
    lastSaved,
    handleMetadataBlur,
    togglePermission,
    toggleGroup,
  };
}
