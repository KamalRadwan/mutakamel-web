import { FAKE_NOW, fakeId } from '../../../../shared/widgets/dashboard/analytics-api';
import { FAKE_CATALOG } from '../../../../shared/widgets/dashboard/fake/fake-catalog';
import { FAKE_BRANCHES, FAKE_PEOPLE, FAKE_TEAMS, fakeLang } from '../../../../shared/widgets/dashboard/fake/fake-org';
import {
  applyFakeGovernedTarget,
  applyFakeTopN,
  applyFakeWinRate,
  type FakeTargetScenario,
} from '../../../../shared/widgets/dashboard/fake/fake-closure';
import type { WidgetExecution } from '../../../../shared/widgets/dashboard/analytics.model';
import { DASHBOARD_STORE } from '../dashboards/dashboards.fake';
import { WIDGET_STORE, type StoredWidget } from '../shared/widget-store.fake';
import type {
  DraftState,
  GovernedTargetOption,
  PublishWidgetResult,
  QuerySpec,
  Share,
  Visualization,
  WidgetSourceResource,
  WidgetSummary,
} from './widgets.model';

export const IMPACT_TTL_MS = 5 * 60_000;

export const INACTIVE_USER_IDS = new Set<string>([FAKE_PEOPLE[7].id]);

export interface SeedDashboardMeta {
  id: string;
  nameEn: string;
  nameAr: string;
  revision: number;
}

export const SEED_DASHBOARDS: SeedDashboardMeta[] = DASHBOARD_STORE.map((stored) => ({
  id: stored.detail.id,
  nameEn: stored.detail.name,
  nameAr: stored.nameAr ?? stored.detail.name,
  revision: stored.detail.revision,
}));

export interface StoredUsagePlacement {
  placementId: string;
  dashboardId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  versionPolicy: 'FOLLOW_ACTIVE' | 'PINNED';
  versionNumber: number | null;
  /** The placement sits on a dashboard the viewer cannot see (counted, never listed). */
  hidden: boolean;
}

export interface PublishImpactRecord {
  impactId: string;
  expiresAtMs: number;
  widgetId: string;
  widgetRevision: number;
  governanceRevision: number;
  draftId: string;
  draftRevision: number;
  nextVersionNumber: number;
  adjustments: { placementId: string; dashboardId: string; x: number; y: number; w: number; h: number }[];
}

export interface LifecycleImpactRecord {
  impactId: string;
  expiresAtMs: number;
  widgetId: string;
  action: 'ARCHIVE' | 'RESTORE';
  widgetRevision: number;
  governanceRevision: number;
}

export interface TransferImpactRecord {
  impactId: string;
  expiresAtMs: number;
  widgetId: string;
  targetUserId: string;
  widgetRevision: number;
  governanceRevision: number;
}

export interface RestoreImpactRecord {
  impactId: string;
  expiresAtMs: number;
  widgetId: string;
  leftVersionNumber: number;
  rightVersionNumber: number;
  widgetRevision: number;
  governanceRevision: number;
}

const USAGE_MAP = new Map<string, StoredUsagePlacement[]>();

export const PUBLISH_IMPACTS = new Map<string, PublishImpactRecord>();
export const LIFECYCLE_IMPACTS = new Map<string, LifecycleImpactRecord>();
export const TRANSFER_IMPACTS = new Map<string, TransferImpactRecord>();
export const RESTORE_IMPACTS = new Map<string, RestoreImpactRecord>();

export const CREATE_IDEM = new Map<
  string,
  { fingerprint: string; result: DraftState & { activeVersionNumber: null } }
>();
export const CLONE_IDEM = new Map<string, { fingerprint: string; result: DraftState }>();
export const PUBLISH_IDEM = new Map<string, { fingerprint: string; result: PublishWidgetResult }>();
export const SHARE_IDEM = new Map<string, { fingerprint: string; result: Share }>();

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function impactExpiresIso(): string {
  return new Date(Date.parse(FAKE_NOW) + IMPACT_TTL_MS).toISOString();
}

export function dashboardMeta(dashboardId: string): SeedDashboardMeta {
  return SEED_DASHBOARDS.find((d) => d.id === dashboardId) ?? SEED_DASHBOARDS[0];
}

export function localizedDashboardName(meta: SeedDashboardMeta): string {
  return fakeLang() === 'ar' ? meta.nameAr : meta.nameEn;
}

