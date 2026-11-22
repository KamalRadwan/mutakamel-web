import type {
  DisplaySpec,
  QuerySpec,
  ShareListItem,
  Visualization,
} from '../../../../shared/widgets/dashboard/analytics.model';
import { FAKE_NOW } from '../../../../shared/widgets/dashboard/analytics-api';
import { FAKE_BRANCHES, FAKE_ME, FAKE_PEOPLE, fakeLang } from '../../../../shared/widgets/dashboard/fake/fake-org';
import type { EmbeddedWidget } from '../dashboards/dashboards.model';
import type { WidgetDraft, WidgetSourceResource, WidgetSummary } from './widget.model';

export const SYSTEM_OWNER_ID = '01934b10-0000-7000-8000-000000000000';
export const SYSTEM_OWNER_NAME = 'Mutakamel';

export interface StoredWidget {
  summary: WidgetSummary;
  draft: WidgetDraft | null;
  versions: {
    versionNumber: number;
    name: string;
    publishedAt: string | null;
    provenance: string;
    /** `crm_widget_versions` row (versionProjection in dashboard-widget-version-restore.service.ts). */
    snapshot: {
      name: string;
      visualizationType: Visualization;
      schemaVersion: number;
      querySpec: QuerySpec;
      displaySpec: DisplaySpec;
      description: string | null;
      internalNotes: string | null;
      changeSummary: string | null;
      restoredFromVersionNumber: number | null;
      authoredByUserId: string | null;
    };
  }[];
  shares: ShareListItem[];
}

interface WidgetSeedSpec {
  id: string;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  kind: Visualization;
  metricKey: string;
  secondaryMetricKey?: string;
  owner?: 'system' | 'me' | 'ali' | 'sara';
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  accessLevel?: 'OWNER' | 'EDIT' | 'VIEW';
  versionCount?: number;
  dimension?: QuerySpec['dimension'];
  filters?: QuerySpec['filters'];
  comparison?: QuerySpec['comparison'];
  displaySpec?: Partial<DisplaySpec>;
  sourceResources: WidgetSourceResource[];
  hasDraft?: boolean;
  isShared?: boolean;
}

const WIDGET_LOCALE_NAMES: Record<string, { en: string; ar: string }> = {};

const TARGET_COMPARISON: QuerySpec['comparison'] = {
  type: 'GOVERNED_TARGET',
  governedTarget: {
    branchId: FAKE_BRANCHES[0].id,
    subjectType: 'BRANCH',
    subjectId: FAKE_BRANCHES[0].id,
    currencyCode: 'EGP',
    periodGrain: 'MONTH',
  },
};

function ownerMeta(seed: WidgetSeedSpec): {
  ownerUserId: string;
  ownerName: string;
  accessLevel: 'OWNER' | 'EDIT' | 'VIEW';
} {
  if (seed.owner === 'me') {
    return {
      ownerUserId: FAKE_ME.id,
      ownerName: FAKE_ME.name,
      accessLevel: seed.accessLevel ?? 'OWNER',
    };
  }
  if (seed.owner === 'ali') {
    return {
      ownerUserId: FAKE_PEOPLE[1].id,
      ownerName: FAKE_PEOPLE[1].name,
      accessLevel: seed.accessLevel ?? 'EDIT',
    };
  }
  if (seed.owner === 'sara') {
    return {
      ownerUserId: FAKE_PEOPLE[2].id,
      ownerName: FAKE_PEOPLE[2].name,
      accessLevel: seed.accessLevel ?? 'VIEW',
    };
  }
  return {
    ownerUserId: SYSTEM_OWNER_ID,
    ownerName: SYSTEM_OWNER_NAME,
    accessLevel: seed.accessLevel ?? 'VIEW',
  };
}

