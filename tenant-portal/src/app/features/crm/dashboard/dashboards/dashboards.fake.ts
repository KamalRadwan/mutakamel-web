import type {
  CatalogVisualization,
  DashboardFilters,
  ShareListItem,
  UnavailablePlacement,
  Visualization,
} from '../../../../shared/widgets/dashboard/analytics.model';
import { FAKE_NOW } from '../../../../shared/widgets/dashboard/analytics-api';
import { FAKE_CATALOG } from '../../../../shared/widgets/dashboard/fake/fake-catalog';
import type { FakePanelMetaSeed, FakeTargetScenario } from '../../../../shared/widgets/dashboard/fake/fake-closure';
import {
  FAKE_BRANCHES,
  FAKE_ME,
  FAKE_PEOPLE,
  FAKE_TEAMS,
  fakeLang,
} from '../../../../shared/widgets/dashboard/fake/fake-org';
import {
  SYSTEM_OWNER_ID,
  SYSTEM_OWNER_NAME,
  WIDGET_STORE,
  embedded,
} from '../shared/widget-store.fake';
import type {
  BlueprintItem,
  DashboardDetail,
  LayoutItem,
  Placement,
} from './dashboards.model';

export interface StoredDashboard {
  detail: DashboardDetail;
  nameAr?: string;
  descriptionAr?: string;
  lastOpenedAt: string | null;
}

export interface SeededWidgetOverride {
  executionState: 'READY' | 'EMPTY' | 'UNAVAILABLE' | 'RETIRED' | 'FAILED' | 'DEADLINE_EXCEEDED';
  panelState?: 'UNAVAILABLE' | 'DENIED' | 'RETIRED' | 'TIMEOUT' | 'ERROR';
  reasonCode?: string;
  sourceKey?: string;
  /** Panel meta seeds: availability, partial access, warnings, and a governed target scenario. */
  meta?: FakePanelMetaSeed;
  targetScenario?: FakeTargetScenario;
  /** The run budget ran out while this widget was computed: the panel is clipped and carries a warning. */
  budgetClipped?: boolean;
}

const VIZ_MAP = new Map<Visualization, CatalogVisualization>(
  FAKE_CATALOG.visualizations.map((v) => [v.key, v]),
);

const WIDGET_MAP = new Map(WIDGET_STORE.map((w) => [w.summary.id, w]));

export function catalogVizSpec(kind: Visualization): CatalogVisualization {
  const found = VIZ_MAP.get(kind);
  if (!found) {
    throw new Error(`Missing visualization specification in FAKE_CATALOG: ${kind}`);
  }
  return found;
}

const DESKTOP_BREAKPOINT: DashboardDetail['breakpoints'][number] = {
  breakpointKey: 'desktop',
  gridColumns: FAKE_CATALOG.grid.columns,
  rowHeightPx: FAKE_CATALOG.grid.rowHeightPx,
  minViewportPx: 1024,
  derivesFromKey: null,
  isPrimary: true,
  sortOrder: 0,
};

interface RowSlotSeed {
  widgetId: string;
  w: number;
  h?: number;
  allowUndersized?: boolean;
  versionPolicy?: 'FOLLOW_ACTIVE' | 'PINNED';
  pinnedVersionNumber?: number | null;
}

/** Seed placement ids are fixed UUID v7 strings (the run and drill fakes require UUID v7 ids). */
let seedPlacementSeq = 0;
function seedPlacementId(): string {
  seedPlacementSeq += 1;
  return `019a0d01-0000-7000-8000-${seedPlacementSeq.toString(16).padStart(12, '0')}`;
}

function buildPlacementsAndLayout(
  dashboardId: string,
  rows: RowSlotSeed[][],
): {
  placements: Placement[];
  layoutItems: LayoutItem[];
  widgets: Placement['widget'][];
} {
  const placements: Placement[] = [];
  const layoutItems: LayoutItem[] = [];
  const widgetMap = new Map<string, Placement['widget']>();
  let y = 0;
  let sortOrder = 0;

  for (const row of rows) {
    let x = 0;
    let rowMaxH = 0;

    for (const slot of row) {
      const stored = WIDGET_MAP.get(slot.widgetId);
      if (!stored) {
        throw new Error(`Missing widget in WIDGET_STORE: ${slot.widgetId}`);
      }
      const wObj = embedded(stored);
      const spec = catalogVizSpec(wObj.visualizationType);
      const w = slot.allowUndersized ? slot.w : Math.max(slot.w, spec.minSize.w);
      const h =
        slot.allowUndersized && slot.h !== undefined
          ? slot.h
          : Math.max(spec.minSize.h, spec.defaultSize.h);
      sortOrder += 1;
      const placementId = seedPlacementId();

      const placement: Placement = {
        id: placementId,
        dashboardId,
        widgetId: wObj.id,
        sortOrder: sortOrder - 1,
        versionPolicy: slot.versionPolicy ?? 'FOLLOW_ACTIVE',
        pinnedVersionNumber: slot.pinnedVersionNumber ?? null,
        widget: wObj,
      };
      placements.push(placement);
      layoutItems.push({
        placementId,
        x,
        y,
        w,
        h,
        zIndex: 0,
        isHidden: false,
        origin: 'BLUEPRINT',
      });
      widgetMap.set(wObj.id, wObj);

      x += w;
      if (h > rowMaxH) rowMaxH = h;
    }

    y += rowMaxH;
  }

  return {
    placements,
    layoutItems,
    widgets: Array.from(widgetMap.values()),
  };
}