export function personName(userId: string, fallback: string | null = null): string | null {
  const person = FAKE_PEOPLE.find((p) => p.id === userId);
  if (!person) return fallback;
  return fakeLang() === 'ar' ? person.nameAr : person.name;
}

export function personTeamId(userId: string): string | null {
  return FAKE_PEOPLE.find((p) => p.id === userId)?.teamId ?? null;
}

function defaultBoxFor(viz: Visualization | null): { w: number; h: number } {
  const entry = viz ? FAKE_CATALOG.visualizations.find((v) => v.key === viz) : undefined;
  return entry ? { ...entry.defaultSize } : { w: 24, h: 56 };
}

function buildSeedPlacements(widget: StoredWidget): StoredUsagePlacement[] {
  if (widget.summary.status === 'DRAFT') {
    return [];
  }

  if (widget.summary.status === 'ARCHIVED') {
    const archivedWidgets = WIDGET_STORE.filter((w) => w.summary.status === 'ARCHIVED');
    const archivedIndex = archivedWidgets.findIndex((w) => w.summary.id === widget.summary.id);
    if (archivedIndex <= 0) {
      return [];
    }
    const box = defaultBoxFor(widget.summary.visualizationType);
    return [0, 1].map((offset) => {
      const dash = SEED_DASHBOARDS[(archivedIndex + offset) % SEED_DASHBOARDS.length];
      return {
        placementId: fakeId(),
        dashboardId: dash.id,
        x: offset === 0 ? 0 : 24,
        y: offset * 12,
        w: box.w,
        h: box.h,
        versionPolicy: offset === 0 ? 'FOLLOW_ACTIVE' : 'PINNED',
        versionNumber: widget.summary.versionNumber ?? 1,
        // `hidden` means "on a dashboard the viewer cannot see"; archiving never changes it.
        hidden: false,
      };
    });
  }

  const placements: StoredUsagePlacement[] = [];
  for (const stored of DASHBOARD_STORE) {
    const detail = stored.detail;
    const primaryKey =
      detail.breakpoints.find((bp) => bp.isPrimary)?.breakpointKey ?? Object.keys(detail.layouts)[0];
    const items = primaryKey ? (detail.layouts[primaryKey]?.items ?? []) : [];
    for (const placement of detail.placements) {
      if (placement.widgetId !== widget.summary.id) continue;
      const item = items.find((it) => it.placementId === placement.id);
      const box = defaultBoxFor(widget.summary.visualizationType);
      placements.push({
        placementId: placement.id,
        dashboardId: detail.id,
        x: item?.x ?? 0,
        y: item?.y ?? 0,
        w: item?.w ?? box.w,
        h: item?.h ?? box.h,
        versionPolicy: placement.versionPolicy,
        versionNumber: placement.pinnedVersionNumber ?? widget.summary.versionNumber ?? 1,
        // A layout `isHidden` item is still on a dashboard the viewer can see.
        hidden: false,
      });
    }
  }
  return placements;
}

export function ensureUsageFor(widget: StoredWidget): StoredUsagePlacement[] {
  let list = USAGE_MAP.get(widget.summary.id);
  if (!list) {
    list = buildSeedPlacements(widget);
    USAGE_MAP.set(widget.summary.id, list);
  }
  return list;
}

export function initEmptyUsage(widgetId: string): void {
  USAGE_MAP.set(widgetId, []);
}

export function deleteUsage(widgetId: string): void {
  USAGE_MAP.delete(widgetId);
}

export function getUsageSummaryCounts(widget: StoredWidget): {
  placementCount: number;
  dashboardCount: number;
  hiddenPlacementCount: number;
} {
  const all = ensureUsageFor(widget);
  const visible = all.filter((p) => !p.hidden);
  const hidden = all.length - visible.length;
  const dashboards = new Set(visible.map((p) => p.dashboardId));
  return {
    placementCount: visible.length,
    dashboardCount: dashboards.size,
    hiddenPlacementCount: hidden,
  };
}

type FakeAlertRuleRef = { id: string; name: string; enabled: boolean; suspendedReason: string | null };

