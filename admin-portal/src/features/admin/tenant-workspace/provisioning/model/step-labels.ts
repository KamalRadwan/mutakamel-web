/**
 * Human names for provisioning step keys and kinds.
 *
 * The API answers machine keys — `core.foundation.seed.core.rbac`,
 * `REFERENCE_SEED` — because they are the plan's identity and they are what an
 * operator pastes into a query. They are not a label: a screen that prints them
 * asks the reader to decode the plan grammar for themselves, in a portal that
 * is Arabic half the time.
 *
 * So the table shows the name and keeps the key beside it. Nothing is hidden.
 *
 * The map below is every step the platform plans today (verified against
 * `tenant_operation_steps` on 2026-09-05). A release ships new components and
 * seed packs without asking this file, so an unmapped key is decomposed by the
 * plan's own grammar instead — `<component>.schema`,
 * `<component>.seed.<pack>`, `<component>.verify`, per `buildSteps` in
 * core-app `tenant-provisioning-plan.service.ts` — and falls back to the raw
 * key when even that does not fit.
 */

type Bilingual = readonly [en: string, ar: string];

const COMPONENTS: Record<string, Bilingual> = {
  "core.foundation": ["Core foundation", "أساس النواة"],
  crm: ["CRM", "إدارة العملاء"],
  trade: ["Trade", "التجارة"],
};

const STEPS: Record<string, Bilingual> = {
  "database.create": ["Create tenant database", "إنشاء قاعدة بيانات المستأجر"],
  "tenant.activate": ["Activate tenant", "تفعيل المستأجر"],
  "core.owner-invitation": ["Owner invitation email", "رسالة دعوة المالك"],
  "core.foundation.seed.core.currencies": ["Currencies", "العملات"],
  "core.foundation.seed.core.organization": ["Organization structure", "الهيكل التنظيمي"],
  "core.foundation.seed.core.owner": ["Owner account", "حساب المالك"],
  "core.foundation.seed.core.rbac": ["Roles and permissions", "الأدوار والصلاحيات"],
  "core.foundation.seed.core.workspace-settings": ["Workspace settings", "إعدادات مساحة العمل"],
  "crm.seed.crm.acquisition-source-icons": ["Acquisition source icons", "أيقونات مصادر الاستقطاب"],
  "crm.seed.crm.acquisition-sources": ["Acquisition sources", "مصادر الاستقطاب"],
  "crm.seed.crm.default-pipeline": ["Default pipeline", "مسار المبيعات الافتراضي"],
  "crm.seed.crm.lead-stages": ["Lead stages", "مراحل العملاء المحتملين"],
  "crm.seed.crm.permissions": ["Permissions", "الصلاحيات"],
  "crm.seed.crm.settings": ["CRM settings", "إعدادات إدارة العملاء"],
  "trade.seed.trade.governance-defaults": ["Governance defaults", "الضوابط الافتراضية"],
  "trade.seed.trade.numbering": ["Document numbering", "ترقيم المستندات"],
  "trade.seed.trade.permissions": ["Permissions", "الصلاحيات"],
  "trade.seed.trade.settings": ["Trade settings", "إعدادات التجارة"],
};

const KINDS: Record<string, Bilingual> = {
  DATABASE: ["Database", "قاعدة البيانات"],
  SCHEMA: ["Schema", "المخطط"],
  SYSTEM_SEED: ["System data", "بيانات النظام"],
  REFERENCE_SEED: ["Reference data", "بيانات مرجعية"],
  IDENTITY: ["Identity", "الهوية"],
  CONFIG: ["Configuration", "الإعدادات"],
  VERIFICATION: ["Verification", "التحقق"],
  NOTIFICATION: ["Notification", "إشعار"],
  ACTIVATION: ["Activation", "التفعيل"],
};

/**
 * The timeline's own vocabulary. Same rule as the steps: the event type is a
 * wire value, and a reader should not have to decode SCREAMING_SNAKE_CASE.
 */
const EVENTS: Record<string, Bilingual> = {
  OPERATION_PLANNED: ["Operation planned", "خُطّطت العملية"],
  STEP_STARTED: ["Step started", "بدأت الخطوة"],
  STEP_SUCCEEDED: ["Step succeeded", "نجحت الخطوة"],
  STEP_FAILED: ["Step failed", "فشلت الخطوة"],
  OPERATION_SUCCEEDED: ["Operation succeeded", "نجحت العملية"],
  OPERATION_FAILED: ["Operation failed", "فشلت العملية"],
  OPERATION_CANCELLED: ["Operation cancelled", "أُلغيت العملية"],
};

/** Step lifecycle, as the table's status column reads it. */
const STATUSES: Record<string, Bilingual> = {
  PENDING: ["Pending", "قيد الانتظار"],
  RUNNING: ["Running", "قيد التنفيذ"],
  SUCCEEDED: ["Succeeded", "نجحت"],
  FAILED: ["Failed", "فشلت"],
  SKIPPED: ["Skipped", "تم تخطيها"],
  CANCELLED: ["Cancelled", "أُلغيت"],
  CONFLICT: ["Conflict", "تعارض"],
  BLOCKED: ["Blocked", "محجوبة"],
};

const SUFFIXES: Record<string, Bilingual> = {
  schema: ["schema", "المخطط"],
  verify: ["verification", "التحقق"],
};

const pick = (value: Bilingual, ar: boolean): string => (ar ? value[1] : value[0]);

/** `component — detail`, in the reading order of the active language. */
function compose(component: Bilingual, detail: string, ar: boolean): string {
  return `${pick(component, ar)} — ${detail}`;
}

/** The step's name for a reader. Falls back to the key it could not name. */
export function provisioningStepLabel(stepKey: string, ar: boolean): string {
  const mapped = STEPS[stepKey];
  const componentKey = Object.keys(COMPONENTS).find(
    (candidate) => stepKey === candidate || stepKey.startsWith(`${candidate}.`),
  );
  const component = componentKey ? COMPONENTS[componentKey] : undefined;

  if (mapped) {
    // The three fleet-wide steps stand alone; the rest read as one component's work.
    return component && stepKey.includes(".seed.")
      ? compose(component, pick(mapped, ar), ar)
      : pick(mapped, ar);
  }
  if (!component || !componentKey) return stepKey;

  const rest = stepKey.slice(componentKey.length + 1);
  const suffix = SUFFIXES[rest];
  if (suffix) return compose(component, pick(suffix, ar), ar);
  // An unmapped seed pack from a newer release: name its component and carry
  // the pack key itself rather than inventing a translation for it.
  if (rest.startsWith("seed.")) return compose(component, rest.slice(5), ar);
  return stepKey;
}

/** The step kind, translated. Unknown kinds keep their wire value. */
export function provisioningStepKindLabel(kind: string, ar: boolean): string {
  const mapped = KINDS[kind];
  return mapped ? pick(mapped, ar) : kind;
}

/** A timeline event type, translated. Unknown types keep their wire value. */
export function provisioningEventLabel(eventType: string, ar: boolean): string {
  const mapped = EVENTS[eventType];
  return mapped ? pick(mapped, ar) : eventType;
}

/** A step status, translated. Unknown statuses keep their wire value. */
export function provisioningStepStatusLabel(status: string, ar: boolean): string {
  const mapped = STATUSES[status];
  return mapped ? pick(mapped, ar) : status;
}
