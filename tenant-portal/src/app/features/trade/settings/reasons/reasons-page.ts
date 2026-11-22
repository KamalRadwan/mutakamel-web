import { Component, DestroyRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerBox,
  tablerEye,
  tablerFileText,
  tablerLock,
  tablerPencil,
  tablerShieldCheck,
  tablerStack2,
  tablerToggleRight,
  tablerTrash,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { ActionItem, ActionSelection, ActionsMenu } from '../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../shared/ui/button/button';
import { Field } from '../../../../shared/ui/field/field';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { SettingsFrame } from '../../../../shared/ui/settings-frame/settings-frame';
import { StepFilter, StepOption } from '../../../../shared/ui/step-filter/step-filter';
import { Switch } from '../../../../shared/ui/switch/switch';
import { TabItem, Tabs, tabButtonId, tabPanelId } from '../../../../shared/ui/tabs/tabs';
import { errorCodeOf } from '../../shared/trade-api';
import type { ReasonCode, ReasonKind } from '../../shared/trade-foundation.model';
import { REASON_AREAS, type ReasonArea } from '../../shared/reasons/reason-kinds';
import {
  type ReasonCounts,
  countReasons,
  listReasonsAdmin,
  updateReason,
} from '../../shared/reasons/reasons-admin.api';
import { ReasonModal } from './reason-modal/reason-modal';
import { settingsErrorText } from '../settings-errors';
import { SettingsMutationKeys } from '../settings-mutation-keys';
import { translationEvents } from '../../../../core/i18n/translation-events';

const CAN_MANAGE = true; // later from the session permissions (trade.reasons.manage)
const SORT_ORDER_MAX = 1_000_000;

const AREA_TABS_META: readonly { id: ReasonArea; icon: string; labelKey: string }[] = [
  { id: 'documents', icon: 'tablerFileText', labelKey: 'tset.areas.documents' },
  { id: 'inventory', icon: 'tablerStack2', labelKey: 'tset.areas.inventory' },
  { id: 'catalogue', icon: 'tablerBox', labelKey: 'tset.areas.catalogue' },
  { id: 'governance', icon: 'tablerShieldCheck', labelKey: 'tset.areas.governance' },
];

const GRID_COLUMNS =
  'grid-cols-trade-reason-row-actions';
const GRID_COLUMNS_READONLY =
  'grid-cols-trade-reason-row';

function isReasonArea(raw: string | null | undefined): raw is ReasonArea {
  return raw === 'documents' || raw === 'inventory' || raw === 'catalogue' || raw === 'governance';
}

function areaOfKind(kind: string | null | undefined): ReasonArea | null {
  if (!kind) return null;
  for (const meta of AREA_TABS_META) {
    if (REASON_AREAS[meta.id].includes(kind)) {
      return meta.id;
    }
  }
  return null;
}

function parseAreaAndKind(
  areaRaw: string | null | undefined,
  kindRaw: string | null | undefined,
): { area: ReasonArea; kind: ReasonKind } {
  const areaCandidate = areaRaw?.trim().toLowerCase();
  const kindCandidate = kindRaw?.trim().toUpperCase();

  if (isReasonArea(areaCandidate)) {
    const kinds = REASON_AREAS[areaCandidate];
    const kind = kindCandidate && kinds.includes(kindCandidate) ? kindCandidate : kinds[0];
    return { area: areaCandidate, kind };
  }

  const owningArea = areaOfKind(kindCandidate);
  if (owningArea && kindCandidate) {
    return { area: owningArea, kind: kindCandidate };
  }

  return { area: 'documents', kind: REASON_AREAS.documents[0] };
}

function compareReasons(a: ReasonCode, b: ReasonCode): number {
  return a.sortOrder - b.sortOrder || a.code.localeCompare(b.code);
}

@Component({
  selector: 'app-trade-reasons-page',
  imports: [
    NgIcon,
    TranslocoPipe,
    ActionsMenu,
    Button,
    Field,
    FullState,
    SettingsFrame,
    StepFilter,
    Switch,
    Tabs,
    ReasonModal,
  ],
  providers: [
    provideTranslocoScope(
      { scope: 'trade-shared', alias: 'tradeShared' },
      'settings',
      { scope: 'trade-settings', alias: 'tset' },
      { scope: 'trade-settings-reasons', alias: 'treasons' },
    ),
    provideIcons({
      tablerFileText,
      tablerStack2,
      tablerBox,
      tablerShieldCheck,
      tablerLock,
      tablerEye,
      tablerPencil,
      tablerToggleRight,
      tablerTrash,
    }),
  ],
  templateUrl: './reasons-page.html',
  host: { class: 'flex min-h-0 flex-1 flex-col' },
})
export class ReasonsPage {
  private static nextId = 0;
  protected readonly uid = `trade-reasons-page-${++ReasonsPage.nextId}`;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;
  private readonly queryParams = toSignal(this.route.queryParamMap);

  private readonly reasonModal = viewChild.required(ReasonModal);

  protected readonly canManage = CAN_MANAGE;
  protected readonly skeletonRows = [0, 1, 2, 3, 4];
  protected readonly tabButtonId = tabButtonId;
  protected readonly tabPanelId = tabPanelId;
  protected readonly gridColumns = CAN_MANAGE ? GRID_COLUMNS : GRID_COLUMNS_READONLY;

  private readonly initialSelection = parseAreaAndKind(
    this.route.snapshot.queryParamMap.get('area'),
    this.route.snapshot.queryParamMap.get('kind'),
  );

  protected readonly activeArea = signal<ReasonArea>(this.initialSelection.area);
  protected readonly activeKind = signal<ReasonKind>(this.initialSelection.kind);
  protected readonly counts = signal<ReasonCounts | null>(null);
  protected readonly reasons = signal<ReasonCode[]>([]);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly search = signal('');
  protected readonly showInactive = signal(false);
  private readonly busyIds = signal<ReadonlySet<string>>(new Set());
  private readonly mutationKeys = new SettingsMutationKeys();

  private lastUrlArea: ReasonArea = this.initialSelection.area;
  private lastUrlKind: ReasonKind = this.initialSelection.kind;
  private initialLoaded = false;
  private lastLoadedKind: ReasonKind | null = null;
  private listSeq = 0;
  private countsSeq = 0;
  private destroyed = false;

  protected readonly areaTabs = computed<TabItem[]>(() => {
    this.i18n();
    const currentCounts = this.counts();
    return AREA_TABS_META.map((meta) => {
      const kinds = REASON_AREAS[meta.id];
      const count = currentCounts
        ? kinds.reduce((sum, kind) => sum + (currentCounts.byKind[kind] ?? 0), 0)
        : null;
      return {
        id: meta.id,
        label: this.transloco.translate(meta.labelKey),
        icon: meta.icon,
        count,
      };
    });
  });

  protected readonly kindSteps = computed<StepOption[]>(() => {
    this.i18n();
    const kinds = REASON_AREAS[this.activeArea()];
    const currentCounts = this.counts();
    return kinds.map((kind) => ({
      id: kind,
      label: this.transloco.translate(`tset.kinds.${kind}`),
      count: currentCounts ? (currentCounts.byKind[kind] ?? 0) : null,
    }));
  });

  protected readonly visibleReasons = computed<ReasonCode[]>(() => {
    const term = this.search().trim().toLowerCase();
    const list = this.reasons();
    const filtered = term
      ? list.filter(
          (item) =>
            item.code.toLowerCase().includes(term) ||
            (item.localizedNames['en']?.toLowerCase().includes(term) ?? false) ||
            (item.localizedNames['ar']?.toLowerCase().includes(term) ?? false),
        )
      : list;
    return filtered.slice().sort(compareReasons);
  });

  protected readonly nextSortOrder = computed(() => {
    let maxOrder = 0;
    for (const item of this.reasons()) {
      if (item.sortOrder > maxOrder) {
        maxOrder = item.sortOrder;
      }
    }
    const next = maxOrder <= 0 ? 10 : Math.floor(maxOrder / 10) * 10 + 10;
    return Math.min(next, SORT_ORDER_MAX);
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
    });

    effect(() => {
      const qp = this.queryParams();
      if (!qp) return;
      const parsed = parseAreaAndKind(qp.get('area'), qp.get('kind'));
      untracked(() => {
        if (parsed.area !== this.lastUrlArea || parsed.kind !== this.lastUrlKind) {
          this.lastUrlArea = parsed.area;
          this.lastUrlKind = parsed.kind;
          this.activeArea.set(parsed.area);
          this.activeKind.set(parsed.kind);
        }
      });
    });

    effect(() => {
      const kind = this.activeKind();
      const includeInactive = this.showInactive();
      untracked(() => {
        if (!this.initialLoaded) {
          this.initialLoaded = true;
          this.lastLoadedKind = kind;
          void this.loadAll(kind, includeInactive);
          return;
        }
        if (kind !== this.lastLoadedKind) {
          this.lastLoadedKind = kind;
          this.reasons.set([]);
        }
        if (this.counts() === null) {
          void this.loadAll(kind, includeInactive);
          return;
        }
        void this.loadKind(kind, includeInactive);
      });
    });
  }

  protected selectArea(next: string): void {
    if (!isReasonArea(next)) return;
    const nextKind = REASON_AREAS[next][0];
    if (next === this.activeArea() && nextKind === this.activeKind()) return;
    this.activeArea.set(next);
    this.activeKind.set(nextKind);
    this.lastUrlArea = next;
    this.lastUrlKind = nextKind;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        area: next === 'documents' ? null : next,
        kind: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected selectKind(next: string): void {
    const area = this.activeArea();
    const kinds = REASON_AREAS[area];
    if (!kinds.includes(next)) return;
    if (next === this.activeKind() && next === this.lastUrlKind) return;
    this.activeKind.set(next);
    this.lastUrlArea = area;
    this.lastUrlKind = next;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        area: area === 'documents' ? null : area,
        kind: next === kinds[0] ? null : next,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected reload(): void {
    void this.loadAll(this.activeKind(), this.showInactive());
  }

  protected openCreate(): void {
    if (!this.canManage) return;
    this.reasonModal().openCreate(this.activeKind(), this.nextSortOrder());
  }

  protected openEdit(reason: ReasonCode): void {
    this.reasonModal().openEdit(reason);
  }

  protected clearSearch(): void {
    this.search.set('');
  }

  protected primaryName(reason: ReasonCode): string {
    const lang = this.language();
    const other = lang === 'ar' ? 'en' : 'ar';
    return reason.localizedNames[lang]?.trim() || reason.localizedNames[other]?.trim() || reason.code;
  }

  protected secondaryName(reason: ReasonCode): string {
    const lang = this.language();
    const other = lang === 'ar' ? 'en' : 'ar';
    const primary = this.primaryName(reason);
    const secondary = reason.localizedNames[other]?.trim() ?? '';
    return secondary && secondary !== primary ? secondary : '';
  }

  protected rowActions(reason: ReasonCode): ActionItem[] {
    this.i18n();
    const items: ActionItem[] = [
      {
        id: 'open',
        title: this.transloco.translate('treasons.actions.open'),
        icon: 'tablerEye',
        tile: 'bg-icon-blue',
      },
    ];

    if (!this.canManage) {
      return items;
    }

    items.push({
      id: 'edit',
      title: this.transloco.translate('treasons.actions.edit'),
      icon: 'tablerPencil',
      tile: 'bg-icon-navy',
    });

    if (reason.isActive) {
      items.push({
        id: 'deactivate',
        title: this.transloco.translate('treasons.actions.deactivate'),
        icon: 'tablerToggleRight',
        tile: 'bg-icon-orange',
        disabled: reason.isSystem,
        reason: reason.isSystem ? this.transloco.translate('treasons.systemLocked') : undefined,
      });
    } else {
      items.push({
        id: 'activate',
        title: this.transloco.translate('treasons.actions.activate'),
        icon: 'tablerToggleRight',
        tile: 'bg-icon-orange',
      });
    }

    items.push({
      id: 'delete',
      title: this.transloco.translate('treasons.actions.delete'),
      icon: 'tablerTrash',
      tile: 'bg-icon-red',
      danger: true,
      disabled: reason.isSystem,
      reason: reason.isSystem ? this.transloco.translate('treasons.systemLockedDelete') : undefined,
    });

    return items;
  }

  protected async handleAction(reason: ReasonCode, selection: ActionSelection): Promise<void> {
    if (selection.id === 'open' || selection.id === 'edit') {
      this.openEdit(reason);
      return;
    }

    if (selection.id === 'delete') {
      void this.reasonModal().confirmDelete(reason, false);
      return;
    }

    if (selection.id !== 'activate' && selection.id !== 'deactivate') return;
    if (!this.canManage || (reason.isSystem && selection.id === 'deactivate') || this.busyIds().has(reason.id)) return;

    const nextActive = selection.id === 'activate';
    this.setBusy(reason.id, true);
    try {
      const operation = `update:${reason.id}`;
      const patch = { isActive: nextActive };
      const updated = await updateReason(
        reason.id,
        reason.version,
        patch,
        this.mutationKeys.for(operation, { version: reason.version, patch }),
      );
      this.mutationKeys.clear(operation);
      if (this.destroyed) return;
      this.syncReason(updated);
      this.notify.success(
        this.transloco.translate(nextActive ? 'treasons.toasts.activated' : 'treasons.toasts.deactivated'),
      );
      void this.refreshCounts();
    } catch (error) {
      if (this.destroyed) return;
      const code = errorCodeOf(error);
      if (code === 'TRADE.CONCURRENCY.STALE_VERSION') {
        this.reasonModal().openConflict(reason, { isActive: nextActive });
        return;
      }
      if (code === 'TRADE.REASON.NOT_FOUND') {
        this.notify.error(this.transloco.translate('tset.errors.TRADE_REASON_NOT_FOUND'));
        this.removeReason(reason.id);
        void this.refreshCounts();
        return;
      }
      this.notify.error(settingsErrorText(error, this.transloco));
    } finally {
      this.setBusy(reason.id, false);
    }
  }

  protected onReasonSaved(reason: ReasonCode): void {
    this.syncReason(reason);
    void this.refreshCounts();
  }

  protected onReasonReloaded(reason: ReasonCode): void {
    this.syncReason(reason);
    void this.refreshCounts();
  }

  protected onReasonDeleted(reason: ReasonCode): void {
    this.removeReason(reason.id);
    void this.refreshCounts();
  }

  private async loadAll(kind: ReasonKind, includeInactive: boolean): Promise<void> {
    const seq = ++this.listSeq;
    const cSeq = ++this.countsSeq;
    this.loading.set(true);
    this.failed.set(false);
    try {
      const [counts, items] = await Promise.all([countReasons(), listReasonsAdmin(kind, includeInactive)]);
      if (seq !== this.listSeq || this.destroyed) return;
      if (cSeq === this.countsSeq) {
        this.counts.set(counts);
      }
      this.reasons.set(items.slice().sort(compareReasons));
    } catch {
      if (seq === this.listSeq && !this.destroyed) {
        this.failed.set(true);
      }
    } finally {
      if (seq === this.listSeq && !this.destroyed) {
        this.loading.set(false);
      }
    }
  }

  private async loadKind(kind: ReasonKind, includeInactive: boolean): Promise<void> {
    const seq = ++this.listSeq;
    this.loading.set(true);
    this.failed.set(false);
    try {
      const items = await listReasonsAdmin(kind, includeInactive);
      if (seq !== this.listSeq || this.destroyed) return;
      this.reasons.set(items.slice().sort(compareReasons));
    } catch {
      if (seq === this.listSeq && !this.destroyed) {
        this.failed.set(true);
      }
    } finally {
      if (seq === this.listSeq && !this.destroyed) {
        this.loading.set(false);
      }
    }
  }

  private async refreshCounts(): Promise<void> {
    const seq = ++this.countsSeq;
    try {
      const counts = await countReasons();
      if (seq === this.countsSeq && !this.destroyed) {
        this.counts.set(counts);
      }
    } catch {
      // Keep existing counts until the next manual reload.
    }
  }

  private syncReason(reason: ReasonCode): void {
    if (reason.kind !== this.activeKind()) return;
    if (!reason.isActive && !this.showInactive()) {
      this.removeReason(reason.id);
      return;
    }
    this.reasons.update((current) => {
      const exists = current.some((item) => item.id === reason.id);
      const next = exists
        ? current.map((item) => (item.id === reason.id ? reason : item))
        : [...current, reason];
      return next.slice().sort(compareReasons);
    });
  }

  private removeReason(id: string): void {
    this.reasons.update((current) => current.filter((item) => item.id !== id));
  }

  private setBusy(id: string, busy: boolean): void {
    this.busyIds.update((current) => {
      const next = new Set(current);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  }
}
