"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  HardDrive,
  KeyRound,
  Save,
  ShieldAlert,
  ShieldCheck,
  Globe,
  Database,
  Users,
} from "lucide-react";
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

  if (isAuthLoading) {
    return (
      <div className="grid min-h-80 place-items-center text-sm font-semibold text-slate-500 dark:text-slate-400">
        {c.checkingPermissions}
      </div>
    );
  }

  if (!canCreate) {
    return (
      <section className="mx-auto max-w-xl rounded-xl border border-rose-200 bg-rose-50 p-8 text-center text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100 shadow-md">
        <ShieldAlert className="mx-auto size-10 text-rose-600 dark:text-rose-400" aria-hidden="true" />
        <h1 className="mt-3 text-lg font-semibold">{c.accessDeniedTitle}</h1>
        <p className="mt-2 text-sm">{c.accessDeniedDesc}</p>
      </section>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* Glassmorphism Compact Header */}
      <header className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-4 py-3 sm:px-5 sm:py-3.5 rounded-xl border border-indigo-500/20 shadow-md">
        <div className="absolute top-0 end-0 -mt-10 -me-10 w-72 h-72 bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-pink-500/0 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/storage-servers"
              aria-label={c.backToList}
              className="p-2 bg-white/10 hover:bg-white/20 border border-white/15 text-white rounded-xl transition-all shrink-0 shadow-xs backdrop-blur-md"
            >
              <BackIcon className="w-4 h-4" />
            </Link>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-semibold text-white tracking-tight">
                  {c.title}
                </h1>
                <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 text-2xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md">
                  {c.tag}
                </span>
              </div>
              <p className="text-xs text-indigo-200/80 mt-0.5 max-w-2xl leading-tight">
                {c.subtitle}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Grid: Left = Form Fields, Right = Live Preview Card */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {storageRuntimeSetupRequired && (
            <div
              role="alert"
              className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 shadow-sm dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
            >
              <div className="flex items-start gap-3">
                <KeyRound className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold">
                    {c.runtimeSetup.title}
                  </h2>
                  <p className="mt-1 text-xs leading-relaxed">
                    {storageRuntimeSetupRequired.errorCode ===
                    "CORE.STORAGE_RUNTIME.DISABLED"
                      ? c.runtimeSetup.disabledDescription
                      : c.runtimeSetup.keyUnavailableDescription}
                  </p>
                  {storageRuntimeSetupRequired.correlationId ? (
                    <p className="mt-2 break-all font-mono text-xs opacity-80">
                      {c.runtimeSetup.correlationId}: {storageRuntimeSetupRequired.correlationId}
                    </p>
                  ) : null}
                  {canConfigureStorageRuntime ? (
                    <Link
                      href="/settings/storage"
                      className="mt-3 inline-flex min-h-10 items-center justify-center rounded-xl bg-amber-900 px-4 text-xs font-semibold text-white transition hover:bg-amber-800 dark:bg-amber-200 dark:text-amber-950 dark:hover:bg-amber-100"
                    >
                      {c.runtimeSetup.openSettings}
                    </Link>
                  ) : (
                    <p className="mt-3 text-xs font-semibold">
                      {c.runtimeSetup.askAdministrator}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {formError && (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100 shadow-sm whitespace-pre-line"
            >
              {formError}
            </div>
          )}

          {setupPending && !formError && (
            <div
              role="status"
              className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs font-semibold text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100 shadow-sm"
            >
              {dir === "rtl"
                ? "تم حفظ الخادم بالفعل. أعد محاولة التفعيل فقط؛ لن تُرسل بيانات الاعتماد ولن يُنشأ خادم آخر."
                : "The server is already saved. Retry activation only; credentials are not resent and no second server is created."}
            </div>
          )}

          <fieldset disabled={setupPending || isSubmitting} className="contents">
            {/* Section 1: Host Identity & Location */}
            <FormSection
              icon={<HardDrive className="size-4 text-indigo-600 dark:text-indigo-400" />}
              title={c.sections.identity}
              description={c.sections.identityDesc}
            >
            <Field label={c.fields.name}>
              <input
                required
                minLength={1}
                maxLength={120}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={inputClass}
                placeholder="Garage Primary S3 Cluster"
              />
            </Field>

            <Field label={c.fields.code} hint={c.fields.codeHint}>
              <input
                required
                pattern={STORAGE_SERVER_DNS_LABEL_PATTERN}
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toLowerCase() })}
                className={`${inputClass} font-mono`}
                placeholder="garage-primary"
              />
            </Field>

            <Field wide label={c.fields.endpoint} hint={c.fields.endpointHint}>
              <input
                required
                type="url"
                value={form.endpoint}
                onChange={(e) => setForm({ ...form, endpoint: e.target.value })}
                className={`${inputClass} font-mono`}
                placeholder="https://garage.example.com"
              />
            </Field>

            <Field label={c.fields.region}>
              <input
                required
                pattern={STORAGE_SERVER_DNS_LABEL_PATTERN}
                value={form.region}
                onChange={(e) => setForm({ ...form, region: e.target.value.toLowerCase() })}
                className={`${inputClass} font-mono`}
                placeholder="garage"
              />
            </Field>

            <Field label={c.fields.bucketName}>
              <input
                required
                minLength={3}
                maxLength={63}
                value={form.bucketName}
                onChange={(e) => setForm({ ...form, bucketName: e.target.value.toLowerCase() })}
                className={`${inputClass} font-mono`}
                placeholder="mutakamel-files"
              />
            </Field>

            <Field label={c.fields.maxTenants} hint={c.fields.maxTenantsHint}>
              <input
                type="number"
                min={1}
                max={1_000_000}
                value={maxTenants}
                onChange={(e) => setMaxTenants(e.target.value)}
                className={inputClass}
                placeholder="100"
              />
            </Field>
            </FormSection>

            {/* Section 2: Garage / S3 Access Credentials */}
            <FormSection
              icon={<KeyRound className="size-4 text-purple-600 dark:text-purple-400" />}
              title={c.sections.credentials}
              description={c.sections.credentialsDesc}
            >
            <Field wide label={c.fields.accessKeyId}>
              <input
                required
                minLength={3}
                maxLength={128}
                autoComplete="off"
                value={form.credentials.accessKeyId}
                onChange={(e) =>
                  setForm({
                    ...form,
                    credentials: { ...form.credentials, accessKeyId: e.target.value },
                  })
                }
                className={`${inputClass} font-mono`}
                placeholder="GK1234567890EXAMPLE"
              />
            </Field>

            <Field wide label={c.fields.secretAccessKey}>
              <input
                required
                type="password"
                minLength={16}
                maxLength={256}
                autoComplete="new-password"
                value={form.credentials.secretAccessKey}
                onChange={(e) =>
                  setForm({
                    ...form,
                    credentials: { ...form.credentials, secretAccessKey: e.target.value },
                  })
                }
                className={`${inputClass} font-mono`}
                placeholder="••••••••••••••••••••••••••••••••"
              />
            </Field>
            </FormSection>
          </fieldset>

          {/* Form Action Buttons */}
          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400 sm:text-end">
            {canActivate
              ? dir === "rtl"
                ? "سيحفظ النظام الخادم ثم يفحص الاتصال ويُفعّله تلقائياً؛ لا تحتاج إلى Probe مسبق."
                : "One setup action saves the server, performs the authoritative connection check, and activates it; no pre-probe is required."
              : dir === "rtl"
                ? "سيتم حفظ الخادم كمسودة لأن حسابك لا يملك صلاحية التفعيل."
                : "The server will be saved as a DRAFT because this account cannot activate it."}
          </p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end pt-2">
            <Link
              href="/storage-servers"
              className="inline-flex min-h-11 items-center justify-center rounded-xl px-5 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800 transition"
            >
              {c.actions.cancel}
            </Link>

            <button
              type="submit"
              formNoValidate={setupPending}
              disabled={isSubmitting}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 px-6 text-xs font-semibold text-white shadow-lg shadow-indigo-500/25 transition disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            >
              <Save className="size-4" aria-hidden="true" />
              {isSubmitting
                ? c.actions.submitting
                : setupPending
                  ? dir === "rtl"
                    ? "إعادة محاولة التفعيل"
                    : "Retry activation"
                  : canActivate
                    ? dir === "rtl"
                      ? "حفظ وإعداد الخادم"
                      : "Save and set up server"
                    : c.actions.submit}
            </button>
          </div>
        </div>

        {/* Right Column: Live Configuration Preview Card */}
        <div className="lg:col-span-1">
          <div className="sticky top-6 bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-md space-y-5">
            <div>
              <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <Globe className="w-4 h-4 text-indigo-500" />
                {c.sections.preview}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                {c.sections.previewDesc}
              </p>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-1">
                <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                  {c.previewCard.targetEndpoint}
                </span>
                <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400 text-xs break-all block">
                  {form.endpoint.trim() || "https://..."}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-1">
                <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Database className="w-3 h-3 text-purple-500" />
                  {c.previewCard.bucketTarget}
                </span>
                <span className="font-mono font-semibold text-slate-900 dark:text-slate-100 text-xs block">
                  {form.bucketName.trim() || "bucket-name"} @ {form.region.trim() || "region"}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-1">
                <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Users className="w-3 h-3 text-cyan-500" />
                  {c.previewCard.tenantCap}
                </span>
                <span className="font-mono font-semibold text-cyan-600 dark:text-cyan-400 text-xs block">
                  {maxTenants ? `${maxTenants} tenants` : c.previewCard.unlimited}
                </span>
              </div>

              {/* Security Boundary Highlight */}
              <div className="p-3.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/60 flex items-start gap-2.5 text-emerald-900 dark:text-emerald-300">
                <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-500 mt-0.5" />
                <div className="text-xs leading-relaxed">
                  <span className="font-semibold block">{c.previewCard.securityMode}</span>
                  {c.previewCard.encryptedNotice}
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

function FormSection({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:p-6 shadow-md">
      <div className="mb-5 flex items-start gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
        <span className="grid size-9 place-items-center rounded-xl bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 shrink-0">
          {icon}
        </span>
        <div>
          <h2 className="font-semibold text-sm uppercase tracking-wider text-slate-900 dark:text-slate-100">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      <div className="grid gap-5 md:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  wide,
  children,
}: {
  label: string;
  hint?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <label className={`block ${wide ? "md:col-span-2" : ""}`}>
      <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200">
        {label}
      </span>
      {children}
      {hint ? (
        <span className="mt-1.5 block text-xs text-slate-500 dark:text-slate-400">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

const inputClass =
  "min-h-11 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 px-3.5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none transition focus:border-indigo-600 dark:focus:border-indigo-400 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500/20";
