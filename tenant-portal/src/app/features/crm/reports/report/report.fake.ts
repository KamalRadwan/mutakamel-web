import {
  differenceInCalendarDays,
  endOfMonth,
  endOfQuarter,
  endOfYear,
  format,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
  subYears,
} from 'date-fns';
import type {
  FilterDescriptor,
  Panel,
  PanelCoverage,
  PanelManifest,
  PanelTable,
  ReportDomain,
  Visualization,
  WidgetExecution,
} from '../../../../shared/widgets/dashboard/analytics.model';
import {
  ApiError,
  FAKE_NOW,
  fakeId,
  idempotencyKeyOf,
  isUuidV7,
  pageOf,
  replayOf,
  validationFailed,
} from '../../../../shared/widgets/dashboard/analytics-api';
import { FAKE_CATALOG } from '../../../../shared/widgets/dashboard/fake/fake-catalog';
import { FAKE_BRANCHES, FAKE_PEOPLE, fakeLang } from '../../../../shared/widgets/dashboard/fake/fake-org';
import { fakeReceipt } from '../../../../shared/widgets/dashboard/fake/fake-receipts';
import { fakeExecution, fakePanel } from '../../../../shared/widgets/dashboard/fake/fake-results';
import { assertReportKey } from '../catalogue/catalogue.api';
import { FAKE_REPORTS } from '../catalogue/catalogue.fake';
import type { ReportCatalogueItem } from '../catalogue/catalogue.model';
import type {
  DashboardListPage,
  DashboardListRow,
  PanelRowsPage,
  PanelRowsRequest,
  PinPanelRequest,
  PinPanelResponse,
  ReportRunRequest,
} from './report.model';

const DOMAIN_CHARTS: Record<ReportDomain, [Visualization, Visualization]> = {
  acquisition: ['COLUMN', 'DONUT'],
  'lead-conversion': ['FUNNEL', 'LINE'],
  'lead-lifecycle': ['STACKED_BAR', 'BAR'],
  'response-sla': ['HEATMAP', 'LINE'],
  pipeline: ['COMBO', 'DONUT'],
  'forecast-targets': ['WATERFALL', 'COLUMN'],
  activities: ['STACKED_BAR', 'HEATMAP'],
  'team-performance': ['BAR', 'LINE'],
  customers: ['AREA', 'DONUT'],
  commercial: ['COLUMN', 'LINE'],
  email: ['LINE', 'DONUT'],
  'data-governance': ['STACKED_BAR', 'COLUMN'],
};

const METHOD_CARDS: Record<ReportDomain, { en: string; ar: string }> = {
  acquisition: {
    en: 'Counts new leads created within the selected period grouped by acquisition channel and branch. Duplicate merged records are counted once using the earliest creation date.',
    ar: 'يحسب العملاء المحتملين الجدد المنشئين خلال الفترة المحددة مصنفين حسب قناة الاكتساب والفرع. تُحتسب السجلات المدمجة مرة واحدة وفق أقدم تاريخ إنشاء.',
  },
  'lead-conversion': {
    en: 'Tracks creation cohorts from initial intake through qualification and conversion. Conversion percentages show converted leads divided by total leads created in the same cohort.',
    ar: 'يتتبع أفواج الإنشاء من الاستقبال الأولي مرورًا بالتأهيل وحتى التحويل. تُحسب نسب التحويل بقسمة العملاء المحوّلين على إجمالي العملاء المحتملين المنشئين في الفوج نفسه.',
  },
  'lead-lifecycle': {
    en: 'Measures current lead inventory across active lifecycle stages as of the cutoff timestamp. Disqualified leads are separated from open pipeline counts.',
    ar: 'يقيس المخزون الحالي للعملاء المحتملين عبر مراحل دورة الحياة النشطة حتى وقت الرصد. تُفصل السجلات المستبعدة عن أعداد المسار المفتوح.',
  },
  'response-sla': {
    en: 'Computes elapsed business minutes between lead assignment and the first logged outbound touchpoint. Calculations respect the active branch working calendar when configured.',
    ar: 'يحسب دقائق العمل المنقضية بين إسناد العميل المحتمل وأول تفاعل صادر مسجل. تلتزم الحسابات بتقويم العمل المفعّل للفرع عند تهيئته.',
  },
  pipeline: {
    en: 'Evaluates open opportunities by stage as a current snapshot without mixing currencies. Each currency is reported separately and excluded records without currency appear in quality notes.',
    ar: 'يقيّم الفرص المفتوحة حسب المرحلة كلقطة حالية دون خلط العملات. تُعرض كل عملة على حدة وتُذكر السجلات المفتقرة للعملة في ملاحظات الجودة.',
  },
  'forecast-targets': {
    en: 'Compares closed-won revenue and weighted pipeline against approved branch and team targets. Only finalized targets in the active currency are included in attainment ratios.',
    ar: 'يقارن الإيرادات الرابحة ومسار البيع المرجّح بالمستهدفات المعتمدة للفروع والفرق. تُدرج المستهدفات المعتمدة فقط بالعملة النشطة ضمن نسب التحقق.',
  },
  activities: {
    en: 'Aggregates logged calls, meetings, emails, and tasks attributed to the selected owners and branches. Overdue items are evaluated against the report reference clock.',
    ar: 'يجمع المكالمات والاجتماعات ورسائل البريد والمهام المسجلة والمنسوبة للمالكين والفروع المحددين. تُقيّم العناصر المتأخرة مقارنة بساعة مرجع التقرير.',
  },
  'team-performance': {
    en: 'Ranks teams and representatives using verified conversions, win rates, and closed deal values. Multi-currency revenue columns remain separated by currency code.',
    ar: 'يرتب الفرق والمندوبين استنادًا إلى التحويلات الموثقة ومعدلات الربح وقيم الصفقات المغلقة. تبقى أعمدة الإيرادات متعددة العملات مفصولة برمز العملة.',
  },
  customers: {
    en: 'Analyzes active customer accounts, repeat orders, and retention trends across segments. Revenue metrics exclude cancelled commercial documents.',
    ar: 'يحلل حسابات العملاء النشطين والطلبات المتكررة واتجاهات الاحتفاظ عبر الشرائح. تستبعد مقاييس الإيرادات المستندات التجارية الملغاة.',
  },
  commercial: {
    en: 'Summarizes quotations, sales orders, and invoices issued within the selected event period. Draft and voided documents are excluded from totals.',
    ar: 'يلخص عروض الأسعار وأوامر البيع والفواتير الصادرة خلال فترة الحدث المحددة. تُستبعد المسودات والمستندات الملغاة من الإجماليات.',
  },
  email: {
    en: 'Measures outbound campaign deliveries, opens, and reply events attributed to CRM templates. Bounced recipients are separated before calculating engagement rates.',
    ar: 'يقيس عمليات تسليم الحملات البريدية والفتح والردود المنسوبة لقوالب إدارة العملاء. يُفصل المستلمون المرتدّون قبل حساب معدلات التفاعل.',
  },
  'data-governance': {
    en: 'Audits field completeness, historical coverage tiers, and source readiness across CRM modules. Missing values are flagged explicitly instead of defaulting to zero.',
    ar: 'يدقق اكتمال الحقول ومستويات التغطية التاريخية وجاهزية المصادر عبر وحدات إدارة العملاء. تُميّز القيم المفقودة صراحةً بدلًا من اعتبارها صفرًا.',
  },
};