interface DashboardSeedSpec {
  id: string;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  ownerUserId: string;
  ownerName: string;
  accessLevel: 'OWNER' | 'EDIT' | 'VIEW';
  kind: 'DASHBOARD' | 'REPORT';
  isShared?: boolean;
  isDefault?: boolean;
  isFavorite?: boolean;
  isLayoutLocked?: boolean;
  blueprintKey: string | null;
  blueprintRevision: number | null;
  sourceTemplateKey?: string | null;
  templateVersionPolicy?: 'FOLLOW_ACTIVE' | 'PINNED' | null;
  defaultFilters?: DashboardFilters;
  rows: RowSlotSeed[][];
  unavailablePlacements?: UnavailablePlacement[];
  lastOpenedAt?: string | null;
}

function makeDashboard(seed: DashboardSeedSpec): StoredDashboard {
  const { placements, layoutItems, widgets } = buildPlacementsAndLayout(seed.id, seed.rows);
  const detail: DashboardDetail = {
    id: seed.id,
    ownerUserId: seed.ownerUserId,
    ownerName: seed.ownerName,
    name: seed.name,
    description: seed.description,
    defaultFilters: seed.defaultFilters ?? { datePreset: 'CURRENT_MONTH', compare: 'PREVIOUS_PERIOD' },
    sourceTemplateKey: seed.sourceTemplateKey ?? null,
    schemaVersion: 2,
    revision: 1,
    createdAt: '2026-10-20T09:00:00.000Z',
    updatedAt: FAKE_NOW,
    accessLevel: seed.accessLevel,
    isShared: Boolean(seed.isShared),
    isDefault: Boolean(seed.isDefault),
    isFavorite: Boolean(seed.isFavorite),
    kind: seed.kind,
    blueprintKey: seed.blueprintKey,
    blueprintRevision: seed.blueprintRevision,
    templateVersionPolicy: seed.templateVersionPolicy ?? null,
    layoutCollisionMode: 'PUSH',
    isLayoutLocked: Boolean(seed.isLayoutLocked),
    breakpoints: [{ ...DESKTOP_BREAKPOINT }],
    layouts: {
      desktop: {
        origin: 'MATERIALIZED',
        items: layoutItems,
      },
    },
    placements,
    unavailablePlacements: seed.unavailablePlacements ?? [],
    widgets,
  };

  return {
    detail,
    nameAr: seed.nameAr,
    descriptionAr: seed.descriptionAr,
    lastOpenedAt: seed.lastOpenedAt ?? FAKE_NOW,
  };
}