function buildStoredWidget(seed: WidgetSeedSpec, index: number): StoredWidget {
  WIDGET_LOCALE_NAMES[seed.id] = { en: seed.name, ar: seed.nameAr };
  const status = seed.status ?? 'PUBLISHED';
  const owner = ownerMeta(seed);
  const querySpec: QuerySpec = {
    series: [
      { metricKey: seed.metricKey, axis: 'LEFT' },
      ...(seed.secondaryMetricKey ? [{ metricKey: seed.secondaryMetricKey, axis: 'LEFT' as const }] : []),
    ],
    ...(seed.dimension ? { dimension: seed.dimension } : {}),
    filters: seed.filters ?? { datePreset: 'CURRENT_MONTH', compare: 'PREVIOUS_PERIOD' },
    comparison: seed.comparison ?? { type: 'NONE' },
    scopeBinding: { kind: 'VIEWER_RELATIVE' },
  };
  const displaySpec: DisplaySpec = {
    title: seed.name,
    numberFormat: 'auto',
    legendPosition: 'bottom',
    ...seed.displaySpec,
  };

  const versionCount = status === 'DRAFT' ? 0 : (seed.versionCount ?? 2);
  const versions: StoredWidget['versions'] = [];
  for (let v = 1; v <= versionCount; v++) {
    versions.push({
      versionNumber: v,
      name: seed.name,
      publishedAt: `2026-11-${String(Math.min(20, 10 + index + v)).padStart(2, '0')}T08:30:00.000Z`,
      provenance: v === 1 ? 'INITIAL' : 'PUBLISH',
      snapshot: {
        name: seed.name,
        visualizationType: seed.kind,
        schemaVersion: 2,
        querySpec: structuredClone(querySpec),
        displaySpec: structuredClone(displaySpec),
        description: seed.description,
        internalNotes: null,
        changeSummary: v === 1 ? null : 'Updated filter defaults',
        restoredFromVersionNumber: null,
        authoredByUserId: owner.ownerUserId,
      },
    });
  }

  const hasDraft = status === 'DRAFT' ? true : Boolean(seed.hasDraft);
  const draft: WidgetDraft | null = hasDraft
    ? {
        draftId: `01934b20-1000-7000-8000-${String(index + 1).padStart(12, '0')}`,
        revision: 1,
        baseVersionNumber: versionCount > 0 ? versionCount : null,
        schemaVersion: 2,
        updatedAt: FAKE_NOW,
        updatedByUserId: owner.ownerUserId,
        createdAt: FAKE_NOW,
        createdByUserId: owner.ownerUserId,
        name: seed.name,
        visualizationType: seed.kind,
        querySpec: structuredClone(querySpec),
        displaySpec: structuredClone(displaySpec),
        description: seed.description,
        internalNotes: null,
        changeSummary: versionCount > 0 ? 'Updated filter defaults' : 'Initial draft',
        restoredFromVersionNumber: null,
      }
    : null;

  const summary: WidgetSummary = {
    id: seed.id,
    ownerUserId: owner.ownerUserId,
    ownerName: owner.ownerName,
    name: seed.name,
    visualizationType: seed.kind,
    querySpec: status === 'DRAFT' ? null : structuredClone(querySpec),
    displaySpec: status === 'DRAFT' ? null : structuredClone(displaySpec),
    schemaVersion: status === 'DRAFT' ? null : 2,
    versionNumber: versionCount > 0 ? versionCount : null,
    revision: versionCount + 1,
    governanceRevision: 1,
    updatedAt: FAKE_NOW,
    createdAt: '2026-10-15T09:00:00.000Z',
    accessLevel: owner.accessLevel,
    status,
    hasDraft,
    draftRevision: hasDraft ? 1 : null,
    sourceResources: [...seed.sourceResources],
    isShared: Boolean(seed.isShared),
  };

  return {
    summary,
    draft,
    versions,
    shares: seed.isShared
      ? [
          {
            id: `01934b21-0000-7000-8000-${String(index + 1).padStart(12, '0')}`,
            subjectType: 'USER',
            subjectId: FAKE_PEOPLE[1].id,
            accessLevel: 'EDIT',
            sharedByUserId: owner.ownerUserId,
            expiresAt: null,
            createdAt: '2026-11-01T09:00:00.000Z',
            updatedAt: '2026-11-01T09:00:00.000Z',
            effectiveAccessLevel: 'EDIT',
            subjectName: FAKE_PEOPLE[1].name,
            subjectEmail: FAKE_PEOPLE[1].email,
            context: 'Cairo',
            effectiveAccessSource: 'Direct grant',
          },
        ]
      : [],
  };
}

