"use client";

import { useEffect, useRef, useState } from "react";
import { FileKey2, LockKeyhole, ShieldCheck, Trash2 } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import type {
  DatabaseServerSslConfigDto,
  DatabaseServerSslMode,
} from "../types";
import { readDatabaseSslMaterialFile } from "../lib/database-ssl-config";

interface DatabaseSslConfigurationFieldsProps {
  idPrefix: string;
  mode: DatabaseServerSslMode;
  rejectUnauthorized: boolean;
  config: DatabaseServerSslConfigDto;
  onModeChange: (mode: DatabaseServerSslMode) => void;
  onRejectUnauthorizedChange: (value: boolean) => void;
  onConfigChange: (config: DatabaseServerSslConfigDto) => void;
  hasStoredConfig?: boolean;
  removeStoredConfig?: boolean;
  onRemoveStoredConfigChange?: (value: boolean) => void;
  disabled?: boolean;
}

type CertificateField = "ca" | "cert" | "key";

export function DatabaseSslConfigurationFields({
  idPrefix,
  mode,
  rejectUnauthorized,
  config,
  onModeChange,
  onRejectUnauthorizedChange,
  onConfigChange,
  hasStoredConfig = false,
  removeStoredConfig = false,
  onRemoveStoredConfigChange,
  disabled = false,
}: DatabaseSslConfigurationFieldsProps) {
  const { lang, dir } = useI18n();
  const copy = DATABASE_SSL_COPY[lang];
  const [fileError, setFileError] = useState("");
  const configRef = useRef(config);
  const caInputRef = useRef<HTMLInputElement>(null);
  const certInputRef = useRef<HTMLInputElement>(null);
  const keyInputRef = useRef<HTMLInputElement>(null);

  const inputRefs: Record<CertificateField, React.RefObject<HTMLInputElement | null>> = {
    ca: caInputRef,
    cert: certInputRef,
    key: keyInputRef,
  };

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  const clearNativeInputs = () => {
    for (const ref of Object.values(inputRefs)) {
      if (ref.current) ref.current.value = "";
    }
  };

  const handleModeChange = (nextMode: DatabaseServerSslMode) => {
    setFileError("");
    if (nextMode === "disable") {
      clearNativeInputs();
      onConfigChange({});
    }
    onModeChange(nextMode);
  };

  const handleFileChange = async (
    field: CertificateField,
    label: string,
    file: File | undefined,
  ) => {
    if (!file) return;
    setFileError("");
    try {
      const value = await readDatabaseSslMaterialFile(file, label);
      onRemoveStoredConfigChange?.(false);
      const nextConfig = { ...configRef.current, [field]: value };
      configRef.current = nextConfig;
      onConfigChange(nextConfig);
    } catch (error) {
      const ref = inputRefs[field];
      if (ref.current) ref.current.value = "";
      setFileError(
        error instanceof Error && error.message.endsWith(" file is empty.")
          ? copy.fileEmpty(label)
          : error instanceof Error && error.message.includes("20,000 character API limit")
            ? copy.fileTooLarge(label)
            : copy.unableToRead(label),
      );
    }
  };

  const clearField = (field: CertificateField) => {
    const next = { ...configRef.current };
    delete next[field];
    if (field === "key") delete next.passphrase;
    if (inputRefs[field].current) inputRefs[field].current.value = "";
    configRef.current = next;
    onConfigChange(next);
  };

  const handleRemoveStoredConfig = (remove: boolean) => {
    setFileError("");
    if (remove) {
      clearNativeInputs();
      onConfigChange({});
    }
    onRemoveStoredConfigChange?.(remove);
  };

  const fileField = (
    field: CertificateField,
    label: string,
    description: string,
    accept: string,
    required = false,
  ) => (
    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/70">
      <div className="flex items-start justify-between gap-3">
        <div>
          <label
            htmlFor={`${idPrefix}-${field}`}
            className="block text-xs font-bold text-slate-800 dark:text-slate-200"
          >
            {label}{required ? " *" : ""}
          </label>
          <p className="mt-1 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
            {description}
          </p>
        </div>
        {config[field] && (
          <button
            type="button"
            onClick={() => clearField(field)}
            disabled={disabled}
            className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 dark:hover:bg-rose-950/40"
            aria-label={copy.clearSelected(label)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <input
        ref={inputRefs[field]}
        id={`${idPrefix}-${field}`}
        type="file"
        accept={accept}
        required={required && !hasStoredConfig}
        disabled={disabled || removeStoredConfig}
        onChange={(event) =>
          void handleFileChange(field, label, event.target.files?.[0])
        }
        className="mt-3 block w-full cursor-pointer text-[11px] text-slate-500 file:me-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-xs file:font-bold file:text-blue-700 hover:file:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-400 dark:file:bg-blue-950/50 dark:file:text-blue-300"
      />
      {config[field] && (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
          <ShieldCheck className="h-3.5 w-3.5" /> {copy.readyToSend}
        </p>
      )}
    </div>
  );

  return (
    <section dir={dir} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/70 dark:border-slate-700 dark:bg-slate-800/40">
      <div className="flex items-start gap-3 border-b border-slate-200 p-4 dark:border-slate-700">
        <div className="rounded-xl bg-blue-100 p-2 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
          <LockKeyhole className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            {copy.title}
          </h3>
          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
            {copy.description}
          </p>
        </div>
      </div>

      <div className="space-y-4 p-4">
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
          {copy.sslMode}
          <select
            value={mode}
            disabled={disabled}
            onChange={(event) =>
              handleModeChange(event.target.value as DatabaseServerSslMode)
            }
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm font-semibold text-slate-900 outline-none transition-colors focus:border-blue-600 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="disable">{copy.disable}</option>
            <option value="require">{copy.require}</option>
            <option value="verify-ca">{copy.verifyCa}</option>
            <option value="verify-full">{copy.verifyFull}</option>
          </select>
        </label>

        <p className="rounded-xl bg-slate-100 px-3 py-2 text-[11px] leading-5 text-slate-600 dark:bg-slate-900/60 dark:text-slate-300">
          {copy.modeHelp[mode]}
        </p>

        {mode !== "disable" && (
          <>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/70">
              <input
                type="checkbox"
                checked={rejectUnauthorized}
                disabled={disabled}
                onChange={(event) => onRejectUnauthorizedChange(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>
                <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  {copy.rejectUnauthorized}
                </span>
                <span className="mt-1 block text-[11px] leading-4 text-slate-500 dark:text-slate-400">
                  {copy.rejectUnauthorizedHelp}
                </span>
              </span>
            </label>

            {hasStoredConfig && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
                <div className="flex items-start gap-2">
                  <FileKey2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-emerald-800 dark:text-emerald-200">
                      {copy.storedBundle}
                    </p>
                    <p className="mt-1 text-[11px] leading-4 text-emerald-700 dark:text-emerald-300">
                      {copy.storedBundleHelp}
                    </p>
                    {onRemoveStoredConfigChange && (
                      <label className="mt-3 flex cursor-pointer items-center gap-2 text-[11px] font-bold text-rose-700 dark:text-rose-300">
                        <input
                          type="checkbox"
                          checked={removeStoredConfig}
                          disabled={disabled}
                          onChange={(event) => handleRemoveStoredConfig(event.target.checked)}
                          className="h-4 w-4 rounded border-rose-300 text-rose-600 focus:ring-rose-500"
                        />
                        {copy.removeStoredBundle}
                      </label>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              {fileField(
                "ca",
                copy.caCertificate,
                copy.caCertificateHelp,
                ".pem,.crt,.cer,application/x-pem-file,application/pkix-cert,text/plain",
                mode === "verify-ca" || mode === "verify-full",
              )}
              {fileField(
                "cert",
                copy.clientCertificate,
                copy.clientCertificateHelp,
                ".pem,.crt,.cer,application/x-pem-file,application/pkix-cert,text/plain",
              )}
              {fileField(
                "key",
                copy.clientPrivateKey,
                copy.clientPrivateKeyHelp,
                ".pem,.key,application/x-pem-file,text/plain",
              )}
              <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/70">
                <label
                  htmlFor={`${idPrefix}-passphrase`}
                  className="block text-xs font-bold text-slate-800 dark:text-slate-200"
                >
                  {copy.privateKeyPassphrase}
                </label>
                <p className="mt-1 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
                  {copy.privateKeyPassphraseHelp}
                </p>
                <input
                  id={`${idPrefix}-passphrase`}
                  type="password"
                  autoComplete="new-password"
                  maxLength={1024}
                  value={config.passphrase ?? ""}
                  disabled={disabled || removeStoredConfig}
                  onChange={(event) => {
                    onRemoveStoredConfigChange?.(false);
                    const nextConfig = {
                      ...configRef.current,
                      passphrase: event.target.value,
                    };
                    configRef.current = nextConfig;
                    onConfigChange(nextConfig);
                  }}
                  className="mt-3 w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs outline-none focus:border-blue-600 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            </div>

            {fileError && (
              <p role="alert" className="text-xs font-semibold text-rose-700 dark:text-rose-300">
                {fileError}
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}

const DATABASE_SSL_COPY = {
  ar: {
    title: "أمان نقل البيانات",
    description:
      "تبقى محتويات الشهادات داخل هذا النموذج النشط فقط، وتُرسل إلى Core كحقول كتابة فقط.",
    sslMode: "وضع SSL",
    disable: "تعطيل SSL",
    require: "اشتراط التشفير",
    verifyCa: "التحقق من جهة إصدار الشهادة",
    verifyFull: "التحقق من الجهة واسم المضيف",
    modeHelp: {
      disable:
        "اتصال PostgreSQL بلا تشفير. استخدمه فقط داخل شبكة تطوير محلية موثوقة.",
      require:
        "يشفّر الاتصال؛ وتكون شهادة CA المخصصة أو شهادة العميل لـmTLS اختيارية.",
      "verify-ca":
        "يشفّر الاتصال ويتحقق من شهادة الخادم باستخدام شهادة CA المرفوعة.",
      "verify-full":
        "يتحقق من جهة إصدار الشهادة ومن تطابق اسم مضيف قاعدة البيانات.",
    } satisfies Record<DatabaseServerSslMode, string>,
    rejectUnauthorized: "رفض الشهادات غير الموثوقة",
    rejectUnauthorizedHelp:
      "اتركه مفعّلًا ما لم تتطلب بيئة تطوير مضبوطة خلاف ذلك صراحةً.",
    storedBundle: "توجد حزمة شهادات مشفّرة مُعدّة بالفعل",
    storedBundleHelp:
      "لا يعيد Core محتوياتها مطلقًا. رفع أي مادة جديدة يستبدل الحزمة المخزنة كاملةً.",
    removeStoredBundle: "إزالة حزمة الشهادات المخزنة",
    caCertificate: "شهادة CA",
    caCertificateHelp: "شهادة الجذر الموثوقة أو سلسلة الشهادات بصيغة PEM.",
    clientCertificate: "شهادة العميل",
    clientCertificateHelp: "هوية عميل اختيارية لاتصال mTLS.",
    clientPrivateKey: "المفتاح الخاص للعميل",
    clientPrivateKeyHelp: "يلزم رفعه مع شهادة العميل.",
    privateKeyPassphrase: "عبارة مرور المفتاح الخاص",
    privateKeyPassphraseHelp:
      "اختيارية، ولا تكون صالحة إلا مع المفتاح الخاص المرفوع.",
    readyToSend: "جاهز للإرسال الآمن",
    clearSelected: (label: string) => `مسح ${label} المحددة`,
    fileEmpty: (label: string) => `ملف ${label} فارغ.`,
    fileTooLarge: (label: string) =>
      `${label} تتجاوز حد واجهة API البالغ 20,000 حرف.`,
    unableToRead: (label: string) => `تعذرت قراءة ${label}.`,
  },
  en: {
    title: "Transport security",
    description:
      "Certificate contents stay only in this active form and are sent to Core as write-only DTO fields.",
    sslMode: "SSL mode",
    disable: "Disable",
    require: "Require encryption",
    verifyCa: "Verify certificate authority",
    verifyFull: "Verify authority and hostname",
    modeHelp: {
      disable:
        "Plain PostgreSQL transport. Use only on a trusted local development network.",
      require:
        "Encrypts transport. A custom CA or mutual-TLS client certificate is optional.",
      "verify-ca":
        "Encrypts transport and verifies the server certificate against the uploaded CA.",
      "verify-full":
        "Verifies both the certificate authority and the database hostname.",
    } satisfies Record<DatabaseServerSslMode, string>,
    rejectUnauthorized: "Reject unauthorized certificates",
    rejectUnauthorizedHelp:
      "Keep enabled unless a controlled development environment explicitly requires otherwise.",
    storedBundle: "An encrypted certificate bundle is already configured",
    storedBundleHelp:
      "Core never returns its contents. Uploading any new material replaces the entire stored bundle.",
    removeStoredBundle: "Remove the stored certificate bundle",
    caCertificate: "CA certificate",
    caCertificateHelp: "Trusted root or certificate chain in PEM format.",
    clientCertificate: "Client certificate",
    clientCertificateHelp: "Optional client identity for mutual TLS.",
    clientPrivateKey: "Client private key",
    clientPrivateKeyHelp: "Required together with a client certificate.",
    privateKeyPassphrase: "Private-key passphrase",
    privateKeyPassphraseHelp:
      "Optional, and valid only with the uploaded private key.",
    readyToSend: "Ready to send securely",
    clearSelected: (label: string) => `Clear selected ${label.toLowerCase()}`,
    fileEmpty: (label: string) => `${label} file is empty.`,
    fileTooLarge: (label: string) =>
      `${label} exceeds the 20,000 character API limit.`,
    unableToRead: (label: string) => `Unable to read ${label}.`,
  },
} as const;