export const DASHBOARD_STORE: StoredDashboard[] = [
  // 1. Base 1 — Sales rep (default for FAKE_ME)
  makeDashboard({
    id: '019a0d00-0000-7000-8000-000000000001',
    name: 'Sales rep',
    nameAr: 'مندوب المبيعات',
    description: 'Daily leads, conversion cohort, activity stream, and monthly target pacing.',
    descriptionAr: 'متابعة يومية للعملاء المحتملين ومعدل التحويل والأنشطة والمستهدف الشهري.',
    ownerUserId: SYSTEM_OWNER_ID,
    ownerName: SYSTEM_OWNER_NAME,
    accessLevel: 'VIEW',
    kind: 'DASHBOARD',
    isDefault: true,
    isFavorite: true,
    blueprintKey: 'crm-sales-rep',
    blueprintRevision: 3,
    templateVersionPolicy: 'FOLLOW_ACTIVE',
    rows: [
      [
        { widgetId: 'w-new-leads-kpi', w: 16 },
        { widgetId: 'w-conversion-rate-kpi', w: 16 },
        { widgetId: 'w-open-pipeline-kpi', w: 16 },
      ],
      [
        { widgetId: 'w-lead-journey-funnel', w: 16 },
        { widgetId: 'w-leads-monthly-column', w: 16 },
        { widgetId: 'w-recent-activity-feed', w: 16 },
      ],
      [
        { widgetId: 'w-monthly-target-gauge', w: 16 },
        { widgetId: 'w-pipeline-stage-table', w: 32 },
      ],
    ],
  }),

  // 2. Base 2 — Team leader (+ 1 unavailablePlacement WIDGET_ARCHIVED)
  makeDashboard({
    id: '019a0d00-0000-7000-8000-000000000002',
    name: 'Team leader',
    nameAr: 'قائد الفريق',
    description: 'Team conversion, sales leaderboard, scorecards, and open SLA alerts.',
    descriptionAr: 'تحويل الفريق وترتيب أداء المندوبين وبطاقة النتائج والتنبيهات المفتوحة.',
    ownerUserId: SYSTEM_OWNER_ID,
    ownerName: SYSTEM_OWNER_NAME,
    accessLevel: 'VIEW',
    kind: 'DASHBOARD',
    isFavorite: true,
    blueprintKey: 'crm-team-leader',
    blueprintRevision: 2,
    templateVersionPolicy: 'FOLLOW_ACTIVE',
    rows: [
      [
        { widgetId: 'w-won-value-kpi', w: 24 },
        { widgetId: 'w-monthly-target-progress', w: 24 },
      ],
      [{ widgetId: 'w-lead-funnel-summary', w: 48 }],
      [
        { widgetId: 'w-rep-leaderboard', w: 24 },
        { widgetId: 'w-lead-trend-line', w: 24 },
      ],
      [
        { widgetId: 'w-team-scorecard', w: 20 },
        { widgetId: 'w-leads-source-donut', w: 12 },
        { widgetId: 'w-open-alerts-list', w: 16 },
      ],
    ],
    unavailablePlacements: [
      {
        id: '019a0d00-0000-7000-8000-00000000000e',
        x: 0,
        y: 0,
        width: 6,
        height: 4,
        sortOrder: 99,
        reason: 'WIDGET_ARCHIVED',
      },
    ],
  }),

  // 3. Base 3 — Multi-team leader
  makeDashboard({
    id: '019a0d00-0000-7000-8000-000000000003',
    name: 'Multi-team leader',
    nameAr: 'قائد عدة فرق',
    description: 'Cross-branch pipeline comparison, stage mix, and deal timeline.',
    descriptionAr: 'مقارنة مسار البيع عبر الفروع وتوزيع المراحل والجدول الزمني للصفقات.',
    ownerUserId: SYSTEM_OWNER_ID,
    ownerName: SYSTEM_OWNER_NAME,
    accessLevel: 'VIEW',
    kind: 'DASHBOARD',
    blueprintKey: 'crm-multi-team-leader',
    blueprintRevision: 2,
    templateVersionPolicy: 'FOLLOW_ACTIVE',
    rows: [
      [
        { widgetId: 'w-new-leads-kpi', w: 16 },
        { widgetId: 'w-open-opps-kpi', w: 16 },
        { widgetId: 'w-monthly-target-progress', w: 16 },
      ],
      [
        { widgetId: 'w-branch-stage-stacked', w: 24 },
        { widgetId: 'w-branch-stage-mix-100', w: 24 },
      ],
      [
        { widgetId: 'w-won-vs-rate-combo', w: 32 },
        { widgetId: 'w-opp-stage-pie', w: 16 },
      ],
      [{ widgetId: 'w-opportunity-gantt', w: 48 }],
    ],
  }),

  // 4. Base 4 — Executive (contains all 4 special interim states: UNAVAILABLE, DEADLINE_EXCEEDED, DENIED, RETIRED)
  makeDashboard({
    id: '019a0d00-0000-7000-8000-000000000004',
    name: 'Executive',
    nameAr: 'الإدارة التنفيذية',
    description: 'Company-wide pipeline movement, target attainment, and customer segments.',
    descriptionAr: 'نظرة تنفيذية على حركة مسار البيع وتحقيق المستهدفات وشرائح العملاء.',
    ownerUserId: SYSTEM_OWNER_ID,
    ownerName: SYSTEM_OWNER_NAME,
    accessLevel: 'VIEW',
    kind: 'DASHBOARD',
    blueprintKey: 'crm-executive',
    blueprintRevision: 4,
    templateVersionPolicy: 'FOLLOW_ACTIVE',
    rows: [
      [
        { widgetId: 'w-won-value-kpi', w: 16 },
        { widgetId: 'w-win-rate-kpi', w: 16 },
        { widgetId: 'w-retired-score-kpi', w: 16 },
      ],
      [
        { widgetId: 'w-pipeline-waterfall', w: 32 },
        { widgetId: 'w-quarterly-target-gauge', w: 16 },
      ],
      [
        { widgetId: 'w-customer-treemap', w: 24 },
        { widgetId: 'w-marketing-spend-bar', w: 24 },
      ],
      [
        { widgetId: 'w-exec-revenue-area', w: 24 },
        { widgetId: 'w-exec-target-speedometer', w: 24 },
      ],
      [{ widgetId: 'w-revenue-bullet', w: 48 }],
    ],
  }),

  // 5. Base 5 — Marketing
  makeDashboard({
    id: '019a0d00-0000-7000-8000-000000000005',
    name: 'Marketing',
    nameAr: 'التسويق والاكتساب',
    description: 'Acquisition channels, arrival intensity, lead aging, and daily intake.',
    descriptionAr: 'قنوات الاكتساب وكثافة الوصول وأعمار العملاء المحتملين والتدفق اليومي.',
    ownerUserId: SYSTEM_OWNER_ID,
    ownerName: SYSTEM_OWNER_NAME,
    accessLevel: 'VIEW',
    kind: 'DASHBOARD',
    blueprintKey: 'crm-marketing',
    blueprintRevision: 2,
    templateVersionPolicy: 'FOLLOW_ACTIVE',
    rows: [
      [
        { widgetId: 'w-new-leads-kpi', w: 16 },
        { widgetId: 'w-converted-leads-kpi', w: 16 },
        { widgetId: 'w-conversion-rate-kpi', w: 16 },
      ],
      [
        { widgetId: 'w-leads-line-area', w: 32 },
        { widgetId: 'w-leads-source-donut', w: 16 },
      ],
      [
        { widgetId: 'w-arrival-heatmap', w: 24 },
        { widgetId: 'w-lead-aging-histogram', w: 24 },
      ],
      [{ widgetId: 'w-daily-leads-calendar-heat', w: 48 }],
    ],
  }),

  // 6. Base 6 — Data steward
  makeDashboard({
    id: '019a0d00-0000-7000-8000-000000000006',
    name: 'Data steward',
    nameAr: 'مسؤول جودة البيانات',
    description: 'Response time distribution, stage transitions, timeline, and open alerts.',
    descriptionAr: 'توزيع أزمنة الاستجابة وتدفق انتقال المراحل والتنبيهات المفتوحة.',
    ownerUserId: SYSTEM_OWNER_ID,
    ownerName: SYSTEM_OWNER_NAME,
    accessLevel: 'VIEW',
    kind: 'DASHBOARD',
    blueprintKey: 'crm-data-steward',
    blueprintRevision: 1,
    templateVersionPolicy: 'FOLLOW_ACTIVE',
    rows: [
      [
        { widgetId: 'w-open-opps-kpi', w: 24 },
        { widgetId: 'w-monthly-target-progress', w: 24 },
      ],
      [{ widgetId: 'w-lead-funnel-summary', w: 48 }],
      [
        { widgetId: 'w-first-response-boxplot', w: 32 },
        { widgetId: 'w-sla-circular-gauge', w: 16 },
      ],
      [
        { widgetId: 'w-stage-flowchart', w: 24 },
        { widgetId: 'w-crm-timeline', w: 24 },
      ],
      [{ widgetId: 'w-open-alerts-list', w: 48 }],
    ],
  }),

  // 7. Own 1 — "My sales board" (12 widgets)
  makeDashboard({
    id: '019a0d00-0000-7000-8000-000000000007',
    name: 'My sales board',
    nameAr: 'لوحة مبيعاتي',
    description: 'Personal workspace combining KPIs, deal scatter, calendar, and leaderboard.',
    descriptionAr: 'لوحتي الشخصية لمتابعة المؤشرات والفرص والتقويم وترتيب الأداء.',
    ownerUserId: FAKE_ME.id,
    ownerName: FAKE_ME.name,
    accessLevel: 'OWNER',
    kind: 'DASHBOARD',
    isShared: true,
    isFavorite: true,
    blueprintKey: null,
    blueprintRevision: null,
    sourceTemplateKey: 'crm-sales-rep',
    rows: [
      [
        { widgetId: 'w-new-leads-kpi', w: 16 },
        { widgetId: 'w-open-pipeline-kpi', w: 16 },
        { widgetId: 'w-won-value-kpi', w: 16 },
      ],
      [
        { widgetId: 'w-deal-scatter', w: 24 },
        { widgetId: 'w-deal-bubble', w: 24 },
      ],
      [{ widgetId: 'w-activities-calendar', w: 48 }],
      [
        { widgetId: 'w-lead-trend-line', w: 24 },
        { widgetId: 'w-pipeline-stage-bar', w: 24 },
      ],
      [
        { widgetId: 'w-lead-journey-funnel', w: 24 },
        { widgetId: 'w-rep-leaderboard', w: 24 },
      ],
      [
        { widgetId: 'w-monthly-target-gauge', w: 16 },
        { widgetId: 'w-pipeline-stage-table', w: 32 },
      ],
    ],
  }),

  // 8. Own 2 — "Weekly review"
  makeDashboard({
    id: '019a0d00-0000-7000-8000-000000000008',
    name: 'Weekly review',
    nameAr: 'المراجعة الأسبوعية',
    description: 'Weekly pipeline pacing, conversion trends, and recent CRM milestones.',
    descriptionAr: 'مراجعة أسبوعية لوتيرة المبيعات واتجاهات التحويل وأهم الأحداث.',
    ownerUserId: FAKE_ME.id,
    ownerName: FAKE_ME.name,
    accessLevel: 'OWNER',
    kind: 'DASHBOARD',
    blueprintKey: null,
    blueprintRevision: null,
    rows: [
      [
        { widgetId: 'w-won-count-kpi', w: 16 },
        { widgetId: 'w-win-rate-kpi', w: 16 },
        { widgetId: 'w-monthly-target-progress', w: 16 },
      ],
      [
        { widgetId: 'w-weekly-leads-area', w: 24 },
        { widgetId: 'w-leads-monthly-column', w: 24 },
      ],
      [
        { widgetId: 'w-recent-activity-feed', w: 24 },
        { widgetId: 'w-crm-timeline', w: 24 },
      ],
      [{ widgetId: 'w-revenue-bullet', w: 48 }],
    ],
  }),

  // 8b. Own 3 — PRE_Q16 undersized stat-card layout (3 × 12×10 metric cards)
  makeDashboard({
    id: '019a0d00-0000-7000-8000-000000000009',
    name: 'Q3 review (old layout)',
    nameAr: 'مراجعة الربع الثالث (تخطيط قديم)',
    description: 'Q3 review dashboard saved with 12-column metric cards before the stat-card size update.',
    descriptionAr: 'لوحة مراجعة الربع الثالث محفوظة ببطاقات مؤشرات بعرض 12 عمودًا قبل تحديث أحجام البطاقات.',
    ownerUserId: FAKE_ME.id,
    ownerName: FAKE_ME.name,
    accessLevel: 'OWNER',
    kind: 'DASHBOARD',
    blueprintKey: null,
    blueprintRevision: null,
    rows: [
      [
        { widgetId: 'w-new-leads-kpi', w: 12, h: 10, allowUndersized: true },
        { widgetId: 'w-conversion-rate-kpi', w: 12, h: 10, allowUndersized: true },
        { widgetId: 'w-won-value-kpi', w: 12, h: 10, allowUndersized: true },
      ],
      [
        { widgetId: 'w-leads-monthly-column', w: 24 },
        { widgetId: 'w-lead-trend-line', w: 24 },
      ],
    ],
  }),

  // 9. Shared with me (VIEW)
  makeDashboard({
    id: '019a0d00-0000-7000-8000-00000000000a',
    name: 'Cairo branch overview',
    nameAr: 'نظرة عامة على فرع القاهرة',
    description: 'Read-only branch performance board shared by Ali Hassan.',
    descriptionAr: 'لوحة أداء فرع القاهرة للعرض فقط مشاركة من علي حسن.',
    ownerUserId: FAKE_PEOPLE[1].id,
    ownerName: FAKE_PEOPLE[1].name,
    accessLevel: 'VIEW',
    kind: 'DASHBOARD',
    isShared: true,
    blueprintKey: null,
    blueprintRevision: null,
    rows: [
      [
        { widgetId: 'w-open-opps-kpi', w: 16 },
        { widgetId: 'w-won-value-kpi', w: 16 },
        { widgetId: 'w-win-rate-kpi', w: 16 },
      ],
      [
        { widgetId: 'w-pipeline-stage-bar', w: 24 },
        { widgetId: 'w-branch-target-speedometer', w: 24 },
      ],
      [
        { widgetId: 'w-rep-leaderboard', w: 24 },
        { widgetId: 'w-pipeline-stage-table', w: 24 },
      ],
    ],
  }),

  // 10. Shared with me (EDIT)
  makeDashboard({
    id: '019a0d00-0000-7000-8000-00000000000b',
    name: 'Q4 pipeline war room',
    nameAr: 'غرفة متابعة مسار البيع للربع الرابع',
    description: 'Collaborative pipeline board shared with edit access.',
    descriptionAr: 'لوحة متابعة تشاركية لمسار البيع بصلاحية التعديل.',
    ownerUserId: FAKE_PEOPLE[2].id,
    ownerName: FAKE_PEOPLE[2].name,
    accessLevel: 'EDIT',
    kind: 'DASHBOARD',
    isShared: true,
    blueprintKey: null,
    blueprintRevision: null,
    rows: [
      [
        { widgetId: 'w-open-pipeline-kpi', w: 16 },
        { widgetId: 'w-won-value-kpi', w: 16 },
        { widgetId: 'w-monthly-target-progress', w: 16 },
      ],
      [
        { widgetId: 'w-pipeline-waterfall', w: 32 },
        { widgetId: 'w-monthly-target-gauge', w: 16 },
      ],
      [
        { widgetId: 'w-deal-scatter', w: 24 },
        { widgetId: 'w-won-vs-rate-combo', w: 24 },
      ],
    ],
  }),

  // 11. REPORT-kind row 1
  makeDashboard({
    id: '019a0d00-0000-7000-8000-00000000000c',
    name: 'Lead conversion report',
    nameAr: 'تقرير تحويل العملاء المحتملين',
    description: 'Locked report template covering acquisition cohorts and conversion speed.',
    descriptionAr: 'قالب تقرير مقفل يغطي أفواج الاكتساب وسرعة التحويل.',
    ownerUserId: SYSTEM_OWNER_ID,
    ownerName: SYSTEM_OWNER_NAME,
    accessLevel: 'VIEW',
    kind: 'REPORT',
    isLayoutLocked: true,
    blueprintKey: 'lead-conversion-overview',
    blueprintRevision: 1,
    rows: [],
  }),

  // 12. REPORT-kind row 2
  makeDashboard({
    id: '019a0d00-0000-7000-8000-00000000000d',
    name: 'Pipeline forecast report',
    nameAr: 'تقرير توقعات مسار البيع',
    description: 'Locked report template summarizing weighted forecast and quota pacing.',
    descriptionAr: 'قالب تقرير مقفل يلخص التوقعات المرجحة ووتيرة المستهدف.',
    ownerUserId: SYSTEM_OWNER_ID,
    ownerName: SYSTEM_OWNER_NAME,
    accessLevel: 'VIEW',
    kind: 'REPORT',
    isLayoutLocked: true,
    blueprintKey: 'pipeline-forecast-summary',
    blueprintRevision: 1,
    rows: [],
  }),
];

