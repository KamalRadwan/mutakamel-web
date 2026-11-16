"use client";

import { useEffect, useId, useState } from "react";
import { CalendarDays } from "lucide-react";
import { Badge, Button, Card, DateTime, Field, hasPermission, Input } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useAuthScopeKey } from "@/hooks/useAuthScopeKey";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError } from "@/lib/api/errors";
import { can } from "@/lib/auth/permission-scope";
import { formatNumber } from "@/lib/format/number";
import { invalidResponse, record, timestamp } from "../../dashboard-parse";
import { useWidgetSafety } from "../../../widgets/hooks/useWidgetSafety";
import { assertWidgetStatus, WIDGET_READ, WIDGET_WRITE } from "../../../widgets/hooks/widget-requests";
import { ReportSelect } from "./CohortReportFilters";

const DAY_MS = 86_400_000;
const MAX_REVISION = 2_147_483_647;
const MANAGE = "crm.targets.manage";
type CalendarKey = { branchId: string; year: number };
type CalendarReceipt = { revision: number; workingDays: string | null; publishedAt: string | null };

function yearLength(year: number) {
  return (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / DAY_MS;
}

function parseCalendar(value: unknown, { branchId, year }: CalendarKey): CalendarReceipt {
  const row = record(value);
  if (!row || row.branchId !== branchId || row.calendarYear !== year || typeof row.revision !== "number"
    || !Number.isInteger(row.revision) || row.revision < 0 || row.revision > MAX_REVISION) return invalidResponse("branch working calendar");
  const { revision, workingDays, publishedAt } = row;
  if (revision === 0 && workingDays === null && publishedAt === null) return { revision, workingDays, publishedAt };
  if (revision < 1 || typeof workingDays !== "string" || /[^01]/u.test(workingDays) || workingDays.length !== yearLength(year)
    || !timestamp(publishedAt)) return invalidResponse("branch working calendar");
  return { revision, workingDays, publishedAt };
}

export function WonTargetCalendarManager({ branches, initialYear, onPublished }: {
  branches: ReadonlyArray<{ id: string; name: string; companyName: string }>; initialYear?: string; onPublished: () => void;
}) {
  const { t } = useI18n();
  const labels = t.crmDashboardReports.wonTarget.calendar;
  const { user, realtimeAuthGeneration } = useTenantAuth();
  const authScope = useAuthScopeKey(user);
  const scope = user?.permissionScopes?.[MANAGE];
  const permitted = user?.isTenantOwner || hasPermission(user?.permissions ?? [], MANAGE, true);
  const eligible = permitted ? branches.filter(branch => user?.accessibleBranches.includes(branch.id)
    && (user.isTenantOwner || !scope || can(user, MANAGE, { branchId: branch.id }))) : [];
  const [open, setOpen] = useState(false);
  const [branch, setBranch] = useState("");
  const [yearInput, setYear] = useState<string>();
  const [selection, setSelection] = useState<CalendarKey>();
  const controls = useId();
  const branchId = eligible.some(item => item.id === branch) ? branch : eligible.length === 1 ? eligible[0].id : "";
  const year = yearInput ?? initialYear ?? "";
  const selectionVisible = selection && eligible.some(item => item.id === selection.branchId);
  if (!eligible.length) return null;
  return <>
    <Button type="button" variant="outline" aria-expanded={open} aria-controls={controls} onClick={() => setOpen(value => !value)}>
      <CalendarDays aria-hidden="true" />{labels.manage}
    </Button>
    <div id={controls} hidden={!open}>
      {open && <Card className="space-y-4 p-4">
        <div><h3 className="font-semibold">{labels.title}</h3><p className="text-sm text-muted-foreground">{labels.description}</p></div>
        <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_8rem_auto]">
          <ReportSelect label={t.crmDashboards.branch} value={branchId || "NONE"} onChange={setBranch}
            items={[{ id: "NONE", name: t.common.selectBranch }, ...eligible.map(item => ({ id: item.id, name: `${item.name} · ${item.companyName}` }))]} />
          <Field showLabel label={labels.year}><Input inputMode="numeric" dir="ltr" maxLength={4} value={year} onChange={event => setYear(event.target.value)} /></Field>
          <Button type="button" variant="outline" disabled={!branchId || !/^(?:20\d{2}|2100)$/u.test(year)
            || (selection?.branchId === branchId && selection.year === Number(year))}
          onClick={() => { setYear(year); setSelection({ branchId, year: Number(year) }); }}>{labels.load}</Button>
        </div>
        {selectionVisible && <WorkingCalendarEditor key={JSON.stringify([authScope, realtimeAuthGeneration, scope, selection])} selection={selection}
          branchName={eligible.find(item => item.id === selection.branchId)!.name} onPublished={onPublished} />}
      </Card>}
    </div>
  </>;
}

