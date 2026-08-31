"use client";

import { useEffect, useRef, useState } from "react";
import { FileKey2, LockKeyhole, ShieldCheck, Trash2 } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import {
  Button,
  Checkbox,
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/design-system";
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
type FileError = { field: CertificateField; message: string };

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
  const [fileError, setFileError] = useState<FileError | null>(null);
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
    setFileError(null);
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
    setFileError(null);
    try {
      const value = await readDatabaseSslMaterialFile(file, label);
      onRemoveStoredConfigChange?.(false);
      const nextConfig = { ...configRef.current, [field]: value };
      configRef.current = nextConfig;
      onConfigChange(nextConfig);
    } catch (error) {
      const ref = inputRefs[field];
      if (ref.current) ref.current.value = "";
      setFileError({
        field,
        message:
          error instanceof Error && error.message.endsWith(" file is empty.")
            ? copy.fileEmpty(label)
            : error instanceof Error && error.message.includes("20,000 character API limit")
              ? copy.fileTooLarge(label)
              : copy.unableToRead(label),
      });
    }
  };

  const clearField = (field: CertificateField) => {
    const next = { ...configRef.current };
    delete next[field];
    if (field === "key") delete next.passphrase;
    if (inputRefs[field].current) inputRefs[field].current.value = "";
    configRef.current = next;
    if (fileError?.field === field) setFileError(null);
    onConfigChange(next);
  };

  const handleRemoveStoredConfig = (remove: boolean) => {
    setFileError(null);
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
    <div className="rounded-lg border border-border bg-card p-3">
      <Field
        id={`${idPrefix}-${field}`}
        label={label}
        hint={description}
        error={fileError?.field === field ? fileError.message : undefined}
        required={required}
        labelAction={config[field] ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => clearField(field)}
            disabled={disabled}
            className="size-8 p-0 text-destructive hover:bg-destructive-subtle hover:text-destructive-subtle-foreground"
            aria-label={copy.clearSelected(label)}
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </Button>
        ) : undefined}
      >
        {(fieldProps) => (
          <Input
            {...fieldProps}
            ref={inputRefs[field]}
            type="file"
            accept={accept}
            required={required && !hasStoredConfig}
            disabled={disabled || removeStoredConfig}
            onChange={(event) => void handleFileChange(field, label, event.target.files?.[0])}
            className="h-auto min-h-(--size-control-lg) cursor-pointer py-1 text-xs text-muted-foreground file:me-3 file:min-h-8 file:cursor-pointer file:rounded-md file:border-0 file:bg-info-subtle file:px-3 file:text-xs file:font-semibold file:text-info-subtle-foreground"
          />
        )}
      </Field>
      {config[field] && (
        <p role="status" className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-success-subtle-foreground">
          <ShieldCheck className="size-3.5" aria-hidden="true" /> {copy.readyToSend}
        </p>
      )}
    </div>
  );

  return (
    <section dir={dir} className="overflow-hidden rounded-lg border border-border bg-muted">
      <div className="flex items-start gap-3 border-b border-border p-4">
        <div className="rounded-lg bg-info-subtle p-2 text-info-subtle-foreground">
          <LockKeyhole className="size-4" aria-hidden="true" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            {copy.title}
          </h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {copy.description}
          </p>
        </div>
      </div>

      <div className="space-y-4 p-4">
        <Field id={`${idPrefix}-mode`} label={copy.sslMode} required>
          {({ required, ...fieldProps }) => (
            <Select value={mode} onValueChange={(value) => handleModeChange(value as DatabaseServerSslMode)} disabled={disabled} dir={dir}>
              <SelectTrigger {...fieldProps} aria-required={required}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="disable">{copy.disable}</SelectItem>
                <SelectItem value="require">{copy.require}</SelectItem>
                <SelectItem value="verify-ca">{copy.verifyCa}</SelectItem>
                <SelectItem value="verify-full">{copy.verifyFull}</SelectItem>
              </SelectContent>
            </Select>
          )}
        </Field>

        <p className={`rounded-lg px-3 py-2 text-xs leading-5 ${mode === "disable" ? "bg-warning-subtle text-warning-subtle-foreground" : "bg-info-subtle text-info-subtle-foreground"}`}>
          {copy.modeHelp[mode]}
        </p>

        {mode !== "disable" && (
          <>
            <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
              <Checkbox
                id={`${idPrefix}-reject-unauthorized`}
                checked={rejectUnauthorized}
                disabled={disabled}
                onCheckedChange={(checked) => onRejectUnauthorizedChange(checked === true)}
                className="mt-0.5"
              />
              <label htmlFor={`${idPrefix}-reject-unauthorized`} className="cursor-pointer">
                <span className="block text-sm font-semibold text-foreground">
                  {copy.rejectUnauthorized}
                </span>
                <span className="mt-1 block text-xs leading-4 text-muted-foreground">
                  {copy.rejectUnauthorizedHelp}
                </span>
              </label>
            </div>

            {hasStoredConfig && (
              <div className="rounded-lg border border-info/30 bg-info-subtle p-3 text-info-subtle-foreground">
                <div className="flex items-start gap-2">
                  <FileKey2 className="mt-0.5 size-4 shrink-0 text-info" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold">
                      {copy.storedBundle}
                    </p>
                    <p className="mt-1 text-xs leading-4">
                      {copy.storedBundleHelp}
                    </p>
                    {onRemoveStoredConfigChange && (
                      <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-destructive-subtle-foreground">
                        <Checkbox
                          id={`${idPrefix}-remove-stored`}
                          checked={removeStoredConfig}
                          disabled={disabled}
                          onCheckedChange={(checked) => handleRemoveStoredConfig(checked === true)}
                        />
                        <label htmlFor={`${idPrefix}-remove-stored`} className="cursor-pointer">{copy.removeStoredBundle}</label>
                      </div>
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
              <div className="rounded-lg border border-border bg-card p-3">
                <Field id={`${idPrefix}-passphrase`} label={copy.privateKeyPassphrase} hint={copy.privateKeyPassphraseHelp}>
                  {(fieldProps) => (
                    <Input
                      {...fieldProps}
                      type="password"
                      autoComplete="new-password"
                      maxLength={1024}
                      value={config.passphrase ?? ""}
                      disabled={disabled || removeStoredConfig}
                      onChange={(event) => {
                        onRemoveStoredConfigChange?.(false);
                        const nextConfig = { ...configRef.current, passphrase: event.target.value };
                        configRef.current = nextConfig;
                        onConfigChange(nextConfig);
                      }}
                    />
                  )}
                </Field>
              </div>
            </div>
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