export const SEEDED_WIDGET_OVERRIDES: Record<string, SeededWidgetOverride> = {
  'w-marketing-spend-bar': {
    executionState: 'UNAVAILABLE',
    panelState: 'UNAVAILABLE',
    reasonCode: 'SOURCE_NOT_READY',
    sourceKey: 'marketing.spend',
  },
  'w-exec-revenue-area': {
    executionState: 'DEADLINE_EXCEEDED',
    panelState: 'TIMEOUT',
    reasonCode: 'BUDGET_EXHAUSTED',
  },
  'w-exec-target-speedometer': {
    executionState: 'READY',
    panelState: 'DENIED',
    reasonCode: 'CRM_SCOPED_PERMISSION_DENIED',
  },
  'w-retired-score-kpi': {
    executionState: 'RETIRED',
    panelState: 'RETIRED',
    reasonCode: 'METRIC_RETIRED',
  },
  // Trade application not subscribed: unavailable with the reason and no numbers.
  'w-sla-circular-gauge': {
    executionState: 'READY',
    meta: {
      availability: 'APPLICATION_NOT_SUBSCRIBED',
      warnings: ['APPLICATION_UNAVAILABLE'],
      clearData: true,
    },
  },
  // Some branches left out because the user cannot read them.
  'w-weekly-leads-area': { executionState: 'READY', meta: { partialAccess: true } },
  // A source permission is missing: the permission state, no numbers.
  'w-customer-treemap': {
    executionState: 'READY',
    meta: { availability: 'AVAILABLE', warnings: ['SOURCE_PERMISSION_REQUIRED'], clearData: true },
  },
  // The run budget ran out: the panel is clipped and shows a warning, not an error.
  'w-won-vs-rate-combo': { executionState: 'READY', panelState: undefined, budgetClipped: true },
  // Governed target without a working calendar: pace unavailable, target and attainment still shown.
  'w-branch-target-speedometer': { executionState: 'READY', targetScenario: 'PACE_UNAVAILABLE' },
  // No approved target row for the period.
  'w-quarterly-target-gauge': { executionState: 'READY', targetScenario: 'TARGET_NOT_SET' },
};

