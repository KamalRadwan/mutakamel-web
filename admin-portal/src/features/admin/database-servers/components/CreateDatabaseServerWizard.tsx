"use client";

import { useEffect, useRef, useState, type SetStateAction } from "react";
import { useRouter } from "next/navigation";
import {
  CreateDatabaseServerDto,
  CheckDatabaseServerConnectivityDto,
  DatabaseServerConnectivityResult,
  DatabaseServerSslMode,
} from "../types";
import { useDatabaseServerRegistration } from "../hooks/useDatabaseServerRegistration";
import { DatabaseSslConfigurationFields } from "./DatabaseSslConfigurationFields";
import {
  createDatabaseServerInitialValues,
  DATABASE_SERVER_CREATE_CONSTRAINTS,
  DATABASE_SECURITY_ADMIN_USERNAME_PATTERN,
  DATABASE_SECURITY_ADMIN_POSTURE,
  isDatabaseSecurityAdminStepValid,
  isDatabaseServerConnectionStepValid,
} from "../lib/registration-state";
import {
  compactDatabaseSslConfig,
  validateDatabaseSslConfig,
} from "../lib/database-ssl-config";
import { normalizeApiError } from "@/shared/api/normalized-api-error";
import { useToast } from "@/components/ui/ToastContext";
import { shouldResetDatabaseServerWriteKey } from "../lib/database-server-idempotency";
import { useI18n } from "@/i18n/I18nContext";
import { Badge, Button, Card, CodeRef, Field, Input } from "@/design-system";

