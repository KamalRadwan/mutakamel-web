"use client";

import { useState } from "react";
import { RefreshCw, Settings2, SlidersHorizontal, Undo2 } from "lucide-react";
import { BackupCompressionAlgorithm, type BackupDatabaseConfig, type BackupPolicy } from "../types";
import { BackupDialog } from "../components/BackupDialog";
import { BackupErrorBanner } from "../components/BackupErrorBanner";
import { BackupPageHeader } from "../components/BackupPageHeader";
import { BackupServerSelect } from "../components/BackupServerSelect";
import { BackupStatePanel } from "../components/BackupStatePanel";
import { useBackupPolicies } from "../hooks/useBackupPolicies";
import { formatBackupNumber } from "../lib/backup-format";
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
  const { dir, lang, t } = useI18n();
  const copy = t.backup.policiesScreen;
  const locale = lang === "ar" ? "ar-EG" : "en-US";
  const view = useBackupPolicies();
  const policySourceKey = view.policy ? `${view.policy.id}:${view.policy.updatedAt}` : "none";
  const loadedPolicyDraft = createPolicyDraft(view.policy, policySourceKey);
  const [savedPolicyDraft, setSavedPolicyDraft] = useState(loadedPolicyDraft);
  const policyDraft = savedPolicyDraft.sourceKey === policySourceKey ? savedPolicyDraft : loadedPolicyDraft;
  const updatePolicyDraft = (next: Partial<Omit<PolicyDraft, "sourceKey">>) => {
    setSavedPolicyDraft({ ...policyDraft, ...next, sourceKey: policySourceKey });
  };
  const {
    enabled,
    cronExpression,
    timezone,
    retentionDays,
    serverConcurrency,
    tenantConcurrency,
    defaultBackupEnabled,
    defaultCompressionEnabled,
    defaultAlgorithm,
  } = policyDraft;
  const [editingDatabase, setEditingDatabase] = useState<BackupDatabaseConfig | null>(null);
  const [overrideBackup, setOverrideBackup] = useState("inherit");
  const [overrideCompression, setOverrideCompression] = useState("inherit");
  const [overrideAlgorithm, setOverrideAlgorithm] = useState("inherit");

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
  const cronError = !cronExpression.trim() || cronExpression.length > 120
    ? lang === "ar" ? "أدخل تعبير جدولة صالحاً بطول لا يتجاوز 120 حرفاً." : "Enter a schedule expression up to 120 characters."
    : undefined;
  const timezoneError = !timezone.trim() || timezone.length > 80
    ? lang === "ar" ? "أدخل منطقة زمنية صالحة بطول لا يتجاوز 80 حرفاً." : "Enter a timezone up to 80 characters."
    : undefined;
  const retentionError = retentionDays === "" || Number(retentionDays) < 1 || Number(retentionDays) > 3650
    ? lang === "ar" ? "يجب أن تكون مدة الاحتفاظ بين 1 و3650 يوماً." : "Retention must be between 1 and 3650 days."
    : undefined;
  const serverConcurrencyError = serverConcurrency < 1 || serverConcurrency > 10
    ? lang === "ar" ? "يجب أن يكون توازي الخوادم بين 1 و10." : "Server concurrency must be between 1 and 10."
    : undefined;
  const tenantConcurrencyError = tenantConcurrency < 1 || tenantConcurrency > 10
    ? lang === "ar" ? "يجب أن يكون توازي المستأجرين بين 1 و10." : "Tenant concurrency must be between 1 and 10."
    : undefined;

  const databaseColumns: ColumnDef<BackupDatabaseConfig>[] = [
    {
      key: "database",
      headerEn: "Database",
      headerAr: "قاعدة البيانات",
      cell: (database) => (
        <div>
          <p dir="ltr" className="font-mono font-semibold">{database.databaseName}</p>
          <p dir="ltr" className="mt-1 font-mono text-xs text-muted-foreground">{database.tenantId}</p>
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
          {database.override && <Badge tone="warn">{lang === "ar" ? "تجاوز" : "Override"}</Badge>}
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
            <Button type="button" variant="outline" size="sm" onClick={() => openOverride(database)} disabled={Boolean(view.activeAction)}>
              {copy.editAction}
            </Button>
          )}
          {view.canManage && database.override && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void view.resetOverride(database.tenantId).catch(() => undefined)}
              disabled={Boolean(view.activeAction)}
              loading={view.activeAction === `reset:${database.tenantId}`}
              aria-label={copy.resetOverrideAriaLabel}
              className="size-9 p-0 text-muted-foreground"
            >
              {view.activeAction !== `reset:${database.tenantId}` && <Undo2 className="size-4" aria-hidden="true" />}
            </Button>
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
            required
          />
          <Button type="button" variant="outline" onClick={() => void view.refresh()} disabled={!view.selectedServerId || view.isLoadingData} loading={view.isLoadingData}>
            {!view.isLoadingData && <RefreshCw className="size-4" aria-hidden="true" />}
            {copy.refreshButton}
          </Button>
        </CardContent>
      </Card>

      {view.error && !editingDatabase && <BackupErrorBanner error={view.error} />}

      {view.isLoading || view.isLoadingData ? (
        <BackupStatePanel kind="loading" title={copy.loadingTitle} description={copy.loadingDescription} />
      ) : !view.selectedServerId || !view.policy ? (
        view.error ? null : <BackupStatePanel kind="empty" title={copy.selectServerTitle} description={copy.selectServerDescription} />
      ) : (
        <>
          <Card>
            <CardHeader className="flex-col items-start justify-between gap-3 space-y-0 sm:flex-row">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Settings2 className="size-5 text-info" aria-hidden="true" />
                  {copy.policyDefaultsTitle}
                </CardTitle>
                <CardDescription>{copy.policyDefaultsDescription}</CardDescription>
              </div>
              <Badge tone={enabled ? "success" : "neutral"}>{enabled ? copy.policyEnabledBadge : copy.policyDisabledBadge}</Badge>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <label htmlFor="backup-policy-enabled" className="flex min-h-(--size-control-lg) items-center gap-3 rounded-md border border-border px-3 text-sm font-semibold">
                <Checkbox id="backup-policy-enabled" checked={enabled} onCheckedChange={(c) => updatePolicyDraft({ enabled: c === true })} disabled={!view.canManage} />
                {copy.policyEnabledLabel}
              </label>
              <Field label={copy.cronLabel} error={cronError} required>
                {(fp) => <Input {...fp} dir="ltr" value={cronExpression} onChange={(e) => updatePolicyDraft({ cronExpression: e.target.value })} disabled={!view.canManage} maxLength={120} />}
              </Field>
              <Field label={copy.timezoneLabel} error={timezoneError} required>
                {(fp) => <Input {...fp} dir="ltr" value={timezone} onChange={(e) => updatePolicyDraft({ timezone: e.target.value })} disabled={!view.canManage} maxLength={80} />}
              </Field>
              <Field label={copy.retentionDaysLabel} error={retentionError} required>
                {(fp) => <Input {...fp} dir="ltr" type="number" min={1} max={3650} value={retentionDays} onChange={(e) => updatePolicyDraft({ retentionDays: e.target.value })} disabled={!view.canManage} placeholder="30" />}
              </Field>
              <Field label={copy.serverConcurrencyLabel} error={serverConcurrencyError} required>
                {(fp) => <Input {...fp} dir="ltr" type="number" min={1} max={10} value={serverConcurrency} onChange={(e) => updatePolicyDraft({ serverConcurrency: Number(e.target.value) })} disabled={!view.canManage} />}
              </Field>
              <Field label={copy.tenantConcurrencyLabel} error={tenantConcurrencyError} required>
                {(fp) => <Input {...fp} dir="ltr" type="number" min={1} max={10} value={tenantConcurrency} onChange={(e) => updatePolicyDraft({ tenantConcurrency: Number(e.target.value) })} disabled={!view.canManage} />}
              </Field>
              <label htmlFor="backup-policy-default-enabled" className="flex min-h-(--size-control-lg) items-center gap-3 rounded-md border border-border px-3 text-sm font-semibold">
                <Checkbox id="backup-policy-default-enabled" checked={defaultBackupEnabled} onCheckedChange={(c) => updatePolicyDraft({ defaultBackupEnabled: c === true })} disabled={!view.canManage} />
                {copy.backupByDefaultLabel}
              </label>
              <label htmlFor="backup-policy-compression-enabled" className="flex min-h-(--size-control-lg) items-center gap-3 rounded-md border border-border px-3 text-sm font-semibold">
                <Checkbox id="backup-policy-compression-enabled" checked={defaultCompressionEnabled} onCheckedChange={(c) => updatePolicyDraft({ defaultCompressionEnabled: c === true })} disabled={!view.canManage} />
                {copy.compressByDefaultLabel}
              </label>
              <Field label={copy.defaultCompressionAlgorithmLabel} required>
                {(fp) => (
                  <Select value={defaultAlgorithm} onValueChange={(v) => updatePolicyDraft({ defaultAlgorithm: v as BackupCompressionAlgorithm })} disabled={!view.canManage} dir={dir}>
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
                  loading={view.activeAction === "policy"}
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
                  {view.activeAction !== "policy" && <Settings2 className="size-4" aria-hidden="true" />}
                  {copy.savePolicyButton}
                </Button>
              </CardFooter>
            )}
          </Card>

          <section className="space-y-3" aria-labelledby="backup-database-config-title">
            <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h2 id="backup-database-config-title" className="flex items-center gap-2 text-base font-semibold">
                  <SlidersHorizontal className="size-5 text-info" aria-hidden="true" />
                  {copy.databaseConfigTitle}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">{copy.databaseConfigDescription}</p>
              </div>
              <Badge tone="neutral">{formatBackupNumber(view.databases.length, locale)}</Badge>
            </div>
            <DataTable
              labelEn="Tenant backup configuration"
              labelAr="إعدادات النسخ الاحتياطي للمستأجرين"
              columns={databaseColumns}
              data={view.databases}
              getRowId={(database) => database.tenantId}
              getRowLabel={(database) => database.databaseName}
              responsiveMode="record-cards"
              pagination={{ page: 1, limit: view.databases.length || 1, totalItems: view.databases.length, totalPages: 1, onPageChange: () => {} }}
              emptyState={{ titleEn: "No tenant databases are placed on this server.", titleAr: "لا توجد قواعد بيانات مستأجرين على هذا الخادم." }}
            />
          </section>
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
        error={view.error}
      >
        <Field label={copy.backupEnabledFieldLabel} required>
          {(fp) => (
            <Select value={overrideBackup} onValueChange={setOverrideBackup} dir={dir}>
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
        <Field label={copy.compressionEnabledFieldLabel} required>
          {(fp) => (
            <Select value={overrideCompression} onValueChange={setOverrideCompression} dir={dir}>
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
        <Field label={copy.overrideAlgorithmFieldLabel} required>
          {(fp) => (
            <Select value={overrideAlgorithm} onValueChange={setOverrideAlgorithm} dir={dir}>
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

interface PolicyDraft {
  sourceKey: string;
  enabled: boolean;
  cronExpression: string;
  timezone: string;
  retentionDays: string;
  serverConcurrency: number;
  tenantConcurrency: number;
  defaultBackupEnabled: boolean;
  defaultCompressionEnabled: boolean;
  defaultAlgorithm: BackupCompressionAlgorithm;
}

function createPolicyDraft(policy: BackupPolicy | null, sourceKey: string): PolicyDraft {
  return {
    sourceKey,
    enabled: policy?.enabled ?? true,
    cronExpression: policy?.cronExpression ?? "0 2 * * *",
    timezone: policy?.timezone ?? "UTC",
    retentionDays: String(policy?.retentionDays ?? 30),
    serverConcurrency: policy?.serverConcurrency ?? 2,
    tenantConcurrency: policy?.tenantConcurrency ?? 2,
    defaultBackupEnabled: policy?.defaultBackupEnabled ?? true,
    defaultCompressionEnabled: policy?.defaultCompressionEnabled ?? true,
    defaultAlgorithm: policy?.defaultCompressionAlgorithm ?? BackupCompressionAlgorithm.GZIP,
  };
}