export const BLUEPRINT_DEFINITIONS: Omit<BlueprintItem, 'adoption'>[] = [
  {
    key: 'crm-sales-rep',
    definitionRevision: 3,
    audience: 'USER',
    name: 'Sales rep',
    nameAr: 'مندوب المبيعات',
    description: 'Daily leads, conversion cohort, activity stream, and monthly target pacing.',
    descriptionAr: 'متابعة يومية للعملاء المحتملين ومعدل التحويل والأنشطة والمستهدف الشهري.',
    widgetCount: 8,
    branchSelectionRequired: false,
    targets: [{ widgetName: 'Monthly target attainment', target: 1200000 }],
  },
  {
    key: 'crm-team-leader',
    definitionRevision: 2,
    audience: 'TEAM_LEADER',
    name: 'Team leader',
    nameAr: 'قائد الفريق',
    description: 'Team conversion, sales leaderboard, scorecards, and open SLA alerts.',
    descriptionAr: 'تحويل الفريق وترتيب أداء المندوبين وبطاقة النتائج والتنبيهات المفتوحة.',
    widgetCount: 8,
    branchSelectionRequired: false,
    targets: [{ widgetName: 'Target attainment', target: 2500000 }],
  },
  {
    key: 'crm-multi-team-leader',
    definitionRevision: 2,
    audience: 'TEAM_LEADER',
    name: 'Multi-team leader',
    nameAr: 'قائد عدة فرق',
    description: 'Cross-branch pipeline comparison, stage mix, and deal timeline.',
    descriptionAr: 'مقارنة مسار البيع عبر الفروع وتوزيع المراحل والجدول الزمني للصفقات.',
    widgetCount: 8,
    branchSelectionRequired: false,
    targets: [],
  },
  {
    key: 'crm-executive',
    definitionRevision: 4,
    audience: 'CRM_ADMIN',
    name: 'Executive',
    nameAr: 'الإدارة التنفيذية',
    description: 'Company-wide pipeline movement, target attainment, and customer segments.',
    descriptionAr: 'نظرة تنفيذية على حركة مسار البيع وتحقيق المستهدفات وشرائح العملاء.',
    widgetCount: 10,
    branchSelectionRequired: false,
    targets: [{ widgetName: 'Quarterly quota pacing', target: 5000000 }],
  },
  {
    key: 'crm-marketing',
    definitionRevision: 2,
    audience: 'CRM_ADMIN',
    name: 'Marketing',
    nameAr: 'التسويق والاكتساب',
    description: 'Acquisition channels, arrival intensity, lead aging, and daily intake.',
    descriptionAr: 'قنوات الاكتساب وكثافة الوصول وأعمار العملاء المحتملين والتدفق اليومي.',
    widgetCount: 8,
    branchSelectionRequired: false,
    targets: [],
  },
  {
    key: 'crm-data-steward',
    definitionRevision: 1,
    audience: 'DEFINITION_ADMIN',
    name: 'Data steward',
    nameAr: 'مسؤول جودة البيانات',
    description: 'Response time distribution, stage transitions, timeline, and open alerts.',
    descriptionAr: 'توزيع أزمنة الاستجابة وتدفق انتقال المراحل والتنبيهات المفتوحة.',
    widgetCount: 8,
    branchSelectionRequired: false,
    targets: [],
  },
];

