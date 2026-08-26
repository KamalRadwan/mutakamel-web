"use client";

import {
  AlertCircle,
  Database,
  HardDrive,
  Loader2,
  RefreshCw,
  Server,
  ShieldCheck,
} from "lucide-react";
import type { TenantStoragePlacementOption } from "../../lib/storage-placement";
import type { NormalizedApiError } from "@/shared/api/normalized-api-error";
import type {
  TenantDatabasePlacementOption,
  TenantRegistrationLoadState,
} from "../types";

interface TenantInfrastructureStepProps {
  isArabic: boolean;
  databaseOptions: readonly TenantDatabasePlacementOption[];
  databaseState: TenantRegistrationLoadState;
  databaseError: NormalizedApiError | null;
  selectedDatabase: TenantDatabasePlacementOption | null;
  selectedDatabaseId: string;
  showDatabaseSelectionError: boolean;
  onDatabaseChange: (id: string) => void;
  onRetryDatabase: () => void;
  storageOptions: readonly TenantStoragePlacementOption[];
  storageState: TenantRegistrationLoadState;
  storageError: NormalizedApiError | null;
  selectedStorage: TenantStoragePlacementOption | null;
  selectedStorageId: string;
  showStorageSelectionError: boolean;
  onStorageChange: (id: string) => void;
  onRetryStorage: () => void;
}

export function TenantInfrastructureStep({
  isArabic,
  databaseOptions,
  databaseState,
  databaseError,
  selectedDatabase,
  selectedDatabaseId,
  showDatabaseSelectionError,
  onDatabaseChange,
  onRetryDatabase,
  storageOptions,
  storageState,
  storageError,
  selectedStorage,
  selectedStorageId,
  showStorageSelectionError,
  onStorageChange,
  onRetryStorage,
}: TenantInfrastructureStepProps) {
  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
      <header className="border-b border-slate-200 pb-4 dark:border-slate-800">
        <h3 className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-slate-100">
          <Server className="size-4 text-purple-600 dark:text-purple-400" />
          {isArabic
            ? "الخطوة 4: تحديد البنية التحتية"
            : "Step 4: Infrastructure Placement"}
        </h3>
        <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500 dark:text-slate-400">
          {isArabic
            ? "يجب اختيار Database Server متوافق مع التطبيقات المختارة وStorage Server مؤهل. يعيد Core التحقق من الاثنين عند الإنشاء."
            : "Choose a Database Server compatible with the selected Applications and an eligible Storage Server. Core revalidates both when the tenant is created."}
        </p>
      </header>

      <PlacementSection
        icon={<Database className="size-4" />}
        title={isArabic ? "سيرفر قاعدة البيانات" : "Database Server"}
        description={
          isArabic
            ? "تعرض القائمة فقط السيرفرات التي جهزت system principals وربطت كل التطبيقات المختارة بنجاح."
            : "Only servers with ready system principals and ready bindings for every selected Application are returned."
        }
        state={databaseState}
        error={databaseError}
        isArabic={isArabic}
        onRetry={onRetryDatabase}
        idleText={isArabic ? "أكمل اختيار التطبيقات أولاً." : "Complete the Application selection first."}
        emptyText={
          isArabic
            ? "لا يوجد Database Server متوافق مع مجموعة التطبيقات الحالية."
            : "No Database Server is compatible with the current Application set."
        }
      >
        <select
          value={selectedDatabaseId}
          onChange={(event) => onDatabaseChange(event.target.value)}
          aria-invalid={showDatabaseSelectionError && !selectedDatabase}
          required
          className={`min-h-11 w-full rounded-xl border bg-white px-3 text-xs text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 dark:bg-slate-900 dark:text-slate-100 ${
            showDatabaseSelectionError && !selectedDatabase
              ? "border-rose-400 dark:border-rose-700"
              : "border-slate-200 dark:border-slate-700"
          }`}
        >
          <option value="">{isArabic ? "-- اختر Database Server --" : "-- Select Database Server --"}</option>
          {databaseOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name} · {option.currentTenants}/{option.maxTenants} {isArabic ? "مستأجر" : "tenants"}
              {option.countryIsoCode ? ` · ${option.countryIsoCode}` : ""}
            </option>
          ))}
        </select>
        {showDatabaseSelectionError && !selectedDatabase ? (
          <ValidationMessage>
            {isArabic
              ? "اختر Database Server مؤهلاً من القائمة الموثوقة."
              : "Select an eligible Database Server from the authoritative list."}
          </ValidationMessage>
        ) : null}
        {selectedDatabase ? (
          <dl className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 text-[11px] sm:grid-cols-4 dark:border-slate-700 dark:bg-slate-900">
            <Metric label={isArabic ? "الاسم" : "Name"} value={selectedDatabase.name} />
            <Metric label={isArabic ? "الحالة" : "Status"} value={selectedDatabase.status} />
            <Metric label={isArabic ? "السعة" : "Capacity"} value={`${selectedDatabase.currentTenants}/${selectedDatabase.maxTenants}`} />
            <Metric label={isArabic ? "الدولة" : "Country"} value={selectedDatabase.countryName ?? selectedDatabase.countryIsoCode ?? "—"} />
          </dl>
        ) : null}
      </PlacementSection>

      <PlacementSection
        icon={<HardDrive className="size-4" />}
        title={isArabic ? "سيرفر التخزين" : "Storage Server"}
        description={
          isArabic
            ? "الاختيار صريح ولا يوجد fallback أو هدف افتراضي للمستأجر."
            : "Selection is explicit; there is no silent fallback or tenant default."
        }
        state={storageState}
        error={storageError}
        isArabic={isArabic}
        onRetry={onRetryStorage}
        emptyText={
          isArabic
            ? "لا يوجد Storage Server مؤهل باختبار اتصال حديث."
            : "No Storage Server has current eligible connection evidence."
        }
      >
        <select
          value={selectedStorageId}
          onChange={(event) => onStorageChange(event.target.value)}
          aria-invalid={showStorageSelectionError && !selectedStorage}
          required
          className={`min-h-11 w-full rounded-xl border bg-white px-3 text-xs text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 dark:bg-slate-900 dark:text-slate-100 ${
            showStorageSelectionError && !selectedStorage
              ? "border-rose-400 dark:border-rose-700"
              : "border-slate-200 dark:border-slate-700"
          }`}
        >
          <option value="">{isArabic ? "-- اختر Storage Server --" : "-- Select Storage Server --"}</option>
          {storageOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name} · {option.region} · {option.assignedTenants}
              {option.maxTenants ? `/${option.maxTenants}` : ""} {isArabic ? "مستأجر" : "tenants"}
            </option>
          ))}
        </select>
        {showStorageSelectionError && !selectedStorage ? (
          <ValidationMessage>
            {isArabic
              ? "اختر Storage Server مؤهلاً من القائمة الموثوقة."
              : "Select an eligible Storage Server from the authoritative list."}
          </ValidationMessage>
        ) : null}
        {selectedStorage ? (
          <dl className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 text-[11px] sm:grid-cols-4 dark:border-slate-700 dark:bg-slate-900">
            <Metric label={isArabic ? "الاسم" : "Name"} value={selectedStorage.name} />
            <Metric label={isArabic ? "المنطقة" : "Region"} value={selectedStorage.region} />
            <Metric
              label={isArabic ? "السعة" : "Capacity"}
              value={`${selectedStorage.assignedTenants} / ${selectedStorage.maxTenants ?? "∞"}`}
            />
            <Metric label={isArabic ? "الحالة" : "Status"} value={selectedStorage.status} />
          </dl>
        ) : null}
      </PlacementSection>
    </section>
  );
}

