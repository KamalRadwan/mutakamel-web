"use client";

import { redirect } from "next/navigation";
import { SETTINGS_SUBNAV } from "@/design-system";
import { useAuth } from "@/context/AuthContext";
import { adminCan } from "@/lib/auth/rbac";

export default function SettingsIndexPage() {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;

  const firstPermittedPage = SETTINGS_SUBNAV.find((item) => adminCan(user, item.permission));
  redirect(firstPermittedPage?.href ?? "/profile");
}
