"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Card,
  Field,
  Input,
} from "@/design-system";
import type { useTenantFqdnManagement } from "../hooks/useTenantFqdnManagement";
import { canPromoteLegacyPrimary } from "../model/readers";
import type { TenantCorePermissions, TenantView } from "../types";
import { tenantWorkspaceCopy, type TenantWorkspaceLocale } from "./copy";

export interface TenantFqdnPanelProps {
  locale: TenantWorkspaceLocale;
  tenant: TenantView;
  permissions: Pick<
    TenantCorePermissions,
    "canRead" | "canValidateFqdn" | "canManageFqdns"
  >;
  fqdn: ReturnType<typeof useTenantFqdnManagement>;
}

export function TenantFqdnPanel({
  locale,
  tenant,
  permissions,
  fqdn,
}: TenantFqdnPanelProps) {
  const text = tenantWorkspaceCopy(locale);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const busy = fqdn.isPreflighting || fqdn.mutation.name !== null;
  const canMutate = tenant.status === "ACTIVE" && permissions.canManageFqdns;
  // Every domain mutation in Core requires an ACTIVE tenant, so offering the
  // form in any other state only produces a 409 the admin cannot act on.
  const canAttach = tenant.status === "ACTIVE" && permissions.canValidateFqdn;
  const released = tenant.status === "DELETED";

  return (
    <section aria-labelledby="tenant-domains-title">
    <Card className="space-y-4 p-4">
      <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
        <h2 id="tenant-domains-title" className="text-sm font-semibold text-foreground">
          {text.domains}
        </h2>
        <span className="text-xs font-semibold text-muted-foreground">
          {fqdn.fqdns.length}
        </span>
      </div>

      {released && (
        <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
          {text.domainsReleased}
        </p>
      )}

      {canAttach && (
        <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
          <Field id="tenant-fqdn" label={text.domainFieldLabel} error={fqdn.preflightError?.message}>
            {(field) => (
              <Input
                {...field}
                name="fqdn"
                value={fqdn.candidate}
                disabled={busy}
                placeholder={text.domainPlaceholder}
                className="font-mono"
                onChange={(event) => fqdn.setCandidate(event.target.value)}
              />
            )}
          </Field>
          <Button
            type="button"
            variant="outline"
            disabled={busy || !fqdn.candidate.trim()}
            onClick={() => void fqdn.preflight().catch(() => undefined)}
            loading={fqdn.isPreflighting}
          >
            {text.validate}
          </Button>
          {permissions.canManageFqdns && (
            <Button
              type="button"
              variant="primary"
              disabled={busy || !fqdn.canAdd}
              onClick={() => void fqdn.add().catch(() => undefined)}
            >
              {text.addDomain}
            </Button>
          )}
        </div>
      )}

      {fqdn.evidence && (
        <div
          role="status"
          className={`rounded-lg border p-3 text-xs ${
            fqdn.evidence.available
              ? "border-success/30 bg-success-subtle text-success-subtle-foreground"
              : "border-destructive/30 bg-destructive-subtle text-destructive-subtle-foreground"
          }`}
        >
          <p className="font-semibold">{fqdn.evidence.message}</p>
          {fqdn.evidence.available && !fqdn.evidence.valid && (
            <p className="mt-1">{text.pendingDns}</p>
          )}
        </div>
      )}

      <InlineError
        locale={locale}
        error={fqdn.listError ?? fqdn.mutation.error}
      />

      {fqdn.listError ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => void fqdn.reloadFqdns()}
        >
          {text.reloadDomains}
        </Button>
      ) : null}

      <div className="space-y-2">
        {fqdn.isLoadingFqdns ? (
          <p
            role="status"
            className="rounded-lg bg-muted p-4 text-center text-xs text-muted-foreground"
          >
            {text.loadingDomains}
          </p>
        ) : fqdn.fqdns.length === 0 && !fqdn.listError ? (
          <p className="rounded-lg bg-muted p-4 text-center text-xs text-muted-foreground">
            {text.noDomains}
          </p>
        ) : null}
        {fqdn.fqdns.map((row) => (
          <div
            key={row.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
          >
            <div className="min-w-0">
              <p className="truncate font-mono text-xs font-semibold text-foreground">
                {row.fqdn}
              </p>
              <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
                <Badge tone={row.isPrimary ? "info" : "neutral"} className="normal-case tracking-normal">
                  {row.isPrimary ? text.primary : text.secondary}
                </Badge>
                <Badge tone={fqdnValidationTone(row.validationStatus)} className="font-mono">
                  {row.validationStatus}
                </Badge>
              </div>
            </div>
            {canMutate && !row.isPrimary && (
              <div className="flex gap-2">
                {canPromoteLegacyPrimary(tenant, row) && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      void fqdn.promote(row.id).catch(() => undefined)
                    }
                  >
                    {text.promote}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={busy}
                  onClick={() => setRemoveId(row.id)}
                >
                  {text.remove}
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      <AlertDialog open={removeId !== null} onOpenChange={(open) => !open && setRemoveId(null)}>
        {removeId ? (
          <AlertDialogContent dir={locale === "ar" ? "rtl" : "ltr"}>
            <AlertDialogHeader>
              <AlertDialogTitle>{text.remove}</AlertDialogTitle>
              <AlertDialogDescription>{text.confirmRemoveDomain}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>{text.cancel}</AlertDialogCancel>
              <AlertDialogAction
                destructive
                disabled={busy}
                onClick={(event) => {
                  event.preventDefault();
                  const id = removeId;
                  void fqdn.remove(id).then(() => setRemoveId(null)).catch(() => undefined);
                }}
              >
                {text.confirm}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        ) : null}
      </AlertDialog>
    </Card>
    </section>
  );
}

function InlineError({
  locale,
  error,
}: {
  locale: TenantWorkspaceLocale;
  error: { message: string; correlationId?: string } | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error) ref.current?.focus();
  }, [error]);
  if (!error) return null;
  const text = tenantWorkspaceCopy(locale);
  return (
    <div
      ref={ref}
      role="alert"
      tabIndex={-1}
      className="rounded-lg border border-destructive/30 bg-destructive-subtle p-3 text-xs text-destructive-subtle-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <p>{error.message}</p>
      {error.correlationId && (
        <p className="mt-1 font-mono text-xs">
          {text.correlation}: {error.correlationId}
        </p>
      )}
    </div>
  );
}

function fqdnValidationTone(status: string): "success" | "danger" | "warn" | "neutral" {
  if (status === "VERIFIED") return "success";
  if (status === "FAILED" || status === "REJECTED") return "danger";
  if (status === "PENDING") return "warn";
  return "neutral";
}