const DATABASE_SERVER_REGISTRATION_COPY = {
  ar: {
    title: "تسجيل خادم قاعدة بيانات",
    connectionStep: "1. الاتصال والسعة",
    accessStep: "2. وصول المسؤول والتسجيل",
    correlationId: "معرّف الارتباط",
    connectionChecksFailed: "فشلت فحوصات الاتصال بقاعدة البيانات",
    connectionChecksFailedDescription:
      "صحّح القيم المُدخلة قبل التسجيل، أو شغّل الفحص التشخيصي الاختياري مرة أخرى.",
    securityAdminCheck: "مسؤول أمان قاعدة البيانات",
    passed: "ناجح",
    failed: "فشل",
    serverName: "اسم الخادم",
    host: "المضيف",
    port: "المنفذ",
    maxTenants: "السعة القصوى للمستأجرين",
    supportedEngine: "المحرّك المدعوم",
    engineRequirement: "PostgreSQL الإصدار الرئيسي 16 فقط",
    engineRestriction:
      "يُرفض PostgreSQL 15 والإصدارات 17 فأحدث لأن عميل النسخ الاحتياطي والاستعادة الحالي مثبت على الإصدار الرئيسي 16.",
    nextCredentials: "التالي: بيانات الاعتماد",
    securityAdminCredentials: "بيانات اعتماد مسؤول الأمان",
    credentialsDescription:
      "يستخدمها Core فقط لإدارة الأدوار المقيّدة. تُنشأ كلمات مرور التطبيقات وتُشفّر على الخادم بعد إنشاء الخادم بحالة DRAFT؛ ولا تُدخل أو تُنزّل من هنا.",
    postureAriaLabel: "متطلبات صلاحيات مسؤول أمان PostgreSQL",
    required: "مطلوب",
    rejected: "مرفوض",
    membershipRule:
      "لا يجوز لأي عضوية غير متوقعة أن تمنح وصول INHERIT أو SET فعّالًا. يُسمح فقط بحواف عضوية ADMIN إلى الأدوار التي ينشئها Core.",
    usernameRule:
      "يجب أن يتكون اسم المستخدم من 1 إلى 63 حرفًا صغيرًا أو رقمًا أو شرطة سفلية، وأن يبدأ بحرف صغير أو شرطة سفلية، وألا يبدأ بـ",
    usernameRuleTitle:
      "استخدم من 1 إلى 63 حرفًا صغيرًا أو رقمًا أو شرطة سفلية؛ ابدأ بحرف صغير أو شرطة سفلية؛ ولا تبدأ بـ pg_.",
    securityAdminUsername: "اسم مستخدم مسؤول الأمان",
    securityAdminPassword: "كلمة مرور مسؤول الأمان",
    username: "اسم المستخدم",
    password: "كلمة المرور",
    localSslNoteStart: "يمكن للتطوير المحلي استخدام وضع SSL",
    localSslNoteEnd:
      "أما في الإنتاج، فيرفض Core الفحص قبل فتح اتصال بقاعدة البيانات ما لم يكن وضع SSL هو",
    localSslNoteTail:
      "مع تفعيل التحقق من الشهادة وتوفير شهادة CA صريحة.",
    generatedTitle: "يُنشأ تلقائيًا بعد التسجيل",
    applicationRoles: "أدوار التطبيقات",
    backupAccess: "وصول النسخ الاحتياطي",
    manifestScopedAccess: "وصول مقيّد ببيان التطبيق",
    readAllDataRule: "لا تُستخدم صلاحية pg_read_all_data.",
    generatedPasswordRule:
      "لا يُدخل هذا المتصفح كلمات المرور المُنشأة أو يعرضها أو ينزّلها أو يخزّنها.",
    diagnosticNote:
      "اختبار الاتصال فحص تشخيصي اختياري. يعيد التسجيل دائمًا فحوصات الاتصال وTLS وإصدار PostgreSQL وصلاحيات مسؤول الأمان بصورة مرجعية.",
    emptyCatalogueNote:
      "كتالوج التطبيقات الفارغ حالة صحيحة؛ وتكتمل مرحلة التجهيز الخاصة به كعملية READY بلا تغييرات.",
    setupActionNote:
      "إجراء إعداد واحد يسجل الخادم بحالة DRAFT، وينفذ التجهيز المرجعي للوصول المُنشأ، ثم يفعّل الخادم عند اكتمال الجاهزية. تظل النتيجة الجزئية قابلة للفحص وإعادة المحاولة دون إنشاء خادم ثانٍ.",
    pendingActivationNote:
      "تم حفظ التسجيل بالفعل. أعد محاولة التفعيل باستخدام نية الكتابة المحمية نفسها؛ ولن يؤدي ذلك إلى تسجيل خادم آخر.",
    pendingBootstrapNote:
      "تم حفظ التسجيل بالفعل. أعد فقط محاولة إعداد الوصول المُنشأ غير المكتمل؛ ولن يؤدي ذلك إلى تسجيل خادم آخر أو إعادة إرسال بيانات الاعتماد الأصلية.",
    diagnosticPassed:
      "نجح فحص الاتصال التشخيصي الاختياري. سيظل التسجيل ينفذ التحقق المرجعي.",
    back: "السابق",
    testing: "جارٍ الاختبار…",
    optionalTest: "اختبار اختياري",
    activating: "جارٍ تفعيل الخادم…",
    retryingSetup: "جارٍ إعادة محاولة الإعداد…",
    registering: "جارٍ تسجيل الخادم…",
    retrySetup: "إعادة محاولة الإعداد",
    retryActivation: "إعادة محاولة التفعيل",
    registerAndActivate: "تسجيل وتفعيل",
    registerServer: "تسجيل الخادم",
    validSecurityAdminRequired:
      "أدخل اسم مستخدم وكلمة مرور صالحين لمسؤول الأمان.",
    completeConnectionFields: "أكمل حقول اتصال الخادم والسعة.",
    connectionFailed: (message: string) => `فشل الاتصال: ${message}`,
    setupCompleteTitle: "اكتمل إعداد خادم قاعدة البيانات",
    setupCompleteBody:
      "تم تسجيل الخادم وتجهيز بيانات الوصول وتفعيله ضمن إجراء إعداد واحد.",
    activationNeedsAttention: (message: string) =>
      `تم حفظ التسجيل، لكن التفعيل يحتاج إلى مراجعة. صحّح العائق المُبلّغ عنه ثم أعد المحاولة من هنا. ${message}`,
    registeredActivationAttentionTitle: "تم التسجيل؛ والتفعيل يحتاج إلى مراجعة",
    registeredActivationAttentionBody: (message: string) =>
      `${message} يظل الخادم محفوظًا بأمان بحالة DRAFT.`,
    activationUnknown: (message: string) =>
      `تم حفظ التسجيل، لكن نتيجة التفعيل ما زالت غير معروفة. أعد محاولة نية الإعداد نفسها. ${message}`,
    savedDraftIncomplete:
      "ما زالت مسودة DRAFT المحفوظة غير مكتملة. أعد المحاولة فقط بعد إتاحة اعتماد قاعدة البيانات المُبلّغ عنه.",
    setupReadyTitle: "إعداد خادم قاعدة البيانات جاهز",
    setupReadyBody:
      "وصول قاعدة البيانات المُنشأ جاهز. يمكن لمستخدم مخوّل تفعيل مسودة DRAFT المحفوظة.",
    bootstrapRetryFailed: (message: string) =>
      `يظل الخادم محفوظًا ولم يُنشأ أي تكرار. ${message}`,
    registeredTitle: "تم تسجيل خادم قاعدة البيانات",
    registeredBody:
      "اكتمل التحقق المرجعي وتجهيز الوصول المُنشأ؛ ويظل الخادم بحالة DRAFT حتى يفعّله مستخدم مخوّل.",
    bootstrapNotReady:
      "تم حفظ التسجيل، لكن وصول قاعدة البيانات المُنشأ لم يصل إلى READY بعد. أعد محاولة الإعداد من هنا؛ ولن يُسجل الخادم مرة أخرى.",
    setupAttentionTitle: "تم تسجيل خادم قاعدة البيانات؛ والإعداد يحتاج إلى مراجعة",
    setupAttentionBody:
      "حُفظت مسودة DRAFT الدائمة. راجع جاهزيتها وأعد فقط محاولة إعداد الوصول المُنشأ غير المكتمل.",
  },
  en: {
    title: "Register Database Server",
    connectionStep: "1. Connection & Capacity",
    accessStep: "2. Admin Access & Register",
    correlationId: "Correlation ID",
    connectionChecksFailed: "Database connection checks failed",
    connectionChecksFailedDescription:
      "Correct the submitted values before registration, or run the optional diagnostic again.",
    securityAdminCheck: "Security admin",
    passed: "Passed",
    failed: "Failed",
    serverName: "Server Name",
    host: "Host",
    port: "Port",
    maxTenants: "Max Tenants Capacity",
    supportedEngine: "Supported engine",
    engineRequirement: "PostgreSQL major version 16 only",
    engineRestriction:
      "PostgreSQL 15 and 17+ are rejected because the current backup/restore client is pinned to major 16.",
    nextCredentials: "Next: Credentials",
    securityAdminCredentials: "Security Admin Credentials",
    credentialsDescription:
      "Used by Core only for restricted role administration. Application passwords are generated and encrypted server-side after the DRAFT server is created; they are never entered or downloaded here.",
    postureAriaLabel: "Required PostgreSQL security administrator posture",
    required: "Required",
    rejected: "Rejected",
    membershipRule:
      "No unexpected membership may provide effective INHERIT or SET access. ADMIN-only membership edges to roles generated by Core are expected.",
    usernameRule:
      "Username must be 1–63 lowercase letters, digits, or underscores, start with a lowercase letter or underscore, and must not start with",
    usernameRuleTitle:
      "Use 1–63 lowercase letters, digits, or underscores; start with a lowercase letter or underscore; do not start with pg_.",
    securityAdminUsername: "Security Admin Username",
    securityAdminPassword: "Security Admin Password",
    username: "Username",
    password: "Password",
    localSslNoteStart: "Local development may use SSL mode",
    localSslNoteEnd:
      "In production, Core rejects the check before opening a database connection unless SSL mode is",
    localSslNoteTail:
      "certificate verification is enabled, and an explicit CA certificate is provided.",
    generatedTitle: "Generated automatically after registration",
    applicationRoles: "Application roles",
    backupAccess: "backup access",
    manifestScopedAccess: "manifest-scoped access",
    readAllDataRule: "No pg_read_all_data grant is used.",
    generatedPasswordRule:
      "Generated passwords are never entered, revealed, downloaded, or stored by this browser.",
    diagnosticNote:
      "Connectivity testing is an optional diagnostic. Registration always repeats the connection, TLS, PostgreSQL version, and security-administrator posture checks authoritatively.",
    emptyCatalogueNote:
      "An empty Application catalogue is valid; its bootstrap phase completes as a READY no-op.",
    setupActionNote:
      "One setup action registers the DRAFT, performs the authoritative generated-access bootstrap, and activates the server when readiness is complete. A partial result remains inspectable and retryable without creating a second server.",
    pendingActivationNote:
      "Registration is already saved. Retry activation with the same protected write intent; this will not register another server.",
    pendingBootstrapNote:
      "Registration is already saved. Retry only the incomplete generated-access setup; this will not register another server or resend the original credentials.",
    diagnosticPassed:
      "Optional connectivity diagnostic passed. Register still performs the authoritative validation.",
    back: "Back",
    testing: "Testing…",
    optionalTest: "Test (Optional)",
    activating: "Activating server…",
    retryingSetup: "Retrying setup…",
    registering: "Registering server…",
    retrySetup: "Retry setup",
    retryActivation: "Retry activation",
    registerAndActivate: "Register and activate",
    registerServer: "Register Server",
    validSecurityAdminRequired:
      "Enter a valid security-administrator username and password.",
    completeConnectionFields:
      "Complete the server connection and capacity fields.",
    connectionFailed: (message: string) => `Connection failed: ${message}`,
    setupCompleteTitle: "Database Server setup complete",
    setupCompleteBody:
      "The server was registered, bootstrapped, and activated in one setup action.",
    activationNeedsAttention: (message: string) =>
      `Registration is saved, but activation needs attention. Retry here after correcting the reported blocker. ${message}`,
    registeredActivationAttentionTitle: "Registered; activation needs attention",
    registeredActivationAttentionBody: (message: string) =>
      `${message} The server remains safely available as DRAFT.`,
    activationUnknown: (message: string) =>
      `Registration was saved, but activation is still unknown. Retry the same setup intent. ${message}`,
    savedDraftIncomplete:
      "The saved DRAFT is still incomplete. Retry only after the reported database dependency is available.",
    setupReadyTitle: "Database Server setup ready",
    setupReadyBody:
      "Generated database access is ready. An authorized actor can activate the saved DRAFT.",
    bootstrapRetryFailed: (message: string) =>
      `The server remains saved and no duplicate was created. ${message}`,
    registeredTitle: "Database Server registered",
    registeredBody:
      "Authoritative validation and generated-access bootstrap completed; the server remains DRAFT until an authorized actor activates it.",
    bootstrapNotReady:
      "Registration is saved, but generated database access is not READY yet. Retry setup here; the server will not be registered again.",
    setupAttentionTitle: "Database Server registered; setup needs attention",
    setupAttentionBody:
      "The durable DRAFT was saved. Review its readiness and retry only the incomplete generated-access setup.",
  },
} as const;

