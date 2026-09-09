"use client";

import { ShieldAlert } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { useTenantAuth } from "@/context/AuthContext";
import { cn } from "../../lib/cn";
import { proseMeasure } from "../../lib/variants";
import { hasPermission } from "./hasPermission";

export interface PermissionGateProps {
  require: string | string[];
  scoped?: boolean;
  /** An authoritative server denial overrides advisory session permissions. */
  denied?: boolean;
  children: React.ReactNode;
}

// 403 is not an empty state — a distinct, labelled in-body state explaining
// that access is missing, never EmptyState, which implies "there is nothing
// here". Client-side only; the backend is authoritative.
export function PermissionGate({ require, scoped, denied = false, children }: PermissionGateProps) {
  const { t } = useI18n();
  const { user } = useTenantAuth();

  if (!denied && hasPermission(user?.permissions ?? [], require, scoped)) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
      <ShieldAlert className="size-8 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm font-medium text-foreground">{t.permissionGate.title}</p>
      <p className={cn("text-xs text-muted-foreground", proseMeasure)}>{t.permissionGate.description}</p>
    </div>
  );
}