function WorkingCalendarEditor({ selection, branchName, onPublished }: { selection: CalendarKey; branchName: string; onPublished: () => void }) {
  const { t, lang } = useI18n();
  const labels = t.crmDashboardReports.wonTarget.calendar;
  const { branchId, year } = selection;
  const path = `/api/tenant/crm/v1/targets/working-calendars/${branchId}/${year}`;
  const safety = useWidgetSafety(path);
  const [readVersion, setReadVersion] = useState(0);
  const [receipt, setReceipt] = useState<CalendarReceipt>();
  const [days, setDays] = useState<string | null>(null);
  const [week, setWeek] = useState<number[]>([]);
  const [month, setMonth] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "readFailed" | "publishing" | "conflict" | "publishFailed" | "published">("loading");

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await axiosClient.get<unknown>(path, { ...WIDGET_READ, signal: controller.signal });
        if (controller.signal.aborted) return;
        assertWidgetStatus(response, 200);
        const result = parseCalendar(response.data, { branchId, year });
        setReceipt(result); setDays(result.workingDays); setStatus("ready");
      } catch {
        if (!controller.signal.aborted) setStatus("readFailed");
      }
    }
    void load();
    return () => controller.abort();
  }, [branchId, path, readVersion, year]);

  const reload = () => { setStatus("loading"); setReadVersion(version => version + 1); };
  const editable = status === "ready" || status === "published";
  const publish = async () => {
    if (!editable || !receipt || days === null || days === receipt.workingDays || receipt.revision >= MAX_REVISION) return;
    const ticket = safety.beginWrite(true);
    if (!ticket) return;
    setStatus("publishing");
    try {
      const response = await axiosClient.post<unknown>(path, { expectedRevision: receipt.revision, workingDays: days },
        { ...WIDGET_WRITE, skipAutoIdempotency: true });
      if (!safety.currentWrite(ticket)) return;
      assertWidgetStatus(response, 201);
      const result = parseCalendar(response.data, selection);
      if (result.revision !== receipt.revision + 1 || result.workingDays !== days) return invalidResponse("branch working calendar publication");
      setReceipt(result); setStatus("published"); onPublished();
    } catch (error) {
      if (safety.currentWrite(ticket)) setStatus(normalizeApiError(error).status === 409 ? "conflict" : "publishFailed");
    } finally {
      safety.finish(ticket);
    }
  };

  const start = Date.UTC(year, month, 1);
  const offset = (start - Date.UTC(year, 0, 1)) / DAY_MS;
  const monthLength = (Date.UTC(year, month + 1, 1) - start) / DAY_MS;
  const weekday = new Intl.DateTimeFormat(lang, { weekday: "short", timeZone: "UTC" });
  const date = new Intl.DateTimeFormat(lang, { dateStyle: "full", timeZone: "UTC", calendar: "gregory" });
  const monthLabel = new Intl.DateTimeFormat(lang, { month: "long", timeZone: "UTC", calendar: "gregory" });
  const monthName = monthLabel.format(start);
  const workdays = days?.replaceAll("0", "").length ?? 0;
  const generate = () => setDays(Array.from({ length: yearLength(year) }, (_, i) => week.includes(new Date(Date.UTC(year, 0, i + 1)).getUTCDay()) ? "1" : "0").join(""));

  return <section className="space-y-3 border-t border-border pt-4" aria-label={labels.title} aria-busy={status === "loading" || status === "publishing"}>
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <h4 className="font-medium"><bdi>{branchName}</bdi> · {formatNumber(year, lang, { useGrouping: false })}</h4>
      {receipt && <Badge tone="neutral">{receipt.revision ? `${labels.revision} ${formatNumber(receipt.revision, lang)}` : labels.unpublished}</Badge>}
      {receipt?.publishedAt && <DateTime value={receipt.publishedAt} />}
    </div>
    {status === "loading" && <p role="status" className="text-sm text-muted-foreground">{t.common.loading}</p>}
    {(status === "readFailed" || status === "conflict" || status === "publishFailed") && <div className="flex flex-wrap items-center gap-2" role="alert">
      <p className="text-sm">{labels[status]}</p><Button type="button" size="sm" variant="outline" onClick={reload}>{labels.reload}</Button>
    </div>}
    {receipt && <>
      <div className={days === null ? "space-y-3" : "grid gap-4 lg:grid-cols-[minmax(15rem,1fr)_minmax(0,1.4fr)]"}>
      <fieldset className="space-y-2 rounded-lg border border-border p-3"><legend className="px-1 text-sm font-medium">{labels.week}</legend>
        <div className="flex flex-wrap gap-1">{Array.from({ length: 7 }, (_, day) => <Button type="button" key={day} size="sm" variant={week.includes(day) ? "primary" : "outline"}
          aria-pressed={week.includes(day)} disabled={!editable || !safety.canMutate} onClick={() => setWeek(values => values.includes(day) ? values.filter(value => value !== day) : [...values, day])}>
          {weekday.format(Date.UTC(2023, 0, day + 1))}</Button>)}</div>
        <Button type="button" size="sm" variant="outline" disabled={!editable || !safety.canMutate} onClick={generate}>{labels.generate}</Button>
        <p className="text-xs text-muted-foreground">{labels.generateHint}</p>
      </fieldset>
      {days !== null && <div className="space-y-2 rounded-lg border border-border p-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <Button type="button" size="sm" variant="outline" disabled={month === 0} onClick={() => setMonth(value => value - 1)}>{labels.previousMonth}</Button>
          <ReportSelect label={labels.month} value={String(month)} onChange={value => setMonth(Number(value))}
            items={Array.from({ length: 12 }, (_, value) => ({ id: String(value), name: monthLabel.format(Date.UTC(year, value, 1)) }))} />
          <Button type="button" size="sm" variant="outline" disabled={month === 11} onClick={() => setMonth(value => value + 1)}>{labels.nextMonth}</Button>
        </div>
        <div className="grid grid-cols-7 gap-1" aria-label={monthName}>
          {Array.from({ length: 7 }, (_, day) => <span key={`weekday-${day}`} className="text-center text-xs text-muted-foreground">{weekday.format(Date.UTC(2023, 0, day + 1))}</span>)}
          {Array.from({ length: new Date(start).getUTCDay() }, (_, day) => <span key={`empty-${day}`} aria-hidden="true" />)}
          {Array.from({ length: monthLength }, (_, day) => <Button type="button" key={day} size="sm" className="min-h-10 px-1" variant={days[offset + day] === "1" ? "primary" : "outline"}
            aria-pressed={days[offset + day] === "1"} aria-label={date.format(start + day * DAY_MS)} disabled={!editable || !safety.canMutate}
            onClick={() => setDays(current => current === null ? null : current.slice(0, offset + day) + (current[offset + day] === "1" ? "0" : "1") + current.slice(offset + day + 1))}>
            {formatNumber(day + 1, lang)}</Button>)}
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="size-3 rounded-sm bg-primary" />{labels.workingDay}</span>
          <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="size-3 rounded-sm border border-border" />{labels.nonWorkingDay}</span>
        </div>
      </div>}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" disabled={!editable || !safety.canMutate || safety.busy || safety.blocked || days === null || days === receipt.workingDays || receipt.revision >= MAX_REVISION}
          onClick={() => void publish()}>{labels.publish}</Button>
        {days !== null && <span className="text-sm text-muted-foreground">{labels.workdayTotal} {formatNumber(workdays, lang)}</span>}
        {status === "published" && <span role="status" className="text-sm">{labels.published}</span>}
      </div>
    </>}
  </section>;
}