interface SeedDashboard {
  id: string;
  ownerUserId: string;
  name: { en: string; ar: string };
  revision: number;
  accessLevel: DashboardListRow['accessLevel'];
  placements: number;
}

/** A dashboard holds at most 20 placements (report-pin.service.ts `DASHBOARD_PLACEMENT_LIMIT`). */
const DASHBOARD_PLACEMENT_LIMIT = 20;

const PIN_TARGETS: SeedDashboard[] = [
  {
    id: '01934b10-0000-7000-8000-000000001001',
    ownerUserId: FAKE_PEOPLE[0].id,
    name: { en: 'My sales board', ar: 'لوحة مبيعاتي' },
    revision: 3,
    accessLevel: 'OWNER',
    placements: 6,
  },
  {
    id: '01934b10-0000-7000-8000-000000001002',
    ownerUserId: FAKE_PEOPLE[1].id,
    name: { en: 'Cairo team overview', ar: 'نظرة عامة لفريق القاهرة' },
    revision: 2,
    accessLevel: 'EDIT',
    placements: 11,
  },
  {
    id: '01934b10-0000-7000-8000-000000001003',
    ownerUserId: FAKE_PEOPLE[0].id,
    name: { en: 'Executive pipeline', ar: 'مسار البيع التنفيذي' },
    revision: 5,
    accessLevel: 'OWNER',
    placements: DASHBOARD_PLACEMENT_LIMIT,
  },
  {
    id: '01934b10-0000-7000-8000-000000001004',
    ownerUserId: FAKE_PEOPLE[2].id,
    name: { en: 'Branch leaderboard', ar: 'لوحة صدارة الفروع' },
    revision: 1,
    accessLevel: 'VIEW',
    placements: 4,
  },
];

const PIN_IDEM_STORE = new Map<string, { fingerprint: string; response: PinPanelResponse }>();