const ARABIC_SSL_ERRORS: Record<string, string> = {
  "Certificate files cannot be sent when SSL mode is disabled.":
    "لا يمكن إرسال ملفات الشهادات عندما يكون وضع SSL معطلًا.",
  "A CA certificate is required for verify-ca and verify-full modes.":
    "شهادة CA مطلوبة في وضعي verify-ca وverify-full.",
  "The client certificate and private key must be uploaded together.":
    "يجب رفع شهادة العميل والمفتاح الخاص معًا.",
  "A private-key passphrase requires an uploaded private key.":
    "تتطلب عبارة مرور المفتاح الخاص رفع مفتاح خاص.",
  "CA certificate exceeds the 20,000 character API limit.":
    "تتجاوز شهادة CA حد واجهة API البالغ 20,000 حرف.",
  "Client certificate exceeds the 20,000 character API limit.":
    "تتجاوز شهادة العميل حد واجهة API البالغ 20,000 حرف.",
  "Private key exceeds the 20,000 character API limit.":
    "يتجاوز المفتاح الخاص حد واجهة API البالغ 20,000 حرف.",
  "Private-key passphrase exceeds the 1,024 character API limit.":
    "تتجاوز عبارة مرور المفتاح الخاص حد واجهة API البالغ 1,024 حرفًا.",
};

