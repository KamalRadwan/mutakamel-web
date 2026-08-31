"use client";

import { Clock8, PlugZap, RefreshCw, ShieldCheck } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  PageHeader,
  PermissionGate,
  Skeleton,
  SubNav,
  CORE_SETTINGS_NAV_ITEMS,
} from "@/design-system";
import { useEmailConfig } from "../hooks/useEmailConfig";
import { EmailConflictDialog } from "./EmailConflictDialog";
import { EmailDnsPanel } from "./EmailDnsPanel";
import { EmailProviderFields } from "./EmailProviderFields";
import { EmailSenderFields } from "./EmailSenderFields";

export function EmailConfigWorkspace() {
  const {
    t,
    canManage,
    config,
    draft,
    isLoading,
    pending,
    isNotReady,
    loadError,
    formError,
    conflict,
    updateDraft,
    dismissConflict,
    resolveConflict,
    save,
    verify,
    verifyConnection,
    reload,
  } = useEmailConfig();
  const isBusy = pending !== null;
  const isReadOnly = !canManage;

  return (
    <PermissionGate require="workspace.email.read">
      <div className="flex flex-col gap-4">
        <PageHeader
          title={t.coreSettings.emailTitle}
          description={t.coreSettings.emailSubtitle}
          primaryAction={
            canManage && draft
              ? {
                  label: t.coreSettings.save,
                  onClick: () => void save(),
                  disabled: isBusy,
                  loading: pending === "save",
                }
              : undefined
          }
          secondaryActions={
            <span className="flex flex-wrap items-center gap-2">
              {canManage && config ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => void verify()}
                    disabled={isBusy}
                    loading={pending === "verify"}
                  >
                    <ShieldCheck className="size-4" aria-hidden="true" />
                    {t.coreSettings.emailVerify}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void verifyConnection()}
                    disabled={isBusy || config.providerDriver !== "smtp"}
                    loading={pending === "probe"}
                  >
                    <PlugZap className="size-4" aria-hidden="true" />
                    {t.coreSettings.emailVerifyConnection}
                  </Button>
                </>
              ) : null}
              <Button variant="outline" onClick={() => void reload()} disabled={isLoading}>
                <RefreshCw className={isLoading ? "size-4 animate-spin" : "size-4"} aria-hidden="true" />
                {t.coreSettings.reload}
              </Button>
            </span>
          }
        />

        <SubNav items={CORE_SETTINGS_NAV_ITEMS} />

        {isLoading && !config ? (
          <Card>
            <CardContent className="flex flex-col gap-4">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </CardContent>
          </Card>
        ) : null}

        {isNotReady ? (
          <EmptyState
            icon={Clock8}
            title={t.coreSettings.emailNotReadyTitle}
            description={t.coreSettings.emailNotReadyDescription}
            action={{ label: t.coreSettings.reload, onClick: () => void reload() }}
          />
        ) : null}

        {loadError ? (
          <ErrorState
            title={t.coreSettings.emailLoadFailed}
            description={loadError.message}
            onRetry={() => void reload()}
            retryLabel={t.common.retry}
          />
        ) : null}

        {formError ? (
          <p role="alert" className="rounded-sm border border-destructive px-3 py-2 text-xs text-destructive">
            {formError}
          </p>
        ) : null}

        {config && draft ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t.coreSettings.emailSenderTitle}</CardTitle>
              </CardHeader>
              <CardContent>
                <EmailSenderFields
                  values={draft}
                  onChange={updateDraft}
                  disabled={isBusy}
                  readOnly={isReadOnly}
                />
              </CardContent>
            </Card>

            <div className="flex flex-col gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>{t.coreSettings.emailProviderTitle}</CardTitle>
                </CardHeader>
                <CardContent>
                  <EmailProviderFields
                    config={config}
                    values={draft}
                    onChange={updateDraft}
                    disabled={isBusy}
                    readOnly={isReadOnly}
                  />
                </CardContent>
              </Card>

              <EmailDnsPanel config={config} />
            </div>
          </div>
        ) : null}

        <EmailConflictDialog
          kind={conflict}
          onReload={() => void resolveConflict()}
          onCancel={dismissConflict}
          loading={isLoading}
        />
      </div>
    </PermissionGate>
  );
}