/** Blueprint keys follow DASHBOARD_BLUEPRINT_KEY_PATTERN (`^[a-z][a-z0-9-]{0,79}$`). */
export const BLUEPRINT_BASE_DASHBOARD_ID: Record<string, string> = {
  'crm-sales-rep': '019a0d00-0000-7000-8000-000000000001',
  'crm-team-leader': '019a0d00-0000-7000-8000-000000000002',
  'crm-multi-team-leader': '019a0d00-0000-7000-8000-000000000003',
  'crm-executive': '019a0d00-0000-7000-8000-000000000004',
  'crm-marketing': '019a0d00-0000-7000-8000-000000000005',
  'crm-data-steward': '019a0d00-0000-7000-8000-000000000006',
};

export const ADOPTED_BLUEPRINTS = new Map<string, { dashboardId: string; definitionRevision: number }>();

export const DASHBOARD_SHARES = new Map<string, ShareListItem[]>([
  [
    '019a0d00-0000-7000-8000-000000000007',
    [
      {
        id: '01934b30-0000-7000-8000-000000000001',
        subjectType: 'USER',
        subjectId: FAKE_PEOPLE[1].id,
        accessLevel: 'EDIT',
        sharedByUserId: FAKE_ME.id,
        expiresAt: null,
        createdAt: '2026-11-05T10:00:00.000Z',
        updatedAt: '2026-11-05T10:00:00.000Z',
        effectiveAccessLevel: 'EDIT',
        subjectName: FAKE_PEOPLE[1].name,
        subjectEmail: FAKE_PEOPLE[1].email,
        context: FAKE_BRANCHES[0].name.en,
        effectiveAccessSource: 'Direct grant',
      },
      {
        id: '01934b30-0000-7000-8000-000000000002',
        subjectType: 'TEAM',
        subjectId: FAKE_TEAMS[2].id,
        accessLevel: 'VIEW',
        sharedByUserId: FAKE_ME.id,
        expiresAt: '2026-12-31T23:59:59.000Z',
        createdAt: '2026-11-10T11:30:00.000Z',
        updatedAt: '2026-11-10T11:30:00.000Z',
        effectiveAccessLevel: 'VIEW',
        subjectName: FAKE_TEAMS[2].name.en,
        subjectEmail: null,
        context: FAKE_BRANCHES[1].name.en,
        effectiveAccessSource: 'Direct grant',
      },
    ],
  ],
  [
    '019a0d00-0000-7000-8000-00000000000a',
    [
      {
        id: '01934b30-0000-7000-8000-000000000003',
        subjectType: 'USER',
        subjectId: FAKE_ME.id,
        accessLevel: 'VIEW',
        sharedByUserId: FAKE_PEOPLE[1].id,
        expiresAt: null,
        createdAt: '2026-11-02T09:00:00.000Z',
        updatedAt: '2026-11-02T09:00:00.000Z',
        effectiveAccessLevel: 'VIEW',
        subjectName: FAKE_ME.name,
        subjectEmail: FAKE_PEOPLE[0].email,
        context: FAKE_BRANCHES[0].name.en,
        effectiveAccessSource: 'Direct grant',
      },
    ],
  ],
  [
    '019a0d00-0000-7000-8000-00000000000b',
    [
      {
        id: '01934b30-0000-7000-8000-000000000004',
        subjectType: 'USER',
        subjectId: FAKE_ME.id,
        accessLevel: 'EDIT',
        sharedByUserId: FAKE_PEOPLE[2].id,
        expiresAt: null,
        createdAt: '2026-11-04T09:00:00.000Z',
        updatedAt: '2026-11-04T09:00:00.000Z',
        effectiveAccessLevel: 'EDIT',
        subjectName: FAKE_ME.name,
        subjectEmail: FAKE_PEOPLE[0].email,
        context: FAKE_BRANCHES[0].name.en,
        effectiveAccessSource: 'Direct grant',
      },
    ],
  ],
]);