const SEEDS: WidgetSeedSpec[] = [
  // 1-4: Core KPI Metric Cards
  {
    id: 'w-new-leads-kpi',
    name: 'New leads',
    nameAr: 'العملاء المحتملون الجدد',
    description: 'Total new leads created during the selected period.',
    descriptionAr: 'إجمالي العملاء المحتملين الجدد خلال الفترة المحددة.',
    kind: 'METRIC_CARD',
    metricKey: 'crm.leads.created.total',
    owner: 'me',
    versionCount: 3,
    comparison: { type: 'PREVIOUS_PERIOD' },
    sourceResources: ['leads'],
  },
  {
    id: 'w-conversion-rate-kpi',
    name: 'Conversion rate',
    nameAr: 'معدل التحويل',
    description: 'Creation cohort lead conversion percentage.',
    descriptionAr: 'نسبة تحويل العملاء المحتملين ضمن فوج الإنشاء.',
    kind: 'METRIC_CARD',
    metricKey: 'crm.leads.conversion.rate',
    owner: 'system',
    versionCount: 2,
    comparison: { type: 'PREVIOUS_PERIOD' },
    sourceResources: ['leads'],
  },
  {
    id: 'w-open-pipeline-kpi',
    name: 'Open pipeline',
    nameAr: 'قيمة الفرص المفتوحة',
    description: 'Current open opportunity pipeline amount by currency.',
    descriptionAr: 'القيمة الحالية للفرص المفتوحة حسب العملة.',
    kind: 'METRIC_CARD',
    metricKey: 'crm.opportunities.pipeline.value',
    owner: 'system',
    filters: { datePreset: 'CURRENT_MONTH', currencyCode: 'EGP' },
    sourceResources: ['opportunities'],
  },
  {
    id: 'w-won-value-kpi',
    name: 'Won value',
    nameAr: 'قيمة الفرص الرابحة',
    description: 'Closed-won deal revenue in the selected period.',
    descriptionAr: 'قيمة الصفقات المغلقة بالربح خلال الفترة المحددة.',
    kind: 'METRIC_CARD',
    metricKey: 'crm.opportunities.won.value',
    owner: 'me',
    versionCount: 2,
    filters: { datePreset: 'CURRENT_MONTH', currencyCode: 'EGP', compare: 'PREVIOUS_PERIOD' },
    comparison: { type: 'PREVIOUS_PERIOD' },
    sourceResources: ['opportunities'],
  },
  {
    id: 'w-open-opps-kpi',
    name: 'Open opportunities',
    nameAr: 'عدد الفرص المفتوحة',
    description: 'Active open opportunities snapshot.',
    descriptionAr: 'العدد الحالي للفرص المفتوحة.',
    kind: 'METRIC_CARD',
    metricKey: 'crm.opportunities.open.count',
    owner: 'ali',
    accessLevel: 'EDIT',
    isShared: true,
    sourceResources: ['opportunities'],
  },
  {
    id: 'w-win-rate-kpi',
    name: 'Win rate',
    nameAr: 'معدل ربح الفرص',
    description: 'Ratio of won opportunities to closed opportunities.',
    descriptionAr: 'نسبة الفرص الرابحة إلى إجمالي الفرص المغلقة.',
    kind: 'METRIC_CARD',
    metricKey: 'crm.opportunities.win.rate',
    owner: 'me',
    comparison: { type: 'PREVIOUS_PERIOD' },
    sourceResources: ['opportunities'],
  },
  {
    id: 'w-won-count-kpi',
    name: 'Won deals',
    nameAr: 'الصفقات الرابحة',
    description: 'Number of closed-won opportunities.',
    descriptionAr: 'عدد الفرص المغلقة بالربح.',
    kind: 'METRIC_CARD',
    metricKey: 'crm.opportunities.won.count',
    owner: 'system',
    sourceResources: ['opportunities'],
  },
  {
    id: 'w-converted-leads-kpi',
    name: 'Converted leads',
    nameAr: 'العملاء المحوّلون',
    description: 'Total leads converted to opportunities.',
    descriptionAr: 'إجمالي العملاء المحتملين المحوّلين إلى فرص.',
    kind: 'METRIC_CARD',
    metricKey: 'crm.leads.converted.total',
    owner: 'system',
    sourceResources: ['leads'],
  },
  {
    id: 'w-retired-score-kpi',
    name: 'Legacy lead score',
    nameAr: 'التقييم القديم للعملاء',
    description: 'Deprecated scoring metric retired from analytics.',
    descriptionAr: 'مقياس تقييم قديم تم إيقاف العمل به.',
    kind: 'METRIC_CARD',
    metricKey: 'crm.leads.legacy_score.avg',
    owner: 'system',
    versionCount: 1,
    sourceResources: ['leads'],
  },

  // Multi KPI & Progress Card
  {
    id: 'w-lead-funnel-summary',
    name: 'Lead funnel KPIs',
    nameAr: 'مؤشرات التحويل الرئيسية',
    description: 'Created, converted, and conversion rate side by side.',
    descriptionAr: 'عرض العملاء الجدد والمحوّلين ومعدل التحويل معًا.',
    kind: 'MULTI_KPI',
    metricKey: 'crm.leads.created.total',
    secondaryMetricKey: 'crm.leads.converted.total',
    owner: 'me',
    versionCount: 2,
    sourceResources: ['leads'],
  },
  {
    id: 'w-monthly-target-progress',
    name: 'Target attainment',
    nameAr: 'تحقيق المستهدف',
    description: 'Won revenue progress against approved branch target.',
    descriptionAr: 'نسبة التقدم نحو مستهدف المبيعات الشهري المعتمد.',
    kind: 'PROGRESS_CARD',
    metricKey: 'crm.opportunities.won_vs_target.value',
    owner: 'me',
    versionCount: 3,
    comparison: TARGET_COMPARISON,
    filters: { datePreset: 'CURRENT_MONTH', currencyCode: 'EGP' },
    sourceResources: ['opportunities', 'targets'],
  },

  // Funnel, Column, Activity Feed, Semi-circle Gauge, Table
  {
    id: 'w-lead-journey-funnel',
    name: 'Lead journey',
    nameAr: 'رحلة العميل المحتمل',
    description: 'Progression of leads from creation to conversion.',
    descriptionAr: 'تدرج العملاء المحتملين من الإنشاء حتى التحويل.',
    kind: 'FUNNEL',
    metricKey: 'crm.leads.by_stage.count',
    dimension: { key: 'stage' },
    owner: 'me',
    versionCount: 2,
    sourceResources: ['leads'],
  },
  {
    id: 'w-leads-monthly-column',
    name: 'Monthly leads created vs converted',
    nameAr: 'العملاء الجدد والمحوّلون شهريًا',
    description: 'Monthly columns comparing new and converted leads.',
    descriptionAr: 'أعمدة شهرية تقارن بين العملاء المحتملين الجدد والمحوّلين.',
    kind: 'COLUMN',
    metricKey: 'crm.leads.created.count',
    secondaryMetricKey: 'crm.leads.converted.count',
    dimension: { key: 'time', grain: 'MONTH' },
    owner: 'me',
    versionCount: 2,
    comparison: { type: 'PREVIOUS_PERIOD' },
    sourceResources: ['leads'],
  },
  {
    id: 'w-recent-activity-feed',
    name: 'Recent sales activity',
    nameAr: 'أحدث أنشطة المبيعات',
    description: 'Live stream of calls, stage moves, and deal outcomes.',
    descriptionAr: 'تدفق حي للمكالمات وتغييرات المراحل ونتائج الصفقات.',
    kind: 'ACTIVITY_FEED',
    metricKey: 'crm.activities.feed.events',
    owner: 'system',
    sourceResources: ['activities', 'leads', 'opportunities'],
  },
  {
    id: 'w-monthly-target-gauge',
    name: 'Monthly target attainment',
    nameAr: 'المستهدف الشهري',
    description: 'Semicircle gauge tracking closed revenue vs target.',
    descriptionAr: 'مؤشر نصف دائري لمتابعة الإيرادات الرابحة مقابل المستهدف.',
    kind: 'SEMI_CIRCLE_GAUGE',
    metricKey: 'crm.opportunities.won_vs_target.value',
    owner: 'me',
    versionCount: 3,
    comparison: TARGET_COMPARISON,
    filters: { datePreset: 'CURRENT_MONTH', currencyCode: 'EGP' },
    sourceResources: ['opportunities', 'targets'],
  },
  {
    id: 'w-pipeline-stage-table',
    name: 'Open opportunities by stage',
    nameAr: 'الفرص المفتوحة حسب المرحلة',
    description: 'Tabular summary of deal counts and amounts per stage.',
    descriptionAr: 'جدول ملخص لعدد وقيمة الفرص المفتوحة في كل مرحلة.',
    kind: 'TABLE',
    metricKey: 'crm.opportunities.by_stage.count',
    secondaryMetricKey: 'crm.opportunities.by_stage.value',
    dimension: { key: 'pipeline_stage' },
    owner: 'me',
    versionCount: 2,
    filters: { datePreset: 'CURRENT_MONTH', currencyCode: 'EGP' },
    sourceResources: ['opportunities'],
  },

  // Leaderboard, Line, Scorecard, Donut, Alert List
  {
    id: 'w-rep-leaderboard',
    name: 'Sales rep leaderboard',
    nameAr: 'ترتيب أداء مندوبي المبيعات',
    description: 'Top sales reps ranked by closed won value.',
    descriptionAr: 'ترتيب مندوبي المبيعات حسب قيمة الصفقات الرابحة.',
    kind: 'LEADERBOARD',
    metricKey: 'crm.team.leaderboard.rows',
    dimension: { key: 'owner', topN: 8 },
    owner: 'me',
    filters: { datePreset: 'CURRENT_MONTH', currencyCode: 'EGP' },
    sourceResources: ['opportunities'],
  },
  {
    id: 'w-lead-trend-line',
    name: 'Lead creation & conversion trend',
    nameAr: 'اتجاه إنشاء وتحويل العملاء المحتملين',
    description: 'Monthly trend line of newly acquired and converted leads.',
    descriptionAr: 'منحنى شهري لعدد العملاء المحتملين الجدد والمحوّلين.',
    kind: 'LINE',
    metricKey: 'crm.leads.created.count',
    secondaryMetricKey: 'crm.leads.converted.count',
    dimension: { key: 'time', grain: 'MONTH' },
    owner: 'me',
    versionCount: 2,
    comparison: { type: 'PREVIOUS_PERIOD' },
    sourceResources: ['leads'],
  },
  {
    id: 'w-team-scorecard',
    name: 'Team KPI scorecard',
    nameAr: 'بطاقة نتائج أداء الفريق',
    description: 'Goal pacing statuses across key team metrics.',
    descriptionAr: 'حالات الأداء مقابل المستهدفات عبر مؤشرات الفريق.',
    kind: 'SCORECARD',
    metricKey: 'crm.team.scorecard.rows',
    owner: 'system',
    sourceResources: ['leads', 'opportunities', 'activities', 'targets'],
  },
  {
    id: 'w-leads-source-donut',
    name: 'Leads by source',
    nameAr: 'العملاء المحتملون حسب المصدر',
    description: 'Distribution of new leads across acquisition channels.',
    descriptionAr: 'توزيع العملاء المحتملين الجدد حسب قنوات الاكتساب.',
    kind: 'DONUT',
    metricKey: 'crm.leads.by_source.count',
    dimension: { key: 'source', topN: 9, groupRest: true },
    owner: 'ali',
    accessLevel: 'EDIT',
    isShared: true,
    sourceResources: ['leads'],
  },
  {
    id: 'w-open-alerts-list',
    name: 'Open CRM alerts',
    nameAr: 'التنبيهات المفتوحة',
    description: 'Triggered operational SLA and pipeline warnings.',
    descriptionAr: 'التنبيهات النشطة المتعلقة باتفاقيات الاستجابة ومسار البيع.',
    kind: 'ALERT_LIST',
    metricKey: 'crm.alerts.open.rows',
    owner: 'system',
    sourceResources: ['leads', 'opportunities'],
  },

  // Stacked Bar, Stacked Bar 100, Combo, Pie, Gantt
  {
    id: 'w-branch-stage-stacked',
    name: 'Lead stages by branch',
    nameAr: 'مراحل العملاء المحتملين حسب الفرع',
    description: 'Volume of leads per stage broken down by branch.',
    descriptionAr: 'حجم العملاء المحتملين في كل مرحلة موزعين على الفروع.',
    kind: 'STACKED_BAR',
    metricKey: 'crm.leads.by_stage.count',
    dimension: { key: 'branch' },
    owner: 'system',
    sourceResources: ['leads'],
  },
  {
    id: 'w-branch-stage-mix-100',
    name: 'Stage mix share by branch',
    nameAr: 'التوزيع النسبي للمراحل حسب الفرع',
    description: '100% normalized share of lead stages across branches.',
    descriptionAr: 'النسب المئوية لتوزيع مراحل العملاء المحتملين بكل فرع.',
    kind: 'STACKED_BAR_100',
    metricKey: 'crm.leads.by_stage.count',
    dimension: { key: 'branch' },
    owner: 'system',
    sourceResources: ['leads'],
  },
  {
    id: 'w-won-vs-rate-combo',
    name: 'Won deals & win rate by branch',
    nameAr: 'الصفقات الرابحة ومعدل الربح حسب الفرع',
    description: 'Dual-axis comparison of closed deal count and win rate.',
    descriptionAr: 'مقارنة مزدوجة المحور بين عدد الصفقات الرابحة ومعدل الربح.',
    kind: 'COMBO',
    metricKey: 'crm.opportunities.won.count',
    secondaryMetricKey: 'crm.opportunities.win.rate',
    dimension: { key: 'branch' },
    owner: 'ali',
    accessLevel: 'EDIT',
    isShared: true,
    sourceResources: ['opportunities'],
  },
  {
    id: 'w-opp-stage-pie',
    name: 'Opportunity share by stage',
    nameAr: 'توزيع الفرص حسب المرحلة',
    description: 'Share of open deals across pipeline stages.',
    descriptionAr: 'نسبة الفرص المفتوحة عبر مراحل مسار البيع.',
    kind: 'PIE',
    metricKey: 'crm.opportunities.by_stage.count',
    dimension: { key: 'pipeline_stage' },
    owner: 'system',
    sourceResources: ['opportunities'],
  },
  {
    id: 'w-opportunity-gantt',
    name: 'Deal cycle timeline',
    nameAr: 'الجدول الزمني للصفقات',
    description: 'Active deal stage windows across the current month.',
    descriptionAr: 'الفترات الزمنية لتقدم الصفقات خلال الشهر الحالي.',
    kind: 'GANTT',
    metricKey: 'crm.opportunities.timeline.interval',
    owner: 'system',
    sourceResources: ['opportunities'],
  },

  // Waterfall, Three-quarter Gauge, Treemap, Bar, Area, Detailed Speedometer, Bullet
  {
    id: 'w-pipeline-waterfall',
    name: 'Pipeline movement',
    nameAr: 'حركة مسار البيع',
    description: 'Bridge from starting open pipeline to ending balance.',
    descriptionAr: 'تحليل التغير في قيمة مسار البيع من البداية حتى النهاية.',
    kind: 'WATERFALL',
    metricKey: 'crm.opportunities.pipeline_movement.value',
    owner: 'me',
    versionCount: 2,
    filters: { datePreset: 'CURRENT_MONTH', currencyCode: 'EGP' },
    sourceResources: ['opportunities'],
  },
  {
    id: 'w-quarterly-target-gauge',
    name: 'Quarterly quota pacing',
    nameAr: 'وتيرة المستهدف الربع سنوي',
    description: 'Three-quarter arc tracking progress toward target.',
    descriptionAr: 'مؤشر لمتابعة نسبة إنجاز المستهدف الربع سنوي.',
    kind: 'THREE_QUARTER_GAUGE',
    metricKey: 'crm.opportunities.won_vs_target.value',
    owner: 'system',
    comparison: TARGET_COMPARISON,
    filters: { datePreset: 'CURRENT_QUARTER', currencyCode: 'EGP' },
    sourceResources: ['opportunities', 'targets'],
  },
  {
    id: 'w-customer-treemap',
    name: 'Customers by segment',
    nameAr: 'العملاء حسب الشريحة',
    description: 'Hierarchical breakdown of customer accounts by segment.',
    descriptionAr: 'توزيع هرمي لحسابات العملاء حسب الشريحة والقطاع.',
    kind: 'TREEMAP',
    metricKey: 'crm.customers.by_segment.hierarchy',
    dimension: { key: 'customer_status' },
    owner: 'system',
    sourceResources: ['customer_profiles'],
  },
  {
    id: 'w-marketing-spend-bar',
    name: 'Campaign spend by channel',
    nameAr: 'الإنفاق التسويقي حسب القناة',
    description: 'Attributed pipeline value by marketing campaign spend.',
    descriptionAr: 'قيمة مسار البيع المنسوبة إلى إنفاق الحملات التسويقية.',
    kind: 'BAR',
    metricKey: 'crm.opportunities.by_stage.value',
    dimension: { key: 'pipeline_stage' },
    owner: 'system',
    filters: { datePreset: 'CURRENT_MONTH', currencyCode: 'EGP' },
    sourceResources: ['opportunities'],
  },
  {
    id: 'w-pipeline-stage-bar',
    name: 'Pipeline value by stage',
    nameAr: 'قيمة الفرص حسب المرحلة',
    description: 'Horizontal bars showing open deal value per stage.',
    descriptionAr: 'أشرطة أفقية لقيمة الفرص المفتوحة في كل مرحلة.',
    kind: 'BAR',
    metricKey: 'crm.opportunities.by_stage.value',
    dimension: { key: 'pipeline_stage' },
    owner: 'me',
    versionCount: 2,
    filters: { datePreset: 'CURRENT_MONTH', currencyCode: 'EGP' },
    sourceResources: ['opportunities'],
  },
  {
    id: 'w-exec-revenue-area',
    name: 'Long-term pipeline velocity',
    nameAr: 'وتيرة نمو مسار البيع',
    description: 'Cumulative creation trend across historical cohorts.',
    descriptionAr: 'اتجاه النمو التراكمي للعملاء عبر الفترات التاريخية.',
    kind: 'AREA',
    metricKey: 'crm.leads.created.count',
    dimension: { key: 'time', grain: 'MONTH' },
    owner: 'system',
    sourceResources: ['leads'],
  },
  {
    id: 'w-weekly-leads-area',
    name: 'Lead intake volume',
    nameAr: 'حجم استقطاب العملاء',
    description: 'Shaded trend of new leads arriving each period.',
    descriptionAr: 'منحنى مساحي لتدفق العملاء المحتملين الجدد.',
    kind: 'AREA',
    metricKey: 'crm.leads.created.count',
    dimension: { key: 'time', grain: 'MONTH' },
    owner: 'me',
    sourceResources: ['leads'],
  },
  {
    id: 'w-exec-target-speedometer',
    name: 'Branch revenue speedometer',
    nameAr: 'مقياس إيرادات الفروع',
    description: 'Detailed speedometer tracking branch quota attainment.',
    descriptionAr: 'مقياس تفصيلي لمستوى تحقيق مستهدف إيرادات الفرع.',
    kind: 'DETAILED_SPEEDOMETER',
    metricKey: 'crm.opportunities.won_vs_target.value',
    owner: 'system',
    comparison: TARGET_COMPARISON,
    filters: { datePreset: 'CURRENT_MONTH', currencyCode: 'EGP' },
    sourceResources: ['opportunities', 'targets'],
  },
  {
    id: 'w-branch-target-speedometer',
    name: 'Monthly revenue target gauge',
    nameAr: 'مقياس المستهدف الشهري التفصيلي',
    description: 'Detailed gauge for Cairo branch monthly sales target.',
    descriptionAr: 'مقياس تفصيلي لمستهدف المبيعات الشهري لفرع القاهرة.',
    kind: 'DETAILED_SPEEDOMETER',
    metricKey: 'crm.opportunities.won_vs_target.value',
    owner: 'ali',
    accessLevel: 'EDIT',
    isShared: true,
    comparison: TARGET_COMPARISON,
    filters: { datePreset: 'CURRENT_MONTH', currencyCode: 'EGP' },
    sourceResources: ['opportunities', 'targets'],
  },
  {
    id: 'w-revenue-bullet',
    name: 'Revenue vs target bullet',
    nameAr: 'الإيرادات مقابل المستهدف',
    description: 'Bullet bar comparing won revenue to the approved target.',
    descriptionAr: 'مؤشر خطي يقارن الإيرادات المحققة بالمستهدف المعتمد.',
    kind: 'BULLET',
    metricKey: 'crm.opportunities.won_vs_target.value',
    owner: 'me',
    comparison: TARGET_COMPARISON,
    filters: { datePreset: 'CURRENT_MONTH', currencyCode: 'EGP' },
    sourceResources: ['opportunities', 'targets'],
  },

  // Line Area, Heatmap, Histogram, Calendar Heatmap
  {
    id: 'w-leads-line-area',
    name: 'Acquisition vs conversion',
    nameAr: 'الاكتساب مقابل التحويل',
    description: 'Area and line comparison of created vs converted leads.',
    descriptionAr: 'رسم خطي ومساحي يقارن الاكتساب بالتحويل عبر الأشهر.',
    kind: 'LINE_AREA',
    metricKey: 'crm.leads.created.count',
    secondaryMetricKey: 'crm.leads.converted.count',
    dimension: { key: 'time', grain: 'MONTH' },
    owner: 'system',
    sourceResources: ['leads'],
  },
  {
    id: 'w-arrival-heatmap',
    name: 'Lead arrival by day & hour',
    nameAr: 'كثافة وصول العملاء حسب اليوم والساعة',
    description: 'Hourly arrival intensity across weekdays.',
    descriptionAr: 'توزيع كثافة وصول العملاء المحتملين حسب أيام الأسبوع والساعات.',
    kind: 'HEATMAP',
    metricKey: 'crm.leads.arrival_heat.count',
    dimension: { key: 'created_weekday' },
    owner: 'system',
    sourceResources: ['leads'],
  },
  {
    id: 'w-lead-aging-histogram',
    name: 'Lead aging buckets',
    nameAr: 'توزيع أعمار العملاء المحتملين',
    description: 'Number of open leads grouped by age in days.',
    descriptionAr: 'توزيع العملاء المحتملين المفتوحين وفق عدد الأيام منذ الإنشاء.',
    kind: 'HISTOGRAM',
    metricKey: 'crm.leads.aging.bins',
    owner: 'system',
    sourceResources: ['leads'],
  },
  {
    id: 'w-daily-leads-calendar-heat',
    name: 'Daily lead intake calendar',
    nameAr: 'تقويم كثافة العملاء يوميًا',
    description: 'Day-by-day lead volume heatmap over the last two months.',
    descriptionAr: 'خريطة حرارية يومية لحجم العملاء المحتملين خلال آخر شهرين.',
    kind: 'CALENDAR_HEATMAP',
    metricKey: 'crm.leads.daily.count',
    dimension: { key: 'time', grain: 'DAY' },
    owner: 'system',
    sourceResources: ['leads'],
  },

  // Box Plot, Circular Progress Gauge, Flowchart, Timeline
  {
    id: 'w-first-response-boxplot',
    name: 'First response time by branch',
    nameAr: 'زمن الاستجابة الأولى حسب الفرع',
    description: 'Min, quartile, median, and max response time distribution.',
    descriptionAr: 'توزيع الحد الأدنى والربيعيات والوسيط والأقصى لزمن الاستجابة.',
    kind: 'BOX_PLOT',
    metricKey: 'crm.leads.first_response.duration',
    dimension: { key: 'branch' },
    owner: 'system',
    sourceResources: ['leads', 'activities'],
  },
  {
    id: 'w-sla-circular-gauge',
    name: 'Quota circular progress',
    nameAr: 'التقدم الدائري نحو المستهدف',
    description: 'Circular progress ring for approved revenue target.',
    descriptionAr: 'حلقة تقدم دائرية لمتابعة تحقيق مستهدف المبيعات.',
    kind: 'CIRCULAR_PROGRESS_GAUGE',
    metricKey: 'crm.opportunities.won_vs_target.value',
    owner: 'system',
    comparison: TARGET_COMPARISON,
    filters: { datePreset: 'CURRENT_MONTH', currencyCode: 'EGP' },
    sourceResources: ['opportunities', 'targets'],
  },
  {
    id: 'w-stage-flowchart',
    name: 'Stage transition flow',
    nameAr: 'تدفق الانتقال بين المراحل',
    description: 'Sankey flow of deals moving across pipeline stages.',
    descriptionAr: 'مخطط تدفق لحركة الصفقات وانتقالها بين مراحل البيع.',
    kind: 'FLOWCHART',
    metricKey: 'crm.opportunities.stage_flow.count',
    dimension: { key: 'stage_flow' },
    owner: 'system',
    sourceResources: ['opportunities'],
  },
  {
    id: 'w-crm-timeline',
    name: 'Key sales milestones',
    nameAr: 'الخط الزمني لأحداث المبيعات',
    description: 'Chronological timeline of recent CRM events.',
    descriptionAr: 'تسلسل زمني لأبرز أحداث العملاء والفرص الأخيرة.',
    kind: 'TIMELINE',
    metricKey: 'crm.activities.feed.events',
    owner: 'me',
    sourceResources: ['activities', 'leads', 'opportunities'],
  },

  // Scatter, Bubble, Calendar
  {
    id: 'w-deal-scatter',
    name: 'Deal value vs win probability',
    nameAr: 'قيمة الصفقة مقابل احتمال الربح',
    description: 'Scatter plot correlating deal size and probability.',
    descriptionAr: 'مخطط تشتت يوضح العلاقة بين قيمة الصفقة واحتمال ربحها.',
    kind: 'SCATTER',
    metricKey: 'crm.opportunities.deal_vs_probability.xy',
    owner: 'me',
    filters: { datePreset: 'CURRENT_MONTH', currencyCode: 'EGP' },
    sourceResources: ['opportunities'],
  },
  {
    id: 'w-deal-bubble',
    name: 'Deal size, probability & velocity',
    nameAr: 'حجم الصفقات واحتماليتها',
    description: 'Bubble chart sized by activity engagement.',
    descriptionAr: 'مخطط فقاعي يربط قيمة الصفقة واحتمال الربح بحجم المتابعات.',
    kind: 'BUBBLE',
    metricKey: 'crm.opportunities.deal_vs_probability.xy',
    owner: 'me',
    filters: { datePreset: 'CURRENT_MONTH', currencyCode: 'EGP' },
    sourceResources: ['opportunities'],
  },
  {
    id: 'w-activities-calendar',
    name: 'Scheduled activities calendar',
    nameAr: 'تقويم الأنشطة المجدولة',
    description: 'Monthly agenda of scheduled calls, demos, and reviews.',
    descriptionAr: 'عرض شهري للمكالمات والعروض والاجتماعات المجدولة.',
    kind: 'CALENDAR',
    metricKey: 'crm.activities.schedule.interval',
    owner: 'me',
    sourceResources: ['activities'],
  },

  // 3 DRAFT widgets
  {
    id: 'w-draft-weekly-calls',
    name: 'Weekly completed calls (draft)',
    nameAr: 'المكالمات المكتملة أسبوعيًا (مسودة)',
    description: 'Draft bar chart of weekly outbound call counts.',
    descriptionAr: 'مسودة رسم أشرطة لعدد المكالمات الصادرة أسبوعيًا.',
    kind: 'COLUMN',
    metricKey: 'crm.activities.completed.count',
    dimension: { key: 'time', grain: 'WEEK' },
    owner: 'me',
    status: 'DRAFT',
    sourceResources: ['activities'],
  },
  {
    id: 'w-draft-source-conversion',
    name: 'Conversion by source (draft)',
    nameAr: 'التحويل حسب المصدر (مسودة)',
    description: 'Work-in-progress source conversion breakdown.',
    descriptionAr: 'مسودة تحليل معدل التحويل وفق مصدر العميل المحتمل.',
    kind: 'BAR',
    metricKey: 'crm.leads.by_source.count',
    dimension: { key: 'source' },
    owner: 'me',
    status: 'DRAFT',
    sourceResources: ['leads'],
  },
  {
    id: 'w-draft-activity-mix',
    name: 'Activities by type (draft)',
    nameAr: 'الأنشطة حسب النوع (مسودة)',
    description: 'Draft donut breakdown of completed CRM activities.',
    descriptionAr: 'مسودة توزيع الأنشطة المكتملة حسب النوع.',
    kind: 'DONUT',
    metricKey: 'crm.activities.by_type.count',
    dimension: { key: 'activity_type' },
    owner: 'me',
    status: 'DRAFT',
    sourceResources: ['activities'],
  },

  // 2 ARCHIVED widgets
  {
    id: 'w-archived-legacy-forecast',
    name: 'Old weighted forecast',
    nameAr: 'التوقعات المرجحة السابقة',
    description: 'Archived forecast card replaced by pipeline movement.',
    descriptionAr: 'بطاقة توقعات مؤرشفة استُبدلت بمخطط حركة مسار البيع.',
    kind: 'METRIC_CARD',
    metricKey: 'crm.opportunities.legacy_forecast.value',
    owner: 'me',
    status: 'ARCHIVED',
    versionCount: 1,
    sourceResources: ['opportunities'],
  },
  {
    id: 'w-archived-q3-calls',
    name: 'Q3 call completion mix',
    nameAr: 'توزيع مكالمات الربع الثالث',
    description: 'Archived quarterly activity chart.',
    descriptionAr: 'رسم مؤرشف لأنشطة الربع الثالث.',
    kind: 'PIE',
    metricKey: 'crm.activities.by_type.count',
    dimension: { key: 'activity_type' },
    owner: 'me',
    status: 'ARCHIVED',
    versionCount: 1,
    sourceResources: ['activities'],
  },
];

