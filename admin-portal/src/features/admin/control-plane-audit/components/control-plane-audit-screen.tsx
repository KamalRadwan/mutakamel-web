"use client";

import {
  Activity,
  Braces,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Database,
  Filter,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  UserRound,
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { useI18n } from "@/i18n/I18nContext";
import { formatAuditValue } from "../lib/control-plane-audit-utils";
import { useControlPlaneAudit } from "../hooks/use-control-plane-audit";
import {
  CONTROL_PLANE_AUDIT_ACTOR_TYPES,
  CONTROL_PLANE_AUDIT_OUTCOMES,
  CONTROL_PLANE_AUDIT_SOURCE_TYPES,
  type ControlPlaneAuditEvent,
  type ControlPlaneAuditFilterDraft,
} from "../types/control-plane-audit";

const COPY = {
  en: {
    title: "Control-plane audit",
    subtitle:
      "Search immutable, cross-domain administrative evidence without changing historical records.",
    immutable: "Read-only evidence",
    allEvents: "All events",
    entityHistory: "Entity history",
    filters: "Exact filters",
    apply: "Apply filters",
    clear: "Clear",
    refresh: "Refresh",
    actorType: "Actor type",
    actorId: "Actor ID",
    tenantId: "Tenant UUID",
    action: "Action",
    entityType: "Entity type",
    entityId: "Entity ID",
    outcome: "Outcome",
    sourceApp: "Source application",
    sourceType: "Source type",
    correlationId: "Correlation ID",
    from: "Occurred from",
    to: "Occurred before",
    pageSize: "Page size",
    any: "Any",
    loading: "Loading audit evidence…",
    chooseEntity: "Enter an entity type and entity ID, then apply the filters.",
    forbidden: "You do not have permission to read control-plane audit evidence.",
    permission: "Required permission: admin.audit.read",
    unavailable: "Audit evidence is currently unavailable.",
    retry: "Retry",
    empty: "No audit events match the applied filters.",
    events: "events",
    activeFilters: "active filters",
    actor: "Actor",
    source: "Source",
    entity: "Entity",
    evidence: "Inspect evidence",
    provenance: "Request provenance",
    reason: "Reason",
    before: "Before",
    after: "After",
    diff: "Field changes",
    metadata: "Metadata",
    noSnapshot: "No snapshot recorded",
    previous: "Previous",
    next: "Next",
    page: "Page",
    of: "of",
    systemActor: "System / unattributed",
    notRecorded: "Not recorded",
    exclusiveEnd: "The end is exclusive.",
  },
  ar: {
    title: "سجل تدقيق منصة التحكم",
    subtitle:
      "ابحث في أدلة الإدارة غير القابلة للتعديل عبر جميع النطاقات دون تغيير السجل التاريخي.",
    immutable: "أدلة للقراءة فقط",
    allEvents: "كل الأحداث",
    entityHistory: "سجل كيان",
    filters: "عوامل تصفية دقيقة",
    apply: "تطبيق التصفية",
    clear: "مسح",
    refresh: "تحديث",
    actorType: "نوع المنفذ",
    actorId: "معرف المنفذ",
    tenantId: "معرف المستأجر UUID",
    action: "الإجراء",
    entityType: "نوع الكيان",
    entityId: "معرف الكيان",
    outcome: "النتيجة",
    sourceApp: "التطبيق المصدر",
    sourceType: "نوع المصدر",
    correlationId: "معرف التتبع",
    from: "وقت البداية",
    to: "قبل وقت النهاية",
    pageSize: "حجم الصفحة",
    any: "الكل",
    loading: "جارٍ تحميل أدلة التدقيق…",
    chooseEntity: "أدخل نوع الكيان ومعرفه ثم طبّق عوامل التصفية.",
    forbidden: "ليست لديك صلاحية قراءة سجل تدقيق منصة التحكم.",
    permission: "الصلاحية المطلوبة: admin.audit.read",
    unavailable: "أدلة التدقيق غير متاحة حاليًا.",
    retry: "إعادة المحاولة",
    empty: "لا توجد أحداث تطابق عوامل التصفية المطبقة.",
    events: "حدث",
    activeFilters: "عوامل نشطة",
    actor: "المنفذ",
    source: "المصدر",
    entity: "الكيان",
    evidence: "فحص الأدلة",
    provenance: "بيانات الطلب",
    reason: "السبب",
    before: "قبل",
    after: "بعد",
    diff: "تغييرات الحقول",
    metadata: "بيانات وصفية",
    noSnapshot: "لا توجد لقطة مسجلة",
    previous: "السابق",
    next: "التالي",
    page: "صفحة",
    of: "من",
    systemActor: "النظام / غير منسوب",
    notRecorded: "غير مسجل",
    exclusiveEnd: "وقت النهاية غير مشمول.",
  },
} as const;

export function ControlPlaneAuditScreen() {
  const { lang } = useI18n();
  const copy = COPY[lang];
  const audit = useControlPlaneAudit();

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-950 dark:bg-[#090d16] dark:text-slate-100">
      <Navbar />
      <main className="w-full flex-1 space-y-4 px-[10px] py-4 sm:py-6">
        <header className="overflow-hidden rounded-2xl border border-cyan-500/20 bg-slate-950 px-4 py-4 text-white shadow-md sm:px-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="rounded-xl border border-cyan-400/25 bg-cyan-500/15 p-2.5 text-cyan-300">
                <Activity className="size-5" />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg font-black sm:text-xl">{copy.title}</h1>
                  <span className="rounded-md border border-cyan-400/30 bg-cyan-500/15 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-cyan-200">
                    {copy.immutable}
                  </span>
                </div>
                <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-300">
                  {copy.subtitle}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-300">
              <span className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 font-mono">
                {audit.data?.total ?? 0} {copy.events}
              </span>
              <span className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 font-mono">
                {audit.activeFilterCount} {copy.activeFilters}
              </span>
            </div>
          </div>
        </header>

        {audit.isAuthLoading ? (
          <StatusPanel icon={<Loader2 className="size-7 animate-spin" />} title={copy.loading} />
        ) : audit.canRead ? (
          <>
            <AuditFilters copy={copy} audit={audit} lang={lang} />
            <AuditResults copy={copy} audit={audit} lang={lang} />
          </>
        ) : (
          <StatusPanel
            icon={<ShieldAlert className="size-7" />}
            title={copy.forbidden}
            detail={copy.permission}
            tone="warning"
          />
        )}
      </main>
    </div>
  );
}

type Copy = (typeof COPY)[keyof typeof COPY];
type AuditHook = ReturnType<typeof useControlPlaneAudit>;

function AuditFilters({ copy, audit, lang }: { copy: Copy; audit: AuditHook; lang: "ar" | "en" }) {
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    audit.applyFilters();
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <h2 className="flex items-center gap-2 text-sm font-black">
          <Filter className="size-4 text-cyan-500" />
          {copy.filters}
        </h2>
        <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-950">
          {([
            ["ALL_EVENTS", copy.allEvents],
            ["ENTITY_HISTORY", copy.entityHistory],
          ] as const).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => audit.setMode(mode)}
              aria-pressed={audit.mode === mode}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                audit.mode === mode
                  ? "bg-cyan-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={submit} className="space-y-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          <AuditSelect
            label={copy.actorType}
            value={audit.draft.actorType}
            onChange={(value) => audit.updateDraft("actorType", value as ControlPlaneAuditFilterDraft["actorType"])}
            options={CONTROL_PLANE_AUDIT_ACTOR_TYPES}
            anyLabel={copy.any}
          />
          <AuditInput
            label={copy.actorId}
            value={audit.draft.actorId}
            maxLength={128}
            error={localizeValidationError(audit.validationErrors.actorId, lang)}
            onChange={(value) => audit.updateDraft("actorId", value)}
          />
          <AuditInput
            label={copy.tenantId}
            value={audit.draft.tenantId}
            error={localizeValidationError(audit.validationErrors.tenantId, lang)}
            onChange={(value) => audit.updateDraft("tenantId", value)}
          />
          <AuditInput
            label={copy.action}
            value={audit.draft.action}
            maxLength={96}
            error={localizeValidationError(audit.validationErrors.action, lang)}
            onChange={(value) => audit.updateDraft("action", value)}
          />
          <AuditInput
            label={copy.entityType}
            value={audit.draft.entityType}
            maxLength={128}
            required={audit.mode === "ENTITY_HISTORY"}
            error={localizeValidationError(audit.validationErrors.entityType, lang)}
            onChange={(value) => audit.updateDraft("entityType", value)}
          />
          <AuditInput
            label={copy.entityId}
            value={audit.draft.entityId}
            maxLength={256}
            required={audit.mode === "ENTITY_HISTORY"}
            error={localizeValidationError(audit.validationErrors.entityId, lang)}
            onChange={(value) => audit.updateDraft("entityId", value)}
          />
          <AuditSelect
            label={copy.outcome}
            value={audit.draft.outcome}
            onChange={(value) => audit.updateDraft("outcome", value as ControlPlaneAuditFilterDraft["outcome"])}
            options={CONTROL_PLANE_AUDIT_OUTCOMES}
            anyLabel={copy.any}
          />
          <AuditInput
            label={copy.sourceApp}
            value={audit.draft.sourceApp}
            maxLength={64}
            error={localizeValidationError(audit.validationErrors.sourceApp, lang)}
            onChange={(value) => audit.updateDraft("sourceApp", value)}
          />
          <AuditSelect
            label={copy.sourceType}
            value={audit.draft.sourceType}
            onChange={(value) => audit.updateDraft("sourceType", value)}
            options={CONTROL_PLANE_AUDIT_SOURCE_TYPES}
            anyLabel={copy.any}
          />
          <AuditInput
            label={copy.correlationId}
            value={audit.draft.correlationId}
            maxLength={128}
            error={localizeValidationError(audit.validationErrors.correlationId, lang)}
            onChange={(value) => audit.updateDraft("correlationId", value)}
          />
          <AuditInput
            label={copy.from}
            value={audit.draft.from}
            type="datetime-local"
            error={localizeValidationError(audit.validationErrors.from, lang)}
            onChange={(value) => audit.updateDraft("from", value)}
          />
          <AuditInput
            label={copy.to}
            value={audit.draft.to}
            type="datetime-local"
            error={localizeValidationError(audit.validationErrors.to, lang)}
            hint={copy.exclusiveEnd}
            onChange={(value) => audit.updateDraft("to", value)}
          />
        </div>

        {audit.validationErrors.dateRange ? (
          <p role="alert" className="text-xs font-semibold text-rose-600 dark:text-rose-300">
            {localizeValidationError(audit.validationErrors.dateRange, lang)}
          </p>
        ) : null}

        <div className="flex flex-wrap items-end justify-between gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
          <label className="grid gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-300">
            <span>{copy.pageSize}</span>
            <select
              value={audit.limit}
              onChange={(event) => audit.setLimit(Number(event.target.value))}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-950"
            >
              {[25, 50, 100].map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={audit.clearFilters}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              <RotateCcw className="size-3.5" />
              {copy.clear}
            </button>
            <button
              type="button"
              onClick={audit.refresh}
              disabled={audit.requestState === "IDLE"}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              <RefreshCw className={`size-3.5 ${audit.isRefreshing ? "animate-spin" : ""}`} />
              {copy.refresh}
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-xs font-black text-white shadow-sm hover:bg-cyan-500"
            >
              <Filter className="size-3.5" />
              {copy.apply}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}

function AuditResults({
  copy,
  audit,
  lang,
}: {
  copy: Copy;
  audit: AuditHook;
  lang: "ar" | "en";
}) {
  if (audit.requestState === "IDLE") {
    return <StatusPanel icon={<Database className="size-7" />} title={copy.chooseEntity} />;
  }
  if (audit.requestState === "LOADING") {
    return <StatusPanel icon={<Loader2 className="size-7 animate-spin" />} title={copy.loading} />;
  }
  if (audit.requestState === "FORBIDDEN") {
    return <StatusPanel icon={<ShieldAlert className="size-7" />} title={copy.forbidden} detail={copy.permission} tone="warning" />;
  }
  if (audit.requestState === "UNAVAILABLE") {
    const detail = [
      audit.error?.message,
      audit.error?.correlationId
        ? `Correlation: ${audit.error.correlationId}`
        : undefined,
    ].filter(Boolean).join(" · ");
    return (
      <StatusPanel
        icon={<ShieldAlert className="size-7" />}
        title={copy.unavailable}
        detail={detail}
        tone="danger"
        action={<button type="button" onClick={audit.refresh} className="rounded-xl bg-rose-600 px-3 py-2 text-xs font-bold text-white hover:bg-rose-500">{copy.retry}</button>}
      />
    );
  }
  if (audit.requestState === "EMPTY" || !audit.data?.items.length) {
    return <StatusPanel icon={<Braces className="size-7" />} title={copy.empty} />;
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <h2 className="flex items-center gap-2 text-sm font-black">
          <Activity className="size-4 text-cyan-500" />
          {audit.mode === "ENTITY_HISTORY" ? copy.entityHistory : copy.allEvents}
        </h2>
        {audit.isRefreshing ? <Loader2 className="size-4 animate-spin text-cyan-500" aria-label={copy.loading} /> : null}
      </div>
      <div className="space-y-3 p-3 sm:p-4">
        {audit.data.items.map((event) => (
          <AuditEventCard key={event.id} event={event} copy={copy} lang={lang} />
        ))}
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-xs dark:border-slate-800">
        <span className="font-mono text-slate-500 dark:text-slate-400">
          {copy.page} {audit.data.page} {copy.of} {Math.max(1, audit.data.totalPages)} · {audit.data.total} {copy.events}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!audit.data.hasPrev || audit.isRefreshing}
            onClick={() => audit.setPage(Math.max(1, audit.page - 1))}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 font-bold disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700"
          >
            <ChevronLeft className="size-3.5 rtl:rotate-180" />
            {copy.previous}
          </button>
          <button
            type="button"
            disabled={!audit.data.hasNext || audit.isRefreshing}
            onClick={() => audit.setPage(audit.page + 1)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 font-bold disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700"
          >
            {copy.next}
            <ChevronRight className="size-3.5 rtl:rotate-180" />
          </button>
        </div>
      </footer>
    </section>
  );
}

function AuditEventCard({
  event,
  copy,
  lang,
}: {
  event: ControlPlaneAuditEvent;
  copy: Copy;
  lang: "ar" | "en";
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/50">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-1 text-[10px] font-black ${event.outcome === "SUCCESS" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"}`}>
              {event.outcome}
            </span>
            <strong className="break-all font-mono text-xs text-cyan-700 dark:text-cyan-300">
              {event.action}
            </strong>
          </div>
          <p className="mt-2 break-all text-xs text-slate-600 dark:text-slate-300">
            <span className="font-bold">{copy.entity}:</span> {event.entityType}
            {event.entityId ? ` / ${event.entityId}` : ""}
          </p>
        </div>
        <time dateTime={event.occurredAt} className="inline-flex items-center gap-1.5 whitespace-nowrap text-[11px] text-slate-500 dark:text-slate-400">
          <Clock3 className="size-3.5" />
          {new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en", {
            dateStyle: "medium",
            timeStyle: "medium",
          }).format(new Date(event.occurredAt))}
        </time>
      </div>

      <div className="mt-3 grid gap-2 text-[11px] text-slate-600 sm:grid-cols-2 lg:grid-cols-3 dark:text-slate-300">
        <EvidenceDatum icon={<UserRound className="size-3.5" />} label={copy.actor} value={event.actorLabel || event.actorId || copy.systemActor} />
        <EvidenceDatum icon={<Activity className="size-3.5" />} label={copy.source} value={`${event.sourceApp} / ${event.sourceType}`} />
        <EvidenceDatum icon={<Braces className="size-3.5" />} label={copy.correlationId} value={event.correlationId || copy.notRecorded} mono />
      </div>

      <details className="mt-3 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <summary className="cursor-pointer select-none px-3 py-2 text-xs font-black text-cyan-700 marker:text-cyan-500 dark:text-cyan-300">
          {copy.evidence}
        </summary>
        <div className="space-y-3 border-t border-slate-200 p-3 dark:border-slate-800">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <EvidenceDatum label="eventId" value={event.id} mono />
            <EvidenceDatum label="operationId" value={event.operationId || copy.notRecorded} mono />
            <EvidenceDatum label="requestId" value={event.requestId || copy.notRecorded} mono />
            <EvidenceDatum label="idempotencyKey" value={event.idempotencyKey || copy.notRecorded} mono />
            <EvidenceDatum label="tenantId" value={event.tenantId || copy.notRecorded} mono />
            <EvidenceDatum label="sourceId" value={event.sourceId || copy.notRecorded} mono />
            <EvidenceDatum label="sourceRoute" value={event.sourceRoute || copy.notRecorded} mono />
            <EvidenceDatum label="schemaVersion" value={String(event.schemaVersion)} mono />
          </div>
          {event.reason ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              <strong>{copy.reason}:</strong> {event.reason}
            </div>
          ) : null}
          <div className="grid gap-3 xl:grid-cols-2">
            <AuditJson title={copy.before} value={event.before} empty={copy.noSnapshot} />
            <AuditJson title={copy.after} value={event.after} empty={copy.noSnapshot} />
            <AuditJson title={copy.diff} value={event.diff} empty={copy.noSnapshot} />
            <AuditJson title={copy.metadata} value={event.metadata} empty={copy.noSnapshot} />
          </div>
          <div className="grid gap-2 text-[10px] text-slate-500 sm:grid-cols-2 dark:text-slate-400">
            <p><strong>IP:</strong> {event.ip || copy.notRecorded}</p>
            <p className="break-all"><strong>User-Agent:</strong> {event.userAgent || copy.notRecorded}</p>
          </div>
        </div>
      </details>
    </article>
  );
}

function EvidenceDatum({
  icon,
  label,
  value,
  mono = false,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <p className="flex min-w-0 items-start gap-1.5 rounded-lg bg-slate-100 px-2.5 py-2 dark:bg-slate-800/70">
      {icon ? <span className="mt-0.5 shrink-0 text-slate-400">{icon}</span> : null}
      <span className="min-w-0">
        <strong>{label}:</strong>{" "}
        <span className={`break-all ${mono ? "font-mono" : ""}`}>{value}</span>
      </span>
    </p>
  );
}

function AuditJson({ title, value, empty }: { title: string; value: unknown; empty: string }) {
  const hasValue = value !== null && value !== undefined && (!Array.isArray(value) || value.length > 0);
  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
      <h3 className="border-b border-slate-200 bg-slate-100 px-3 py-2 text-[11px] font-black dark:border-slate-800 dark:bg-slate-950">{title}</h3>
      {hasValue ? (
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all p-3 text-[10px] leading-5 text-slate-700 dark:text-slate-300">{formatAuditValue(value)}</pre>
      ) : (
        <p className="p-3 text-[11px] text-slate-500">{empty}</p>
      )}
    </section>
  );
}

function AuditInput({
  label,
  value,
  onChange,
  type = "text",
  maxLength,
  required = false,
  error,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "datetime-local";
  maxLength?: number;
  required?: boolean;
  error?: string;
  hint?: string;
}) {
  return (
    <label className="grid min-w-0 gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-300">
      <span>{label}{required ? " *" : ""}</span>
      <input
        type={type}
        value={value}
        maxLength={maxLength}
        aria-required={required}
        aria-invalid={Boolean(error)}
        onChange={(event) => onChange(event.target.value)}
        className={`min-w-0 rounded-xl border bg-white px-3 py-2 text-xs font-normal text-slate-950 outline-none focus:border-cyan-500 dark:bg-slate-950 dark:text-slate-100 ${error ? "border-rose-500" : "border-slate-300 dark:border-slate-700"}`}
      />
      {error ? <span role="alert" className="font-medium text-rose-600 dark:text-rose-300">{error}</span> : hint ? <span className="font-normal text-slate-400">{hint}</span> : null}
    </label>
  );
}

function AuditSelect({
  label,
  value,
  onChange,
  options,
  anyLabel,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  anyLabel: string;
}) {
  return (
    <label className="grid min-w-0 gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-300">
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-normal text-slate-950 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
      >
        <option value="">{anyLabel}</option>
        {options.map((option) => <option key={option} value={option}>{option.replaceAll("_", " ")}</option>)}
      </select>
    </label>
  );
}

function StatusPanel({
  icon,
  title,
  detail,
  tone = "neutral",
  action,
}: {
  icon: React.ReactNode;
  title: string;
  detail?: string;
  tone?: "neutral" | "warning" | "danger";
  action?: React.ReactNode;
}) {
  const colors = tone === "danger"
    ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"
    : tone === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
      : "border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300";
  return (
    <section className={`flex min-h-52 flex-col items-center justify-center rounded-2xl border p-6 text-center ${colors}`}>
      <span className="mb-3 opacity-70">{icon}</span>
      <h2 className="text-sm font-black">{title}</h2>
      {detail ? <p className="mt-1 max-w-2xl break-all text-xs opacity-80">{detail}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </section>
  );
}

function localizeValidationError(
  error: string | undefined,
  lang: "ar" | "en",
): string | undefined {
  if (!error || lang === "en") return error;
  const maximum = /^Maximum (\d+) characters\.$/.exec(error);
  if (maximum) return `الحد الأقصى ${maximum[1]} حرفًا.`;
  const translations: Record<string, string> = {
    "Enter a valid tenant UUID.": "أدخل معرف مستأجر UUID صالحًا.",
    "Entity type is required for entity history.": "نوع الكيان مطلوب لعرض سجل الكيان.",
    "Entity ID is required for entity history.": "معرف الكيان مطلوب لعرض سجل الكيان.",
    "Enter a valid start date and time.": "أدخل تاريخ ووقت بداية صالحين.",
    "Enter a valid end date and time.": "أدخل تاريخ ووقت نهاية صالحين.",
    "The start must be earlier than the exclusive end.": "يجب أن تكون البداية قبل وقت النهاية غير المشمول.",
  };
  return translations[error] ?? error;
}
