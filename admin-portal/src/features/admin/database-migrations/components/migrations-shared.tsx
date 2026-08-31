"use client";

import type { ReactNode } from "react";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  CircleDot,
  Clock,
  DatabaseZap,
  FileWarning,
  Loader2,
  LifeBuoy,
  OctagonX,
  PauseCircle,
  RefreshCw,
  ShieldAlert,
  Target,
  XCircle,
} from "lucide-react";
import {
  readPreconditionCode,
  type MigrationPreconditionCode,
} from "../model/migration-errors";
import {
  describeRunStatus,
  describeSchemaState,
  describeTenantOutcome,
  readRunProgressPct,
  type MigrationGlyph,
} from "../model/migration-outcomes";
import type {
  MigrationMutationState,
  MigrationRun,
  MigrationRunStatus,
  MigrationTenantOutcome,
  MigrationTone,
  TenantSchemaVersionState,
} from "../types/database-migrations";

export const MIGRATIONS_COPY = {
  en: {
    title: "Database migrations",
    subtitle:
      "Fleet schema state per application, and the controls to migrate one tenant or the whole fleet.",
    back: "Back to database migrations",
    loading: "Loading fleet migration state…",
    forbidden: "You do not have permission to read database migrations.",
    readPermission: "Required permission: admin.migrations.read",
    unavailable: "The migration surface is currently unavailable.",
    notFound: "This migration run no longer exists or is inaccessible.",
    error: "Migration state could not be loaded.",
    retry: "Retry",
    refresh: "Refresh",
    open: "Open",
    close: "Close",
    cancel: "Cancel",
    correlation: "Correlation ID",
    none: "—",

    readOnlyTitle: "This surface is read-only for you",
    readOnlyBody:
      "Mutating controls are hidden because you do not hold the permissions they require. Hiding a control is presentation only — authorization is enforced by the Gateway and Worker on every request.",
    missingPermissions: "Missing permissions",

    fleetTitle: "Fleet status",
    fleetHelp:
      "Read from the control-plane schema-version projection. The projection selects candidates; each tenant's own migration history stays the authority.",
    application: "Application",
    availableVersion: "Available version",
    tenantsTotal: "Tenants",
    behind: "Behind",
    activeRun: "Active run",
    noFleet: "No projection rows exist for any application yet.",

    stateUpToDate: "Up to date",
    statePending: "Pending",
    stateRunning: "Running",
    stateFailed: "Failed",
    stateBlocked: "Blocked",
    stateRestoreIncomplete: "Restore incomplete",
    stateDrifted: "Drifted",

    alarmTitle: "Databases in an unexplained state",
    alarmBody:
      "A drifted or restore-incomplete database is excluded from fleet runs until it is resolved. Remediate with a corrective migration, a restore, or by recording the difference as expected.",
    alarmDrifted: "drifted",
    alarmRestoreIncomplete: "restore incomplete",
    alarmReview: "Review affected tenants",
    fragmentedTitle: "Fragmented fleet",
    fragmentedBody:
      "More than one schema version is live for this application. A healthy fleet has one dominant entry.",
    distribution: "Version distribution",
    schemaVersion: "Schema version",
    tenantCount: "Tenants",

    projectionDegradedTitle: "Fleet projection unavailable",
    projectionDegradedBody:
      "The schema-version projection could not be read, so fleet counts and per-tenant versions are hidden. The projection is a cache: run history and run controls below are unaffected.",

    tenantsTitle: "Tenants",
    tenantsHelp: "Per-tenant schema state, newest observation first.",
    tenant: "Tenant",
    state: "State",
    version: "Version",
    observedAt: "Observed",
    lastRun: "Last run",
    driftDetail: "Difference",
    noTenants: "No tenant matches the current filters.",
    filterState: "State",
    allStates: "All states",
    filterApplication: "Application",
    allApplications: "All applications",
    migrateTenant: "Migrate this tenant",

    runsTitle: "Migration runs",
    runsHelp:
      "A single-tenant migration is a fleet run carrying a tenant filter, not a separate path.",
    run: "Run",
    status: "Status",
    mode: "Mode",
    targetVersion: "Target version",
    progress: "Progress",
    startedAt: "Started",
    finishedAt: "Finished",
    triggeredBy: "Triggered by",
    noRuns: "No migration run has been recorded.",
    dryRun: "Dry run",
    apply: "Apply",
    scopeFleet: "Whole fleet",
    scopeSingle: "Single tenant",
    scopeTenantCount: (count: number) => `${count} tenant filter`,

    runStatusPending: "Queued",
    runStatusRunning: "Running",
    runStatusPaused: "Paused",
    runStatusCompleted: "Completed",
    runStatusCompletedWithErrors: "Completed with errors",
    runStatusFailed: "Failed",
    runStatusAborted: "Aborted",

    startRun: "Run a migration",
    startTitle: "Run a migration",
    startHelp:
      "Both paths use the same engine. Choose how the run executes before choosing what it touches.",
    modeLegend: "How should this run execute?",
    dryRunName: "Dry run",
    dryRunHelp:
      "Executes the full selection and safety path and reports what each tenant would receive. No schema is changed.",
    applyName: "Apply for real",
    applyHelp:
      "Writes to tenant databases. Every outcome is recorded per tenant and audited.",
    scopeLegend: "Which databases should it touch?",
    scopeFleetHelp:
      "Every eligible tenant for this application. Ineligible tenants are recorded as skipped with a reason, never silently omitted.",
    scopeSingleHelp:
      "One tenant, run through the identical fleet engine with a tenant filter.",
    tenantIdLabel: "Tenant ID",
    tenantIdHelp: "The tenant this run is filtered to.",
    applicationLabel: "Application",
    targetVersionLabel: "Target version",
    targetVersionHelp: "The migration name the fleet should reach.",
    batchSizeLabel: "Batch size",
    strategyLabel: "Strategy",
    failFastLabel: "Stop the whole run on the first failure",
    failFastHelp:
      "Leave this off to let the canary policy halt the run at a stage boundary instead.",
    canaryTitle: "Progressive rollout",
    canaryHelp:
      "Batches escalate 1 → 10 → 100 → remainder. Any failure in stage one, or over 5% in a later stage, pauses the run for inspection instead of failing it.",
    triggeredByLabel: "Audit reason",
    triggeredByHelp:
      "Recorded with the run. State why this migration is being run now.",
    start: "Start run",
    starting: "Starting…",
    startDryRun: "Start dry run",
    startApply: "Start real run",

    confirmFleetTitle: "Apply to every eligible tenant",
    confirmFleetBody: (application: string, tenants: string) =>
      `This writes schema changes to every eligible tenant database of the "${application}" application${tenants}. Type the application key to confirm.`,
    confirmFleetUnknownCount: "",
    confirmFleetCount: (count: number) =>
      ` — ${count} tenants are currently behind`,
    confirmSingleTitle: "Apply to one tenant",
    confirmSingleBody: (tenant: string, application: string) =>
      `This writes schema changes to the "${application}" database of tenant ${tenant}. Type the tenant ID to confirm.`,

    detailTitle: "Run detail",
    controlsTitle: "Run control",
    pause: "Pause",
    resume: "Resume",
    abort: "Abort",
    retryFailed: "Retry failed tenants",
    retryFailedHelp:
      "Starts a new run filtered to the tenants that failed in this one.",
    controlReasonLabel: "Audit reason",
    controlReasonHelp: "Recorded against the run. Required for every control.",
    confirmAbortTitle: "Abort this run",
    confirmAbortBody: (run: string, tenants: string) =>
      `Aborting stops run ${run} at the next batch boundary${tenants}. Tenants already migrated are not rolled back. Type the run ID to confirm.`,
    confirmAbortTenants: (queued: number, inFlight: number) =>
      `, leaving ${queued} queued and ${inFlight} in-flight tenants unmigrated`,

    outcomesTitle: "Per-tenant outcomes",
    outcomesHelp:
      "Every tenant the run enrolled, including the ones it was not allowed to touch.",
    groupAtTarget: "At the target version",
    groupInFlight: "Still to come",
    groupNeedsAttention: "Needs attention",
    outcomePending: "Queued",
    outcomeRunning: "Running",
    outcomeApplied: "Applied",
    outcomeFailed: "Failed",
    outcomeSkipped: "Skipped — ineligible",
    outcomeSkippedUpToDate: "Already at target",
    outcomePendingHelp: "Enrolled and waiting for its batch.",
    outcomeRunningHelp: "Migrating now.",
    outcomeAppliedHelp: "Migrations were applied to this database.",
    outcomeFailedHelp: "The migration did not complete on this database.",
    outcomeSkippedHelp:
      "The run was not allowed to touch this database. It is still behind.",
    outcomeSkippedUpToDateHelp:
      "Reached and found already carrying the target version. Nothing to apply.",
    skipReasonLabel: "Reason",
    skipReasonMissing:
      "No reason was recorded. A skipped tenant without a reason is a contract defect — report it rather than treating it as migrated.",
    filterOutcome: "Outcome",
    allOutcomes: "All outcomes",
    noOutcomes: "No tenant outcome matches the current filter.",
    migration: "Migration",
    appliedCount: "Applied",
    duration: "Duration",
    errorCode: "Error",
    outcomesUnavailable: "Per-tenant outcomes are unavailable",
    outcomesUnavailableBody:
      "The run's rolled-up counters are shown below. Individual tenant rows could not be read.",

    commandSucceeded: "The migration command succeeded.",
    commandForbidden: "Your permissions do not authorize this command.",
    commandConflict:
      "Another run is already active for this application, or the run changed state first.",
    commandPrecondition:
      "A precondition was not met, so the run was refused before it started.",
    commandUnavailable:
      "The command outcome is unknown. Check the run history before retrying — this request is not replayed automatically.",
    commandError: "The migration command failed.",
    preconditionRunActive: "Another run is active for this application.",
    preconditionUntested: "A migration in scope has no valid test record.",
    preconditionBlocked:
      "A migration in scope is blocked. Unblock it explicitly first.",
    preconditionLint: "A migration in scope failed the safety linter.",
    preconditionBackup:
      "A pre-migration backup is missing for a forward-only migration.",
    preconditionWindow:
      "The maintenance window is closed for this application.",
    preconditionClaim:
      "Another structural operation holds a claim on a tenant in scope.",
    preconditionIneligible: "A tenant in scope is not eligible for migration.",

    validationApplication: "Choose an application.",
    validationVersion: "Enter the target migration name.",
    validationTenant: "Enter the tenant ID this run is filtered to.",
    validationReason: "Enter an audit reason of at least 3 characters.",
    validationBatch: "Enter a batch size from 1 to 500.",
  },
  ar: {
    title: "ترحيلات قواعد البيانات",
    subtitle:
      "حالة مخطط الأسطول لكل تطبيق، وأدوات ترحيل مستأجر واحد أو الأسطول بالكامل.",
    back: "العودة إلى ترحيلات قواعد البيانات",
    loading: "جارٍ تحميل حالة ترحيل الأسطول…",
    forbidden: "لا تملك صلاحية قراءة ترحيلات قواعد البيانات.",
    readPermission: "الصلاحية المطلوبة: admin.migrations.read",
    unavailable: "واجهة الترحيل غير متاحة حاليًا.",
    notFound: "عملية الترحيل غير موجودة أو لا يمكن الوصول إليها.",
    error: "تعذر تحميل حالة الترحيل.",
    retry: "إعادة المحاولة",
    refresh: "تحديث",
    open: "فتح",
    close: "إغلاق",
    cancel: "إلغاء",
    correlation: "معرّف التتبع",
    none: "—",

    readOnlyTitle: "هذه الواجهة للقراءة فقط بالنسبة لك",
    readOnlyBody:
      "أدوات التنفيذ مخفية لأنك لا تملك الصلاحيات المطلوبة. الإخفاء عرض فقط، والتفويض يُفرض من البوابة وWorker في كل طلب.",
    missingPermissions: "الصلاحيات الناقصة",

    fleetTitle: "حالة الأسطول",
    fleetHelp:
      "تُقرأ من إسقاط نسخ المخطط في مستوى التحكم. يستخدم الإسقاط لاختيار المرشحين فقط، ويبقى سجل ترحيل كل مستأجر هو المرجع.",
    application: "التطبيق",
    availableVersion: "النسخة المتاحة",
    tenantsTotal: "المستأجرون",
    behind: "متأخرون",
    activeRun: "عملية نشطة",
    noFleet: "لا توجد صفوف إسقاط لأي تطبيق بعد.",

    stateUpToDate: "محدَّث",
    statePending: "قيد الانتظار",
    stateRunning: "قيد التنفيذ",
    stateFailed: "فشل",
    stateBlocked: "محظور",
    stateRestoreIncomplete: "استعادة غير مكتملة",
    stateDrifted: "انحراف",

    alarmTitle: "قواعد بيانات في حالة غير مُفسَّرة",
    alarmBody:
      "قاعدة البيانات المنحرفة أو ذات الاستعادة غير المكتملة مستبعدة من عمليات الأسطول حتى تُعالج. عالجها بترحيل تصحيحي أو استعادة أو بتسجيل الفرق كمتوقع.",
    alarmDrifted: "منحرفة",
    alarmRestoreIncomplete: "استعادة غير مكتملة",
    alarmReview: "مراجعة المستأجرين المتأثرين",
    fragmentedTitle: "أسطول مجزأ",
    fragmentedBody:
      "أكثر من نسخة مخطط واحدة نشطة لهذا التطبيق. الأسطول السليم يملك نسخة مهيمنة واحدة.",
    distribution: "توزيع النسخ",
    schemaVersion: "نسخة المخطط",
    tenantCount: "المستأجرون",

    projectionDegradedTitle: "إسقاط الأسطول غير متاح",
    projectionDegradedBody:
      "تعذرت قراءة إسقاط نسخ المخطط، لذا أُخفيت أعداد الأسطول ونسخ المستأجرين. الإسقاط ذاكرة مؤقتة: سجل العمليات وأدوات التحكم أدناه غير متأثرة.",

    tenantsTitle: "المستأجرون",
    tenantsHelp: "حالة مخطط كل مستأجر، الأحدث ملاحظةً أولًا.",
    tenant: "المستأجر",
    state: "الحالة",
    version: "النسخة",
    observedAt: "آخر رصد",
    lastRun: "آخر عملية",
    driftDetail: "الفرق",
    noTenants: "لا يوجد مستأجر مطابق للفلاتر الحالية.",
    filterState: "الحالة",
    allStates: "كل الحالات",
    filterApplication: "التطبيق",
    allApplications: "كل التطبيقات",
    migrateTenant: "ترحيل هذا المستأجر",

    runsTitle: "عمليات الترحيل",
    runsHelp:
      "ترحيل مستأجر واحد هو عملية أسطول تحمل فلتر مستأجر، وليس مسارًا منفصلًا.",
    run: "العملية",
    status: "الحالة",
    mode: "النمط",
    targetVersion: "النسخة الهدف",
    progress: "التقدم",
    startedAt: "البداية",
    finishedAt: "النهاية",
    triggeredBy: "بأمر من",
    noRuns: "لم تُسجل أي عملية ترحيل.",
    dryRun: "تشغيل تجريبي",
    apply: "تنفيذ فعلي",
    scopeFleet: "الأسطول بالكامل",
    scopeSingle: "مستأجر واحد",
    scopeTenantCount: (count: number) => `فلتر من ${count} مستأجر`,

    runStatusPending: "في الطابور",
    runStatusRunning: "قيد التنفيذ",
    runStatusPaused: "متوقفة مؤقتًا",
    runStatusCompleted: "اكتملت",
    runStatusCompletedWithErrors: "اكتملت مع أخطاء",
    runStatusFailed: "فشلت",
    runStatusAborted: "أُجهضت",

    startRun: "تشغيل ترحيل",
    startTitle: "تشغيل ترحيل",
    startHelp:
      "كلا المسارين يستخدم المحرك نفسه. اختر كيفية التنفيذ قبل اختيار نطاقه.",
    modeLegend: "كيف تريد تنفيذ هذه العملية؟",
    dryRunName: "تشغيل تجريبي",
    dryRunHelp:
      "ينفذ مسار الاختيار والفحوص كاملًا ويبلغ عما سيحصل عليه كل مستأجر دون تغيير أي مخطط.",
    applyName: "تنفيذ فعلي",
    applyHelp:
      "يكتب في قواعد بيانات المستأجرين. تُسجَّل كل نتيجة لكل مستأجر وتُدقَّق.",
    scopeLegend: "أي قواعد بيانات ستُمس؟",
    scopeFleetHelp:
      "كل مستأجر مؤهل لهذا التطبيق. المستأجرون غير المؤهلين يُسجَّلون كمتخطَّين مع سبب، ولا يُحذفون بصمت.",
    scopeSingleHelp:
      "مستأجر واحد، عبر محرك الأسطول نفسه مع فلتر مستأجر.",
    tenantIdLabel: "معرّف المستأجر",
    tenantIdHelp: "المستأجر الذي تقتصر عليه هذه العملية.",
    applicationLabel: "التطبيق",
    targetVersionLabel: "النسخة الهدف",
    targetVersionHelp: "اسم الترحيل الذي يجب أن يصل إليه الأسطول.",
    batchSizeLabel: "حجم الدفعة",
    strategyLabel: "الاستراتيجية",
    failFastLabel: "إيقاف العملية بالكامل عند أول فشل",
    failFastHelp:
      "اتركه معطلًا ليتولى نظام الكناري إيقاف العملية عند حدود المرحلة بدلًا من ذلك.",
    canaryTitle: "الطرح التدريجي",
    canaryHelp:
      "تتصاعد الدفعات 1 ← 10 ← 100 ← الباقي. أي فشل في المرحلة الأولى، أو تجاوز 5% في مرحلة لاحقة، يوقف العملية مؤقتًا للفحص بدل إفشالها.",
    triggeredByLabel: "سبب التدقيق",
    triggeredByHelp: "يُسجَّل مع العملية. اذكر سبب تشغيل هذا الترحيل الآن.",
    start: "بدء العملية",
    starting: "جارٍ البدء…",
    startDryRun: "بدء التشغيل التجريبي",
    startApply: "بدء التنفيذ الفعلي",

    confirmFleetTitle: "التنفيذ على كل مستأجر مؤهل",
    confirmFleetBody: (application: string, tenants: string) =>
      `سيكتب هذا تغييرات المخطط في كل قاعدة بيانات مستأجر مؤهلة لتطبيق «${application}»${tenants}. اكتب مفتاح التطبيق للتأكيد.`,
    confirmFleetUnknownCount: "",
    confirmFleetCount: (count: number) => ` — ${count} مستأجرًا متأخرون حاليًا`,
    confirmSingleTitle: "التنفيذ على مستأجر واحد",
    confirmSingleBody: (tenant: string, application: string) =>
      `سيكتب هذا تغييرات المخطط في قاعدة بيانات «${application}» للمستأجر ${tenant}. اكتب معرّف المستأجر للتأكيد.`,

    detailTitle: "تفاصيل العملية",
    controlsTitle: "التحكم في العملية",
    pause: "إيقاف مؤقت",
    resume: "استئناف",
    abort: "إجهاض",
    retryFailed: "إعادة محاولة المستأجرين الفاشلين",
    retryFailedHelp:
      "يبدأ عملية جديدة مقتصرة على المستأجرين الذين فشلوا في هذه العملية.",
    controlReasonLabel: "سبب التدقيق",
    controlReasonHelp: "يُسجَّل مع العملية، ومطلوب لكل أمر تحكم.",
    confirmAbortTitle: "إجهاض هذه العملية",
    confirmAbortBody: (run: string, tenants: string) =>
      `الإجهاض يوقف العملية ${run} عند حدود الدفعة التالية${tenants}. لا يُتراجع عن المستأجرين المرحَّلين بالفعل. اكتب معرّف العملية للتأكيد.`,
    confirmAbortTenants: (queued: number, inFlight: number) =>
      `، تاركًا ${queued} في الطابور و${inFlight} قيد التنفيذ دون ترحيل`,

    outcomesTitle: "نتائج كل مستأجر",
    outcomesHelp:
      "كل مستأجر شملته العملية، بما فيهم من لم يُسمح لها بلمسه.",
    groupAtTarget: "عند النسخة الهدف",
    groupInFlight: "ما زال قادمًا",
    groupNeedsAttention: "يحتاج انتباهًا",
    outcomePending: "في الطابور",
    outcomeRunning: "قيد التنفيذ",
    outcomeApplied: "طُبِّق",
    outcomeFailed: "فشل",
    outcomeSkipped: "متخطَّى — غير مؤهل",
    outcomeSkippedUpToDate: "عند النسخة الهدف أصلًا",
    outcomePendingHelp: "مشمول وينتظر دفعته.",
    outcomeRunningHelp: "يجري ترحيله الآن.",
    outcomeAppliedHelp: "طُبِّقت الترحيلات على قاعدة البيانات هذه.",
    outcomeFailedHelp: "لم يكتمل الترحيل على قاعدة البيانات هذه.",
    outcomeSkippedHelp:
      "لم يُسمح للعملية بلمس قاعدة البيانات هذه، وما زال المستأجر متأخرًا.",
    outcomeSkippedUpToDateHelp:
      "وُصِل إليه ووُجد يحمل النسخة الهدف بالفعل. لا شيء لتطبيقه.",
    skipReasonLabel: "السبب",
    skipReasonMissing:
      "لم يُسجَّل سبب. المستأجر المتخطَّى بلا سبب خلل في العقد — أبلغ عنه ولا تعامله كمُرحَّل.",
    filterOutcome: "النتيجة",
    allOutcomes: "كل النتائج",
    noOutcomes: "لا توجد نتيجة مطابقة للفلتر الحالي.",
    migration: "الترحيل",
    appliedCount: "المطبَّق",
    duration: "المدة",
    errorCode: "الخطأ",
    outcomesUnavailable: "نتائج المستأجرين غير متاحة",
    outcomesUnavailableBody:
      "تظهر العدادات المجمّعة للعملية أدناه. تعذرت قراءة صفوف المستأجرين الفردية.",

    commandSucceeded: "نجح أمر الترحيل.",
    commandForbidden: "صلاحياتك لا تسمح بهذا الأمر.",
    commandConflict:
      "توجد عملية نشطة أخرى لهذا التطبيق، أو تغيرت حالة العملية أولًا.",
    commandPrecondition: "لم يتحقق شرط مسبق، لذا رُفضت العملية قبل بدئها.",
    commandUnavailable:
      "نتيجة الأمر غير معروفة. راجع سجل العمليات قبل إعادة المحاولة — لا يُعاد إرسال هذا الطلب تلقائيًا.",
    commandError: "فشل أمر الترحيل.",
    preconditionRunActive: "توجد عملية نشطة لهذا التطبيق.",
    preconditionUntested: "أحد الترحيلات في النطاق بلا سجل اختبار صالح.",
    preconditionBlocked:
      "أحد الترحيلات في النطاق محظور. ارفع الحظر صراحةً أولًا.",
    preconditionLint: "أحد الترحيلات في النطاق رسب في مدقق السلامة.",
    preconditionBackup:
      "نسخة احتياطية سابقة للترحيل مفقودة لترحيل أحادي الاتجاه.",
    preconditionWindow: "نافذة الصيانة مغلقة لهذا التطبيق.",
    preconditionClaim:
      "عملية بنيوية أخرى تحتجز مستأجرًا في النطاق.",
    preconditionIneligible: "أحد المستأجرين في النطاق غير مؤهل للترحيل.",

    validationApplication: "اختر تطبيقًا.",
    validationVersion: "أدخل اسم الترحيل الهدف.",
    validationTenant: "أدخل معرّف المستأجر الذي تقتصر عليه العملية.",
    validationReason: "أدخل سبب تدقيق لا يقل عن 3 أحرف.",
    validationBatch: "أدخل حجم دفعة بين 1 و500.",
  },
} as const;

