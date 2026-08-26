"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Edit3,
  HardDrive,
  KeyRound,
  Loader2,
  Play,
  RefreshCw,
  ShieldCheck,
  StopCircle,
  Trash2,
} from "lucide-react";
import { DestructiveActionModal } from "@/components/shared/DestructiveActionModal";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useToast } from "@/components/ui/ToastContext";
import { useI18n } from "@/i18n/I18nContext";
import { useStorageServerDetail } from "../hooks/useStorageServerDetail";
import type { NormalizedApiError } from "@/shared/api/normalized-api-error";
import { isSecureStorageEndpoint, probeFreshnessPercent } from "../lib/storage-server-contract";
import type { StorageServerView, UpdateStorageServerDto } from "../types";
import {
  PageHeader,
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Field,
  Input,
  DegradedBanner,
  ErrorState as DsErrorState,
  FormDrawer,
} from "@/design-system";

export function StorageServerDetailScreen({ id }: { id: string }) {
  const { lang, dir } = useI18n();
  const isArabic = lang === "ar";
  const router = useRouter();
  const toast = useToast();
  const view = useStorageServerDetail(id);
  const [editor, setEditor] = useState<"configuration" | "credentials" | null>(null);
  const [confirmation, setConfirmation] = useState<"offline" | "delete" | null>(null);
  const BackIcon = dir === "rtl" ? ArrowRight : ArrowLeft;

  useEffect(() => {
    queueMicrotask(() => {
      setEditor(null);
      setConfirmation(null);
    });
  }, [id]);

  if (view.isAuthLoading) return <LoadingState isArabic={isArabic} />;
  if (!view.canRead) return <AccessDenied isArabic={isArabic} />;
  if (view.isLoading && !view.server) return <LoadingState isArabic={isArabic} />;
  if (!view.server) return <NotAvailableState message={view.error} isArabic={isArabic} />;
  const server = view.server;

  const run = async (action: () => Promise<unknown>, success: string): Promise<boolean> => {
    try {
      await action();
      toast.success(isArabic ? "تم تنفيذ الإجراء" : "Action completed", success);
      return true;
    } catch (caught) {
      toast.error(isArabic ? "فشل الإجراء" : "Action failed", readErrorMessage(caught, isArabic ? "تعذر تنفيذ الطلب." : "The request could not be completed."));
      return false;
    }
  };

  const runProbe = async () => {
    try {
      const result = await view.probe();
      if (result.outcome === "PASSED") {
        toast.success(isArabic ? "نجح اختبار الاتصال" : "Connection test passed", isArabic ? "تم تحديث دليل الاتصال من دون تغيير حالة الخادم." : "Connection evidence was refreshed without changing lifecycle state.");
      } else {
        toast.warning(
          result.outcome === "SKIPPED" ? (isArabic ? "تم تجاوز الاختبار" : "Connection test skipped") : isArabic ? "فشل اختبار الاتصال" : "Connection test failed",
          result.errorCode ?? (isArabic ? "تغيرت مراجعة الإعداد قبل التنفيذ." : "The configuration revision changed before execution."),
        );
      }
    } catch (caught) {
      toast.error(isArabic ? "تعذر تنفيذ الاختبار" : "Connection test could not run", readErrorMessage(caught, isArabic ? "تعذر تنفيذ الطلب." : "The request could not be completed."));
    }
  };

  const deleteBlocked = server.isPlatformDefault || server.assignedTenants > 0 || !["DRAFT", "OFFLINE"].includes(server.status);
  const connectionEditBlocked = server.assignedTenants > 0 && server.status !== "OFFLINE";
  const canMakeDefault = server.status === "ACTIVE" && server.connectionEvidenceFresh && !server.isPlatformDefault;

  return (
    <div className="w-full space-y-6">
      <PageHeader
        breadcrumb={
          <Button variant="link" size="sm" asChild className="w-fit px-0">
            <Link href="/storage-servers">
              <BackIcon className="size-4" />
              {isArabic ? "العودة" : "Back"}
            </Link>
          </Button>
        }
        title={server.name}
        description={`${server.code} · ${server.id}`}
        status={
          <>
            <StatusBadge status={server.status} enumType="db-server" />
            {server.isPlatformDefault && <Badge tone="brand">{isArabic ? "الافتراضي" : "Platform default"}</Badge>}
          </>
        }
        action={
          view.canUpdate && (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => void runProbe()} disabled={view.isMutating}>
                <RefreshCw className={`size-4 ${view.isMutating ? "animate-spin" : ""}`} />
                {isArabic ? "اختبار الاتصال" : "Run connection test"}
              </Button>
              {["DRAFT", "OFFLINE"].includes(server.status) && (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => void run(view.activate, isArabic ? "نجح اختبار التفعيل وأصبح الخادم نشطاً." : "Activation test passed and the server is now ACTIVE.")}
                  disabled={view.isMutating}
                >
                  <Play className="size-4" />
                  {isArabic ? "اختبار وتفعيل" : "Test & activate"}
                </Button>
              )}
              {server.status === "ACTIVE" && !server.isPlatformDefault && (
                <Button type="button" variant="outline" size="sm" onClick={() => setConfirmation("offline")} disabled={view.isMutating}>
                  <StopCircle className="size-4" />
                  {isArabic ? "إيقاف" : "Take offline"}
                </Button>
              )}
            </div>
          )
        }
      />

      {view.error && (
        <DegradedBanner>
          <p className="whitespace-pre-line">{readErrorMessage(view.error, "")}</p>
        </DegradedBanner>
      )}
      {view.lastProbe && <ProbeResultBanner result={view.lastProbe} isArabic={isArabic} />}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.8fr)]">
        <div className="space-y-6">
          <Panel
            title={isArabic ? "إعدادات الخادم" : "Server configuration"}
            icon={<HardDrive className="size-4" />}
            action={
              view.canUpdate && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditor("configuration")}>
                  <Edit3 className="size-3.5" />
                  {isArabic ? "تعديل" : "Edit"}
                </Button>
              )
            }
          >
            <dl className="grid gap-5 sm:grid-cols-2">
              <Datum label={isArabic ? "نقطة النهاية" : "Endpoint"} value={server.endpoint} mono wide />
              <Datum label={isArabic ? "المنطقة" : "Region"} value={server.region} mono />
              <Datum label={isArabic ? "الحاوية" : "Bucket"} value={server.bucketName} mono />
              <Datum label={isArabic ? "المستأجرون" : "Tenant capacity"} value={`${server.assignedTenants} / ${server.maxTenants ?? "∞"}`} />
              <Datum label={isArabic ? "مراجعة الإعداد" : "Configuration revision"} value={`v${server.configRevision}`} mono />
            </dl>
            {connectionEditBlocked && (
              <p className="mt-5 rounded-md border border-warn-200 bg-warn-50 p-3 text-xs leading-5 text-warn-900 dark:border-warn-800/60 dark:bg-warn-950/30 dark:text-warn-200">
                {isArabic
                  ? "يجب إيقاف الخادم قبل تغيير نقطة النهاية أو المنطقة أو الحاوية أو بيانات الاعتماد لأنه يحتوي مستأجرين."
                  : "Take this assigned server OFFLINE before changing its endpoint, region, bucket, or credentials."}
              </p>
            )}
          </Panel>

          <Panel
            title={isArabic ? "بيانات الاعتماد" : "Credentials"}
            icon={<KeyRound className="size-4" />}
            action={
              view.canUpdate && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditor("credentials")} disabled={connectionEditBlocked}>
                  <KeyRound className="size-3.5" />
                  {isArabic ? "تدوير" : "Rotate"}
                </Button>
              )
            }
          >
            <div className="flex items-start gap-3 rounded-md border border-brand-200 bg-brand-500/5 p-4 text-brand-900 dark:border-brand-800/60 dark:text-brand-300">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-brand-600 dark:text-brand-400" />
              <div>
                <p className="font-semibold">
                  {server.credentialsConfigured ? (isArabic ? "مشفرة ومهيأة" : "Encrypted and configured") : isArabic ? "غير مهيأة" : "Not configured"}
                </p>
                <p className="mt-1 text-xs leading-5">
                  {isArabic
                    ? "لا يعيد Core المفاتيح الخام إلى المتصفح. التدوير يستبدلها ويجعل حالة الخادم DRAFT حتى إعادة التفعيل."
                    : "Core never returns raw keys to the browser. Rotation replaces them and moves the server to DRAFT until it is activated again."}
                </p>
              </div>
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <FreshnessPanel server={server} isArabic={isArabic} />

          <Panel title={isArabic ? "سياسات التشغيل" : "Operational policies"} icon={<ShieldCheck className="size-4" />}>
            <div className="space-y-3">
              <PolicyRow label={isArabic ? "التوزيع الجديد" : "New placement"} value={server.status === "ACTIVE" && server.connectionEvidenceFresh ? (isArabic ? "مسموح" : "Allowed") : isArabic ? "محجوب" : "Blocked"} good={server.status === "ACTIVE" && server.connectionEvidenceFresh} />
              <PolicyRow label={isArabic ? "التشغيل المعين" : "Assigned runtime"} value={isArabic ? "لا يتغير بفشل الاختبار" : "Unaffected by probe failure"} good />
              <PolicyRow label={isArabic ? "الاختبار المجدول" : "Scheduled check"} value={isArabic ? "Worker كل 12 ساعة" : "Worker every 12 hours"} good />
            </div>
            {view.canUpdate && !server.isPlatformDefault && (
              <Button
                type="button"
                variant="outline"
                className="mt-5 w-full"
                onClick={() => void run(view.makePlatformDefault, isArabic ? "أصبح الخادم الافتراضي للمنصة." : "The server is now the platform default.")}
                disabled={!canMakeDefault || view.isMutating}
                title={!canMakeDefault ? (isArabic ? "يتطلب حالة ACTIVE ودليل اتصال حديث." : "Requires ACTIVE state and fresh connection evidence.") : undefined}
              >
                <ShieldCheck className="size-4" />
                {isArabic ? "تعيين كافتراضي" : "Make platform default"}
              </Button>
            )}
          </Panel>

          {view.canDelete && (
            <Panel title={isArabic ? "منطقة خطرة" : "Danger zone"} icon={<Trash2 className="size-4" />}>
              <p className="text-xs leading-5 text-muted-foreground">
                {isArabic ? "يمكن حذف خادم DRAFT أو OFFLINE غير افتراضي ومن دون مستأجرين فقط." : "Only an unassigned, non-default DRAFT or OFFLINE server can be deleted."}
              </p>
              <Button type="button" variant="destructive" className="mt-4 w-full" onClick={() => setConfirmation("delete")} disabled={deleteBlocked || view.isMutating}>
                <Trash2 className="size-4" />
                {isArabic ? "حذف خادم التخزين" : "Delete storage server"}
              </Button>
            </Panel>
          )}
        </div>
      </div>

      {editor && (
        <StorageServerEditor
          key={`${editor}:${server.configRevision}:${server.updatedAt}`}
          mode={editor}
          server={server}
          isArabic={isArabic}
          connectionEditBlocked={connectionEditBlocked}
          isSubmitting={view.isMutating}
          onClose={() => setEditor(null)}
          onSubmit={async (dto) => {
            await view.update(dto);
            setEditor(null);
            toast.success(isArabic ? "تم الحفظ" : "Saved", isArabic ? "تم تحديث خادم التخزين." : "Storage server was updated.");
          }}
        />
      )}

      <DestructiveActionModal
        isOpen={confirmation === "offline"}
        onClose={() => setConfirmation(null)}
        onConfirm={() =>
          void run(view.offline, isArabic ? "تم إيقاف الخادم؛ لا يغير ذلك بيانات المستأجرين المعينين." : "The server is OFFLINE; assigned tenant data was not changed.").then((succeeded) => {
            if (succeeded) setConfirmation(null);
          })
        }
        title={isArabic ? "إيقاف خادم التخزين" : "Take storage server offline"}
        description={isArabic ? "يمنع ذلك التوزيع الجديد ويسمح بصيانة إعداد الاتصال." : "This blocks new placement and permits connection maintenance."}
        targetName={server.name}
        actionType="offline"
        requireNameTyping={false}
        isSubmitting={view.isMutating}
      />
      <DestructiveActionModal
        isOpen={confirmation === "delete"}
        onClose={() => setConfirmation(null)}
        onConfirm={() =>
          void view
            .remove()
            .then(() => {
              setConfirmation(null);
              router.push("/storage-servers");
            })
            .catch((caught) => toast.error(isArabic ? "فشل الحذف" : "Delete failed", readErrorMessage(caught, isArabic ? "تعذر الحذف." : "Delete request failed.")))
        }
        title={isArabic ? "حذف خادم التخزين" : "Delete storage server"}
        description={isArabic ? "حذف منطقي لسجل غير معين. لا يمكن استخدامه للتوزيع." : "Soft-delete this unassigned record so it can no longer be used for placement."}
        targetName={server.name}
        actionType="delete"
        requireNameTyping
        isSubmitting={view.isMutating}
      />
    </div>
  );
}

