"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { AlertTriangle, FileJson2, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { Badge, Button, Card, PageHeader } from "@/design-system";
import type {
  CoreSnapshot,
  ReleaseDraftStatus,
  ReleaseMutationState,
  ReleaseStatus,
  ReleaseValidationCode,
} from "../types/provisioning-releases";

export const RELEASE_COPY = {
  en: {
    title: "Provisioning releases",
    subtitle: "Draft, validate, externally sign, publish, and retire immutable provisioning manifests.",
    drafts: "Release drafts",
    releases: "Published releases",
    createDraft: "Create release draft",
    back: "Back to release governance",
    loading: "Loading release-governance evidence…",
    forbidden: "You do not have permission to read provisioning releases.",
    forbiddenManage: "You do not have permission to manage release drafts.",
    readPermission: "Required permission: admin.provisioning.releases.read",
    managePermission: "Required permission: admin.provisioning.releases.publish",
    unavailable: "Release governance is currently unavailable.",
    notFound: "This release-governance record no longer exists or is inaccessible.",
    error: "Release-governance evidence could not be loaded.",
    empty: "No release drafts or published releases exist.",
    noDrafts: "No release drafts exist.",
    noReleases: "No published releases exist.",
    retry: "Retry",
    refresh: "Refresh",
    open: "Open",
    componentId: "Component UUID v7",
    releaseVersion: "Release version",
    manifestVersion: "Manifest version",
    contractVersion: "Contract version",
    runtimeBuildSha: "Runtime build SHA",
    schemaTarget: "Schema target",
    schemaChecksum: "Schema checksum (optional SHA-256)",
    manifestPayload: "Manifest payload (JSON object)",
    compatibility: "Compatibility contract (JSON object)",
    riskLevel: "Risk level",
    selfServiceAllowed: "Allow tenant self-service",
    requiresBackup: "Require verified backup",
    requiresMaintenance: "Require maintenance fence",
    status: "Status",
    revision: "Revision",
    manifestChecksumLabel: "Manifest checksum",
    publisherKeyId: "Publisher-key UUID v7",
    signingDigest: "Signing digest",
    validatedAt: "Validated at",
    publishedReleaseId: "Published release UUID",
    createdAt: "Created",
    updatedAt: "Updated",
    publishedAt: "Published",
    retiredAt: "Retired",
    publicationSource: "Publication source",
    signatureAlgorithm: "Signature algorithm",
    signatureBase64: "Ed25519 signature (raw 64-byte base64)",
    signedPayloadDigest: "Signed payload digest",
    retirementReason: "Retirement reason code",
    yes: "Yes",
    no: "No",
    saveDraft: "Save complete definition",
    unsavedDefinition: "Save or discard the edited definition before validating or publishing the authoritative Core snapshot.",
    saving: "Saving…",
    create: "Create draft",
    creating: "Creating…",
    created: "Release draft created",
    validationTitle: "Validate and pin publisher key",
    validationHelp: "Core checks the manifest/catalogue and returns the exact external-signing payload. The publisher private key must remain outside this browser and platform.",
    validate: "Validate draft",
    validating: "Validating…",
    publishTitle: "Publish signed immutable release",
    publishHelp: "Sign the verified payload outside the browser with the pinned Ed25519 private key, then paste only the detached signature below.",
    payloadBase64: "External-signing payload (base64)",
    payloadChecking: "Reconstructing the Core canonical payload and verifying its SHA-256 digest…",
    payloadUnavailable: "This browser cannot verify the signing payload. Publication is disabled.",
    payloadMismatch: "The reconstructed payload digest does not match Core. Publication is disabled.",
    publishConfirm: "I verified the component, versions, manifest checksum, signing digest, publisher key, and detached signature and intend to publish this immutable release.",
    publish: "Publish immutable release",
    publishing: "Publishing…",
    published: "Immutable release published",
    viewPublished: "View published release",
    retireTitle: "Retire published release",
    retireHelp: "Retirement blocks this immutable release from selection for new operations. Existing evidence remains available.",
    retireConfirm: "I verified the release identity and manifest checksum and intend to retire this release.",
    retire: "Retire release",
    retiring: "Retiring…",
    definition: "Complete release definition",
    manifestEvidence: "Manifest and compatibility evidence",
    lifecycleEvidence: "Lifecycle evidence",
    signatureEvidence: "Publication signature evidence",
    disclosurePolicy: "Manifest JSON is displayed because Core recursively rejects secret-bearing fields. Public signatures and digests are evidence; private signing keys are never requested, stored, or returned.",
    correlation: "Correlation ID",
    responseAt: "Response received",
    commandSucceeded: "The authoritative release-governance command succeeded.",
    commandForbidden: "Your current permissions do not authorize this command.",
    commandConflict: "The revision, checksum, status, or command fence changed. Authoritative state was refreshed.",
    commandValidation: "Core rejected the release definition or signing evidence. Review the exact fields.",
    commandInFlight: "This exact UUIDv7 command is still in flight. An unchanged retry keeps the same command identity.",
    commandUnavailable: "The command outcome may be ambiguous. State is being reconciled; retry unchanged fields to reuse the same command identity.",
    commandError: "The release-governance command failed.",
    invalidUuid: "Enter a UUID v7 identifier.",
    invalidVersion: "Use 1–64 safe version characters: letters, digits, dot, underscore, colon, plus, or hyphen.",
    invalidInteger: "Enter an integer from 1 through 2,147,483,647.",
    invalidBuildSha: "Enter 7–64 lowercase hexadecimal characters.",
    invalidSchemaTarget: "Enter a 1–255 character schema target beginning with a letter.",
    invalidSha: "Enter exactly 64 lowercase hexadecimal characters.",
    invalidJson: "Enter a JSON object, not an array or scalar.",
    jsonTooLarge: "Canonical JSON must not exceed 256 KiB.",
    secretForbidden: "Secret-bearing keys (password, secret, token, credential, authorization, cookie, or private key) are forbidden recursively.",
    invalidManifest: "Manifest fields, seed packs, contract version, schema target, or embedded compatibility do not match Core's strict contract.",
    invalidCompatibility: "Compatibility must be contractVersion 1 with exact requiredComponents version constraints.",
    invalidSignature: "Enter a canonical raw 64-byte Ed25519 signature encoded as 86 base64 characters plus ==.",
    invalidReason: "Use 3–96 uppercase reason-code characters: A–Z, digits, dot, underscore, or hyphen.",
    confirmationRequired: "Confirm the critical action before continuing.",
  },
  ar: {
    title: "إصدارات التزويد",
    subtitle: "إنشاء المسودات والتحقق والتوقيع الخارجي والنشر والإحالة للتقاعد لبيانات تزويد غير قابلة للتغيير.",
    drafts: "مسودات الإصدار",
    releases: "الإصدارات المنشورة",
    createDraft: "إنشاء مسودة إصدار",
    back: "العودة إلى حوكمة الإصدارات",
    loading: "جارٍ تحميل أدلة حوكمة الإصدارات…",
    forbidden: "لا تملك صلاحية قراءة إصدارات التزويد.",
    forbiddenManage: "لا تملك صلاحية إدارة مسودات الإصدارات.",
    readPermission: "الصلاحية المطلوبة: admin.provisioning.releases.read",
    managePermission: "الصلاحية المطلوبة: admin.provisioning.releases.publish",
    unavailable: "حوكمة الإصدارات غير متاحة حاليًا.",
    notFound: "سجل حوكمة الإصدار غير موجود أو لا يمكن الوصول إليه.",
    error: "تعذر تحميل أدلة حوكمة الإصدارات.",
    empty: "لا توجد مسودات أو إصدارات منشورة.",
    noDrafts: "لا توجد مسودات إصدار.",
    noReleases: "لا توجد إصدارات منشورة.",
    retry: "إعادة المحاولة",
    refresh: "تحديث",
    open: "فتح",
    componentId: "معرّف المكوّن UUID v7",
    releaseVersion: "نسخة الإصدار",
    manifestVersion: "نسخة البيان",
    contractVersion: "نسخة العقد",
    runtimeBuildSha: "SHA لبناء وقت التشغيل",
    schemaTarget: "هدف المخطط",
    schemaChecksum: "بصمة المخطط (SHA-256 اختيارية)",
    manifestPayload: "محتوى البيان (كائن JSON)",
    compatibility: "عقد التوافق (كائن JSON)",
    riskLevel: "مستوى المخاطر",
    selfServiceAllowed: "السماح بالخدمة الذاتية للمستأجر",
    requiresBackup: "اشتراط نسخة احتياطية موثقة",
    requiresMaintenance: "اشتراط سياج صيانة",
    status: "الحالة",
    revision: "المراجعة",
    manifestChecksumLabel: "بصمة البيان",
    publisherKeyId: "معرّف مفتاح الناشر UUID v7",
    signingDigest: "بصمة التوقيع",
    validatedAt: "وقت التحقق",
    publishedReleaseId: "معرّف الإصدار المنشور",
    createdAt: "الإنشاء",
    updatedAt: "التحديث",
    publishedAt: "النشر",
    retiredAt: "التقاعد",
    publicationSource: "مصدر النشر",
    signatureAlgorithm: "خوارزمية التوقيع",
    signatureBase64: "توقيع Ed25519 (64 بايت خام بصيغة base64)",
    signedPayloadDigest: "بصمة المحتوى الموقّع",
    retirementReason: "رمز سبب التقاعد",
    yes: "نعم",
    no: "لا",
    saveDraft: "حفظ التعريف الكامل",
    unsavedDefinition: "احفظ تعديلات التعريف أو تجاهلها قبل التحقق من لقطة Core الموثوقة أو نشرها.",
    saving: "جارٍ الحفظ…",
    create: "إنشاء المسودة",
    creating: "جارٍ الإنشاء…",
    created: "تم إنشاء مسودة الإصدار",
    validationTitle: "التحقق وتثبيت مفتاح الناشر",
    validationHelp: "تتحقق Core من البيان والكتالوج وتعيد محتوى التوقيع الخارجي الدقيق. يجب أن يبقى المفتاح الخاص خارج المتصفح والمنصة.",
    validate: "التحقق من المسودة",
    validating: "جارٍ التحقق…",
    publishTitle: "نشر إصدار موقّع غير قابل للتغيير",
    publishHelp: "وقّع المحتوى الموثق خارج المتصفح بالمفتاح الخاص المثبت ثم الصق التوقيع المنفصل فقط.",
    payloadBase64: "محتوى التوقيع الخارجي (base64)",
    payloadChecking: "جارٍ إعادة بناء محتوى Core القياسي والتحقق من بصمة SHA-256…",
    payloadUnavailable: "لا يستطيع هذا المتصفح التحقق من محتوى التوقيع. تم تعطيل النشر.",
    payloadMismatch: "لا تطابق بصمة المحتوى المعاد بناؤه بصمة Core. تم تعطيل النشر.",
    publishConfirm: "راجعت المكوّن والنسخ وبصمة البيان وبصمة التوقيع ومفتاح الناشر والتوقيع المنفصل وأقصد نشر هذا الإصدار غير القابل للتغيير.",
    publish: "نشر الإصدار غير القابل للتغيير",
    publishing: "جارٍ النشر…",
    published: "تم نشر الإصدار غير القابل للتغيير",
    viewPublished: "عرض الإصدار المنشور",
    retireTitle: "إحالة الإصدار المنشور للتقاعد",
    retireHelp: "يمنع التقاعد اختيار الإصدار لعمليات جديدة مع بقاء الأدلة السابقة متاحة.",
    retireConfirm: "راجعت هوية الإصدار وبصمة البيان وأقصد إحالة هذا الإصدار للتقاعد.",
    retire: "إحالة الإصدار للتقاعد",
    retiring: "جارٍ التقاعد…",
    definition: "تعريف الإصدار الكامل",
    manifestEvidence: "أدلة البيان والتوافق",
    lifecycleEvidence: "أدلة دورة الحياة",
    signatureEvidence: "أدلة توقيع النشر",
    disclosurePolicy: "يُعرض JSON لأن Core ترفض حقول الأسرار تكراريًا. التواقيع العامة والبصمات أدلة، ولا يُطلب المفتاح الخاص أو يُخزن أو يُعاد مطلقًا.",
    correlation: "معرّف التتبع",
    responseAt: "وقت استلام الاستجابة",
    commandSucceeded: "نجح أمر حوكمة الإصدار الموثق.",
    commandForbidden: "صلاحياتك الحالية لا تسمح بهذا الأمر.",
    commandConflict: "تغيرت المراجعة أو البصمة أو الحالة أو سياج الأمر. تم تحديث الحالة الموثقة.",
    commandValidation: "رفضت Core تعريف الإصدار أو دليل التوقيع. راجع الحقول الدقيقة.",
    commandInFlight: "أمر UUIDv7 نفسه قيد التنفيذ. تحتفظ الإعادة دون تغيير بهوية الأمر نفسها.",
    commandUnavailable: "قد تكون نتيجة الأمر ملتبسة. تجري مطابقة الحالة؛ أعد دون تغيير لاستخدام الهوية نفسها.",
    commandError: "فشل أمر حوكمة الإصدار.",
    invalidUuid: "أدخل معرّفًا بصيغة UUID v7.",
    invalidVersion: "استخدم من 1 إلى 64 حرف نسخة آمنًا.",
    invalidInteger: "أدخل عددًا صحيحًا من 1 إلى 2,147,483,647.",
    invalidBuildSha: "أدخل من 7 إلى 64 خانة سداسية عشرية صغيرة.",
    invalidSchemaTarget: "أدخل هدف مخطط من 1 إلى 255 حرفًا يبدأ بحرف.",
    invalidSha: "أدخل 64 خانة سداسية عشرية صغيرة بالضبط.",
    invalidJson: "أدخل كائن JSON وليس مصفوفة أو قيمة مفردة.",
    jsonTooLarge: "يجب ألا يتجاوز JSON القياسي 256 KiB.",
    secretForbidden: "حقول الأسرار محظورة تكراريًا، ومنها كلمة المرور والسر والرمز وبيانات الاعتماد والتفويض وملف الارتباط والمفتاح الخاص.",
    invalidManifest: "حقول البيان أو حزم البذور أو نسخة العقد أو هدف المخطط أو التوافق المضمّن لا تطابق عقد Core الصارم.",
    invalidCompatibility: "يجب أن يكون التوافق بنسخة عقد 1 وقيود requiredComponents دقيقة.",
    invalidSignature: "أدخل توقيع Ed25519 خامًا من 64 بايت بصيغة base64 القياسية وينتهي بـ ==.",
    invalidReason: "استخدم رمز سبب من 3 إلى 96 حرفًا كبيرًا أو رقمًا أو نقطة أو شرطة سفلية أو واصلة.",
    confirmationRequired: "أكد الإجراء الحرج قبل المتابعة.",
  },
} as const;