export type MigrationsCopy =
  | (typeof MIGRATIONS_COPY)["en"]
  | (typeof MIGRATIONS_COPY)["ar"];

const GLYPH_COMPONENTS: Record<
  MigrationGlyph,
  typeof CheckCircle2
> = {
  check: CheckCircle2,
  spinner: Loader2,
  clock: Clock,
  cross: XCircle,
  ban: Ban,
  target: Target,
  drift: FileWarning,
  restore: LifeBuoy,
  pause: PauseCircle,
  stop: OctagonX,
};

const TONE_CLASSES: Record<MigrationTone, string> = {
  success:
    "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
  progress:
    "border-cyan-300 bg-cyan-50 text-cyan-900 dark:border-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-200",
  waiting:
    "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200",
  neutral:
    "border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
  caution:
    "border-amber-400 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200",
  danger:
    "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200",
  alarm:
    "border-fuchsia-400 bg-fuchsia-50 text-fuchsia-950 dark:border-fuchsia-700 dark:bg-fuchsia-950/60 dark:text-fuchsia-100",
};

export function outcomeLabel(
  outcome: MigrationTenantOutcome,
  copy: MigrationsCopy,
): string {
  return {
    PENDING: copy.outcomePending,
    RUNNING: copy.outcomeRunning,
    APPLIED: copy.outcomeApplied,
    FAILED: copy.outcomeFailed,
    SKIPPED: copy.outcomeSkipped,
    SKIPPED_UP_TO_DATE: copy.outcomeSkippedUpToDate,
  }[outcome];
}

