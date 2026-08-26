"use client";

import { type FormEvent, useState } from "react";
import { Search } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
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
import type { TenantStorageMigrationStatus, TenantStorageMigrationView } from "../types";

const UUID_V7_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Read-only status viewer for a tenant storage migration. There is no
 * "list migrations for this tenant" endpoint, so an admin looks one up by
 * id (e.g. from a support ticket). There is intentionally no "start
 * migration" trigger here — see `../api.ts`'s module comment for why.
 */
export function TenantStorageMigrationPanel({ isArabic }: { isArabic: boolean }) {
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
      setValidationError(isArabic ? "معرّف التهجير غير صالح." : "That doesn't look like a valid migration id.");
      return;
    }
    setValidationError(null);
    view.lookup(trimmed);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">
          {isArabic ? "حالة تهجير التخزين" : "Storage migration status"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs leading-5 text-muted-foreground">
          {isArabic
            ? "لا توجد قائمة بعمليات التهجير لهذا المستأجر. أدخل معرّف تهجير معروف لعرض حالته."
            : "There is no list of migrations for this tenant. Enter a known migration id to view its status."}
        </p>
        <form onSubmit={submit} className="flex items-end gap-2">
          <div className="flex-1">
            <Field label={isArabic ? "معرّف التهجير" : "Migration id"} error={validationError ?? undefined}>
              {(fp) => (
                <Input
                  {...fp}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="019f0000-0000-7000-8000-000000000000"
                  className="font-mono"
                />
              )}
            </Field>
          </div>
          <Button type="submit" variant="outline" disabled={view.isLoading}>
            <Search className="size-4" />
            {isArabic ? "بحث" : "Look up"}
          </Button>
        </form>

        {view.error && <ErrorState error={view.error} onRetry={() => view.migrationId && view.lookup(view.migrationId)} />}

        {view.migration && (
          <MigrationStatusView migration={view.migration} isArabic={isArabic} isPolling={view.isLoading} />
        )}
      </CardContent>
    </Card>
  );
}

function MigrationStatusView({
  migration,
  isArabic,
  isPolling,
}: {
  migration: TenantStorageMigrationView;
  isArabic: boolean;
  isPolling: boolean;
}) {
  return (
    <div className="space-y-4 rounded-md border border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <StatusBadge status={migration.status} />
        {isPolling && (
          <Badge tone="neutral">{isArabic ? "يُحدَّث تلقائياً…" : "Auto-refreshing…"}</Badge>
        )}
      </div>
      <OperationTimeline steps={migrationSteps(migration.status, isArabic)} />
      <dl className="grid gap-3 text-xs sm:grid-cols-2">
        <DatumRow label={isArabic ? "خادم المصدر" : "Source server"} value={migration.sourceStorageServerId} mono />
        <DatumRow label={isArabic ? "خادم الهدف" : "Target server"} value={migration.targetStorageServerId} mono />
        {migration.copiedObjectCount !== null && (
          <DatumRow label={isArabic ? "عدد الكائنات المنسوخة" : "Objects copied"} value={String(migration.copiedObjectCount)} />
        )}
        {migration.copiedBytes !== null && (
          <DatumRow label={isArabic ? "البايتات المنسوخة" : "Bytes copied"} value={migration.copiedBytes} mono />
        )}
        {migration.failureCode && (
          <DatumRow label={isArabic ? "رمز الفشل" : "Failure code"} value={migration.failureCode} mono />
        )}
      </dl>
    </div>
  );
}

function migrationSteps(status: TenantStorageMigrationStatus, isArabic: boolean): OperationTimelineStep[] {
  const order = ["ACCEPTED", "COPYING", "COPIED", "PLACEMENT_COMMITTED", "COMPLETED"] as const;
  const labels: Record<(typeof order)[number], [string, string]> = {
    ACCEPTED: ["Accepted", "مقبول"],
    COPYING: ["Copying", "جارٍ النسخ"],
    COPIED: ["Copy verified", "تم التحقق من النسخ"],
    PLACEMENT_COMMITTED: ["Placement committed", "تم اعتماد التوزيع"],
    COMPLETED: ["Completed", "مكتمل"],
  };
  if (status === "ROLLING_BACK" || status === "ROLLED_BACK") {
    return [
      {
        label: isArabic ? "التراجع" : "Rollback",
        detail: status === "ROLLED_BACK"
          ? isArabic
            ? "فشل التهجير وتم التراجع عن التغييرات."
            : "The migration failed and changes were rolled back."
          : isArabic
            ? "التهجير فشل والتراجع جارٍ الآن."
            : "The migration failed and is rolling back now.",
        state: status === "ROLLED_BACK" ? "failed" : "warning",
      },
    ];
  }
  const currentIndex = order.indexOf(status);
  return order.map((step, index) => ({
    label: isArabic ? labels[step][1] : labels[step][0],
    detail: "",
    state: index < currentIndex ? "done" : index === currentIndex ? "active" : "pending",
  }));
}

function DatumRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={mono ? "break-all text-end font-mono font-semibold text-foreground" : "text-end font-semibold text-foreground"}>{value}</dd>
    </div>
  );
}
