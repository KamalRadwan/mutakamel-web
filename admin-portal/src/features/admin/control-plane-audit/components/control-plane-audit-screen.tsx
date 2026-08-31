"use client";

import type { ReactNode } from "react";
import {
  Activity,
  Braces,
  ChevronDown,
  Clock3,
  Database,
  Filter,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  UserRound,
} from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import {
  PageHeader,
  Badge,
  Card,
  Field,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Button,
  StatusBadge,
  Pagination,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/design-system";
import { formatAuditValue } from "../lib/control-plane-audit-utils";
import { useControlPlaneAudit } from "../hooks/use-control-plane-audit";
import { useAuditEventDetail } from "../hooks/use-audit-event-detail";
import { CodeQualityBadge, FaultDomainBadge } from "./fault-domain-badge";
import {
  CONTROL_PLANE_AUDIT_ACTOR_TYPES,
  CONTROL_PLANE_AUDIT_OUTCOMES,
  CONTROL_PLANE_AUDIT_SOURCE_TYPES,
  type ControlPlaneAuditEventSummary,
  type ControlPlaneAuditFilterDraft,
} from "../types/control-plane-audit";

const COPY = {
  en: {
    title: "Control-plane audit",
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
    systemActor: "System / unattributed",
    notRecorded: "Not recorded",
    exclusiveEnd: "The end is exclusive.",
  },
  ar: {
    title: "سجل تدقيق منصة التحكم",
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
    <div className="w-full space-y-4">
      <PageHeader
        title={copy.title}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">
              {formatInteger(audit.data?.total ?? 0, lang)} {copy.events}
            </Badge>
            <Badge tone="neutral">
              {formatInteger(audit.activeFilterCount, lang)} {copy.activeFilters}
            </Badge>
          </div>
        }
      />

      {audit.isAuthLoading ? (
        <StatusPanel icon={<Loader2 className="size-7 animate-spin motion-reduce:animate-none" />} title={copy.loading} />
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
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Filter className="size-4 text-primary" aria-hidden="true" />
          {copy.filters}
        </h2>
        <div className="inline-flex rounded-md border border-input bg-muted p-1">
          {(
            [
              ["ALL_EVENTS", copy.allEvents],
              ["ENTITY_HISTORY", copy.entityHistory],
            ] as const
          ).map(([mode, label]) => (
            <Button
              key={mode}
              type="button"
              size="sm"
              variant={audit.mode === mode ? "secondary" : "ghost"}
              aria-pressed={audit.mode === mode}
              onClick={() => audit.setMode(mode)}
            >
              {label}
            </Button>
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
          <Field label={copy.pageSize}>
            {(fp) => (
              <Select value={String(audit.limit)} onValueChange={(value) => audit.setLimit(Number(value))}>
                <SelectTrigger id={fp.id} aria-describedby={fp["aria-describedby"]} aria-invalid={fp["aria-invalid"]}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[25, 50, 100].map((value) => (
                    <SelectItem key={value} value={String(value)}>
                      {formatInteger(value, lang)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
        </div>

        {audit.validationErrors.dateRange ? (
          <p role="alert" className="text-sm font-semibold text-destructive-subtle-foreground">
            {localizeValidationError(audit.validationErrors.dateRange, lang)}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" onClick={audit.clearFilters}>
            <RotateCcw className="size-3.5" aria-hidden="true" />
            {copy.clear}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={audit.refresh}
            disabled={audit.requestState === "IDLE"}
          >
            <RefreshCw
              className={`size-3.5 ${audit.isRefreshing ? "animate-spin motion-reduce:animate-none" : ""}`}
              aria-hidden="true"
            />
            {copy.refresh}
          </Button>
          <Button type="submit" variant="primary">
            <Filter className="size-3.5" aria-hidden="true" />
            {copy.apply}
          </Button>
        </div>
      </form>
    </Card>
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
    return <StatusPanel icon={<Loader2 className="size-7 animate-spin motion-reduce:animate-none" />} title={copy.loading} />;
  }
  if (audit.requestState === "FORBIDDEN") {
    return <StatusPanel icon={<ShieldAlert className="size-7" />} title={copy.forbidden} detail={copy.permission} tone="warning" />;
  }
  if (audit.requestState === "UNAVAILABLE") {
    const detail = [
      audit.error?.message,
      audit.error?.correlationId ? `${copy.correlationId}: ${audit.error.correlationId}` : undefined,
    ].filter(Boolean).join(" · ");
    return (
      <StatusPanel
        icon={<ShieldAlert className="size-7" />}
        title={copy.unavailable}
        detail={detail}
        tone="danger"
        action={
          <Button type="button" variant="outline" onClick={audit.refresh}>
            {copy.retry}
          </Button>
        }
      />
    );
  }
  if (audit.requestState === "EMPTY" || !audit.data?.items.length) {
    return <StatusPanel icon={<Braces className="size-7" />} title={copy.empty} />;
  }

  return (
    <section aria-labelledby="audit-results-title" className="space-y-3">
      <div className="flex items-center justify-between border-b border-border p-4">
        <h2 id="audit-results-title" className="flex items-center gap-2 text-sm font-semibold">
          <Activity className="size-4 text-primary" aria-hidden="true" />
          {audit.mode === "ENTITY_HISTORY" ? copy.entityHistory : copy.allEvents}
        </h2>
        {audit.isRefreshing ? (
          <Loader2 className="size-4 animate-spin text-primary motion-reduce:animate-none" aria-label={copy.loading} />
        ) : null}
      </div>
      <div className="space-y-3 p-3 sm:p-4">
        {audit.data.items.map((event) => (
          <AuditEventCard key={event.id} event={event} copy={copy} lang={lang} />
        ))}
      </div>
      <Pagination
        page={audit.data.page}
        limit={audit.data.limit}
        totalItems={audit.data.total}
        totalPages={Math.max(1, audit.data.totalPages)}
        onPageChange={audit.setPage}
      />
    </section>
  );
}

function AuditEventCard({
  event,
  copy,
  lang,
}: {
  event: ControlPlaneAuditEventSummary;
  copy: Copy;
  lang: "ar" | "en";
}) {
  const detail = useAuditEventDetail(event.id);

  return (
    <article className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={event.outcome} />
            {/*
              A failure row says which kind of failure it is before anyone
              opens it. Scanning thousands of identical FAILURE badges, an
              operator could not tell an expired session from a crash; the
              domain is the one word that separates them.
            */}
            {event.faultDomain ? (
              <FaultDomainBadge domain={event.faultDomain} lang={lang} />
            ) : null}
            {event.codeQuality ? (
              <CodeQualityBadge quality={event.codeQuality} lang={lang} />
            ) : null}
            <strong dir="ltr" className="break-all font-mono text-sm text-action">
              {event.action}
            </strong>
          </div>
          <p className="mt-2 break-all text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{copy.entity}:</span> {event.entityType}
            {event.entityId ? <> / <bdi dir="ltr">{event.entityId}</bdi></> : null}
          </p>
        </div>
        <time dateTime={event.occurredAt} className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm text-muted-foreground">
          <Clock3 className="size-3.5" aria-hidden="true" />
          {new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-US", {
            dateStyle: "medium",
            timeStyle: "medium",
            timeZone: "UTC",
          }).format(new Date(event.occurredAt))}
        </time>
      </div>

      <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
        <EvidenceDatum icon={<UserRound className="size-3.5" />} label={copy.actor} value={event.actorLabel || event.actorId || copy.systemActor} />
        <EvidenceDatum icon={<Activity className="size-3.5" />} label={copy.source} value={`${event.sourceApp} / ${event.sourceType}`} />
        <EvidenceDatum icon={<Braces className="size-3.5" />} label={copy.correlationId} value={event.correlationId || copy.notRecorded} mono />
      </div>

      <Collapsible
        className="mt-3 rounded-md border border-border bg-muted"
        onOpenChange={(open) => {
          if (open) detail.load();
        }}
      >
        <CollapsibleTrigger asChild>
          <Button type="button" variant="ghost" className="group w-full justify-between rounded-none px-3 text-action" aria-label={`${copy.evidence}: ${event.action}`}>
            {copy.evidence}
            <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 border-t border-border p-3">
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
            <div className="rounded-md border border-warning bg-warning-subtle p-3 text-sm text-warning-subtle-foreground">
              <strong>{copy.reason}:</strong> {event.reason}
            </div>
          ) : null}
          {detail.status === "LOADING" || detail.status === "IDLE" ? (
            <div className="flex items-center gap-2 rounded-md border border-border p-4 text-sm text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              {copy.loading}
            </div>
          ) : detail.status === "UNAVAILABLE" ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive bg-destructive-subtle p-3 text-sm text-destructive-subtle-foreground">
              <span>{detail.error?.message || copy.unavailable}</span>
              <Button type="button" size="sm" variant="outline" onClick={detail.retry}>
                {copy.retry}
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 xl:grid-cols-2">
              <AuditJson title={copy.before} value={detail.data?.before ?? null} empty={copy.noSnapshot} />
              <AuditJson title={copy.after} value={detail.data?.after ?? null} empty={copy.noSnapshot} />
              <AuditJson title={copy.diff} value={detail.data?.diff ?? []} empty={copy.noSnapshot} />
              <AuditJson title={copy.metadata} value={detail.data?.metadata ?? null} empty={copy.noSnapshot} />
            </div>
          )}
          <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            <p><strong className="text-foreground">IP:</strong> <span dir="ltr">{event.ip || copy.notRecorded}</span></p>
            <p className="break-all"><strong className="text-foreground">User-Agent:</strong> <span dir="ltr">{event.userAgent || copy.notRecorded}</span></p>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </article>
  );
}

function EvidenceDatum({
  icon,
  label,
  value,
  mono = false,
}: {
  icon?: ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <p className="flex min-w-0 items-start gap-1.5 rounded-md bg-muted px-2.5 py-2">
      {icon ? <span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span> : null}
      <span className="min-w-0">
        <strong className="text-foreground">{label}:</strong>{" "}
        <span dir={mono ? "ltr" : undefined} className={`break-all ${mono ? "font-mono" : ""}`}>{value}</span>
      </span>
    </p>
  );
}

function AuditJson({ title, value, empty }: { title: string; value: unknown; empty: string }) {
  const hasValue = value !== null && value !== undefined && (!Array.isArray(value) || value.length > 0);
  return (
    <section className="min-w-0 overflow-hidden rounded-md border border-border">
      <h3 className="border-b border-border bg-muted px-3 py-2 text-sm font-semibold">{title}</h3>
      {hasValue ? (
        <pre tabIndex={0} aria-label={title} className="max-h-72 overflow-auto whitespace-pre-wrap break-all p-3 text-sm leading-5 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">{formatAuditValue(value)}</pre>
      ) : (
        <p className="p-3 text-sm text-muted-foreground">{empty}</p>
      )}
    </section>
  );
}

function formatInteger(value: number, lang: "ar" | "en"): string {
  return new Intl.NumberFormat(lang === "ar" ? "ar-EG" : "en-US", {
    maximumFractionDigits: 0,
  }).format(value);
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
    <Field label={label} required={required} error={error} hint={hint}>
      {(fp) => (
        <Input
          id={fp.id}
          aria-describedby={fp["aria-describedby"]}
          aria-invalid={fp["aria-invalid"]}
          aria-required={fp.required}
          type={type}
          value={value}
          maxLength={maxLength}
          invalid={Boolean(error)}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </Field>
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
    <Field label={label}>
      {(fp) => (
        <Select value={value || "ANY"} onValueChange={(next) => onChange(next === "ANY" ? "" : next)}>
          <SelectTrigger id={fp.id} aria-describedby={fp["aria-describedby"]} aria-invalid={fp["aria-invalid"]}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ANY">{anyLabel}</SelectItem>
            {options.map((option) => (
              <SelectItem key={option} value={option}>
                {option.replaceAll("_", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </Field>
  );
}

function StatusPanel({
  icon,
  title,
  detail,
  tone = "neutral",
  action,
}: {
  icon: ReactNode;
  title: string;
  detail?: string;
  tone?: "neutral" | "warning" | "danger";
  action?: ReactNode;
}) {
  const colors = tone === "danger"
    ? "border-destructive bg-destructive-subtle text-destructive-subtle-foreground"
    : tone === "warning"
      ? "border-warning bg-warning-subtle text-warning-subtle-foreground"
      : "border-border bg-card text-muted-foreground";
  return (
    <section role={tone === "neutral" ? "status" : "alert"} className={`flex min-h-52 flex-col items-center justify-center rounded-lg border p-6 text-center ${colors}`}>
      <span className="mb-3 opacity-70">{icon}</span>
      <h2 className="text-sm font-semibold">{title}</h2>
      {detail ? <p className="mt-1 max-w-2xl break-all text-sm opacity-80">{detail}</p> : null}
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
