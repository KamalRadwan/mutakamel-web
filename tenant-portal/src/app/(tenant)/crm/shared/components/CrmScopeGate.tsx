"use client";

import { ShieldAlert } from "lucide-react";
import { cn, proseMeasure } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";

/**
 * The in-body 403 for a CRM record the server refused on **scope**.
 *
 * `PermissionGate` cannot serve this case, and the reason is the whole of
 * defect D11. It decides from `/auth/me` permission strings, and a CRM string
 * carries a scope suffix without saying which records it reaches: an actor
 * holding `crm.leads.read.own` passes `hasPermission("crm.leads.read", true)`
 * for every lead in the tenant, including the ones the server just answered
 * `403` about. Wrapping a server 403 in `PermissionGate` would therefore render
 * its children — swallowing the refusal — for exactly the users who hit it.
 *
 * So this is driven by what the server actually said, not by a string. It
 * renders the same surface `PermissionGate` does, for the same reason — "there
 * is nothing here" and "this is not yours" are different sentences — with copy
 * that names scope rather than a missing role grant, because a role grant is
 * not the remedy.
 *
 * `OwnerGate` in `core/components/` is the same shape for the same reason on
 * the billing screens. If `PermissionGate` ever gains a caller-supplied
 * `denied` override, both should collapse into it.
 */
export function CrmScopeGate({ className }: { className?: string }) {
  const { t } = useI18n();

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 px-4 py-12 text-center",
        className,
      )}
    >
      <ShieldAlert className="size-8 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm font-medium text-foreground">
        {t.crmShared.scopeDeniedTitle}
      </p>
      <p className={cn("text-xs text-muted-foreground", proseMeasure)}>
        {t.crmShared.scopeDeniedDescription}
      </p>
    </div>
  );
}
