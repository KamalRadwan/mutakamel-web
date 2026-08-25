export interface PublisherKeyCopy {
  back: string;
  title: string;
  subtitle: string;
  securityTitle: string;
  securityBody: string;
  readPermission: string;
  managePermission: string;
  criticalPermission: string;
  directory: string;
  directoryHelp: string;
  refresh: string;
  refreshing: string;
  loading: string;
  empty: string;
  forbidden: string;
  unavailable: string;
  stale: string;
  failed: string;
  retry: string;
  select: string;
  close: string;
  detail: string;
  selectHelp: string;
  keyId: string;
  publisherKeyId: string;
  algorithm: string;
  status: string;
  revision: string;
  registeredAt: string;
  revokedAt: string;
  revokeReason: string;
  fingerprint: string;
  publicKey: string;
  active: string;
  revoked: string;
  correlation: string;
  stepChallenge: string;
  challengeHelp: string;
  expiresIn: string;
  seconds: string;
  createChallenge: string;
  challengeReady: string;
  challengeId: string;
  payload: string;
  digest: string;
  expiresAt: string;
  encoding: string;
  stepRegister: string;
  registerHelp: string;
  signature: string;
  reviewRegister: string;
  stepRevoke: string;
  revokeHelp: string;
  reasonCode: string;
  reviewRevoke: string;
  expectedStatus: string;
  confirmRegisterTitle: string;
  confirmRegisterBody: string;
  confirmRevokeTitle: string;
  confirmRevokeBody: string;
  cancel: string;
  confirm: string;
  pending: string;
  successChallenge: string;
  successRegister: string;
  successRevoke: string;
  validation: string;
  conflict: string;
  ambiguous: string;
  exactRetry: string;
  dismiss: string;
  errorCode: string;
  keyIdError: string;
  publicKeyError: string;
  expiryError: string;
  challengeIdError: string;
  signatureError: string;
  reasonError: string;
  publisherKeyIdError: string;
  revisionError: string;
  noPrivateKey: string;
  noWriteAccess: string;
  noCriticalAccess: string;
  activeCount: string;
  revokedCount: string;
}

