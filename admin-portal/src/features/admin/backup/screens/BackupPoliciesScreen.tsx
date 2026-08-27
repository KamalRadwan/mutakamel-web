"use client";

import { useState } from "react";
import { RefreshCw, Settings2, SlidersHorizontal, Undo2 } from "lucide-react";
import { BackupCompressionAlgorithm, type BackupDatabaseConfig } from "../types";
import { BackupDialog } from "../components/BackupDialog";
import { BackupErrorBanner } from "../components/BackupErrorBanner";
import { BackupPageHeader } from "../components/BackupPageHeader";
import { BackupServerSelect } from "../components/BackupServerSelect";
import { BackupStatePanel } from "../components/BackupStatePanel";
import { useBackupPolicies } from "../hooks/useBackupPolicies";
import { useI18n } from "@/i18n/I18nContext";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Field,
  Input,
  Checkbox,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Badge,
  Button,
  DataTable,
  type ColumnDef,
} from "@/design-system";

export function BackupPoliciesScreen() {
  const { t } = useI18n();
  const copy = t.backup.policiesScreen;
  const view = useBackupPolicies();
  const [enabled, setEnabled] = useState(true);
  const [cronExpression, setCronExpression] = useState("0 2 * * *");
  const [timezone, setTimezone] = useState("UTC");
  const [retentionDays, setRetentionDays] = useState("30");
  const [serverConcurrency, setServerConcurrency] = useState(2);
  const [tenantConcurrency, setTenantConcurrency] = useState(2);
  const [defaultBackupEnabled, setDefaultBackupEnabled] = useState(true);
  const [defaultCompressionEnabled, setDefaultCompressionEnabled] = useState(true);
  const [defaultAlgorithm, setDefaultAlgorithm] = useState<BackupCompressionAlgorithm>(BackupCompressionAlgorithm.GZIP);
  const [editingDatabase, setEditingDatabase] = useState<BackupDatabaseConfig | null>(null);
  const [overrideBackup, setOverrideBackup] = useState("inherit");
  const [overrideCompression, setOverrideCompression] = useState("inherit");
  const [overrideAlgorithm, setOverrideAlgorithm] = useState("inherit");

  const [prevPolicy, setPrevPolicy] = useState(view.policy);
  if (view.policy !== prevPolicy) {
    setPrevPolicy(view.policy);
    if (view.policy) {
      setEnabled(view.policy.enabled);
      setCronExpression(view.policy.cronExpression);
      setTimezone(view.policy.timezone);
      setRetentionDays(String(view.policy.retentionDays));
      setServerConcurrency(view.policy.serverConcurrency);
      setTenantConcurrency(view.policy.tenantConcurrency);
      setDefaultBackupEnabled(view.policy.defaultBackupEnabled);
      setDefaultCompressionEnabled(view.policy.defaultCompressionEnabled);
      setDefaultAlgorithm(view.policy.defaultCompressionAlgorithm);
    }
  }

  const openOverride = (database: BackupDatabaseConfig) => {
    setEditingDatabase(database);
    setOverrideBackup(database.override?.backupEnabled === null || database.override?.backupEnabled === undefined ? "inherit" : database.override.backupEnabled ? "enabled" : "disabled");
    setOverrideCompression(database.override?.compressionEnabled === null || database.override?.compressionEnabled === undefined ? "inherit" : database.override.compressionEnabled ? "enabled" : "disabled");
    setOverrideAlgorithm(database.override?.compressionAlgorithm ?? "inherit");
  };

  if (!view.canReadServers) {
    return (
      <BackupStatePanel
        kind="forbidden"
        title={copy.restrictedTitle}
        description={copy.restrictedDescription}
      />
    );
  }

  const policyValid =
    cronExpression.trim().length > 0 &&
    cronExpression.length <= 120 &&
    timezone.trim().length > 0 &&
    timezone.length <= 80 &&
    retentionDays !== "" &&
    Number(retentionDays) >= 1 &&
    Number(retentionDays) <= 3650 &&
    serverConcurrency >= 1 && serverConcurrency <= 10 &&
    tenantConcurrency >= 1 && tenantConcurrency <= 10;

  const databaseColumns: ColumnDef<BackupDatabaseConfig>[] = [
    {
      key: "database",
      headerEn: "Database",
      headerAr: "قاعدة البيانات",
      cell: (database) => (
        <div>
          <p className="font-mono font-semibold">{database.databaseName}</p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">{database.tenantId}</p>
        </div>
      ),
    },
    { key: "tenantStatus", headerEn: "Tenant status", headerAr: "حالة المستأجر", cell: (database) => <span className="font-semibold">{database.tenantStatus}</span> },
    {
      key: "backup",
      headerEn: "Backup",
      headerAr: "النسخ",
      cell: (database) => (
        <div className="flex items-center gap-2">
          {database.backupEnabled ? copy.enabledValue : copy.disabledValue}
          {database.override && <Badge tone="warn">Override</Badge>}
        </div>
      ),
    },
    { key: "compression", headerEn: "Compression", headerAr: "الضغط", cell: (database) => <span>{database.compressionEnabled ? database.compressionAlgorithm : "none"}</span> },
    {
      key: "actions",
      headerEn: "Actions",
      headerAr: "الإجراءات",
      align: "end",
      cell: (database) => (
        <div className="flex items-center justify-end gap-2">
          {view.canManage && (
            <Button type="button" variant="outline" size="sm" onClick={() => openOverride(database)}>
              {copy.editAction}
            </Button>
          )}
          {view.canManage && database.override && (
            <button
              type="button"
              onClick={() => void view.resetOverride(database.tenantId).catch(() => undefined)}
              disabled={view.activeAction === `reset:${database.tenantId}`}
              aria-label={copy.resetOverrideAriaLabel}
              className="grid size-9 place-items-center rounded-md text-muted-foreground hover:bg-ink-100 disabled:opacity-50 dark:hover:bg-ink-800"
            >
              <Undo2 className="size-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="w-full space-y-6">
      <BackupPageHeader
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
      />

      <Card>
        <CardContent className="grid gap-4 p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <BackupServerSelect
            label={copy.databaseServerLabel}
            value={view.selectedServerId}
            servers={view.servers}
            onChange={view.setSelectedServerId}
            disabled={view.isLoading || Boolean(view.activeAction)}
            placeholder={copy.selectServerPlaceholder}
          />
          <Button type="button" variant="outline" onClick={() => void view.refresh()} disabled={!view.selectedServerId || view.isLoadingData}>
            <RefreshCw className={`size-4 ${view.isLoadingData ? "animate-spin" : ""}`} />
            {copy.refreshButton}
          </Button>
        </CardContent>
      </Card>

      {view.error && <BackupErrorBanner error={view.error} />}

      {view.isLoading || view.isLoadingData ? (
        <BackupStatePanel kind="loading" title={copy.loadingTitle} description={copy.loadingDescription} />
      ) : view.error ? null : !view.selectedServerId || !view.policy ? (
        <BackupStatePanel kind="empty" title={copy.selectServerTitle} description={copy.selectServerDescription} />
      ) : (
        <>
          <Card>
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Settings2 className="size-5 text-brand-600 dark:text-brand-400" />
                  {copy.policyDefaultsTitle}
                </CardTitle>
                <CardDescription>{copy.policyDefaultsDescription}</CardDescription>
              </div>
              <Badge tone={enabled ? "brand" : "neutral"}>{enabled ? copy.policyEnabledBadge : copy.policyDisabledBadge}</Badge>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <label className="flex h-(--size-control-lg) items-center gap-3 rounded-md border border-border px-3 text-sm font-semibold">
                <Checkbox checked={enabled} onCheckedChange={(c) => setEnabled(c === true)} disabled={!view.canManage} />
                {copy.policyEnabledLabel}
              </label>
              <Field label={copy.cronLabel}>
                {(fp) => <Input {...fp} value={cronExpression} onChange={(e) => setCronExpression(e.target.value)} disabled={!view.canManage} maxLength={120} />}
              </Field>
              <Field label={copy.timezoneLabel}>
                {(fp) => <Input {...fp} value={timezone} onChange={(e) => setTimezone(e.target.value)} disabled={!view.canManage} maxLength={80} />}
              </Field>
              <Field label={copy.retentionDaysLabel}>
                {(fp) => <Input {...fp} type="number" min={1} max={3650} value={retentionDays} onChange={(e) => setRetentionDays(e.target.value)} disabled={!view.canManage} placeholder="30" />}
              </Field>
              <Field label={copy.serverConcurrencyLabel}>
                {(fp) => <Input {...fp} type="number" min={1} max={10} value={serverConcurrency} onChange={(e) => setServerConcurrency(Number(e.target.value))} disabled={!view.canManage} />}
              </Field>
              <Field label={copy.tenantConcurrencyLabel}>
                {(fp) => <Input {...fp} type="number" min={1} max={10} value={tenantConcurrency} onChange={(e) => setTenantConcurrency(Number(e.target.value))} disabled={!view.canManage} />}
              </Field>
              <label className="flex h-(--size-control-lg) items-center gap-3 rounded-md border border-border px-3 text-sm font-semibold">
                <Checkbox checked={defaultBackupEnabled} onCheckedChange={(c) => setDefaultBackupEnabled(c === true)} disabled={!view.canManage} />
                {copy.backupByDefaultLabel}
              </label>
              <label className="flex h-(--size-control-lg) items-center gap-3 rounded-md border border-border px-3 text-sm font-semibold">
                <Checkbox checked={defaultCompressionEnabled} onCheckedChange={(c) => setDefaultCompressionEnabled(c === true)} disabled={!view.canManage} />
                {copy.compressByDefaultLabel}
              </label>
              <Field label={copy.defaultCompressionAlgorithmLabel}>
                {(fp) => (
                  <Select value={defaultAlgorithm} onValueChange={(v) => setDefaultAlgorithm(v as BackupCompressionAlgorithm)} disabled={!view.canManage}>
                    <SelectTrigger {...fp}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={BackupCompressionAlgorithm.GZIP}>gzip</SelectItem>
                      <SelectItem value={BackupCompressionAlgorithm.NONE}>none</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </Field>
            </CardContent>
            {view.canManage && (
              <CardFooter className="justify-end">
                <Button
                  type="button"
                  variant="primary"
                  disabled={!policyValid || !view.ownsSelectedServerState || view.activeAction === "policy"}
                  onClick={() =>
                    void view
                      .savePolicy({
                        enabled,
                        cronExpression: cronExpression.trim(),
                        timezone: timezone.trim(),
                        retentionDays: Number(retentionDays),
                        serverConcurrency,
                        tenantConcurrency,
                        defaultBackupEnabled,
                        defaultCompressionEnabled,
                        defaultCompressionAlgorithm: defaultAlgorithm,
                      })
                      .catch(() => undefined)
                  }
                >
                  <Settings2 className="size-4" />
                  {copy.savePolicyButton}
                </Button>
              </CardFooter>
            )}
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <SlidersHorizontal className="size-5 text-brand-600 dark:text-brand-400" />
                  {copy.databaseConfigTitle}
                </CardTitle>
                <CardDescription>{copy.databaseConfigDescription}</CardDescription>
              </div>
              <Badge tone="neutral">{view.databases.length}</Badge>
            </CardHeader>
            <DataTable
              columns={databaseColumns}
              data={view.databases}
              getRowId={(database) => database.tenantId}
              pagination={{ page: 1, limit: view.databases.length || 1, totalItems: view.databases.length, totalPages: 1, onPageChange: () => {} }}
              emptyState={{ titleEn: "No tenant databases are placed on this server.", titleAr: "لا توجد قواعد بيانات مستأجرين على هذا الخادم." }}
            />
          </Card>
        </>
      )}

      <BackupDialog
        open={editingDatabase !== null}
        title={copy.editOverrideDialogTitle}
        description={editingDatabase ? editingDatabase.databaseName : ""}
        confirmLabel={copy.saveOverrideButton}
        onClose={() => setEditingDatabase(null)}
        onConfirm={() => {
          if (!editingDatabase) return;
          void view
            .saveOverride(editingDatabase.tenantId, {
              backupEnabled: triStateBoolean(overrideBackup),
              compressionEnabled: triStateBoolean(overrideCompression),
              compressionAlgorithm: overrideAlgorithm === "inherit" ? null : (overrideAlgorithm as BackupCompressionAlgorithm),
            })
            .then(() => setEditingDatabase(null))
            .catch(() => undefined);
        }}
        isSubmitting={editingDatabase ? view.activeAction === `override:${editingDatabase.tenantId}` : false}
        confirmDisabled={!view.ownsSelectedServerState}
      >
        <Field label={copy.backupEnabledFieldLabel}>
          {(fp) => (
            <Select value={overrideBackup} onValueChange={setOverrideBackup}>
              <SelectTrigger {...fp}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inherit">{copy.inheritPolicyOption}</SelectItem>
                <SelectItem value="enabled">{copy.enabledValue}</SelectItem>
                <SelectItem value="disabled">{copy.disabledValue}</SelectItem>
              </SelectContent>
            </Select>
          )}
        </Field>
        <Field label={copy.compressionEnabledFieldLabel}>
          {(fp) => (
            <Select value={overrideCompression} onValueChange={setOverrideCompression}>
              <SelectTrigger {...fp}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inherit">{copy.inheritPolicyOption}</SelectItem>
                <SelectItem value="enabled">{copy.enabledValue}</SelectItem>
                <SelectItem value="disabled">{copy.disabledValue}</SelectItem>
              </SelectContent>
            </Select>
          )}
        </Field>
        <Field label={copy.overrideAlgorithmFieldLabel}>
          {(fp) => (
            <Select value={overrideAlgorithm} onValueChange={setOverrideAlgorithm}>
              <SelectTrigger {...fp}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inherit">{copy.inheritPolicyOption}</SelectItem>
                <SelectItem value={BackupCompressionAlgorithm.GZIP}>gzip</SelectItem>
                <SelectItem value={BackupCompressionAlgorithm.NONE}>none</SelectItem>
              </SelectContent>
            </Select>
          )}
        </Field>
      </BackupDialog>
    </div>
  );
}

function triStateBoolean(value: string): boolean | null {
  if (value === "enabled") return true;
  if (value === "disabled") return false;
  return null;
}
