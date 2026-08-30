"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  HardDrive,
  KeyRound,
  Save,
  ShieldCheck,
  Globe,
  Database,
  Users,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Field as DsField,
  Input,
  Button,
  ErrorState,
  CodeRef,
} from "@/design-system";
import { useCreateStorageServerScreen } from "../hooks/useCreateStorageServerScreen";
import { STORAGE_SERVER_DNS_LABEL_PATTERN } from "../lib/storage-server-contract";

export function CreateStorageServerScreen() {
  const {
    dir,
    c,
    isAuthLoading,
    canCreate,
    canActivate,
    canConfigureStorageRuntime,
    storageRuntimeSetupRequired,
    setupPending,
    form,
    setForm,
    maxTenants,
    setMaxTenants,
    isSubmitting,
    formError,
    handleSubmit,
  } = useCreateStorageServerScreen();

  const BackIcon = dir === "rtl" ? ArrowRight : ArrowLeft;
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const parsedTenantLimit = Number(maxTenants);
  const formattedTenantLimit = maxTenants && Number.isFinite(parsedTenantLimit)
    ? storageNumberFormatters[dir === "rtl" ? "ar" : "en"].format(parsedTenantLimit)
    : maxTenants;

  useEffect(() => {
    if (formError) errorSummaryRef.current?.focus();
  }, [formError]);

  if (isAuthLoading) {
    return <div className="grid min-h-80 place-items-center text-sm font-semibold text-muted-foreground">{c.checkingPermissions}</div>;
  }

  if (!canCreate) {
    return (
      <div className="mx-auto max-w-xl rounded-lg border border-border bg-card">
        <ErrorState
          title={c.accessDeniedTitle}
          error={{
            isNormalized: true,
            httpStatus: 403,
            errorCode: "ADMIN_PERMISSION_DENIED",
            errorCategory: "AUTHORIZATION",
            message: c.accessDeniedDesc,
          }}
        />
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <Button variant="link" size="sm" asChild className="w-fit px-0">
        <Link href="/storage-servers" aria-label={c.backToList}>
          <BackIcon className="size-4" aria-hidden="true" />
          {c.backToList}
        </Link>
      </Button>
      <div>
        <h1 className="text-xl font-semibold text-foreground">{c.title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{c.subtitle}</p>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {storageRuntimeSetupRequired && (
            <div role="alert" className="rounded-lg border border-warning/30 bg-warning-subtle p-4 text-warning-subtle-foreground">
              <div className="flex items-start gap-3">
                <KeyRound className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold">{c.runtimeSetup.title}</h2>
                  <p className="mt-1 text-xs leading-relaxed">
                    {storageRuntimeSetupRequired.errorCode === "CORE.STORAGE_RUNTIME.DISABLED"
                      ? c.runtimeSetup.disabledDescription
                      : c.runtimeSetup.keyUnavailableDescription}
                  </p>
                  {storageRuntimeSetupRequired.correlationId && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                      <span>{c.runtimeSetup.correlationId}:</span>
                      <CodeRef value={storageRuntimeSetupRequired.correlationId} />
                    </div>
                  )}
                  {canConfigureStorageRuntime ? (
                    <Button variant="primary" size="sm" className="mt-3" asChild>
                      <Link href="/settings/storage">{c.runtimeSetup.openSettings}</Link>
                    </Button>
                  ) : (
                    <p className="mt-3 text-xs font-semibold">{c.runtimeSetup.askAdministrator}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {formError && (
            <div ref={errorSummaryRef} role="alert" tabIndex={-1} className="whitespace-pre-line rounded-lg border border-destructive/30 bg-destructive-subtle p-4 text-xs font-semibold text-destructive-subtle-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {formError}
            </div>
          )}

          {setupPending && !formError && (
            <div role="status" className="rounded-lg border border-warning/30 bg-warning-subtle p-4 text-xs font-semibold text-warning-subtle-foreground">
              {dir === "rtl"
                ? "تم حفظ الخادم بالفعل. أعد محاولة التفعيل فقط؛ لن تُرسل بيانات الاعتماد ولن يُنشأ خادم آخر."
                : "The server is already saved. Retry activation only; credentials are not resent and no second server is created."}
            </div>
          )}

          <fieldset disabled={setupPending || isSubmitting} className="contents">
            <Card>
              <SectionHeader icon={<HardDrive className="size-4" aria-hidden="true" />} title={c.sections.identity} description={c.sections.identityDesc} />
              <CardContent className="grid gap-4 md:grid-cols-2">
                <DsField label={c.fields.name}>
                  {(fp) => (
                    <Input {...fp} required minLength={1} maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Garage Primary S3 Cluster" />
                  )}
                </DsField>
                <DsField label={c.fields.code} hint={c.fields.codeHint}>
                  {(fp) => (
                    <Input {...fp} dir="ltr" required pattern={STORAGE_SERVER_DNS_LABEL_PATTERN} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toLowerCase() })} className="font-mono" placeholder="garage-primary" />
                  )}
                </DsField>
                <DsField label={c.fields.endpoint} hint={c.fields.endpointHint} className="md:col-span-2">
                  {(fp) => (
                    <Input {...fp} dir="ltr" required type="url" value={form.endpoint} onChange={(e) => setForm({ ...form, endpoint: e.target.value })} className="font-mono" placeholder="https://garage.example.com" />
                  )}
                </DsField>
                <DsField label={c.fields.region}>
                  {(fp) => (
                    <Input {...fp} dir="ltr" required pattern={STORAGE_SERVER_DNS_LABEL_PATTERN} value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value.toLowerCase() })} className="font-mono" placeholder="garage" />
                  )}
                </DsField>
                <DsField label={c.fields.bucketName}>
                  {(fp) => (
                    <Input {...fp} dir="ltr" required minLength={3} maxLength={63} value={form.bucketName} onChange={(e) => setForm({ ...form, bucketName: e.target.value.toLowerCase() })} className="font-mono" placeholder="mutakamel-files" />
                  )}
                </DsField>
                <DsField label={c.fields.maxTenants} hint={c.fields.maxTenantsHint}>
                  {(fp) => (
                    <Input {...fp} dir="ltr" type="number" min={1} max={1_000_000} value={maxTenants} onChange={(e) => setMaxTenants(e.target.value)} placeholder="100" />
                  )}
                </DsField>
              </CardContent>
            </Card>

            <Card>
              <SectionHeader icon={<KeyRound className="size-4" aria-hidden="true" />} title={c.sections.credentials} description={c.sections.credentialsDesc} />
              <CardContent className="grid gap-4 md:grid-cols-2">
                <DsField label={c.fields.accessKeyId} className="md:col-span-2">
                  {(fp) => (
                    <Input {...fp} dir="ltr" required minLength={3} maxLength={128} autoComplete="off" value={form.credentials.accessKeyId} onChange={(e) => setForm({ ...form, credentials: { ...form.credentials, accessKeyId: e.target.value } })} className="font-mono" placeholder="GK1234567890EXAMPLE" />
                  )}
                </DsField>
                <DsField label={c.fields.secretAccessKey} className="md:col-span-2">
                  {(fp) => (
                    <Input {...fp} dir="ltr" required type="password" minLength={16} maxLength={256} autoComplete="new-password" value={form.credentials.secretAccessKey} onChange={(e) => setForm({ ...form, credentials: { ...form.credentials, secretAccessKey: e.target.value } })} className="font-mono" placeholder="••••••••••••••••••••••••••••••••" />
                  )}
                </DsField>
              </CardContent>
            </Card>
          </fieldset>

          <p className="text-xs leading-relaxed text-muted-foreground sm:text-end">
            {canActivate
              ? dir === "rtl"
                ? "سيحفظ النظام الخادم ثم يفحص الاتصال ويُفعّله تلقائياً؛ لا تحتاج إلى Probe مسبق."
                : "One setup action saves the server, performs the authoritative connection check, and activates it; no pre-probe is required."
              : dir === "rtl"
                ? "سيتم حفظ الخادم كمسودة لأن حسابك لا يملك صلاحية التفعيل."
                : "The server will be saved as a DRAFT because this account cannot activate it."}
          </p>
          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <Button variant="outline" asChild>
              <Link href="/storage-servers">{c.actions.cancel}</Link>
            </Button>
            <Button type="submit" variant="primary" formNoValidate={setupPending} disabled={isSubmitting} loading={isSubmitting}>
              <Save className="size-4" aria-hidden="true" />
              {isSubmitting
                ? c.actions.submitting
                : setupPending
                  ? dir === "rtl" ? "إعادة محاولة التفعيل" : "Retry activation"
                  : canActivate
                    ? dir === "rtl" ? "حفظ وإعداد الخادم" : "Save and set up server"
                    : c.actions.submit}
            </Button>
          </div>
        </div>

        <div className="lg:col-span-1">
          <Card className="lg:sticky lg:top-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xs uppercase tracking-wider rtl:normal-case rtl:tracking-normal">
                <Globe className="size-4 text-info" aria-hidden="true" />
                {c.sections.preview}
              </CardTitle>
              <CardDescription>{c.sections.previewDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3.5 text-xs">
              <div className="space-y-1 rounded-md border border-border bg-muted p-3.5">
                <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground rtl:normal-case rtl:tracking-normal">{c.previewCard.targetEndpoint}</span>
                <span dir="ltr" className="block break-all font-mono text-xs font-semibold text-info-subtle-foreground">{form.endpoint.trim() || "https://..."}</span>
              </div>
              <div className="space-y-1 rounded-md border border-border bg-muted p-3.5">
                <span className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground rtl:normal-case rtl:tracking-normal">
                  <Database className="size-3" aria-hidden="true" />
                  {c.previewCard.bucketTarget}
                </span>
                <span dir="ltr" className="block font-mono text-xs font-semibold text-foreground">
                  {form.bucketName.trim() || "bucket-name"} @ {form.region.trim() || "region"}
                </span>
              </div>
              <div className="space-y-1 rounded-md border border-border bg-muted p-3.5">
                <span className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground rtl:normal-case rtl:tracking-normal">
                  <Users className="size-3" aria-hidden="true" />
                  {c.previewCard.tenantCap}
                </span>
                <span className="block text-xs font-semibold text-foreground">
                  {maxTenants ? <><bdi className="tabular-nums">{formattedTenantLimit}</bdi> {dir === "rtl" ? "مستأجر" : "tenants"}</> : c.previewCard.unlimited}
                </span>
              </div>
              <div className="flex items-start gap-2.5 rounded-md border border-info/30 bg-info-subtle p-3.5 text-info-subtle-foreground">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-info" aria-hidden="true" />
                <div className="text-xs leading-relaxed">
                  <span className="block font-semibold">{c.previewCard.securityMode}</span>
                  {c.previewCard.encryptedNotice}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}

function SectionHeader({ icon, title, description }: { icon: ReactNode; title: string; description?: string }) {
  return (
    <CardHeader className="flex-row items-start gap-3 space-y-0">
      <span className="grid size-9 shrink-0 place-items-center rounded-md bg-info-subtle text-info-subtle-foreground">{icon}</span>
      <div>
        <CardTitle className="text-sm uppercase tracking-wider rtl:normal-case rtl:tracking-normal">{title}</CardTitle>
        {description && <CardDescription className="mt-1">{description}</CardDescription>}
      </div>
    </CardHeader>
  );
}

const storageNumberFormatters = {
  en: new Intl.NumberFormat("en-US"),
  ar: new Intl.NumberFormat("ar-EG"),
} as const;