function FreshnessPanel({ server, isArabic }: { server: StorageServerView; isArabic: boolean }) {
  const percent = probeFreshnessPercent(server.lastConnectionTestedAt, server.connectionEvidenceExpiresAt);
  const passed = server.lastConnectionTestStatus === "PASSED";
  const fresh = server.connectionEvidenceFresh && passed;
  const barTone = fresh ? "bg-brand-500" : server.lastConnectionTestStatus === "FAILED" ? "bg-danger-500" : "bg-warn-500";
  const badgeTone = fresh ? "bg-brand-500 text-ink-950" : server.lastConnectionTestStatus === "FAILED" ? "bg-danger-500 text-white" : "bg-warn-500 text-ink-950";
  return (
    <Panel title={isArabic ? "حداثة دليل الاتصال" : "Connection evidence freshness"} icon={<Clock3 className="size-4" />}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-foreground">
            {fresh ? (isArabic ? "حديث" : "Fresh") : server.lastConnectionTestStatus === "FAILED" ? (isArabic ? "فشل" : "Failed") : isArabic ? "قديم أو غير مختبر" : "Stale or untested"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{isArabic ? "نافذة الصلاحية 24 ساعة" : "24-hour validity window"}</p>
        </div>
        <span className={`grid size-10 place-items-center rounded-full ${badgeTone}`}>
          {fresh ? <CheckCircle2 className="size-5" /> : <AlertCircle className="size-5" />}
        </span>
      </div>
      <div
        className="mt-5 h-2 overflow-hidden rounded-full bg-ink-200 dark:bg-ink-800"
        aria-label={isArabic ? "نسبة الوقت المتبقي" : "Remaining freshness window"}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
        role="progressbar"
      >
        <div className={`h-full rounded-full ${barTone}`} style={{ width: `${percent}%` }} />
      </div>
      <dl className="mt-4 space-y-3 text-xs">
        <DatumRow label={isArabic ? "آخر اختبار" : "Last tested"} value={formatDate(server.lastConnectionTestedAt, isArabic)} />
        <DatumRow label={isArabic ? "انتهاء الدليل" : "Evidence expires"} value={formatDate(server.connectionEvidenceExpiresAt, isArabic)} />
        <DatumRow label={isArabic ? "موعد الاختبار التلقائي" : "Automatic check due"} value={formatDate(server.nextAutomaticProbeDueAt, isArabic)} />
        {server.lastConnectionTestErrorCode && <DatumRow label={isArabic ? "رمز الفشل الآمن" : "Safe failure code"} value={server.lastConnectionTestErrorCode} mono />}
      </dl>
    </Panel>
  );
}

function StorageServerEditor({
  mode,
  server,
  isArabic,
  connectionEditBlocked,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  mode: "configuration" | "credentials";
  server: StorageServerView;
  isArabic: boolean;
  connectionEditBlocked: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (dto: UpdateStorageServerDto) => Promise<void>;
}) {
  const [name, setName] = useState(server.name);
  const [endpoint, setEndpoint] = useState(server.endpoint);
  const [region, setRegion] = useState(server.region);
  const [bucketName, setBucketName] = useState(server.bucketName);
  const [maxTenants, setMaxTenants] = useState(server.maxTenants?.toString() ?? "");
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secretAccessKey, setSecretAccessKey] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    setError(null);
    try {
      if (mode === "credentials") {
        await onSubmit({ credentials: { accessKeyId: accessKeyId.trim(), secretAccessKey } });
        return;
      }
      if (!connectionEditBlocked && !isSecureStorageEndpoint(endpoint.trim())) {
        throw new Error(isArabic ? "نقطة النهاية يجب أن تكون أصلاً آمناً بصيغة HTTPS فقط." : "Endpoint must be an HTTPS root origin.");
      }
      const dto: UpdateStorageServerDto = {};
      const nextName = name.trim();
      const nextMaximum = maxTenants ? Number(maxTenants) : null;
      if (nextName !== server.name) dto.name = nextName;
      if (nextMaximum !== server.maxTenants) dto.maxTenants = nextMaximum;
      if (!connectionEditBlocked) {
        const nextEndpoint = new URL(endpoint.trim()).origin;
        const nextRegion = region.trim().toLowerCase();
        const nextBucket = bucketName.trim().toLowerCase();
        if (nextEndpoint !== server.endpoint) dto.endpoint = nextEndpoint;
        if (nextRegion !== server.region) dto.region = nextRegion;
        if (nextBucket !== server.bucketName) dto.bucketName = nextBucket;
      }
      if (Object.keys(dto).length === 0) {
        onClose();
        return;
      }
      await onSubmit(dto);
    } catch (caught) {
      setError(readErrorMessage(caught, isArabic ? "تعذر الحفظ." : "Save failed."));
    }
  };

  const title = mode === "credentials" ? (isArabic ? "تدوير بيانات الاعتماد" : "Rotate credentials") : isArabic ? "تعديل خادم التخزين" : "Edit storage server";
  const description =
    mode === "credentials"
      ? isArabic
        ? "لا يمكن استرجاع المفاتيح الحالية. أدخل زوجاً جديداً كاملاً."
        : "Current keys cannot be retrieved. Enter a complete replacement pair."
      : connectionEditBlocked
        ? isArabic
          ? "إعدادات الاتصال مقفلة حتى يصبح الخادم OFFLINE."
          : "Connection settings are locked until the server is OFFLINE."
        : isArabic
          ? "تغيير الاتصال يلغي الدليل الحالي ويعيد الحالة إلى DRAFT."
          : "Changing connectivity invalidates current evidence and returns the server to DRAFT.";

  return (
    <FormDrawer
      isOpen
      onClose={onClose}
      titleEn={title}
      titleAr={title}
      subtitleEn={description}
      subtitleAr={description}
      isSubmitting={isSubmitting}
      footerActions={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            {isArabic ? "إلغاء" : "Cancel"}
          </Button>
          <Button type="submit" form="storage-server-editor-form" variant="primary" loading={isSubmitting}>
            {isArabic ? "حفظ" : "Save"}
          </Button>
        </>
      }
    >
      <form id="storage-server-editor-form" onSubmit={submit} className="space-y-4 py-1">
        {error && (
          <div role="alert" className="rounded-md border border-danger-200 bg-danger-50 p-3 text-sm text-danger-900 dark:border-danger-800/60 dark:bg-danger-950/30 dark:text-danger-200">
            {error}
          </div>
        )}
        {mode === "credentials" ? (
          <>
            <Field label={isArabic ? "معرف مفتاح الوصول" : "Access key ID"}>
              {(fp) => <Input {...fp} required minLength={3} maxLength={128} autoComplete="off" value={accessKeyId} onChange={(e) => setAccessKeyId(e.target.value)} className="font-mono" />}
            </Field>
            <Field label={isArabic ? "مفتاح الوصول السري" : "Secret access key"}>
              {(fp) => <Input {...fp} required type="password" minLength={16} maxLength={256} autoComplete="new-password" value={secretAccessKey} onChange={(e) => setSecretAccessKey(e.target.value)} className="font-mono" />}
            </Field>
          </>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={isArabic ? "الاسم" : "Name"}>
              {(fp) => <Input {...fp} required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />}
            </Field>
            <Field label={isArabic ? "الحد الأقصى للمستأجرين" : "Maximum tenants"}>
              {(fp) => <Input {...fp} type="number" min={Math.max(1, server.assignedTenants)} max={1_000_000} value={maxTenants} onChange={(e) => setMaxTenants(e.target.value)} />}
            </Field>
            <Field label={isArabic ? "نقطة النهاية" : "Endpoint"} className="sm:col-span-2">
              {(fp) => <Input {...fp} required disabled={connectionEditBlocked} type="url" value={endpoint} onChange={(e) => setEndpoint(e.target.value)} className="font-mono" />}
            </Field>
            <Field label={isArabic ? "المنطقة" : "Region"}>
              {(fp) => <Input {...fp} required disabled={connectionEditBlocked} value={region} onChange={(e) => setRegion(e.target.value)} className="font-mono" />}
            </Field>
            <Field label={isArabic ? "الحاوية" : "Bucket"}>
              {(fp) => <Input {...fp} required disabled={connectionEditBlocked} value={bucketName} onChange={(e) => setBucketName(e.target.value)} className="font-mono" />}
            </Field>
          </div>
        )}
      </form>
    </FormDrawer>
  );
}

