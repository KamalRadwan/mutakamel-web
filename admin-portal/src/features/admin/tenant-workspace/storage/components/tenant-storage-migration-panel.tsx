"use client";

import { type FormEvent, useState } from "react";
import { Search } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { adminCan } from "@/lib/auth/rbac";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ErrorState,
  Field,
  Input,
  OperationTimeline,
  StatusBadge,
  type OperationTimelineStep,
} from "@/design-system";
import { useTenantStorageMigration } from "../use-tenant-storage-migration";
import { isStorageMigrationAwaitingSourceRelease } from "../types";
import type { TenantStorageMigrationView } from "../types";

const UUID_V7_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Read-only status viewer for a tenant storage migration. There is no
 * "list migrations for this tenant" endpoint, so an admin looks one up by
 * id (e.g. from a support ticket). There is intentionally no "start
 * migration" trigger here — see `../api.ts`'s module comment for why.
 */
export function TenantStorageMigrationPanel() {
  const { t } = useI18n();
  const { user } = useAuth();
  const canRead = adminCan(user, "admin.storage_migrations.read");
  const view = useTenantStorageMigration();
  const [input, setInput] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!canRead) return null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = input.trim().toLowerCase();
    if (!UUID_V7_PATTERN.test(trimmed)) {
      setValidationError(t.storageMigration.invalidMigrationId);
      return;
    }
    setValidationError(null);
    view.lookup(trimmed);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">
          {t.storageMigration.panelTitle}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs leading-5 text-muted-foreground">
          {t.storageMigration.panelDescription}
        </p>
        <form onSubmit={submit} className="grid items-end gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0">
            <Field id="tenant-storage-migration-id" label={t.storageMigration.migrationIdLabel} error={validationError ?? undefined}>
              {(fp) => (
                <Input
                  {...fp}
                  name="migrationId"
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    if (validationError) setValidationError(null);
                  }}
                  placeholder="019f0000-0000-7000-8000-000000000000"
                  className="font-mono"
                />
              )}
            </Field>
          </div>
          <Button type="submit" variant="outline" loading={view.isLoading}>
            <Search className="size-4" aria-hidden="true" />
            {t.storageMigration.lookupButton}
          </Button>
        </form>

        {view.error && <ErrorState error={view.error} onRetry={() => view.migrationId && view.lookup(view.migrationId)} />}

        {view.migration && (
          <MigrationStatusView migration={view.migration} isPolling={view.isLoading} />
        )}
      </CardContent>
    </Card>
  );
}

function MigrationStatusView({
  migration,
  isPolling,
}: {
  migration: TenantStorageMigrationView;
  isPolling: boolean;
}) {
  const { t, lang } = useI18n();
  const awaitingRelease = isStorageMigrationAwaitingSourceRelease(migration);
  return (
    <div className="space-y-4 rounded-md border border-border p-4" aria-busy={isPolling || undefined}>
      <div className="flex items-center justify-between gap-3">
        <StatusBadge status={migration.status} />
        {isPolling && !awaitingRelease && (
          <Badge tone="info" role="status" aria-live="polite">{t.storageMigration.autoRefreshingBadge}</Badge>
        )}
      </div>
      {awaitingRelease && (
        <p role="status" className="rounded-md border border-info/30 bg-info-subtle p-3 text-xs leading-5 text-info-subtle-foreground">
          {lang === "ar"
            ? "اكتمل النقل ويعمل المستأجر على الوجهة. لا تزال النسخة القديمة محفوظة حتى يؤكد مشغّل حذفها من صفحة نقل التخزين."
            : "The move is finished and the tenant runs on the destination. The old copy is deliberately kept until an operator confirms deleting it from the move-storage page."}
        </p>
      )}
      <OperationTimeline steps={migrationSteps(migration, lang, t)} lang={lang} />
      <dl className="grid gap-3 text-xs sm:grid-cols-2">
        <DatumRow label={t.storageMigration.sourceServerLabel} value={migration.sourceStorageServerId} mono />
        <DatumRow label={t.storageMigration.targetServerLabel} value={migration.targetStorageServerId} mono />
        {migration.copiedObjectCount !== null && (
          <DatumRow label={t.storageMigration.objectsCopiedLabel} value={String(migration.copiedObjectCount)} />
        )}
        {migration.copiedBytes !== null && (
          <DatumRow label={t.storageMigration.bytesCopiedLabel} value={migration.copiedBytes} mono />
        )}
        {migration.failureCode && (
          <DatumRow label={t.storageMigration.failureCodeLabel} value={migration.failureCode} mono />
        )}
      </dl>
    </div>
  );
}

function migrationSteps(
  migration: TenantStorageMigrationView,
  lang: "ar" | "en",
  t: ReturnType<typeof useI18n>["t"],
): OperationTimelineStep[] {
  const status = migration.status;
  const order = ["ACCEPTED", "COPYING", "COPIED", "PLACEMENT_COMMITTED", "COMPLETED"] as const;
  const labels: Record<(typeof order)[number], [string, string]> = {
    ACCEPTED: ["Accepted", "مقبول"],
    COPYING: ["Copying", "جارٍ النسخ"],
    COPIED: ["Copy verified", "تم التحقق من النسخ"],
    PLACEMENT_COMMITTED: ["Placement committed", "تم اعتماد التوزيع"],
    COMPLETED: ["Completed", "مكتمل"],
  };
  const isArabic = lang === "ar";
  if (status === "ROLLING_BACK" || status === "ROLLED_BACK") {
    return [
      {
        label: t.storageMigration.rollbackLabel,
        detail: status === "ROLLED_BACK"
          ? t.storageMigration.rolledBackDetail
          : t.storageMigration.rollingBackDetail,
        state: status === "ROLLED_BACK" ? "failed" : "warning",
      },
    ];
  }
  const currentIndex = order.indexOf(status);
  // A retained committed migration is resting, not running: its committed step
  // is done and nothing is in flight until an operator confirms the deletion.
  const awaitingRelease = isStorageMigrationAwaitingSourceRelease(migration);
  return order.map((step, index) => ({
    label: isArabic ? labels[step][1] : labels[step][0],
    detail: "",
    state:
      index < currentIndex || (awaitingRelease && index === currentIndex)
        ? "done"
        : index === currentIndex
          ? "active"
          : "pending",
  }));
}

function DatumRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid min-w-0 gap-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={mono ? "break-all font-mono font-semibold text-foreground sm:text-end" : "font-semibold text-foreground sm:text-end"}>{value}</dd>
    </div>
  );
}