export type ReleaseCopy = (typeof RELEASE_COPY)["en"] | (typeof RELEASE_COPY)["ar"];

export function ReleasePageFrame({ children, dir }: { children: ReactNode; dir: "rtl" | "ltr" }) {
  return <div dir={dir} className="mx-auto w-full max-w-[1600px] space-y-4">{children}</div>;
}

export function ReleaseHero({ copy, action }: { copy: ReleaseCopy; action?: ReactNode }) {
  return <PageHeader title={copy.title} description={copy.subtitle} action={action} />;
}

export function ReleaseStatePanel({ kind, title, detail, correlationId, copy, action }: { kind: "loading" | "empty" | "forbidden" | "notFound" | "unavailable" | "error"; title: string; detail?: string; correlationId?: string; copy: ReleaseCopy; action?: ReactNode }) {
  const Icon = kind === "loading" ? Loader2 : kind === "forbidden" ? ShieldAlert : kind === "error" || kind === "unavailable" ? AlertTriangle : FileJson2;
  return (
    <Card>
      <section role={kind === "error" || kind === "forbidden" ? "alert" : "status"} className="flex min-h-56 flex-col items-center justify-center p-6 text-center">
        <Icon className={`mb-3 size-9 text-muted-foreground ${kind === "loading" ? "animate-spin motion-reduce:animate-none" : ""}`} aria-hidden="true" />
        <h2 className="font-semibold text-foreground">{title}</h2>
        {detail ? <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{detail}</p> : null}
        {correlationId ? <p className="mt-2 text-xs"><strong>{copy.correlation}:</strong> <code dir="ltr" className="select-all break-all">{correlationId}</code></p> : null}
        {action ? <div className="mt-4">{action}</div> : null}
      </section>
    </Card>
  );
}

