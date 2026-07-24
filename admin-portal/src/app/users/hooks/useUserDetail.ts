"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/I18nContext";

export interface RoleOption {
  id: string;
  name: string;
  type: "SUPER_ADMIN" | "ADMIN" | "USER";
  description?: string;
}

const mockAvailableRoles: RoleOption[] = [
  { id: "role-1", name: "Super Administrator", type: "SUPER_ADMIN", description: "Full system access." },
  { id: "role-2", name: "Billing Admin", type: "ADMIN", description: "Manage subscriptions and wallets." },
  { id: "role-3", name: "Support Agent", type: "USER", description: "View-only access for support." },
  { id: "role-4", name: "Security Officer", type: "ADMIN", description: "Manage platform security policies." },
];

export function useUserDetail(id: string) {
  const router = useRouter();
  const { lang, t } = useI18n();

  // User Profile Identity
  console.log("Fetching details for user:", id);
  const [firstName, setFirstName] = useState("كمال");
  const [lastName, setLastName] = useState("رضوان");
  const [email] = useState("kamal.radwan@mutakamel.ai"); // Immutable
  const [tier, setTier] = useState<"SUPER_ADMIN" | "ADMIN" | "USER">("SUPER_ADMIN");
  const [status, setStatus] = useState<"INVITED" | "ACTIVE" | "SUSPENDED" | "DEACTIVATED">("ACTIVE");

  // Assigned Roles State
  const [assignedRoleIds, setAssignedRoleIds] = useState<Set<string>>(new Set(["role-1", "role-2"]));

  // WebPhone SIP Config State
  const [sipExtension, setSipExtension] = useState("1001");
  const [sipUsername, setSipUsername] = useState("kamal_sip");
  const [sipPassword, setSipPassword] = useState("SecretSipPass123!");
  const [outboundCallerId, setOutboundCallerId] = useState("+201001234567");

  // UI Auto-Save State
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Auto-Save Handler for Identity Fields (PATCH /admin/users/:id)
  const handleIdentityBlur = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      setLastSaved(new Date());
    }, 500);
  };

  // Toggle Role Assignment (PUT /admin/users/:id/roles)
  const toggleRole = (roleId: string) => {
    setIsSaving(true);
    setAssignedRoleIds((prev) => {
      const next = new Set(prev);
      if (next.has(roleId)) next.delete(roleId);
      else next.add(roleId);
      return next;
    });

    setTimeout(() => {
      setIsSaving(false);
      setLastSaved(new Date());
    }, 500);
  };

  // Auto-Save Handler for WebPhone Config (PUT /admin/users/:id/webphone)
  const handleWebphoneBlur = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      setLastSaved(new Date());
    }, 500);
  };

  const handleStatusChange = (newStatus: "ACTIVE" | "SUSPENDED") => {
    setIsSaving(true);
    setStatus(newStatus);
    setTimeout(() => {
      setIsSaving(false);
      setLastSaved(new Date());
    }, 500);
  };

  return {
    lang,
    t,
    router,
    firstName,
    setFirstName,
    lastName,
    setLastName,
    email,
    tier,
    setTier,
    status,
    availableRoles: mockAvailableRoles,
    assignedRoleIds,
    sipExtension,
    setSipExtension,
    sipUsername,
    setSipUsername,
    sipPassword,
    setSipPassword,
    outboundCallerId,
    setOutboundCallerId,
    isSaving,
    lastSaved,
    handleIdentityBlur,
    toggleRole,
    handleWebphoneBlur,
    handleStatusChange,
  };
}