export const WIDGET_STORE: StoredWidget[] = SEEDS.map((seed, index) => buildStoredWidget(seed, index));

export function localizeWidgetName(widgetId: string, currentName: string): string {
  const entry = WIDGET_LOCALE_NAMES[widgetId];
  if (!entry) return currentName;
  if (currentName !== entry.en) return currentName;
  return fakeLang() === 'ar' ? entry.ar : entry.en;
}

export function embedded(w: StoredWidget): EmbeddedWidget {
  const latestVersion = w.versions[w.versions.length - 1];
  const snapshot = latestVersion?.snapshot;
  const rawName = snapshot?.name ?? w.summary.name;
  const localizedName = localizeWidgetName(w.summary.id, rawName);

  const querySpec: QuerySpec = snapshot?.querySpec
    ? structuredClone(snapshot.querySpec)
    : w.summary.querySpec
      ? structuredClone(w.summary.querySpec)
      : { series: [{ metricKey: 'crm.leads.created.total', axis: 'LEFT' }] };

  const displaySpec: DisplaySpec = snapshot?.displaySpec
    ? structuredClone(snapshot.displaySpec)
    : w.summary.displaySpec
      ? structuredClone(w.summary.displaySpec)
      : { title: localizedName };

  return structuredClone({
    id: w.summary.id,
    ownerUserId: w.summary.ownerUserId,
    ownerName: w.summary.ownerName,
    name: localizedName,
    visualizationType: snapshot?.visualizationType ?? w.summary.visualizationType ?? 'METRIC_CARD',
    querySpec,
    displaySpec: {
      ...displaySpec,
      title: localizedName,
    },
    schemaVersion: w.summary.schemaVersion ?? 2,
    revision: w.summary.revision,
    updatedAt: w.summary.updatedAt,
    versionNumber: w.summary.versionNumber ?? latestVersion?.versionNumber ?? 1,
  });
}