export const COPY: Record<"en" | "ar", PublisherKeyCopy> = {
  en: {
    back: "Provisioning governance",
    title: "Provisioning publisher keys",
    subtitle:
      "Register and revoke the Ed25519 public keys trusted to sign immutable provisioning releases.",
    securityTitle: "External signing boundary",
    securityBody:
      "Only raw public keys, signing payloads, and signatures belong here. Generate and keep every private signing key outside this browser and outside Mutakamel.",
    readPermission: "Required permission: admin.provisioning.publisher-keys.read",
    managePermission:
      "Required permission: admin.provisioning.publisher-keys.manage",
    criticalPermission:
      "Required permissions: admin.provisioning.publisher-keys.manage + admin.provisioning.critical",
    directory: "Trusted-key directory",
    directoryHelp:
      "Core returns at most 500 records, newest registration first. This endpoint has no search or pagination contract.",
    refresh: "Refresh",
    refreshing: "Refreshing…",
    loading: "Loading publisher keys…",
    empty: "No publisher keys are registered.",
    forbidden: "You do not have access to this resource.",
    unavailable: "The publisher-key service is unavailable.",
    stale: "Showing the last verified response because refresh failed.",
    failed: "The request failed.",
    retry: "Try again",
    select: "Inspect",
    close: "Close",
    detail: "Publisher-key detail",
    selectHelp: "Select a registry row to load its authoritative current revision.",
    keyId: "Key ID",
    publisherKeyId: "Publisher-key UUID",
    algorithm: "Algorithm",
    status: "Status",
    revision: "Revision",
    registeredAt: "Registered",
    revokedAt: "Revoked",
    revokeReason: "Revocation reason",
    fingerprint: "SHA-256 fingerprint",
    publicKey: "Raw public key (Base64)",
    active: "Active",
    revoked: "Revoked",
    correlation: "Correlation ID",
    stepChallenge: "1. Create an actor-bound challenge",
    challengeHelp:
      "Supply a stable key ID and exactly one raw 32-byte Ed25519 public key. The challenge lasts 60–900 seconds.",
    expiresIn: "Challenge lifetime",
    seconds: "seconds",
    createChallenge: "Create challenge",
    challengeReady: "Challenge ready for external signing",
    challengeId: "Challenge UUID",
    payload: "Payload to sign (Base64)",
    digest: "Signing digest (SHA-256)",
    expiresAt: "Expires",
    encoding: "Sign the decoded payload with Ed25519 and return a raw 64-byte Base64 signature.",
    stepRegister: "2. Register the verified public key",
    registerHelp:
      "Paste the externally produced signature. Registration consumes the same actor-bound, unexpired challenge.",
    signature: "Proof signature (Base64)",
    reviewRegister: "Review registration",
    stepRevoke: "Revoke this active key",
    revokeHelp:
      "Revocation is revision-fenced. Existing signed evidence remains immutable; future publication with this key is blocked.",
    reasonCode: "Stable reason code",
    reviewRevoke: "Review revocation",
    expectedStatus: "Expected status",
    confirmRegisterTitle: "Confirm critical key registration",
    confirmRegisterBody:
      "Confirm that the signature was produced by the private key corresponding to this challenge. The private key must never be pasted into this portal.",
    confirmRevokeTitle: "Confirm critical key revocation",
    confirmRevokeBody:
      "This blocks future provisioning-release publication with the selected key. The exact current revision and ACTIVE status will be submitted.",
    cancel: "Cancel",
    confirm: "Confirm",
    pending: "Submitting the exact idempotent command…",
    successChallenge: "Challenge created successfully.",
    successRegister: "Publisher key registered successfully.",
    successRevoke: "Publisher key revoked successfully.",
    validation: "Correct the highlighted contract fields.",
    conflict: "Core rejected the command because current governance state conflicts with it.",
    ambiguous:
      "The service response was unavailable, so the command outcome is unknown. Retry only the retained exact body and UUIDv7 key.",
    exactRetry: "Retry exact command",
    dismiss: "Dismiss",
    errorCode: "Problem code",
    keyIdError: "Use 3–64 lowercase characters: letters, numbers, dot, underscore, or hyphen.",
    publicKeyError: "Enter exactly one canonical Base64-encoded 32-byte Ed25519 public key.",
    expiryError: "Enter a whole number from 60 through 900.",
    challengeIdError: "Enter a valid UUIDv7 challenge ID.",
    signatureError: "Enter a canonical Base64-encoded raw 64-byte Ed25519 signature.",
    reasonError: "Use 3–96 uppercase characters: letters, numbers, dot, underscore, or hyphen.",
    publisherKeyIdError: "Enter a valid UUIDv7 publisher-key ID.",
    revisionError: "Enter the exact current revision from 1 through 2147483647.",
    noPrivateKey: "Never paste a seed, secret key, PEM private key, or wallet file.",
    noWriteAccess: "You may inspect registry evidence, but cannot create challenges.",
    noCriticalAccess: "Critical permission is required to register or revoke keys.",
    activeCount: "Active keys",
    revokedCount: "Revoked keys",
  },
  ar: {
    back: "حوكمة التهيئة",
    title: "مفاتيح ناشري التهيئة",
    subtitle:
      "تسجيل وإلغاء مفاتيح Ed25519 العامة الموثوقة لتوقيع إصدارات التهيئة غير القابلة للتغيير.",
    securityTitle: "حدّ التوقيع الخارجي",
    securityBody:
      "يُسمح هنا بالمفاتيح العامة وحمولات التوقيع والتواقيع فقط. أنشئ كل مفتاح توقيع خاص واحتفظ به خارج المتصفح وخارج متكامل.",
    readPermission: "الصلاحية المطلوبة: admin.provisioning.publisher-keys.read",
    managePermission:
      "الصلاحية المطلوبة: admin.provisioning.publisher-keys.manage",
    criticalPermission:
      "الصلاحيات المطلوبة: admin.provisioning.publisher-keys.manage + admin.provisioning.critical",
    directory: "دليل المفاتيح الموثوقة",
    directoryHelp:
      "يعيد Core بحد أقصى 500 سجل، والأحدث تسجيلًا أولًا. لا يدعم هذا المسار البحث أو ترقيم الصفحات.",
    refresh: "تحديث",
    refreshing: "جارٍ التحديث…",
    loading: "جارٍ تحميل مفاتيح الناشرين…",
    empty: "لا توجد مفاتيح ناشرين مسجلة.",
    forbidden: "ليست لديك صلاحية الوصول إلى هذا المورد.",
    unavailable: "خدمة مفاتيح الناشرين غير متاحة.",
    stale: "تُعرض آخر استجابة موثقة لأن التحديث فشل.",
    failed: "فشل الطلب.",
    retry: "إعادة المحاولة",
    select: "فحص",
    close: "إغلاق",
    detail: "تفاصيل مفتاح الناشر",
    selectHelp: "اختر سجلًا لتحميل مراجعته الحالية الموثوقة.",
    keyId: "معرّف المفتاح",
    publisherKeyId: "UUID لمفتاح الناشر",
    algorithm: "الخوارزمية",
    status: "الحالة",
    revision: "المراجعة",
    registeredAt: "وقت التسجيل",
    revokedAt: "وقت الإلغاء",
    revokeReason: "سبب الإلغاء",
    fingerprint: "بصمة SHA-256",
    publicKey: "المفتاح العام الخام (Base64)",
    active: "نشط",
    revoked: "ملغى",
    correlation: "معرّف الارتباط",
    stepChallenge: "1. إنشاء تحدٍّ مرتبط بالمنفّذ",
    challengeHelp:
      "أدخل معرّفًا ثابتًا ومفتاح Ed25519 عامًا خامًا بطول 32 بايت تمامًا. مدة التحدي من 60 إلى 900 ثانية.",
    expiresIn: "مدة التحدي",
    seconds: "ثانية",
    createChallenge: "إنشاء التحدي",
    challengeReady: "التحدي جاهز للتوقيع الخارجي",
    challengeId: "UUID للتحدي",
    payload: "الحمولة المطلوب توقيعها (Base64)",
    digest: "ملخص التوقيع (SHA-256)",
    expiresAt: "ينتهي في",
    encoding: "وقّع الحمولة بعد فكها باستخدام Ed25519، ثم أعد توقيعًا خامًا بطول 64 بايت مشفرًا Base64.",
    stepRegister: "2. تسجيل المفتاح العام المتحقق منه",
    registerHelp:
      "ألصق التوقيع الناتج خارجيًا. يستهلك التسجيل التحدي نفسه المرتبط بالمنفّذ وغير المنتهي.",
    signature: "توقيع الإثبات (Base64)",
    reviewRegister: "مراجعة التسجيل",
    stepRevoke: "إلغاء هذا المفتاح النشط",
    revokeHelp:
      "الإلغاء محمي بالمراجعة. يبقى دليل التوقيع السابق ثابتًا، ويُمنع النشر المستقبلي بهذا المفتاح.",
    reasonCode: "رمز سبب ثابت",
    reviewRevoke: "مراجعة الإلغاء",
    expectedStatus: "الحالة المتوقعة",
    confirmRegisterTitle: "تأكيد تسجيل المفتاح الحرج",
    confirmRegisterBody:
      "أكد أن التوقيع أُنتج بالمفتاح الخاص المقابل لهذا التحدي. يجب ألا يُلصق المفتاح الخاص في هذه البوابة مطلقًا.",
    confirmRevokeTitle: "تأكيد إلغاء المفتاح الحرج",
    confirmRevokeBody:
      "سيمنع ذلك نشر إصدارات تهيئة مستقبلية بالمفتاح المحدد. ستُرسل المراجعة الحالية الدقيقة والحالة ACTIVE.",
    cancel: "إلغاء",
    confirm: "تأكيد",
    pending: "جارٍ إرسال الأمر المطابق بمفتاح منع التكرار…",
    successChallenge: "تم إنشاء التحدي بنجاح.",
    successRegister: "تم تسجيل مفتاح الناشر بنجاح.",
    successRevoke: "تم إلغاء مفتاح الناشر بنجاح.",
    validation: "صحح حقول العقد المحددة.",
    conflict: "رفض Core الأمر بسبب تعارضه مع حالة الحوكمة الحالية.",
    ambiguous:
      "لم تتوفر استجابة الخدمة، لذلك نتيجة الأمر غير معروفة. أعد فقط الطلب المطابق المحتفظ به مع مفتاح UUIDv7 نفسه.",
    exactRetry: "إعادة الأمر المطابق",
    dismiss: "إخفاء",
    errorCode: "رمز المشكلة",
    keyIdError: "استخدم من 3 إلى 64 حرفًا صغيرًا أو رقمًا أو نقطة أو شرطة سفلية أو واصلة.",
    publicKeyError: "أدخل مفتاح Ed25519 عامًا بطول 32 بايت مشفرًا بصيغة Base64 القياسية.",
    expiryError: "أدخل عددًا صحيحًا من 60 إلى 900.",
    challengeIdError: "أدخل معرّف تحدٍّ UUIDv7 صالحًا.",
    signatureError: "أدخل توقيع Ed25519 خامًا بطول 64 بايت مشفرًا بصيغة Base64 القياسية.",
    reasonError: "استخدم من 3 إلى 96 حرفًا كبيرًا أو رقمًا أو نقطة أو شرطة سفلية أو واصلة.",
    publisherKeyIdError: "أدخل معرّف مفتاح ناشر UUIDv7 صالحًا.",
    revisionError: "أدخل المراجعة الحالية الدقيقة من 1 إلى 2147483647.",
    noPrivateKey: "لا تلصق أبدًا بذرة أو مفتاحًا سريًا أو مفتاح PEM خاصًا أو ملف محفظة.",
    noWriteAccess: "يمكنك فحص دليل السجل، لكن لا يمكنك إنشاء تحديات.",
    noCriticalAccess: "الصلاحية الحرجة مطلوبة لتسجيل المفاتيح أو إلغائها.",
    activeCount: "المفاتيح النشطة",
    revokedCount: "المفاتيح الملغاة",
  },
};