export function outcomeHelp(
  outcome: MigrationTenantOutcome,
  copy: MigrationsCopy,
): string {
  return {
    PENDING: copy.outcomePendingHelp,
    RUNNING: copy.outcomeRunningHelp,
    APPLIED: copy.outcomeAppliedHelp,
    FAILED: copy.outcomeFailedHelp,
    SKIPPED: copy.outcomeSkippedHelp,
    SKIPPED_UP_TO_DATE: copy.outcomeSkippedUpToDateHelp,
  }[outcome];
}

export function schemaStateLabel(
  state: TenantSchemaVersionState,
  copy: MigrationsCopy,
): string {
  return {
    UP_TO_DATE: copy.stateUpToDate,
    PENDING: copy.statePending,
    RUNNING: copy.stateRunning,
    FAILED: copy.stateFailed,
    BLOCKED: copy.stateBlocked,
    RESTORE_INCOMPLETE: copy.stateRestoreIncomplete,
    DRIFTED: copy.stateDrifted,
  }[state];
}

export function runStatusLabel(
  status: MigrationRunStatus,
  copy: MigrationsCopy,
): string {
  return {
    PENDING: copy.runStatusPending,
    RUNNING: copy.runStatusRunning,
    PAUSED: copy.runStatusPaused,
    COMPLETED: copy.runStatusCompleted,
    COMPLETED_WITH_ERRORS: copy.runStatusCompletedWithErrors,
    FAILED: copy.runStatusFailed,
    ABORTED: copy.runStatusAborted,
  }[status];
}