export function fakeAlertRulesFor(
  widgetId: string,
  action: 'ARCHIVE' | 'RESTORE',
  hasPlacements: boolean,
): { effect: 'WILL_SUSPEND' | 'OWNER_MUST_RESUME'; count: number; items: FakeAlertRuleRef[] } {
  const effect = action === 'ARCHIVE' ? 'WILL_SUSPEND' : 'OWNER_MUST_RESUME';
  if (!hasPlacements) {
    return { effect, count: 0, items: [] };
  }
  const h = hashString(widgetId);
  const count = (h % 3);
  if (count === 0) {
    return { effect, count: 0, items: [] };
  }
  const ar = fakeLang() === 'ar';
  // ARCHIVE lists live rules (not suspended); RESTORE lists rules suspended WIDGET_UNAVAILABLE.
  const suspendedReason = action === 'ARCHIVE' ? null : 'WIDGET_UNAVAILABLE';
  const catalog: FakeAlertRuleRef[] = [
    {
      id: `alert-${widgetId.slice(0, 8)}-1`,
      name: ar ? 'تنبيه انخفاض التحويل الأسبوعي' : 'Weekly conversion drop alert',
      enabled: true,
      suspendedReason,
    },
    {
      id: `alert-${widgetId.slice(0, 8)}-2`,
      name: ar ? 'تنبيه تراجع قيمة مسار البيع' : 'Pipeline value threshold alert',
      enabled: true,
      suspendedReason,
    },
  ];
  return {
    effect,
    count,
    items: catalog.slice(0, count),
  };
}

/** Publish-impact dependents and the suspended alert rules (dashboard-widget-publication.service.ts dependents()). */
export function fakePublishDependentsFor(widgetId: string, dashboardCount: number): {
  dependents: {
    alertRules: { count: number; items: FakeAlertRuleRef[] };
    subscriptions: { count: number; items: { id: string; name: string; dashboardId: string }[] };
    reports: { count: number; items: { blueprintKey: string; definitionRevision: number; name: string }[] };
  };
  suspendedAlertRules: { count: number; items: { id: string; name: string; suspendedReason: string }[] };
} {
  const ar = fakeLang() === 'ar';
  const h = hashString(widgetId);
  const alertCount = dashboardCount > 0 && h % 2 === 0 ? 1 : 0;
  const subCount = dashboardCount > 1 && h % 3 === 0 ? 1 : 0;
  const firstDashboard = SEED_DASHBOARDS[h % SEED_DASHBOARDS.length]?.id ?? '';
  return {
    dependents: {
      alertRules: {
        count: alertCount,
        items: alertCount
          ? [
              {
                id: `alert-${widgetId.slice(0, 8)}`,
                name: ar ? 'تنبيه متابعة الأداء' : 'Performance pacing alert',
                enabled: true,
                suspendedReason: null,
              },
            ]
          : [],
      },
      subscriptions: {
        count: subCount,
        items: subCount
          ? [
              {
                id: `sub-${widgetId.slice(0, 8)}`,
                name: ar ? 'التقرير التنفيذي الصباحي' : 'Morning executive brief',
                dashboardId: firstDashboard,
              },
            ]
          : [],
      },
      reports: { count: 0, items: [] },
    },
    suspendedAlertRules: { count: 0, items: [] },
  };
}

export function deriveSourceResources(querySpec: QuerySpec): WidgetSourceResource[] {
  const resources = new Set<WidgetSourceResource>();
  for (const series of querySpec.series) {
    const metric = FAKE_CATALOG.metrics.find((m) => m.key === series.metricKey);
    if (!metric) continue;
    for (const res of metric.accessResources) {
      resources.add(res);
    }
  }
  return resources.size > 0 ? Array.from(resources) : ['leads'];
}

/**
 * Spec-driven fake results shared by the dashboard run and the builder preview:
 * win rate shapes, Top-N with the folded OTHER bucket, and the governed target output.
 */
export function applyFakeSpecEffects(
  exec: WidgetExecution,
  querySpec: QuerySpec,
  displayCurrency: string,
  scenario?: FakeTargetScenario,
): WidgetExecution {
  if (exec.state !== 'READY') return exec;
  const metricKey = querySpec.series[0]?.metricKey;
  const dim = querySpec.dimension;
  let next = exec;

  if (metricKey === 'crm.opportunities.win.rate') {
    next = applyFakeWinRate(next, dim?.key, dim?.topN, dim?.groupRest ?? false);
  } else if (dim && (dim.topN !== undefined || dim.groupRest)) {
    next = applyFakeTopN(next, dim.topN, dim.groupRest ?? false);
  }

  const governed = querySpec.comparison?.governedTarget;
  if (querySpec.comparison?.type === 'GOVERNED_TARGET' && governed && metricKey) {
    const option = fakeGovernedTargets(metricKey, governed.periodGrain).find((o) => o.subjectId === governed.subjectId);
    const rate = metricKey === 'crm.opportunities.win.rate';
    next = applyFakeGovernedTarget(next, {
      unit: rate ? 'PERCENT' : 'MONEY',
      ...(rate ? {} : { currencyCode: governed.currencyCode }),
      displayCurrency,
      targetValue: option?.targetValue ?? null,
      ...(scenario ? { scenario } : {}),
    });
  }
  return next;
}