function PlacementSection({
  icon,
  title,
  description,
  state,
  error,
  isArabic,
  onRetry,
  idleText,
  emptyText,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  state: TenantRegistrationLoadState;
  error: NormalizedApiError | null;
  isArabic: boolean;
  onRetry: () => void;
  idleText?: string;
  emptyText: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/30">
      <div>
        <h4 className="flex items-center gap-2 text-xs font-black text-slate-800 dark:text-slate-200">
          <span className="text-purple-600 dark:text-purple-400">{icon}</span> {title}
        </h4>
        <p className="mt-1 text-[11px] leading-5 text-slate-500">{description}</p>
      </div>
      {state === "idle" ? <PlacementNotice tone="slate" text={idleText ?? ""} /> : null}
      {state === "loading" ? (
        <PlacementNotice tone="blue" text={isArabic ? "جاري تحميل الأهداف المؤهلة..." : "Loading eligible targets..."} loading />
      ) : null}
      {state === "forbidden" ? (
        <PlacementNotice tone="amber" text={isArabic ? "صلاحية admin.tenants.create مطلوبة." : "admin.tenants.create is required."} />
      ) : null}
      {state === "error" ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300" role="alert">
          <p className="flex items-start gap-2 text-[11px]"><AlertCircle className="mt-0.5 size-4 shrink-0" /><span>{error?.message ?? (isArabic ? "تعذر تحميل الأهداف." : "Targets could not be loaded.")}</span></p>
          {error?.correlationId ? <p className="mt-1 break-all font-mono text-[10px]">Correlation ID: {error.correlationId}</p> : null}
          <button type="button" onClick={onRetry} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg border border-rose-300 bg-white px-3 text-xs font-bold hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:border-rose-800 dark:bg-slate-900">
            <RefreshCw className="size-3.5" /> {isArabic ? "إعادة المحاولة" : "Retry"}
          </button>
        </div>
      ) : null}
      {state === "empty" ? <PlacementNotice tone="amber" text={emptyText} /> : null}
      {state === "ready" ? <div className="space-y-3">{children}</div> : null}
    </section>
  );
}

function PlacementNotice({ tone, text, loading = false }: { tone: "slate" | "blue" | "amber"; text: string; loading?: boolean }) {
  const classes = {
    slate: "border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300",
    blue: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300",
    amber: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
  }[tone];
  return (
    <div className={`flex items-center gap-2 rounded-xl border p-3 text-[11px] ${classes}`} role={loading ? "status" : "alert"}>
      {loading ? <Loader2 className="size-4 animate-spin" /> : tone === "amber" ? <AlertCircle className="size-4" /> : <ShieldCheck className="size-4" />}
      <span>{text}</span>
    </div>
  );
}

function ValidationMessage({ children }: { children: React.ReactNode }) {
  return <p className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-600 dark:text-rose-400" role="alert"><AlertCircle className="size-3.5" />{children}</p>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt className="text-slate-500">{label}</dt><dd className="mt-1 truncate font-bold text-slate-900 dark:text-slate-100" title={value}>{value}</dd></div>;
}