function localizeSslValidationError(error: string, language: "ar" | "en") {
  return language === "ar" ? (ARABIC_SSL_ERRORS[error] ?? error) : error;
}

interface DatabaseServerWizardError {
  message: string;
  errorCode?: string;
  correlationId?: string;
}

function normalizedWizardError(error: unknown): DatabaseServerWizardError {
  const normalized = normalizeApiError(error);
  return {
    message: normalized.message,
    errorCode: normalized.errorCode,
    ...(normalized.correlationId
      ? { correlationId: normalized.correlationId }
      : {}),
  };
}

export function CreateDatabaseServerWizard({
  activateAfterRegistration = false,
  canReadDetails = true,
  canRetrySetup = false,
}: {
  activateAfterRegistration?: boolean;
  canReadDetails?: boolean;
  canRetrySetup?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const { lang, dir } = useI18n();
  const copy = DATABASE_SERVER_REGISTRATION_COPY[lang];
  const {
    createServer,
    checkConnectivity,
    activateServer,
    retryBootstrap,
  } = useDatabaseServerRegistration();
  const [step, setStep] = useState(1);
  const [pendingAction, setPendingAction] = useState<
    "diagnostic" | "create" | "bootstrap" | "activate" | null
  >(null);
  const [wizardError, setWizardError] =
    useState<DatabaseServerWizardError | null>(null);
  const [connectivityResult, setConnectivityResult] =
    useState<DatabaseServerConnectivityResult | null>(null);
  const [pendingActivationId, setPendingActivationId] = useState<string | null>(
    null,
  );
  const [pendingBootstrapId, setPendingBootstrapId] = useState<string | null>(
    null,
  );
  const [sslInputRevision, setSslInputRevision] = useState(0);
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState<CreateDatabaseServerDto>(
    createDatabaseServerInitialValues,
  );
  const updateFormData = (next: SetStateAction<CreateDatabaseServerDto>) => {
    setConnectivityResult(null);
    setFormData(next);
  };
  const connectionStepIsValid = isDatabaseServerConnectionStepValid(formData);
  const securityAdminStepIsValid = isDatabaseSecurityAdminStepValid(
    formData.securityAdminCredentials,
  );

  useEffect(() => {
    if (wizardError) errorSummaryRef.current?.focus();
  }, [wizardError]);

  const openRegisteredServer = (databaseServerId: string) => {
    router.push(
      canReadDetails ? `/database-servers/${databaseServerId}` : "/dashboard",
    );
  };

  const activateRegisteredServer = async (databaseServerId: string) => {
    setPendingAction("activate");
    setWizardError(null);
    try {
      await activateServer(databaseServerId);
      setPendingActivationId(null);
      toast.success(copy.setupCompleteTitle, copy.setupCompleteBody);
      openRegisteredServer(databaseServerId);
    } catch (error) {
      const normalized = normalizeApiError(error);
      const definitiveFailure = shouldResetDatabaseServerWriteKey(normalized);
      if (definitiveFailure) {
        if (!canReadDetails) {
          setPendingActivationId(databaseServerId);
          const view = normalizedWizardError(normalized);
          setWizardError({
            ...view,
            message: copy.activationNeedsAttention(view.message),
          });
          return;
        }
        setPendingActivationId(null);
        toast.warning(
          copy.registeredActivationAttentionTitle,
          copy.registeredActivationAttentionBody(normalized.message),
        );
        openRegisteredServer(databaseServerId);
        return;
      }
      const view = normalizedWizardError(normalized);
      setWizardError({
        ...view,
        message: copy.activationUnknown(view.message),
      });
    } finally {
      setPendingAction(null);
    }
  };

  const retryRegisteredServerBootstrap = async (databaseServerId: string) => {
    setPendingAction("bootstrap");
    setWizardError(null);
    try {
      const server = await retryBootstrap(databaseServerId);
      if (server.credentialBootstrap.status !== "READY") {
        setWizardError({
          message: copy.savedDraftIncomplete,
        });
        return;
      }
      setPendingBootstrapId(null);
      if (activateAfterRegistration) {
        setPendingActivationId(server.id);
        await activateRegisteredServer(server.id);
        return;
      }
      toast.success(copy.setupReadyTitle, copy.setupReadyBody);
      openRegisteredServer(server.id);
    } catch (error) {
      const view = normalizedWizardError(error);
      setWizardError({
        ...view,
        message: copy.bootstrapRetryFailed(view.message),
      });
    } finally {
      setPendingAction(null);
    }
  };

  const handleConnectivityCheck = async () => {
    if (!securityAdminStepIsValid) {
      setWizardError({
        message: copy.validSecurityAdminRequired,
      });
      return;
    }
    const sslMode = formData.sslMode ?? "disable";
    const sslErrors = validateDatabaseSslConfig({
      mode: sslMode,
      config: formData.sslConfig,
    });
    if (sslErrors.length > 0) {
      setWizardError({
        message: localizeSslValidationError(sslErrors[0], lang),
      });
      return;
    }

    setPendingAction("diagnostic");
    setWizardError(null);
    setConnectivityResult(null);
    try {
      const sslConfig = compactDatabaseSslConfig(formData.sslConfig);
      const payload: CheckDatabaseServerConnectivityDto = {
        host: formData.host,
        port: formData.port,
        securityAdminCredentials: formData.securityAdminCredentials,
        sslMode: formData.sslMode,
        sslRejectUnauthorized: formData.sslRejectUnauthorized,
        ...(sslConfig ? { sslConfig } : {}),
        maintenanceDatabase: formData.maintenanceDatabase,
      };
      const res = await checkConnectivity(payload);
      setConnectivityResult(res);
      if (!res.connected) {
        if (!res.checks?.length) {
          setWizardError({ message: copy.connectionFailed(res.message) });
        }
      }
    } catch (error) {
      setWizardError(normalizedWizardError(error));
    } finally {
      setPendingAction(null);
    }
  };

  const handleCreateDraft = async () => {
    if (pendingBootstrapId) {
      await retryRegisteredServerBootstrap(pendingBootstrapId);
      return;
    }
    if (pendingActivationId) {
      await activateRegisteredServer(pendingActivationId);
      return;
    }
    if (!connectionStepIsValid) {
      setWizardError({ message: copy.completeConnectionFields });
      setStep(1);
      return;
    }
    if (!securityAdminStepIsValid) {
      setWizardError({
        message: copy.validSecurityAdminRequired,
      });
      setStep(2);
      return;
    }
    const sslMode = formData.sslMode ?? "disable";
    const sslErrors = validateDatabaseSslConfig({
      mode: sslMode,
      config: formData.sslConfig,
    });
    if (sslErrors.length > 0) {
      setWizardError({
        message: localizeSslValidationError(sslErrors[0], lang),
      });
      setStep(2);
      return;
    }

    setPendingAction("create");
    setWizardError(null);
    try {
      const { sslConfig: draftSslConfig, ...basePayload } = formData;
      const sslConfig = compactDatabaseSslConfig(draftSslConfig);
      const payload: CreateDatabaseServerDto = {
        ...basePayload,
        ...(sslConfig ? { sslConfig } : {}),
      };
      const server = await createServer(payload);
      setFormData((current) => ({
        ...current,
        securityAdminCredentials: { username: "", password: "" },
        sslConfig: undefined,
      }));
      setSslInputRevision((current) => current + 1);
      if (
        activateAfterRegistration &&
        server.credentialBootstrap.status === "READY"
      ) {
        setPendingActivationId(server.id);
        await activateRegisteredServer(server.id);
        return;
      }
      if (server.credentialBootstrap.status === "READY") {
        toast.success(copy.registeredTitle, copy.registeredBody);
      } else {
        if (!canReadDetails && canRetrySetup) {
          setPendingBootstrapId(server.id);
          setWizardError({
            message: copy.bootstrapNotReady,
          });
          return;
        }
        toast.warning(copy.setupAttentionTitle, copy.setupAttentionBody);
      }
      openRegisteredServer(server.id);
    } catch (error) {
      setWizardError(normalizedWizardError(error));
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <Card
      dir={dir}
      className="mx-auto mt-6 max-w-3xl p-4 sm:p-6"
    >
      <h2 className="text-xl font-semibold mb-6">{copy.title}</h2>

      {/* Basic Wizard Progress */}
      <ol aria-label={lang === "ar" ? "خطوات تسجيل خادم قاعدة البيانات" : "Database server registration steps"} className="mb-8 grid grid-cols-2 gap-2 text-sm">
        <li
          aria-current={step === 1 ? "step" : undefined}
          className={`border-b-2 pb-2 ${step === 1 ? "border-primary font-semibold text-foreground" : "border-border text-muted-foreground"}`}
        >
          {copy.connectionStep}
        </li>
        <li
          aria-current={step === 2 ? "step" : undefined}
          className={`border-b-2 pb-2 ${step === 2 ? "border-primary font-semibold text-foreground" : "border-border text-muted-foreground"}`}
        >
          {copy.accessStep}
        </li>
      </ol>

      {wizardError && (
        <div
          ref={errorSummaryRef}
          role="alert"
          tabIndex={-1}
          className="mb-4 rounded-lg border border-destructive/30 bg-destructive-subtle p-3 text-sm text-destructive-subtle-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <p>{wizardError.message}</p>
          {(wizardError.errorCode || wizardError.correlationId) && (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs">
              {wizardError.errorCode && <CodeRef value={wizardError.errorCode} />}
              {wizardError.correlationId && (
                <span className="flex flex-wrap items-center gap-1.5">
                  <span>{`${copy.correlationId}: `}</span>
                  <CodeRef value={wizardError.correlationId} />
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {connectivityResult && !connectivityResult.connected && (
        <section
          role="alert"
          aria-labelledby="database-connectivity-failure-title"
          className="mb-4 overflow-hidden rounded-lg border border-destructive/30 bg-destructive-subtle text-destructive-subtle-foreground"
        >
          <div className="border-b border-destructive/30 px-4 py-3">
            <h3
              id="database-connectivity-failure-title"
              className="text-sm font-semibold"
            >
              {copy.connectionChecksFailed}
            </h3>
            <p className="mt-1 text-xs">
              {copy.connectionChecksFailedDescription}
            </p>
          </div>
          <ul className="divide-y divide-destructive/20">
            {connectivityResult.checks?.map((check) => (
              <li
                key={check.principal}
                className="flex items-start justify-between gap-4 px-4 py-3 text-xs"
              >
                <div>
                  <p className="font-semibold text-foreground">
                    {copy.securityAdminCheck}
                  </p>
                  <p
                    className={`mt-1 break-words ${check.connected ? "text-success-subtle-foreground" : "text-destructive-subtle-foreground"}`}
                  >
                    {check.message}
                  </p>
                </div>
                <Badge tone={check.connected ? "success" : "danger"} className="shrink-0">
                  {check.connected ? copy.passed : copy.failed}
                </Badge>
              </li>
            ))}
          </ul>
        </section>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <Field id="create-database-server-name" label={copy.serverName} required>
            {(fieldProps) => (
              <Input
                {...fieldProps}
                dir="ltr"
                minLength={DATABASE_SERVER_CREATE_CONSTRAINTS.name.minLength}
                maxLength={DATABASE_SERVER_CREATE_CONSTRAINTS.name.maxLength}
                value={formData.name}
                onChange={(event) => updateFormData({ ...formData, name: event.target.value })}
              />
            )}
          </Field>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem]">
            <Field id="create-database-server-host" label={copy.host} required>
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  dir="ltr"
                  minLength={DATABASE_SERVER_CREATE_CONSTRAINTS.host.minLength}
                  maxLength={DATABASE_SERVER_CREATE_CONSTRAINTS.host.maxLength}
                  value={formData.host}
                  onChange={(event) => updateFormData({ ...formData, host: event.target.value })}
                />
              )}
            </Field>
            <Field id="create-database-server-port" label={copy.port} required>
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  dir="ltr"
                  type="number"
                  min={DATABASE_SERVER_CREATE_CONSTRAINTS.port.min}
                  max={DATABASE_SERVER_CREATE_CONSTRAINTS.port.max}
                  step={1}
                  value={formData.port}
                  onChange={(event) => updateFormData({ ...formData, port: Number(event.target.value) })}
                />
              )}
            </Field>
          </div>
          <Field id="create-database-server-max-tenants" label={copy.maxTenants} required>
            {(fieldProps) => (
              <Input
                {...fieldProps}
                dir="ltr"
                type="number"
                min={DATABASE_SERVER_CREATE_CONSTRAINTS.maxTenants.min}
                max={DATABASE_SERVER_CREATE_CONSTRAINTS.maxTenants.max}
                step={1}
                value={formData.maxTenants}
                onChange={(event) => updateFormData({ ...formData, maxTenants: Number(event.target.value) })}
              />
            )}
          </Field>
          <div
            role="note"
            className="rounded-lg border border-info/30 bg-info-subtle px-3 py-3 text-xs leading-5 text-info-subtle-foreground"
          >
            {copy.supportedEngine}: <strong>{copy.engineRequirement}</strong>.{" "}
            {copy.engineRestriction}
          </div>
          <Button
            type="button"
            variant="primary"
            onClick={() => setStep(2)}
            disabled={!connectionStepIsValid}
            className="mt-6 w-full"
          >
            {copy.nextCredentials}
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          {/* Security Admin Credentials */}
          <div className="rounded-lg border border-border p-4">
            <h3 className="font-semibold mb-3 text-sm">
              {copy.securityAdminCredentials}
            </h3>
            <p className="mb-3 text-xs leading-5 text-muted-foreground">
              {copy.credentialsDescription}
            </p>
            <div
              role="note"
              aria-label={copy.postureAriaLabel}
              className="mb-4 rounded-lg border border-border bg-muted px-3 py-3 text-xs leading-5 text-foreground"
            >
              <p>
                {copy.required}:{" "}
                <strong>
                  {DATABASE_SECURITY_ADMIN_POSTURE.requiredAttributes.join(
                    " + ",
                  )}
                </strong>
                . {copy.rejected}:{" "}
                <strong>
                  {DATABASE_SECURITY_ADMIN_POSTURE.rejectedAttributes.join(
                    " / ",
                  )}
                </strong>
                .
              </p>
              <p className="mt-1">{copy.membershipRule}</p>
            </div>
            <p className="mb-3 text-xs leading-5 text-muted-foreground">
              {copy.usernameRule} <code>pg_</code>.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="create-database-server-security-admin-username" label={copy.securityAdminUsername} hint={copy.usernameRuleTitle} required>
                {(fieldProps) => (
                  <Input
                    {...fieldProps}
                    dir="ltr"
                    disabled={pendingActivationId !== null || pendingBootstrapId !== null}
                    minLength={DATABASE_SERVER_CREATE_CONSTRAINTS.securityAdminUsername.minLength}
                    maxLength={DATABASE_SERVER_CREATE_CONSTRAINTS.securityAdminUsername.maxLength}
                    pattern={DATABASE_SECURITY_ADMIN_USERNAME_PATTERN.source}
                    autoCapitalize="none"
                    spellCheck={false}
                    autoComplete="off"
                    placeholder={copy.username}
                    value={formData.securityAdminCredentials.username}
                    onChange={(event) => updateFormData({
                      ...formData,
                      securityAdminCredentials: { ...formData.securityAdminCredentials, username: event.target.value },
                    })}
                  />
                )}
              </Field>
              <Field id="create-database-server-security-admin-password" label={copy.securityAdminPassword} required>
                {(fieldProps) => (
                  <Input
                    {...fieldProps}
                    dir="ltr"
                    disabled={pendingActivationId !== null || pendingBootstrapId !== null}
                    minLength={DATABASE_SERVER_CREATE_CONSTRAINTS.securityAdminPassword.minLength}
                    maxLength={DATABASE_SERVER_CREATE_CONSTRAINTS.securityAdminPassword.maxLength}
                    autoComplete="new-password"
                    type="password"
                    placeholder={copy.password}
                    value={formData.securityAdminCredentials.password}
                    onChange={(event) => updateFormData({
                      ...formData,
                      securityAdminCredentials: { ...formData.securityAdminCredentials, password: event.target.value },
                    })}
                  />
                )}
              </Field>
            </div>
          </div>

          <DatabaseSslConfigurationFields
            key={sslInputRevision}
            idPrefix="create-database-server-ssl"
            mode={(formData.sslMode ?? "disable") as DatabaseServerSslMode}
            rejectUnauthorized={formData.sslRejectUnauthorized ?? true}
            config={formData.sslConfig ?? {}}
            onModeChange={(sslMode) =>
              updateFormData((current) => ({
                ...current,
                sslMode,
                ...(sslMode === "disable" ? { sslConfig: undefined } : {}),
              }))
            }
            onRejectUnauthorizedChange={(sslRejectUnauthorized) =>
              updateFormData((current) => ({
                ...current,
                sslRejectUnauthorized,
              }))
            }
            onConfigChange={(sslConfig) =>
              updateFormData((current) => ({ ...current, sslConfig }))
            }
            disabled={
              pendingAction !== null ||
              pendingActivationId !== null ||
              pendingBootstrapId !== null
            }
          />

          <p className="rounded-lg border border-warning/30 bg-warning-subtle px-3 py-2 text-xs leading-5 text-warning-subtle-foreground">
            {copy.localSslNoteStart} <strong>disable</strong>.{" "}
            {copy.localSslNoteEnd} <strong>verify-full</strong>,{" "}
            {copy.localSslNoteTail}
          </p>

          <div className="rounded-lg border border-info/30 bg-info-subtle p-4 text-xs text-info-subtle-foreground">
            <p className="font-semibold">{copy.generatedTitle}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {DATABASE_SECURITY_ADMIN_POSTURE.generatedPrincipals.map((item) => (
                <div key={item.principal} className="rounded-lg bg-card/80 px-3 py-2">
                  <p className="font-mono font-semibold">
                    {item.principal === "Application roles"
                      ? copy.applicationRoles
                      : item.principal}
                  </p>
                  <p className="mt-1 text-xs opacity-75">
                    {item.principal === "mutakamel_backup"
                      ? copy.backupAccess
                      : item.principal === "Application roles"
                        ? copy.manifestScopedAccess
                        : item.capability}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-3 leading-5">
              {copy.readAllDataRule} {copy.generatedPasswordRule}
            </p>
          </div>

          <p role="note" className="rounded-lg border border-info/30 bg-info-subtle px-3 py-2 text-xs leading-5 text-info-subtle-foreground">
            {copy.diagnosticNote}
          </p>

          <p role="note" className="rounded-lg border border-info/30 bg-info-subtle px-3 py-2 text-xs leading-5 text-info-subtle-foreground">
            {copy.emptyCatalogueNote}
          </p>

          {activateAfterRegistration && (
            <p role="note" className="rounded-lg border border-info/30 bg-info-subtle px-3 py-2 text-xs leading-5 text-info-subtle-foreground">
              {copy.setupActionNote}
            </p>
          )}

          {pendingActivationId && (
            <p role="status" className="rounded-lg border border-warning/30 bg-warning-subtle px-3 py-2 text-xs font-semibold leading-5 text-warning-subtle-foreground">
              {copy.pendingActivationNote}
            </p>
          )}

          {pendingBootstrapId && (
            <p role="status" className="rounded-lg border border-warning/30 bg-warning-subtle px-3 py-2 text-xs font-semibold leading-5 text-warning-subtle-foreground">
              {copy.pendingBootstrapNote}
            </p>
          )}

          {connectivityResult?.connected && (
            <p role="status" className="rounded-lg border border-success/30 bg-success-subtle px-3 py-2 text-xs font-semibold text-success-subtle-foreground">
              {copy.diagnosticPassed}
            </p>
          )}

          <div className="grid gap-3 mt-6 sm:grid-cols-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep(1)}
              disabled={
                pendingAction !== null ||
                pendingActivationId !== null ||
                pendingBootstrapId !== null
              }
            >
              {copy.back}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleConnectivityCheck}
              disabled={
                pendingAction !== null ||
                pendingActivationId !== null ||
                pendingBootstrapId !== null ||
                !securityAdminStepIsValid
              }
              loading={pendingAction === "diagnostic"}
            >
              {pendingAction === "diagnostic"
                ? copy.testing
                : copy.optionalTest}
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleCreateDraft}
              disabled={
                pendingAction !== null ||
                (pendingActivationId === null &&
                  pendingBootstrapId === null &&
                  !securityAdminStepIsValid)
              }
              loading={pendingAction === "create" || pendingAction === "bootstrap" || pendingAction === "activate"}
            >
              {pendingAction === "activate"
                ? copy.activating
                : pendingAction === "bootstrap"
                  ? copy.retryingSetup
                  : pendingAction === "create"
                    ? copy.registering
                    : pendingBootstrapId
                      ? copy.retrySetup
                      : pendingActivationId
                        ? copy.retryActivation
                        : activateAfterRegistration
                          ? copy.registerAndActivate
                          : copy.registerServer}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