export function fakeGovernedTargets(
  metricKey: string,
  periodGrain: 'MONTH' | 'QUARTER' | 'YEAR',
): GovernedTargetOption[] {
  if (metricKey === 'crm.opportunities.win.rate') {
    // A governed rate target: percent value, no currency. It returns attainment and a gap in percentage points, no pace.
    const rateAr = fakeLang() === 'ar';
    const rateBranch = FAKE_BRANCHES[0];
    const rateTeam = FAKE_TEAMS[0];
    const rates: GovernedTargetOption[] = [
      {
        id: '01934b30-0000-7000-8000-000000000511',
        branchId: rateBranch.id,
        subjectType: 'BRANCH',
        subjectId: rateBranch.id,
        subjectName: rateAr ? rateBranch.name.ar : rateBranch.name.en,
        currencyCode: '',
        periodGrain: 'MONTH',
        periodStart: '2026-11-01',
        unit: 'PERCENT',
        targetValue: '35.00',
      },
      {
        id: '01934b30-0000-7000-8000-000000000512',
        branchId: rateBranch.id,
        subjectType: 'TEAM',
        subjectId: rateTeam.id,
        subjectName: rateAr ? rateTeam.name.ar : rateTeam.name.en,
        currencyCode: '',
        periodGrain: 'QUARTER',
        periodStart: '2026-10-01',
        unit: 'PERCENT',
        targetValue: '32.50',
      },
    ];
    return rates.filter((item) => item.periodGrain === periodGrain);
  }
  if (
    metricKey !== 'crm.opportunities.won.value' &&
    metricKey !== 'crm.opportunities.won_vs_target.value'
  ) {
    return [];
  }

  const ar = fakeLang() === 'ar';
  const cairo = FAKE_BRANCHES[0];
  const alex = FAKE_BRANCHES[1];
  const cairoSales = FAKE_TEAMS[0];
  const cairoCorp = FAKE_TEAMS[1];

  const all: GovernedTargetOption[] = [
    {
      id: '01934b30-0000-7000-8000-000000000501',
      branchId: cairo.id,
      subjectType: 'BRANCH',
      subjectId: cairo.id,
      subjectName: ar ? cairo.name.ar : cairo.name.en,
      currencyCode: 'EGP',
      periodGrain: 'MONTH',
      periodStart: '2026-11-01',
      unit: 'MONEY',
      targetValue: '1200000.00',
    },
    {
      id: '01934b30-0000-7000-8000-000000000502',
      branchId: cairo.id,
      subjectType: 'TEAM',
      subjectId: cairoSales.id,
      subjectName: ar ? cairoSales.name.ar : cairoSales.name.en,
      currencyCode: 'EGP',
      periodGrain: 'MONTH',
      periodStart: '2026-11-01',
      unit: 'MONEY',
      targetValue: '750000.00',
    },
    {
      id: '01934b30-0000-7000-8000-000000000503',
      branchId: cairo.id,
      subjectType: 'TEAM',
      subjectId: cairoCorp.id,
      subjectName: ar ? cairoCorp.name.ar : cairoCorp.name.en,
      currencyCode: 'EGP',
      periodGrain: 'QUARTER',
      periodStart: '2026-10-01',
      unit: 'MONEY',
      targetValue: '2800000.00',
    },
    {
      id: '01934b30-0000-7000-8000-000000000504',
      branchId: alex.id,
      subjectType: 'BRANCH',
      subjectId: alex.id,
      subjectName: ar ? alex.name.ar : alex.name.en,
      currencyCode: 'EGP',
      periodGrain: 'QUARTER',
      periodStart: '2026-10-01',
      unit: 'MONEY',
      targetValue: '1950000.00',
    },
  ];

  return all.filter((item) => item.periodGrain === periodGrain);
}