export function localizeOwnerName(ownerUserId: string, fallback: string | null): string | null {
  if (ownerUserId === SYSTEM_OWNER_ID) return SYSTEM_OWNER_NAME;
  const person = FAKE_PEOPLE.find((p) => p.id === ownerUserId);
  if (person) return fakeLang() === 'ar' ? person.nameAr : person.name;
  return fallback;
}

export function materializeDetail(stored: StoredDashboard): DashboardDetail {
  const isAr = fakeLang() === 'ar';
  const cloned = structuredClone(stored.detail);
  cloned.name = isAr && stored.nameAr ? stored.nameAr : stored.detail.name;
  cloned.description = isAr && stored.descriptionAr ? stored.descriptionAr : stored.detail.description;
  cloned.ownerName = localizeOwnerName(stored.detail.ownerUserId, stored.detail.ownerName);

  cloned.placements = cloned.placements.map((placement) => {
    const widgetStoreEntry = WIDGET_MAP.get(placement.widgetId);
    if (!widgetStoreEntry) return placement;
    const freshEmbedded = embedded(widgetStoreEntry);
    const pinnedSnap =
      placement.versionPolicy === 'PINNED' && placement.pinnedVersionNumber !== null
        ? widgetStoreEntry.versions.find((v) => v.versionNumber === placement.pinnedVersionNumber)?.snapshot
        : undefined;
    const nextWidget = pinnedSnap
      ? {
          ...freshEmbedded,
          name: isAr ? freshEmbedded.name : pinnedSnap.name,
          visualizationType: pinnedSnap.visualizationType,
          querySpec: structuredClone(pinnedSnap.querySpec),
          displaySpec: structuredClone(pinnedSnap.displaySpec),
          versionNumber: placement.pinnedVersionNumber!,
        }
      : freshEmbedded;
    return {
      ...placement,
      widget: nextWidget,
    };
  });

  const uniqueWidgets = new Map<string, Placement['widget']>();
  for (const placement of cloned.placements) {
    uniqueWidgets.set(placement.widgetId, placement.widget);
  }
  cloned.widgets = Array.from(uniqueWidgets.values());
  return cloned;
}