function ProbeResultBanner({ result, isArabic }: { result: { outcome: string; errorCode: string | null; lifecycleStatus: string }; isArabic: boolean }) {
  const passed = result.outcome === "PASSED";
  return (
    <section
      role="status"
      className={`rounded-lg border p-4 text-sm ${passed ? "border-brand-200 bg-brand-500/5 text-brand-900 dark:border-brand-800/60 dark:text-brand-300" : "border-danger-200 bg-danger-50 text-danger-900 dark:border-danger-800/60 dark:bg-danger-950/30 dark:text-danger-200"}`}
    >
      <p className="font-semibold">{passed ? (isArabic ? "نجح اختبار الاتصال" : "Connection test passed") : isArabic ? "فشل اختبار الاتصال" : "Connection test failed"}</p>
      <p className="mt-1 text-xs">
        {isArabic ? `لم تتغير حالة دورة الحياة: ${result.lifecycleStatus}.` : `Lifecycle state remains ${result.lifecycleStatus}.`}
        {result.errorCode ? ` · ${result.errorCode}` : ""}
      </p>
    </section>
  );
}

function Panel({ title, icon, action, children }: { title: string; icon: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-sm">
          <span className="text-brand-600 dark:text-brand-400">{icon}</span>
          {title}
        </CardTitle>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Datum({ label, value, mono, wide }: { label: string; value: string; mono?: boolean; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className={`mt-2 break-all text-sm font-semibold text-foreground ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}
function DatumRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`text-end font-semibold text-foreground ${mono ? "break-all font-mono" : ""}`}>{value}</dd>
    </div>
  );
}
function PolicyRow({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md bg-ink-100 p-3 text-xs dark:bg-ink-900/40">
      <span className="text-muted-foreground">{label}</span>
      <span className={`text-end font-semibold ${good ? "text-brand-700 dark:text-brand-400" : "text-warn-700 dark:text-warn-400"}`}>{value}</span>
    </div>
  );
}
function AccessDenied({ isArabic }: { isArabic: boolean }) {
  return (
    <div className="mx-auto max-w-xl rounded-lg border border-border bg-card">
      <DsErrorState
        title={isArabic ? "تم رفض الوصول" : "Access denied"}
        error={{ isNormalized: true, httpStatus: 403, errorCode: "ADMIN_PERMISSION_DENIED", errorCategory: "AUTHORIZATION", message: "" }}
      />
    </div>
  );
}
function LoadingState({ isArabic }: { isArabic: boolean }) {
  return (
    <div className="grid min-h-80 place-items-center text-sm font-semibold text-muted-foreground">
      <span className="flex items-center gap-2">
        <Loader2 className="size-5 animate-spin" />
        {isArabic ? "جارٍ تحميل الخادم…" : "Loading storage server…"}
      </span>
    </div>
  );
}
function NotAvailableState({ message, isArabic }: { message: NormalizedApiError | null; isArabic: boolean }) {
  return (
    <div className="mx-auto max-w-xl rounded-lg border border-border bg-card">
      <DsErrorState title={isArabic ? "تعذر تحميل الخادم" : "Storage server unavailable"} error={message} />
      <div className="flex justify-center pb-6">
        <Button variant="outline" size="sm" asChild>
          <Link href="/storage-servers">{isArabic ? "العودة" : "Back"}</Link>
        </Button>
      </div>
    </div>
  );
}
function formatDate(value: string | null, isArabic: boolean) {
  if (!value) return isArabic ? "غير متاح" : "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(isArabic ? "ar-EG-u-nu-latn" : "en-US", { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "UTC", timeZoneName: "short" }).format(date);
}

function readErrorMessage(value: unknown, fallback: string): string {
  if (typeof value !== "object" || value === null) return fallback;
  const candidate = value as { message?: unknown; correlationId?: unknown };
  const message = typeof candidate.message === "string" ? candidate.message : fallback;
  return typeof candidate.correlationId === "string" ? `${message}\nCorrelation ID: ${candidate.correlationId}` : message;
}