/**
 * A chip carries an icon, a translated label, and the literal wire value, so
 * the state survives being read without colour, without icons, or aloud.
 */
export function MigrationChip({
  tone,
  glyph,
  label,
  code,
  spin = false,
}: {
  tone: MigrationTone;
  glyph: MigrationGlyph;
  label: string;
  code: string;
  spin?: boolean;
}) {
  const Icon = GLYPH_COMPONENTS[glyph];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${TONE_CLASSES[tone]}`}
    >
      <Icon className={`size-3.5 shrink-0 ${spin ? "animate-spin" : ""}`} aria-hidden="true" />
      <span>{label}</span>
      <code dir="ltr" className="font-mono text-[10px] opacity-70">
        {code}
      </code>
    </span>
  );
}

export function OutcomeChip({
  outcome,
  copy,
}: {
  outcome: MigrationTenantOutcome;
  copy: MigrationsCopy;
}) {
  const descriptor = describeTenantOutcome(outcome);
  return (
    <MigrationChip
      tone={descriptor.tone}
      glyph={descriptor.glyph}
      label={outcomeLabel(outcome, copy)}
      code={outcome}
      spin={outcome === "RUNNING"}
    />
  );
}

export function SchemaStateChip({
  state,
  copy,
}: {
  state: TenantSchemaVersionState;
  copy: MigrationsCopy;
}) {
  const descriptor = describeSchemaState(state);
  return (
    <MigrationChip
      tone={descriptor.tone}
      glyph={descriptor.glyph}
      label={schemaStateLabel(state, copy)}
      code={state}
      spin={state === "RUNNING"}
    />
  );
}

export function RunStatusChip({
  status,
  copy,
}: {
  status: MigrationRunStatus;
  copy: MigrationsCopy;
}) {
  const descriptor = describeRunStatus(status);
  return (
    <MigrationChip
      tone={descriptor.tone}
      glyph={descriptor.glyph}
      label={runStatusLabel(status, copy)}
      code={status}
      spin={status === "RUNNING"}
    />
  );
}

/** A dry run must be unmistakable wherever a run is named. */
export function RunModeChip({
  dryRun,
  copy,
}: {
  dryRun: boolean;
  copy: MigrationsCopy;
}) {
  return (
    <MigrationChip
      tone={dryRun ? "neutral" : "caution"}
      glyph={dryRun ? "target" : "check"}
      label={dryRun ? copy.dryRun : copy.apply}
      code={dryRun ? "DRY_RUN" : "APPLY"}
    />
  );
}

export function MigrationsPageFrame({
  children,
  dir,
}: {
  children: ReactNode;
  dir: "rtl" | "ltr";
}) {
  return (
    <div
      dir={dir}
      className="min-h-screen bg-slate-50 text-slate-950 dark:bg-[#090d16] dark:text-slate-100"
    >
      <main className="mx-auto w-full max-w-[1600px] space-y-4 px-4 py-5 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}

export function MigrationsHero({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <header className="rounded-2xl border border-cyan-500/20 bg-gradient-to-r from-slate-950 via-cyan-950 to-slate-950 p-5 text-white shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-cyan-400/15 text-cyan-200">
            <DatabaseZap className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-xl font-black sm:text-2xl">{title}</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-cyan-100/80">
              {subtitle}
            </p>
          </div>
        </div>
        {action}
      </div>
    </header>
  );
}

export function MigrationsStatePanel({
  kind,
  title,
  detail,
  correlationId,
  copy,
  action,
}: {
  kind: "loading" | "empty" | "forbidden" | "notFound" | "unavailable" | "error";
  title: string;
  detail?: string;
  correlationId?: string;
  copy: MigrationsCopy;
  action?: ReactNode;
}) {
  const Icon =
    kind === "loading"
      ? Loader2
      : kind === "forbidden"
        ? ShieldAlert
        : kind === "error" || kind === "unavailable"
          ? AlertTriangle
          : CircleDot;
  return (
    <section
      role={kind === "error" || kind === "forbidden" ? "alert" : "status"}
      className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <Icon
        className={`mb-3 size-9 text-cyan-600 ${kind === "loading" ? "animate-spin" : ""}`}
        aria-hidden="true"
      />
      <h2 className="font-black">{title}</h2>
      {detail ? (
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
          {detail}
        </p>
      ) : null}
      {correlationId ? (
        <p className="mt-2 text-xs">
          <strong>{copy.correlation}:</strong>{" "}
          <code dir="ltr" className="select-all break-all">
            {correlationId}
          </code>
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </section>
  );
}

export function RefreshMigrationsButton({
  label,
  onClick,
  pending = false,
}: {
  label: string;
  onClick: () => void;
  pending?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-cyan-300 px-4 text-sm font-bold text-cyan-800 disabled:opacity-50 dark:border-cyan-800 dark:text-cyan-200"
    >
      <RefreshCw
        className={`size-4 ${pending ? "animate-spin" : ""}`}
        aria-hidden="true"
      />
      {label}
    </button>
  );
}

/**
 * Says which permissions are missing rather than leaving an operator to guess
 * why the page has no buttons.
 */
export function ReadOnlyNotice({
  missing,
  copy,
}: {
  missing: readonly string[];
  copy: MigrationsCopy;
}) {
  if (missing.length === 0) return null;
  return (
    <section
      role="status"
      className="rounded-2xl border border-slate-300 bg-slate-100 p-4 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
    >
      <h2 className="font-black">{copy.readOnlyTitle}</h2>
      <p className="mt-1 leading-6">{copy.readOnlyBody}</p>
      <p className="mt-2 text-xs">
        <strong>{copy.missingPermissions}:</strong>{" "}
        <code dir="ltr" className="font-mono">
          {missing.join(", ")}
        </code>
      </p>
    </section>
  );
}

export function RunProgressBar({
  run,
  copy,
}: {
  run: Pick<MigrationRun, "progress">;
  copy: MigrationsCopy;
}) {
  const pct = readRunProgressPct(run.progress);
  return (
    <div className="min-w-40">
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={copy.progress}
        className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
      >
        <div
          className="h-full rounded-full bg-cyan-600"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 font-mono text-xs">
        {pct}% · {run.progress.succeededTenants}/{run.progress.totalTenants}
      </p>
    </div>
  );
}

export function MigrationMutationNotice({
  mutation,
  copy,
}: {
  mutation: MigrationMutationState;
  copy: MigrationsCopy;
}) {
  if (mutation.phase === "IDLE" || mutation.phase === "PENDING") return null;

  const message = {
    SUCCEEDED: copy.commandSucceeded,
    FORBIDDEN: copy.commandForbidden,
    CONFLICT: copy.commandConflict,
    PRECONDITION: copy.commandPrecondition,
    UNAVAILABLE: copy.commandUnavailable,
    ERROR: copy.commandError,
  }[mutation.phase];
  const precondition = mutation.error
    ? readPreconditionCode(mutation.error)
    : null;
  const danger =
    mutation.phase === "ERROR" || mutation.phase === "FORBIDDEN";

  return (
    <div
      role={mutation.phase === "SUCCEEDED" ? "status" : "alert"}
      className={`rounded-xl border px-4 py-3 text-sm ${
        danger
          ? "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100"
          : mutation.phase === "SUCCEEDED"
            ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100"
            : "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
      }`}
    >
      <p className="font-bold">{message}</p>
      {precondition ? (
        <p className="mt-1">{preconditionMessage(precondition, copy)}</p>
      ) : null}
      {mutation.error ? <p className="mt-1">{mutation.error.message}</p> : null}
      {mutation.error?.errorCode ? (
        <code dir="ltr" className="mt-1 block break-all font-mono text-xs">
          {mutation.error.errorCode}
        </code>
      ) : null}
      {mutation.error?.correlationId ? (
        <p className="mt-1 text-xs">
          <strong>{copy.correlation}:</strong>{" "}
          <code dir="ltr">{mutation.error.correlationId}</code>
        </p>
      ) : null}
    </div>
  );
}

function preconditionMessage(
  code: MigrationPreconditionCode,
  copy: MigrationsCopy,
): string {
  return {
    MIGRATION_RUN_ALREADY_ACTIVE: copy.preconditionRunActive,
    MIGRATION_UNTESTED: copy.preconditionUntested,
    MIGRATION_TEST_EXPIRED: copy.preconditionUntested,
    MIGRATION_TEST_CHECKSUM_MISMATCH: copy.preconditionUntested,
    MIGRATION_NOT_APPROVED: copy.preconditionUntested,
    MIGRATION_BLOCKED: copy.preconditionBlocked,
    MIGRATION_LINT_FAILED: copy.preconditionLint,
    MIGRATION_BACKUP_REQUIRED: copy.preconditionBackup,
    TENANT_CLAIM_HELD: copy.preconditionClaim,
    TENANT_INELIGIBLE: copy.preconditionIneligible,
    MAINTENANCE_WINDOW_CLOSED: copy.preconditionWindow,
    BASELINE_AHEAD_OF_APPLICATION: copy.preconditionRunActive,
  }[code];
}

export function MigrationPager({
  page,
  pageSize,
  total,
  onPageChange,
  lang,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  lang: "ar" | "en";
}) {
  const totalPages = Math.max(1, Math.ceil(total / Math.max(pageSize, 1)));
  if (totalPages <= 1) return null;
  const isArabic = lang === "ar";

  return (
    <nav
      aria-label={isArabic ? "تصفح الصفحات" : "Pagination"}
      className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs dark:border-slate-800"
    >
      <span className="font-semibold text-slate-500">
        {isArabic
          ? `صفحة ${page} من ${totalPages}`
          : `Page ${page} of ${totalPages}`}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          className="min-h-9 rounded-xl border border-slate-200 px-3 font-bold disabled:opacity-50 dark:border-slate-700"
        >
          {isArabic ? "السابق" : "Previous"}
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="min-h-9 rounded-xl border border-slate-200 px-3 font-bold disabled:opacity-50 dark:border-slate-700"
        >
          {isArabic ? "التالي" : "Next"}
        </button>
      </div>
    </nav>
  );
}

export function TableHeader({
  children,
  align = "start",
}: {
  children: ReactNode;
  align?: "start" | "end";
}) {
  return (
    <th
      scope="col"
      className={`px-4 py-3 ${align === "end" ? "text-end" : "text-start"}`}
    >
      {children}
    </th>
  );
}

export function formatMigrationDate(
  value: string | null,
  lang: "ar" | "en",
): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function formatDuration(
  milliseconds: number | null,
  lang: "ar" | "en",
): string {
  if (milliseconds === null) return "—";
  if (milliseconds < 1_000) return lang === "ar" ? `${milliseconds} م.ث` : `${milliseconds} ms`;
  const seconds = milliseconds / 1_000;
  if (seconds < 60) {
    return lang === "ar" ? `${seconds.toFixed(1)} ث` : `${seconds.toFixed(1)} s`;
  }
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return lang === "ar" ? `${minutes} د ${rest} ث` : `${minutes}m ${rest}s`;
}

export const migrationInputClass =
  "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white";
export const migrationLabelClass =
  "mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500";