const ANCHOR_DATE = new Date(2026, 10, 21);

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function parseIsoDay(raw: string): Date | null {
  const clean = raw.trim().slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(clean);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

function formatDay(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/** Backend `CRM_DATE_PRESETS` (engine/period-resolver.ts), with YESTERDAY the backend is adding (lead decision). */
const DATE_PRESETS = [
  'TODAY',
  'YESTERDAY',
  'CURRENT_WEEK',
  'CURRENT_MONTH',
  'CURRENT_QUARTER',
  'CURRENT_YEAR',
  'LAST_MONTH',
  'LAST_3_COMPLETE_MONTHS',
  'LAST_QUARTER',
  'LAST_YEAR',
  'LAST_7_DAYS',
  'LAST_30_DAYS',
  'LAST_90_DAYS',
  'CUSTOM',
] as const;
type DatePreset = (typeof DATE_PRESETS)[number];

/** A CUSTOM range may span at most 732 days, both ends included. */
const MAX_CUSTOM_SPAN_DAYS = 732;
const PRESET_PATTERN = /^[A-Z][A-Z0-9_]{1,40}$/;
const CIVIL_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function filterInvalid(): ApiError {
  return new ApiError(422, 'CRM_DASHBOARD_FILTER_INVALID');
}

/** `ReportPeriodDto` shape checks (400), run before the engine sees the period. */
function assertPeriodShape(period: ReportRunRequest['period'] | undefined): void {
  if (period?.preset !== undefined && !PRESET_PATTERN.test(period.preset)) {
    throw validationFailed('period.preset', 'matches');
  }
  if (period?.from !== undefined && !CIVIL_DAY_PATTERN.test(period.from)) {
    throw validationFailed('period.from', 'matches');
  }
  if (period?.to !== undefined && !CIVIL_DAY_PATTERN.test(period.to)) {
    throw validationFailed('period.to', 'matches');
  }
}

function presetWindow(preset: Exclude<DatePreset, 'CUSTOM'>): [Date, Date] {
  switch (preset) {
    case 'TODAY':
      return [ANCHOR_DATE, ANCHOR_DATE];
    case 'YESTERDAY': {
      const yesterday = subDays(ANCHOR_DATE, 1);
      return [yesterday, yesterday];
    }
    case 'CURRENT_WEEK':
      return [startOfWeek(ANCHOR_DATE, { weekStartsOn: 0 }), ANCHOR_DATE];
    case 'CURRENT_MONTH':
      return [startOfMonth(ANCHOR_DATE), ANCHOR_DATE];
    case 'CURRENT_QUARTER':
      return [startOfQuarter(ANCHOR_DATE), ANCHOR_DATE];
    case 'CURRENT_YEAR':
      return [startOfYear(ANCHOR_DATE), ANCHOR_DATE];
    case 'LAST_MONTH': {
      const prev = subMonths(ANCHOR_DATE, 1);
      return [startOfMonth(prev), endOfMonth(prev)];
    }
    case 'LAST_3_COMPLETE_MONTHS':
      return [subMonths(startOfMonth(ANCHOR_DATE), 3), endOfMonth(subMonths(ANCHOR_DATE, 1))];
    case 'LAST_QUARTER': {
      const prevQ = subMonths(ANCHOR_DATE, 3);
      return [startOfQuarter(prevQ), endOfQuarter(prevQ)];
    }
    case 'LAST_YEAR': {
      const prevY = subYears(ANCHOR_DATE, 1);
      return [startOfYear(prevY), endOfYear(prevY)];
    }
    case 'LAST_7_DAYS':
      return [subDays(ANCHOR_DATE, 6), ANCHOR_DATE];
    case 'LAST_30_DAYS':
      return [subDays(ANCHOR_DATE, 29), ANCHOR_DATE];
    case 'LAST_90_DAYS':
      return [subDays(ANCHOR_DATE, 89), ANCHOR_DATE];
  }
}

function resolvePeriod(
  period: ReportRunRequest['period'] | undefined,
  comparison: ReportRunRequest['comparison'] | undefined,
): PanelManifest['period'] {
  assertPeriodShape(period);
  const kind = period?.preset ?? (period?.from || period?.to ? 'CUSTOM' : 'CURRENT_MONTH');
  if (!(DATE_PRESETS as readonly string[]).includes(kind)) throw filterInvalid();
  const preset = kind as DatePreset;

  let fromDate: Date;
  let toDate: Date;
  if (preset === 'CUSTOM') {
    const parsedFrom = period?.from ? parseIsoDay(period.from) : null;
    const parsedTo = period?.to ? parseIsoDay(period.to) : null;
    if (!parsedFrom || !parsedTo || parsedFrom > parsedTo) throw filterInvalid();
    const spanDays = differenceInCalendarDays(parsedTo, parsedFrom) + 1;
    if (spanDays > MAX_CUSTOM_SPAN_DAYS) {
      // period-resolver.ts: numbers travel as decimal strings.
      throw new ApiError(422, 'CRM_DASHBOARD_DATE_RANGE_EXCEEDED', {
        maxDays: [String(MAX_CUSTOM_SPAN_DAYS)],
        requestedDays: [String(spanDays)],
      });
    }
    fromDate = parsedFrom;
    toDate = parsedTo;
  } else {
    [fromDate, toDate] = presetWindow(preset);
  }
  const diff = differenceInCalendarDays(toDate, fromDate);

  let compBlock: PanelManifest['period']['comparison'];
  if (comparison?.kind === 'PREVIOUS_PERIOD') {
    const span = Math.max(0, diff);
    const prevTo = subDays(fromDate, 1);
    const prevFrom = subDays(prevTo, span);
    compBlock = { kind: 'PREVIOUS_PERIOD', from: formatDay(prevFrom), to: formatDay(prevTo) };
  } else if (comparison?.kind === 'PREVIOUS_YEAR') {
    compBlock = {
      kind: 'PREVIOUS_YEAR',
      from: formatDay(subYears(fromDate, 1)),
      to: formatDay(subYears(toDate, 1)),
    };
  }

  return {
    kind,
    from: formatDay(fromDate),
    to: formatDay(toDate),
    ...(compBlock ? { comparison: compBlock } : {}),
  };
}

export function catalogDefaultHeight(kind: Visualization): number {
  const entry = FAKE_CATALOG.visualizations.find((v) => v.key === kind);
  return entry?.defaultSize.h ?? 46;
}

function buildFilterSchema(domain: ReportDomain): FilterDescriptor[] {
  const schema: FilterDescriptor[] = [
    {
      key: 'period',
      kind: 'PERIOD',
      label: { en: 'Period', ar: 'الفترة' },
      required: true,
      defaultValue: 'CURRENT_MONTH',
    },
    {
      key: 'comparison',
      kind: 'COMPARISON',
      label: { en: 'Comparison', ar: 'المقارنة' },
      options: ['NONE', 'PREVIOUS_PERIOD', 'PREVIOUS_YEAR'],
      defaultValue: 'NONE',
    },
    {
      key: 'branchIds',
      kind: 'BRANCH',
      label: { en: 'Branches', ar: 'الفروع' },
      multiple: true,
    },
    {
      key: 'ownerUserId',
      kind: 'OWNER',
      label: { en: 'Owner', ar: 'المالك' },
    },
    {
      key: 'pipelineId',
      kind: 'PIPELINE',
      label: { en: 'Pipeline', ar: 'مسار البيع' },
    },
  ];

  if (domain === 'acquisition' || domain === 'lead-conversion') {
    schema.push({
      key: 'sourceId',
      kind: 'SOURCE',
      label: { en: 'Source', ar: 'المصدر' },
    });
  }

  if (
    domain === 'pipeline' ||
    domain === 'forecast-targets' ||
    domain === 'commercial' ||
    domain === 'customers'
  ) {
    schema.push({
      key: 'currencyCode',
      kind: 'CURRENCY',
      label: { en: 'Currency', ar: 'العملة' },
      defaultValue: 'EGP',
    });
  }

  return schema;
}

const REPORT_MAX_PANELS = 24;
const REPORT_FILTER_KEY_LIMIT = 32;
const MAX_ID_SELECTION = 500;
const PANEL_KEY = /^[a-z][a-z0-9-]{0,79}$/;
const FILTER_KEY = /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/;
const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Filter kinds whose values are record ids (panel-manifest.compiler.ts `ID_FILTER_KINDS`). */
const ID_FILTER_KINDS = new Set(['COMPANY', 'BRANCH', 'TEAM', 'OWNER', 'PIPELINE', 'SOURCE']);

/** `filters`: a plain object of at most 32 identifier keys (`BoundedFilters`). */
function assertFiltersShape(filters: Record<string, unknown> | undefined): void {
  if (filters === undefined) return;
  const keys = Object.keys(filters);
  if (keys.length > REPORT_FILTER_KEY_LIMIT || keys.some((key) => !FILTER_KEY.test(key))) {
    throw validationFailed('filters', 'bounded_report_filters');
  }
}

/** `ReportRunRequestDto` checks the global ValidationPipe makes (400). */
function assertRunShape(body: ReportRunRequest): void {
  const panelKeys = body.panelKeys;
  if (panelKeys) {
    if (panelKeys.length > REPORT_MAX_PANELS) throw validationFailed('panelKeys', 'array_max_size');
    if (new Set(panelKeys).size !== panelKeys.length) throw validationFailed('panelKeys', 'array_unique');
    if (panelKeys.some((key) => !PANEL_KEY.test(key))) throw validationFailed('panelKeys', 'matches');
  }
  assertFiltersShape(body.filters);
}

/** One declared filter value (panel-manifest.compiler.ts `assertFilterValue`): 422 `CRM_DASHBOARD_FILTER_INVALID`. */
function assertFilterValue(desc: FilterDescriptor, value: unknown): void {
  if (ID_FILTER_KINDS.has(desc.kind)) {
    const values = desc.multiple && Array.isArray(value) ? value : [value];
    const badSelection = desc.multiple && Array.isArray(value) && (value.length === 0 || value.length > MAX_ID_SELECTION);
    if (badSelection || values.some((entry) => typeof entry !== 'string' || !ID_PATTERN.test(entry))) {
      throw filterInvalid();
    }
    return;
  }
  if (desc.kind === 'ENUM') {
    const values = desc.multiple && Array.isArray(value) ? value : [value];
    if (desc.options && values.some((entry) => typeof entry !== 'string' || !desc.options!.includes(entry))) {
      throw filterInvalid();
    }
    return;
  }
  if (desc.kind === 'NUMBER') {
    const outOfRange =
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      (desc.min !== undefined && value < desc.min) ||
      (desc.max !== undefined && value > desc.max);
    if (outOfRange) throw filterInvalid();
  }
}

/** Only declared filters are checked; undeclared keys and empty values are ignored, as the engine does. */
function validateFilters(filters: Record<string, unknown> | undefined, schema: readonly FilterDescriptor[]): void {
  const byKey = new Map(schema.map((d) => [d.key, d]));
  for (const [key, value] of Object.entries(filters ?? {})) {
    const desc = byKey.get(key);
    if (!desc || value === undefined || value === null) continue;
    assertFilterValue(desc, value);
  }
}

function applyScale(exec: WidgetExecution, factor: number, currency: string, period: PanelManifest['period']): WidgetExecution {
  const next = structuredClone(exec);
  next.meta.effectivePeriod = { from: period.from, to: period.to, timeZone: 'Africa/Cairo' };
  if (next.meta.currency) {
    next.meta.currency = currency;
  }

  const scaleVal = (val: number | null | undefined, isPercentOrRatio: boolean): number | null => {
    if (val === null || val === undefined || !Number.isFinite(val)) return null;
    if (isPercentOrRatio) {
      const shifted = val * (0.94 + factor * 0.08);
      return Number(Math.min(100, Math.max(0, shifted)).toFixed(1));
    }
    return Math.max(1, Math.round(val * factor));
  };

  if (typeof next.value === 'number') {
    const isPct = next.meta.unit === 'PERCENT' || next.meta.unit === 'RATIO';
    next.value = scaleVal(next.value, isPct);
  }
  if (typeof next.target === 'number') {
    next.target = Math.max(1, Math.round(next.target * factor));
  }

  for (const s of next.series) {
    if (s.currency) s.currency = currency;
    const isPct = s.unit === 'PERCENT' || s.unit === 'RATIO';
    for (const p of s.points) {
      if (p.value !== null) {
        p.value = scaleVal(p.value, isPct);
      }
      if (p.previousValue !== undefined) {
        const scaledPrev = scaleVal(p.previousValue, isPct);
        if (scaledPrev !== null) p.previousValue = scaledPrev;
      }
    }
  }

  if (next.rows) {
    for (const row of next.rows) {
      for (const [k, v] of Object.entries(row)) {
        if (typeof v === 'number' && k !== 'rank') {
          row[k] = Math.max(1, Math.round(v * factor));
        }
      }
    }
  }

  return next;
}

function buildPanelTable(
  item: ReportCatalogueItem,
  currency: string,
  factor: number,
  lang: 'ar' | 'en',
): PanelTable {
  const L = (en: string, ar: string) => (lang === 'ar' ? ar : en);
  const stages = [
    { en: 'Qualification', ar: 'التأهيل', count: 22, value: 1_320_000, age: 9 },
    { en: 'Proposal', ar: 'عرض السعر', count: 18, value: 1_480_000, age: 14 },
    { en: 'Negotiation', ar: 'التفاوض', count: 12, value: 1_240_000, age: 21 },
    { en: 'Contract', ar: 'التعاقد', count: 6, value: 400_000, age: 5 },
  ];

  const currencyScale = currency === 'USD' ? 0.02 : currency === 'SAR' ? 0.08 : 1;
  const rows = stages.map((st, idx) => {
    const count = Math.max(1, Math.round(st.count * factor));
    const value = Math.max(1000, Math.round(st.value * factor * currencyScale));
    const share = Number((idx === 0 ? 37.9 : idx === 1 ? 31.0 : idx === 2 ? 20.7 : 10.4).toFixed(1));
    return [L(st.en, st.ar), count, share, value, st.age];
  });

  const totalCount = rows.reduce((sum, r) => sum + Number(r[1] ?? 0), 0);
  const totalValue = rows.reduce((sum, r) => sum + Number(r[3] ?? 0), 0);
  const avgAge = Math.round(stages.reduce((sum, s) => sum + s.age, 0) / stages.length);

  return {
    columns: [
      { key: 'stage', label: { en: 'Segment', ar: 'الفئة' }, unit: 'TEXT', reconciles: true },
      {
        key: 'count',
        label: item.domain === 'pipeline' ? { en: 'Opportunities', ar: 'الفرص' } : { en: 'Records', ar: 'السجلات' },
        unit: 'COUNT',
        reconciles: true,
      },
      { key: 'share', label: { en: 'Share', ar: 'الحصة' }, unit: 'PERCENT', reconciles: false },
      { key: 'value', label: { en: `Value (${currency})`, ar: `القيمة (${currency})` }, unit: 'MONEY', reconciles: true },
      { key: 'avgAge', label: { en: 'Average age (d)', ar: 'متوسط العمر (ي)' }, unit: 'COUNT', reconciles: false },
    ],
    rows,
    totals: [L('Total', 'الإجمالي'), totalCount, 100, totalValue, avgAge],
    reconciles: true,
    pageInfo: { limit: 25, hasMore: true, nextCursor: 'MjU' },
  };
}

function makePanelWithExecution(
  panelKey: string,
  title: { en: string; ar: string },
  kind: Visualization,
  opts: {
    reportKey: string;
    seed: number;
    currency: string;
    factor: number;
    comparison: boolean;
    period: PanelManifest['period'];
    state: Panel['state'];
    reasonCode?: string;
    coverage?: PanelCoverage;
    experimental?: boolean;
    layout: { x: number; y: number; w: number; h: number };
    customTable?: PanelTable;
    pageable?: boolean;
  },
): Panel {
  const base = fakePanel(panelKey, title, kind, {
    state: opts.state,
    reasonCode: opts.reasonCode,
    coverage: opts.coverage,
  });

  if (opts.state === 'READY' || opts.state === 'PARTIAL') {
    const execCurrency = opts.currency === 'USD' ? 'USD' : 'EGP';
    const rawExec = fakeExecution(kind, {
      id: panelKey,
      state: 'READY',
      seed: opts.seed,
      currency: execCurrency,
      comparison: opts.comparison,
    });
    const scaled = applyScale(rawExec, opts.factor, opts.currency, opts.period);
    if (opts.customTable && kind === 'TABLE') {
      scaled.rows = opts.customTable.rows.map((row, idx) => ({
        key: `row-${idx}`,
        stage: row[0],
        count: row[1],
        share: row[2],
        value: row[3],
        avgAge: row[4],
      }));
      scaled.series = [
        {
          key: 'count',
          label: fakeLang() === 'ar' ? opts.customTable.columns[1].label.ar : opts.customTable.columns[1].label.en,
          unit: 'COUNT',
          axis: 'LEFT',
          points: opts.customTable.rows.map((r, i) => ({
            key: `r-${i}`,
            label: String(r[0]),
            value: Number(r[1]),
          })),
        },
        {
          key: 'value',
          label: fakeLang() === 'ar' ? opts.customTable.columns[3].label.ar : opts.customTable.columns[3].label.en,
          unit: 'MONEY',
          axis: 'RIGHT',
          currency: opts.currency,
          points: opts.customTable.rows.map((r, i) => ({
            key: `r-${i}`,
            label: String(r[0]),
            value: Number(r[3]),
          })),
        },
      ];
    }
    base.result = scaled;
    base.receiptId = fakeReceipt(base.metricKeys[0] ?? 'crm.leads.created.count', {
      reportKey: opts.reportKey,
      panelKey,
      value: scaled.value ?? scaled.series[0]?.points[0]?.value ?? null,
      numerator: typeof scaled.details?.['numerator'] === 'number' ? scaled.details['numerator'] : undefined,
      denominator: typeof scaled.details?.['denominator'] === 'number' ? scaled.details['denominator'] : undefined,
      unit: scaled.meta.unit ?? scaled.series[0]?.unit ?? 'COUNT',
      currencyCode: scaled.meta.currency ?? scaled.series[0]?.currency,
    });
  }

  if (opts.customTable && (opts.state === 'READY' || opts.state === 'PARTIAL')) {
    base.table = opts.customTable;
  }

  base.experimental = Boolean(opts.experimental);
  if (opts.state === 'UNAVAILABLE' || opts.state === 'DENIED' || opts.state === 'RETIRED') {
    base.pageable = false;
    base.pinnable = false;
  } else {
    base.pageable = opts.pageable ?? base.pageable;
  }

  base.layout = { desktop: opts.layout };
  return base;
}

export function findCatalogueReport(reportKey: string): ReportCatalogueItem | undefined {
  return FAKE_REPORTS.find((r) => r.reportKey === reportKey);
}

/**
 * `GET .../manifest` (isRun false) or `POST .../reports/:reportKey` (isRun true). A run sends `filters.schema` back
 * only when the request asks for it with `includeFilterSchema`.
 */
export function buildFakeManifest(
  reportKey: string,
  body: ReportRunRequest = {},
  isRun = false,
): PanelManifest {
  assertReportKey(reportKey);
  if (isRun) assertRunShape(body);
  const item = findCatalogueReport(reportKey);
  if (!item) {
    throw new ApiError(404, 'CRM_REPORT_NOT_FOUND');
  }

  const schema = buildFilterSchema(item.domain);
  validateFilters(body.filters, schema);

  const period = resolvePeriod(body.period, body.comparison);
  const filtersObj = body.filters ?? {};
  const branchIds = Array.isArray(filtersObj['branchIds'])
    ? filtersObj['branchIds'].filter((id): id is string => typeof id === 'string' && id.length > 0)
    : (body.scope?.branchIds ?? []);
  const currencyRaw = typeof filtersObj['currencyCode'] === 'string' && filtersObj['currencyCode']
    ? filtersObj['currencyCode']
    : 'EGP';
  const currency = currencyRaw === 'USD' || currencyRaw === 'SAR' ? currencyRaw : 'EGP';
  const hasComparison = Boolean(body.comparison?.kind && body.comparison.kind !== 'NONE');

  const filterSeed = hashString(
    JSON.stringify({
      reportKey,
      from: period.from,
      to: period.to,
      branchIds,
      owner: filtersObj['ownerUserId'] ?? null,
      pipeline: filtersObj['pipelineId'] ?? null,
      source: filtersObj['sourceId'] ?? null,
      currency,
    }),
  );
  const factor = 0.72 + ((filterSeed % 55) / 100);
  const lang = fakeLang();

  const kpiH = catalogDefaultHeight('METRIC_CARD');
  const multiH = catalogDefaultHeight('MULTI_KPI');
  const progH = catalogDefaultHeight('PROGRESS_CARD');
  const kpiRowH = Math.max(kpiH, multiH, progH);

  const [chartA, chartB] = DOMAIN_CHARTS[item.domain];
  const chartAH = catalogDefaultHeight(chartA);
  const chartBH = catalogDefaultHeight(chartB);
  const chartRowH = Math.max(chartAH, chartBH);
  const tableH = catalogDefaultHeight('TABLE');

  const fullyUnavailable = item.readiness === 'NOT_READY' || item.readiness === 'UNAVAILABLE';
  const degradedOrExp = item.readiness === 'EXPERIMENTAL' || item.readiness === 'DEGRADED';

  const partialCoverage: PanelCoverage = {
    trackingSince: '2026-06-01T00:00:00.000Z',
    tiers: { VERIFIED: 92, DERIVED: 18, BEFORE_TRACKING: 10 },
  };

  const tableSpec = buildPanelTable(item, currency, factor, lang);

  const allPanels: Panel[] = [
    makePanelWithExecution(
      'kpi-primary',
      { en: 'Conversion rate', ar: 'معدل التحويل' },
      'METRIC_CARD',
      {
        reportKey,
        seed: filterSeed + 1,
        currency,
        factor,
        comparison: hasComparison,
        period,
        state: fullyUnavailable ? 'UNAVAILABLE' : 'READY',
        reasonCode: fullyUnavailable ? 'SOURCE_NOT_READY:marketing.spend' : undefined,
        experimental: item.readiness === 'EXPERIMENTAL',
        layout: { x: 0, y: 0, w: 3, h: kpiH },
        pageable: false,
      },
    ),
    makePanelWithExecution(
      'kpi-target',
      { en: 'Target attainment', ar: 'تحقيق المستهدف' },
      'PROGRESS_CARD',
      {
        reportKey,
        seed: filterSeed + 2,
        currency,
        factor: factor * 1.04,
        comparison: hasComparison,
        period,
        state: fullyUnavailable ? 'UNAVAILABLE' : 'READY',
        reasonCode: fullyUnavailable ? 'SOURCE_NOT_READY:marketing.spend' : undefined,
        layout: { x: 3, y: 0, w: 3, h: progH },
        pageable: false,
      },
    ),
    makePanelWithExecution(
      'kpi-breakdown',
      { en: 'Volume breakdown', ar: 'توزيع الأحجام' },
      'MULTI_KPI',
      {
        reportKey,
        seed: filterSeed + 3,
        currency,
        factor,
        comparison: hasComparison,
        period,
        state: fullyUnavailable ? 'UNAVAILABLE' : 'READY',
        reasonCode: fullyUnavailable ? 'SOURCE_NOT_READY:marketing.spend' : undefined,
        layout: { x: 6, y: 0, w: 6, h: multiH },
        pageable: false,
      },
    ),
    makePanelWithExecution(
      'chart-primary',
      { en: 'Primary breakdown', ar: 'التوزيع الرئيسي' },
      chartA,
      {
        reportKey,
        seed: filterSeed + 5,
        currency,
        factor,
        comparison: hasComparison,
        period,
        state: fullyUnavailable ? 'UNAVAILABLE' : degradedOrExp ? 'PARTIAL' : 'READY',
        reasonCode: fullyUnavailable ? 'SOURCE_NOT_READY:marketing.spend' : undefined,
        coverage: degradedOrExp ? partialCoverage : undefined,
        experimental: item.readiness === 'EXPERIMENTAL',
        layout: { x: 0, y: kpiRowH, w: 6, h: chartAH },
        pageable: true,
      },
    ),
    makePanelWithExecution(
      'chart-secondary',
      { en: 'Trend & distribution', ar: 'الاتجاه والتوزيع' },
      chartB,
      {
        reportKey,
        seed: filterSeed + 6,
        currency,
        factor,
        comparison: hasComparison,
        period,
        state: fullyUnavailable || degradedOrExp ? 'UNAVAILABLE' : 'READY',
        reasonCode: fullyUnavailable || degradedOrExp ? 'SOURCE_NOT_READY:marketing.spend' : undefined,
        layout: { x: 6, y: kpiRowH, w: 6, h: chartBH },
        pageable: false,
      },
    ),
    makePanelWithExecution(
      'table-detail',
      { en: 'Detailed breakdown', ar: 'التفصيل الجدولي' },
      'TABLE',
      {
        reportKey,
        seed: filterSeed + 7,
        currency,
        factor,
        comparison: hasComparison,
        period,
        state: fullyUnavailable ? 'UNAVAILABLE' : 'READY',
        reasonCode: fullyUnavailable ? 'SOURCE_NOT_READY:marketing.spend' : undefined,
        layout: { x: 0, y: kpiRowH + chartRowH, w: 12, h: tableH },
        customTable: tableSpec,
        pageable: true,
      },
    ),
  ];

  const requestedKeys = body.panelKeys?.length ? new Set(body.panelKeys) : null;
  const panels = requestedKeys ? allPanels.filter((p) => requestedKeys.has(p.panelKey)) : allPanels;

  const applied: { key: string; value: unknown }[] = [
    { key: 'period', value: period.kind },
    { key: 'comparison', value: body.comparison?.kind ?? 'NONE' },
  ];
  for (const desc of schema) {
    if (desc.key === 'period' || desc.key === 'comparison') continue;
    if (desc.key in filtersObj && filtersObj[desc.key] !== undefined && filtersObj[desc.key] !== null) {
      applied.push({ key: desc.key, value: filtersObj[desc.key] });
    } else if (desc.defaultValue !== undefined) {
      applied.push({ key: desc.key, value: desc.defaultValue });
    }
  }

  const receiptIds = panels.map((p) => p.receiptId).filter((id): id is string => Boolean(id));
  const stale = reportKey === 'lead-lifecycle-inventory';

  return {
    manifestVersion: 2,
    report: {
      reportKey: item.reportKey,
      domain: item.domain,
      code: item.code,
      title: item.title,
      ...(item.summary ? { summary: item.summary } : {}),
      methodCard: METHOD_CARDS[item.domain],
      blueprintRevision: item.blueprintRevision,
    },
    scope: {
      basis: body.scope?.basis ?? 'CURRENT',
      asOf: body.scope?.asOf ?? FAKE_NOW,
      timeZone: 'Africa/Cairo',
      branchIds: branchIds.length > 0 ? branchIds : 'ALL',
      ownerMode: body.scope?.ownerMode ?? 'TEAM',
      fingerprint: `scope:${reportKey}:v1`,
    },
    period,
    filters: {
      applied,
      schema: isRun && !body.includeFilterSchema ? [] : schema,
    },
    panels,
    receipts: {
      runId: fakeId(),
      receiptIds,
    },
    freshness: {
      dataAsOf: '2026-11-21T08:30:00.000Z',
      oldestSourceAsOf: stale ? '2026-11-20T18:15:00.000Z' : '2026-11-21T08:25:00.000Z',
      stale,
    },
  };
}

export function buildFakePanelRows(
  reportKey: string,
  panelKey: string,
  body: PanelRowsRequest = {},
): PanelRowsPage {
  // `ReportPanelRowsRequestDto` (400) before the report is resolved.
  if (!PANEL_KEY.test(panelKey)) throw validationFailed('panelKey', 'matches');
  assertFiltersShape(body.filters);
  if (body.cursor && body.cursor.length > 512) throw validationFailed('cursor', 'max_length');
  if (body.limit !== undefined) {
    if (!Number.isInteger(body.limit)) throw validationFailed('limit', 'is_int');
    if (body.limit < 1) throw validationFailed('limit', 'min');
    if (body.limit > 100) throw validationFailed('limit', 'max');
  }
  if (body.sort) {
    if (!FILTER_KEY.test(body.sort.key)) throw validationFailed('sort.key', 'matches');
    if (body.sort.direction !== 'ASC' && body.sort.direction !== 'DESC') {
      throw validationFailed('sort.direction', 'is_in');
    }
  }

  const manifest = buildFakeManifest(reportKey, {
    period: body.period,
    filters: body.filters,
    scope: body.scope,
  });
  const panel = manifest.panels.find((p) => p.panelKey === panelKey);
  if (!panel || !panel.pageable) {
    throw new ApiError(422, 'CRM_REPORT_PANEL_NOT_PAGEABLE');
  }

  const limit = body.limit ?? 25;
  const lang = fakeLang();
  const currencyRaw = typeof body.filters?.['currencyCode'] === 'string' && body.filters['currencyCode']
    ? body.filters['currencyCode']
    : 'EGP';
  const currency = currencyRaw === 'USD' || currencyRaw === 'SAR' ? currencyRaw : 'EGP';

  const prefixEn = manifest.report?.title.en ?? 'Record';
  const prefixAr = manifest.report?.title.ar ?? 'سجل';

  const columns: PanelTable['columns'] = panel.table
    ? panel.table.columns
    : [
        { key: 'record', label: { en: 'Record', ar: 'السجل' }, unit: 'TEXT' },
        { key: 'owner', label: { en: 'Owner', ar: 'المالك' }, unit: 'TEXT' },
        { key: 'branch', label: { en: 'Branch', ar: 'الفرع' }, unit: 'TEXT' },
        { key: 'count', label: { en: 'Items', ar: 'العناصر' }, unit: 'COUNT' },
        { key: 'rate', label: { en: 'Conversion', ar: 'التحويل' }, unit: 'PERCENT' },
        { key: 'amount', label: { en: `Amount (${currency})`, ar: `المبلغ (${currency})` }, unit: 'MONEY' },
        { key: 'updatedAt', label: { en: 'Updated', ar: 'التحديث' }, unit: 'DATE' },
      ];

  const allRows: unknown[][] = Array.from({ length: 120 }, (_, i) => {
    const person = FAKE_PEOPLE[i % FAKE_PEOPLE.length];
    const branch = FAKE_BRANCHES.find((b) => b.id === person.branchId) ?? FAKE_BRANCHES[0];
    const day = String(1 + (i % 21)).padStart(2, '0');
    const itemsCount = 1 + ((i * 7) % 19);
    const rate = Number((12.5 + ((i * 13) % 680) / 10).toFixed(1));
    const amountBase = 25_000 + ((i * 37_500) % 450_000);
    const amount = currency === 'USD' ? Math.round(amountBase * 0.02) : currency === 'SAR' ? Math.round(amountBase * 0.08) : amountBase;

    if (panel.table) {
      const baseStageRow = panel.table.rows[i % panel.table.rows.length];
      const stageLabel = String(baseStageRow?.[0] ?? (lang === 'ar' ? prefixAr : prefixEn));
      const ownerLabel = lang === 'ar' ? person.nameAr : person.name;
      const share = Number((0.4 + ((i * 3) % 21) * 0.1).toFixed(1));
      const avgAge = 3 + ((i * 5) % 28);
      return [
        `${stageLabel} — ${ownerLabel} (#${1001 + i})`,
        itemsCount,
        share,
        amount,
        avgAge,
      ];
    }

    return [
      lang === 'ar' ? `${prefixAr} #${1001 + i}` : `${prefixEn} #${1001 + i}`,
      lang === 'ar' ? person.nameAr : person.name,
      lang === 'ar' ? branch.name.ar : branch.name.en,
      itemsCount,
      rate,
      amount,
      `2026-11-${day}`,
    ];
  });

  if (body.sort) {
    const colIdx = columns.findIndex((c) => c.key === body.sort?.key);
    if (colIdx !== -1) {
      const dir = body.sort.direction === 'DESC' ? -1 : 1;
      allRows.sort((a, b) => {
        const av = a[colIdx];
        const bv = b[colIdx];
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        if (typeof av === 'number' && typeof bv === 'number') {
          return (av - bv) * dir;
        }
        return String(av).localeCompare(String(bv)) * dir;
      });
    }
  }

  const paged = pageOf(allRows, body.cursor ?? null, limit);
  const receiptId = fakeReceipt(panel.metricKeys[0] ?? 'crm.leads.created.count', {
    reportKey,
    panelKey,
    value: paged.items.length,
    unit: 'COUNT',
    currencyCode: currency,
  });

  const coverageNotes: string[] = [];
  if (panel.coverage) {
    coverageNotes.push(
      lang === 'ar'
        ? 'بعض السجلات قبل 1 يونيو 2026 مستنتجة من تاريخ الحالة.'
        : 'Records prior to Jun 1, 2026 use derived status history.',
    );
  }

  return {
    columns,
    rows: paged.items,
    pageInfo: paged.pageInfo,
    receiptId,
    coverageNotes,
  };
}

const DASHBOARD_PAGE_LIMIT = 25;

// GET /api/v1/crm/dashboards?kind=DASHBOARD&cursor: the dashboards the caller can see, newest id first, by cursor.
export function listFakeDashboards(cursor: string | null = null): DashboardListPage {
  const lang = fakeLang();
  const rows = PIN_TARGETS.map<DashboardListRow>((t) => ({
    id: t.id,
    ownerUserId: t.ownerUserId,
    name: lang === 'ar' ? t.name.ar : t.name.en,
    kind: 'DASHBOARD',
    revision: t.revision,
    accessLevel: t.accessLevel,
  })).sort((a, b) => (a.id < b.id ? 1 : -1));
  const page = pageOf(rows, cursor, DASHBOARD_PAGE_LIMIT);
  return { items: page.items, nextCursor: page.pageInfo.nextCursor };
}

/** Whether the caller can see a dashboard (VIEW or higher), as the subscription target check needs. */
export function fakeDashboardVisible(dashboardId: string): boolean {
  return PIN_TARGETS.some((t) => t.id === dashboardId.toLowerCase());
}

/** Pin: DTO (400) → idempotency key → panel → dashboard EDIT access → revision → placement limit. */
export function executeFakePinPanel(
  reportKey: string,
  panelKey: string,
  body: PinPanelRequest,
  key: string,
): PinPanelResponse {
  assertReportKey(reportKey);
  if (!PANEL_KEY.test(panelKey)) throw validationFailed('panelKey', 'matches');
  if (!isUuidV7(body.dashboardId)) throw validationFailed('dashboardId', 'is_uuid');
  if (!Number.isInteger(body.revision)) throw validationFailed('revision', 'is_int');
  if (body.revision < 1) throw validationFailed('revision', 'min');

  const idemKey = idempotencyKeyOf(key);
  const dashboardId = body.dashboardId.toLowerCase();
  const fingerprint = JSON.stringify({ reportKey, panelKey, dashboardId, revision: body.revision });
  const replay = replayOf(PIN_IDEM_STORE, idemKey, fingerprint);
  if (replay) return replay;

  const manifest = buildFakeManifest(reportKey);
  const panel = manifest.panels.find((p) => p.panelKey === panelKey);
  if (!panel || !panel.pinnable) {
    throw new ApiError(422, 'CRM_REPORT_PANEL_NOT_PINNABLE');
  }

  const target = PIN_TARGETS.find((d) => d.id === dashboardId);
  if (!target) {
    throw new ApiError(404, 'CRM_DASHBOARD_RESOURCE_NOT_FOUND');
  }
  if (target.accessLevel === 'VIEW') {
    throw new ApiError(403, 'CRM_DASHBOARD_DEFINITION_ACCESS_DENIED');
  }
  if (target.revision !== body.revision) {
    throw new ApiError(409, 'CRM_DASHBOARD_REVISION_CONFLICT');
  }
  if (target.placements >= DASHBOARD_PLACEMENT_LIMIT) {
    throw new ApiError(409, 'CRM_DASHBOARD_WIDGET_LIMIT');
  }

  target.revision += 1;
  target.placements += 1;
  const response: PinPanelResponse = {
    widgetId: fakeId(),
    placementId: fakeId(),
    dashboardRevision: target.revision,
  };
  PIN_IDEM_STORE.set(idemKey, { fingerprint, response });
  return response;
}
