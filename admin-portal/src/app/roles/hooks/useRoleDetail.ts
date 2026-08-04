"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { useToast } from "@/components/ui/ToastContext";

import { AdminPermission } from "@/lib/auth/rbac";

export function useRoleDetail(id: string) {
  const router = useRouter();
  const { lang, t } = useI18n();
  const toast = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [catalogue, setCatalogue] = useState<AdminPermission[]>([]);
  const [search, setSearch] = useState("");

  // Role Metadata State
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSystem, setIsSystem] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // Keep original values for diff checking
  const [originalName, setOriginalName] = useState("");
  const [originalDescription, setOriginalDescription] = useState("");

  // Permissions State
  const [assignedPermissions, setAssignedPermissions] = useState<Set<string>>(new Set());
  const pendingPermissionSave = useRef<NodeJS.Timeout | null>(null);

  // UI State
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch catalogue
        const permRes = await axiosClient.get("/api/admin/core/v1/permissions");
        const permPayload = permRes.data?.data;
        const perms: AdminPermission[] = Array.isArray(permPayload) ? permPayload : (permPayload?.items || []);
        setCatalogue(perms);

        // Fetch role details
        const roleRes = await axiosClient.get(`/api/admin/core/v1/roles/${id}`);
        const roleData = roleRes.data?.data;
        if (roleData) {
          setName(roleData.name);
          setOriginalName(roleData.name);
          setDescription(roleData.description || "");
          setOriginalDescription(roleData.description || "");
          setIsSystem(roleData.isSystem);

          const isSuper = Boolean(
            roleData.isSuperAdmin ||
            roleData.name?.toLowerCase().includes("super admin") ||
            roleData.name?.includes("سوبر أدمن")
          );
          setIsSuperAdmin(isSuper);

          // If Super Admin, grant full permissions across catalogue
          if (isSuper) {
            setAssignedPermissions(new Set(perms.map((p) => p.id)));
          } else {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const permissionIds = roleData.permissions?.map((p: any) => typeof p === 'string' ? p : p.id) || [];
            setAssignedPermissions(new Set(permissionIds));
          }
        }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        toast.error(
          lang === "ar" ? "فشل التحميل" : "Load Failed",
          error?.response?.data?.message || (lang === "ar" ? "حدث خطأ أثناء تحميل بيانات الدور." : "Could not load role details.")
        );
        router.push("/roles");
      } finally {
        setIsLoading(false);
      }
    };
    if (id) {
      fetchData();
    }
  }, [id, lang, router, toast]);

  // Grouped and Filtered Catalogue
  const normalizedSearch = search.trim().toLocaleLowerCase();

  const visiblePermissions = catalogue.filter((permission) =>
    [
      permission.key,
      permission.nameAr,
      permission.nameEn,
      permission.group,
      permission.description,
    ].some((value) =>
      value?.toLocaleLowerCase().includes(normalizedSearch),
    ),
  );

  const groupedPermissions = visiblePermissions.reduce((acc, perm) => {
    const g = perm.group || "Ungrouped";
    if (!acc[g]) acc[g] = [];
    acc[g].push(perm);
    return acc;
  }, {} as Record<string, AdminPermission[]>);

  const handleMetadataBlur = async () => {
    if (isSystem || isSuperAdmin) return;
    if (name === originalName && description === originalDescription) return;

    setIsSaving(true);
    try {
      await axiosClient.patch(`/api/admin/core/v1/roles/${id}`, {
        name: name.trim(),
        description: description.trim() || undefined,
      });
      setOriginalName(name);
      setOriginalDescription(description);
      toast.success(
        lang === "ar" ? "تم الحفظ تلقائياً" : "Saved Automatically",
        lang === "ar" ? "تم تحديث بيانات الدور." : "Role metadata has been updated.",
      );
      document.title = `Role: ${name} - Mutakamel Admin`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      toast.error(
        lang === "ar" ? "فشل الحفظ" : "Save Failed",
        error?.response?.data?.message || "Failed to update role metadata."
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Sync title when originalName loads
  useEffect(() => {
    if (originalName) {
      document.title = `Role: ${originalName} - Mutakamel Admin`;
    }
  }, [originalName]);

  const savePermissions = useCallback(async (newPermissions: Set<string>) => {
    if (isSuperAdmin) return;
    setIsSaving(true);
    try {
      await axiosClient.patch(`/api/admin/core/v1/roles/${id}/permissions`, {
        permissionIds: Array.from(newPermissions),
      });
      toast.success(
        lang === "ar" ? "تم الحفظ تلقائياً" : "Saved Automatically",
        lang === "ar" ? "تم تحديث صلاحيات الدور." : "Role permissions have been updated.",
      );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      toast.error(
        lang === "ar" ? "فشل حفظ الصلاحيات" : "Failed to save permissions",
        error?.response?.data?.message || "Failed to update permissions."
      );
    } finally {
      setIsSaving(false);
    }
  }, [id, isSuperAdmin, lang, toast]);

  const schedulePermissionsSave = (newPermissions: Set<string>) => {
    if (pendingPermissionSave.current) {
      clearTimeout(pendingPermissionSave.current);
    }
    pendingPermissionSave.current = setTimeout(() => {
      savePermissions(newPermissions);
    }, 1000); // debounce save
  };

  const togglePermission = (permId: string) => {
    if (isSystem || isSuperAdmin) return;

    setAssignedPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(permId)) {
        next.delete(permId);
      } else {
        next.add(permId);
      }
      schedulePermissionsSave(next);
      return next;
    });
  };

  const toggleGroup = (groupName: string, state: boolean) => {
    if (isSystem || isSuperAdmin) return;

    setAssignedPermissions((prev) => {
      const next = new Set(prev);
      catalogue
        .filter((p) => p.group === groupName)
        .forEach((p) => {
          if (state) next.add(p.id);
          else next.delete(p.id);
        });
      schedulePermissionsSave(next);
      return next;
    });
  };

  return {
    lang,
    t,
    router,
    name,
    setName,
    description,
    setDescription,
    isSystem,
    isSuperAdmin,
    search,
    setSearch,
    groupedPermissions,
    assignedPermissions,
    catalogueLength: catalogue.length,
    isSaving,
    isLoading,
    handleMetadataBlur,
    togglePermission,
    toggleGroup,
  };
}