export function ReleaseMutationNotice({ mutation, copy }: { mutation: ReleaseMutationState; copy: ReleaseCopy }) {
  const noticeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (mutation.phase !== "IDLE" && mutation.phase !== "PENDING" && mutation.phase !== "SUCCEEDED") {
      noticeRef.current?.focus();
    }
  }, [mutation.phase]);
  if (mutation.phase === "IDLE" || mutation.phase === "PENDING") return null;
  const message = { SUCCEEDED: copy.commandSucceeded, FORBIDDEN: copy.commandForbidden, CONFLICT: copy.commandConflict, VALIDATION: copy.commandValidation, IN_FLIGHT: copy.commandInFlight, UNAVAILABLE: copy.commandUnavailable, ERROR: copy.commandError }[mutation.phase];
  const danger = mutation.phase === "ERROR" || mutation.phase === "FORBIDDEN";
  const tone = danger
    ? "border-destructive/30 bg-destructive-subtle text-destructive-subtle-foreground"
    : mutation.phase === "SUCCEEDED"
      ? "border-success/30 bg-success-subtle text-success-subtle-foreground"
      : "border-warning/30 bg-warning-subtle text-warning-subtle-foreground";
  return (
    <div
      ref={noticeRef}
      role={mutation.phase === "SUCCEEDED" ? "status" : "alert"}
      tabIndex={mutation.phase === "SUCCEEDED" ? undefined : -1}
      className={`rounded-lg border px-4 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${tone}`}
    >
      <p className="font-semibold">{message}</p>
      {mutation.error ? <p className="mt-1">{mutation.error.message}</p> : null}
      {mutation.error?.errorCode ? <code dir="ltr" className="mt-1 block break-all text-xs">{mutation.error.errorCode}</code> : null}
      {mutation.correlationId ? <p className="mt-1 text-xs"><strong>{copy.correlation}:</strong> <code dir="ltr">{mutation.correlationId}</code></p> : null}
    </div>
  );
}

