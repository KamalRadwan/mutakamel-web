"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, HardDrive, KeyRound, Save, ShieldAlert } from "lucide-react";
import { useToast } from "@/components/ui/ToastContext";
import { useI18n } from "@/i18n/I18nContext";
import { useStorageServers } from "../hooks/useStorageServers";
import { isSecureStorageEndpoint } from "../lib/storage-server-contract";
import type { CreateStorageServerDto } from "../types";

const initialForm: CreateStorageServerDto = {
  code: "",
  name: "",
  endpoint: "",
  region: "",
  bucketName: "",
  maxTenants: null,
  credentials: { accessKeyId: "", secretAccessKey: "" },
};

export function CreateStorageServerScreen() {
  const { lang } = useI18n();
  const isArabic = lang === "ar";
  const router = useRouter();
  const toast = useToast();
  const view = useStorageServers();
  const [form, setForm] = useState<CreateStorageServerDto>(initialForm);
  const [maxTenants, setMaxTenants] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (view.isAuthLoading) {
    return <div className="grid min-h-80 place-items-center text-sm font-semibold text-slate-500">{isArabic ? "جارٍ التحقق من الصلاحيات…" : "Checking permissions…"}</div>;
  }

  if (!view.canCreate) {
    return (
      <section className="mx-auto max-w-xl rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">
        <ShieldAlert className="mx-auto size-10" aria-hidden="true" />
        <h1 className="mt-3 text-lg font-black">{isArabic ? "تم رفض الوصول" : "Access denied"}</h1>
        <p className="mt-2 text-sm">{isArabic ? "يتطلب التسجيل صلاحيات الإنشاء والإجراء الحرج." : "Registration requires both create and critical permissions."}</p>
      </section>
    );
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const endpoint = form.endpoint.trim();
    if (!isSecureStorageEndpoint(endpoint)) {
      setFormError(isArabic ? "أدخل أصلاً آمناً بصيغة HTTPS فقط، من دون مسار أو بيانات اعتماد أو query string." : "Enter an HTTPS root origin only, without a path, credentials, query string, or fragment.");
      return;
    }

    const dto: CreateStorageServerDto = {
      ...form,
      code: form.code.trim().toLowerCase(),
      name: form.name.trim(),
      endpoint: new URL(endpoint).origin,
      region: form.region.trim().toLowerCase(),
      bucketName: form.bucketName.trim().toLowerCase(),
      maxTenants: maxTenants ? Number(maxTenants) : null,
      credentials: {
        accessKeyId: form.credentials.accessKeyId.trim(),
        secretAccessKey: form.credentials.secretAccessKey,
      },
    };

    setIsSubmitting(true);
    try {
      const created = await view.createServer(dto);
      toast.success(isArabic ? "تم تسجيل الخادم" : "Storage server registered", isArabic ? "تم حفظ بيانات الاعتماد بشكل مشفر. اختبر الاتصال قبل التفعيل." : "Credentials were stored encrypted. Run a connection test before activation.");
      router.push(`/storage-servers/${created.id}`);
    } catch (caught) {
      const message = readErrorMessage(caught, isArabic ? "فشل تسجيل الخادم." : "Storage server registration failed.");
      setFormError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex items-start gap-3">
        <Link href="/storage-servers" aria-label={isArabic ? "العودة إلى خوادم التخزين" : "Back to storage servers"} className="grid size-11 shrink-0 place-items-center rounded-xl border border-slate-300 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:hover:bg-slate-900">
          <ArrowLeft className={`size-4 ${isArabic ? "rotate-180" : ""}`} aria-hidden="true" />
        </Link>
        <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-400">{isArabic ? "تسجيل آمن" : "Secure registration"}</p><h1 className="mt-1 text-2xl font-black">{isArabic ? "خادم تخزين جديد" : "New storage server"}</h1><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{isArabic ? "يسجل Core الخادم كمسودة. لا تعني عملية الحفظ أن الاتصال نجح." : "Core registers the server as DRAFT. Saving does not claim that connectivity passed."}</p></div>
      </header>

      <form onSubmit={submit} className="space-y-5">
        {formError ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">{formError}</div> : null}

        <FormSection icon={<HardDrive className="size-4" />} title={isArabic ? "هوية الخادم وموقعه" : "Server identity and location"}>
          <Field label={isArabic ? "الاسم" : "Name"}><input required minLength={1} maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className={inputClass} /></Field>
          <Field label={isArabic ? "الرمز الثابت" : "Immutable code"} hint={isArabic ? "أحرف إنجليزية صغيرة وأرقام وشرطة فقط." : "Lowercase letters, numbers, and hyphens only."}><input required pattern="[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toLowerCase() })} className={`${inputClass} font-mono`} placeholder="garage-primary" /></Field>
          <Field wide label={isArabic ? "نقطة النهاية HTTPS" : "HTTPS endpoint"} hint={isArabic ? "مثال: https://garage.example.com من دون مسار." : "Example: https://garage.example.com with no path."}><input required type="url" value={form.endpoint} onChange={(event) => setForm({ ...form, endpoint: event.target.value })} className={`${inputClass} font-mono`} placeholder="https://garage.example.com" /></Field>
          <Field label={isArabic ? "المنطقة" : "Region"}><input required pattern="[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?" value={form.region} onChange={(event) => setForm({ ...form, region: event.target.value.toLowerCase() })} className={`${inputClass} font-mono`} placeholder="garage" /></Field>
          <Field label={isArabic ? "اسم الحاوية" : "Bucket name"}><input required minLength={3} maxLength={63} value={form.bucketName} onChange={(event) => setForm({ ...form, bucketName: event.target.value.toLowerCase() })} className={`${inputClass} font-mono`} placeholder="mutakamel-files" /></Field>
          <Field label={isArabic ? "الحد الأقصى للمستأجرين" : "Maximum tenants"} hint={isArabic ? "اتركه فارغاً لعدم وضع حد عددي." : "Leave empty for no numeric cap."}><input type="number" min={1} max={1_000_000} value={maxTenants} onChange={(event) => setMaxTenants(event.target.value)} className={inputClass} /></Field>
        </FormSection>

        <FormSection icon={<KeyRound className="size-4" />} title={isArabic ? "بيانات اعتماد Garage / S3" : "Garage / S3 credentials"} description={isArabic ? "ترسل مرة عبر HTTPS إلى Core ولا يعيدها أي API إلى المتصفح." : "Sent once over HTTPS to Core and never returned by an API to the browser."}>
          <Field wide label={isArabic ? "معرف مفتاح الوصول" : "Access key ID"}><input required minLength={3} maxLength={128} autoComplete="off" value={form.credentials.accessKeyId} onChange={(event) => setForm({ ...form, credentials: { ...form.credentials, accessKeyId: event.target.value } })} className={`${inputClass} font-mono`} /></Field>
          <Field wide label={isArabic ? "مفتاح الوصول السري" : "Secret access key"}><input required type="password" minLength={16} maxLength={256} autoComplete="new-password" value={form.credentials.secretAccessKey} onChange={(event) => setForm({ ...form, credentials: { ...form.credentials, secretAccessKey: event.target.value } })} className={`${inputClass} font-mono`} /></Field>
        </FormSection>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link href="/storage-servers" className="inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900">{isArabic ? "إلغاء" : "Cancel"}</Link>
          <button type="submit" disabled={isSubmitting} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"><Save className="size-4" aria-hidden="true" />{isSubmitting ? isArabic ? "جارٍ الحفظ…" : "Saving…" : isArabic ? "تسجيل المسودة" : "Register draft"}</button>
        </div>
      </form>
    </div>
  );
}

function FormSection({ icon, title, description, children }: { icon: ReactNode; title: string; description?: string; children: ReactNode }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950 sm:p-6"><div className="mb-5 flex items-start gap-3 border-b border-slate-200 pb-4 dark:border-slate-800"><span className="grid size-9 place-items-center rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">{icon}</span><div><h2 className="font-black">{title}</h2>{description ? <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p> : null}</div></div><div className="grid gap-5 md:grid-cols-2">{children}</div></section>;
}

function Field({ label, hint, wide, children }: { label: string; hint?: string; wide?: boolean; children: ReactNode }) {
  return <label className={`block ${wide ? "md:col-span-2" : ""}`}><span className="mb-2 block text-sm font-bold">{label}</span>{children}{hint ? <span className="mt-2 block text-xs text-slate-500">{hint}</span> : null}</label>;
}

const inputClass = "min-h-11 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-indigo-600 focus:bg-white focus:ring-2 focus:ring-indigo-600/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white";

function readErrorMessage(value: unknown, fallback: string): string {
  if (typeof value !== "object" || value === null) return fallback;
  const candidate = value as { message?: unknown; correlationId?: unknown };
  const message = typeof candidate.message === "string" ? candidate.message : fallback;
  return typeof candidate.correlationId === "string"
    ? `${message}\nCorrelation ID: ${candidate.correlationId}`
    : message;
}