export function ReleaseSnapshotMeta({ snapshot, copy, lang }: { snapshot: CoreSnapshot<unknown>; copy: ReleaseCopy; lang: "ar" | "en" }) {
  return (
    <Card>
      <footer className="grid gap-2 px-4 py-3 text-xs text-muted-foreground sm:grid-cols-2">
        <p><strong>{copy.responseAt}:</strong> {formatDate(snapshot.responseTimestamp, lang)}</p>
        <p><strong>{copy.correlation}:</strong> <code dir="ltr" className="select-all break-all">{snapshot.correlationId}</code></p>
      </footer>
    </Card>
  );
}

export function StatusBadge({ status }: { status: ReleaseDraftStatus | ReleaseStatus }) {
  const tone = status === "PUBLISHED" ? "success" : status === "RETIRED" || status === "ABANDONED" ? "neutral" : status === "VALIDATED" ? "info" : "warn";
  return <Badge tone={tone} className="font-mono" dir="ltr">{status}</Badge>;
}

export function ReleaseFieldError({ id, code, copy }: { id: string; code?: ReleaseValidationCode; copy: ReleaseCopy }) {
  if (!code) return null;
  const message = { INVALID_UUID_V7: copy.invalidUuid, INVALID_VERSION: copy.invalidVersion, INVALID_POSITIVE_INTEGER: copy.invalidInteger, INVALID_BUILD_SHA: copy.invalidBuildSha, INVALID_SCHEMA_TARGET: copy.invalidSchemaTarget, INVALID_SHA256: copy.invalidSha, INVALID_JSON_OBJECT: copy.invalidJson, JSON_TOO_LARGE: copy.jsonTooLarge, SECRET_FIELD_FORBIDDEN: copy.secretForbidden, INVALID_MANIFEST_STRUCTURE: copy.invalidManifest, INVALID_COMPATIBILITY: copy.invalidCompatibility, INVALID_SIGNATURE: copy.invalidSignature, INVALID_REASON_CODE: copy.invalidReason, CONFIRMATION_REQUIRED: copy.confirmationRequired }[code];
  return <span id={id} role="alert" className="text-xs font-medium text-destructive-subtle-foreground">{message}</span>;
}

export function JsonEvidence({ title, value }: { title: string; value: Record<string, unknown> }) {
  return (
    <section className="min-w-0 rounded-lg border border-border bg-muted p-3 text-foreground">
      <h3 className="text-xs font-semibold text-muted-foreground">{title}</h3>
      <pre dir="ltr" className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-all text-start font-mono text-xs leading-5">{JSON.stringify(value, null, 2)}</pre>
    </section>
  );
}

export function RefreshReleaseButton({ label, onClick, pending = false }: { label: string; onClick: () => void; pending?: boolean }) {
  return (
    <Button type="button" variant="outline" onClick={onClick} disabled={pending} loading={pending}>
      <RefreshCw className="size-4" aria-hidden="true" />
      {label}
    </Button>
  );
}

export function formatDate(value: string | null, lang: "ar" | "en") {
  if (!value) return "—";
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value));
}
