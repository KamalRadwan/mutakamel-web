import { Component, ElementRef, Injector, computed, inject, linkedSignal, runInInjectionContext, signal, viewChild, viewChildren } from '@angular/core';
import { Router } from '@angular/router';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerChecklist,
  tablerEye,
  tablerListCheck,
  tablerLock,
  tablerPencil,
  tablerThumbDown,
  tablerToggleRight,
  tablerTrophy,
  tablerUserX,
  tablerUsersGroup,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { ActionItem, ActionSelection, ActionsMenu } from '../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../shared/ui/button/button';
import { Field } from '../../../../shared/ui/field/field';
import { Switch } from '../../../../shared/ui/switch/switch';
import { CrmModules } from '../../shared/crm-modules/crm-modules';
import { errorCodeOf } from '../shared/settings-api';
import { reasonsError } from './reasons-error';
import { tenantWide } from '../shared/settings-access';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { SettingsFrame } from '../../../../shared/ui/settings-frame/settings-frame';
import { ReasonModal } from './reason-modal/reason-modal';
import { listReasons, updateReason } from './reasons.api';
import {
  REASON_KINDS,
  REASON_LIMITS,
  Reason,
  ReasonKind,
  ReasonPolarity,
  reasonDefinitionIn,
  reasonNameIn,
  reasonOtherNameIn,
} from './reasons.model';

const POLARITY_BADGE: Record<ReasonPolarity, string> = {
  POSITIVE: 'bg-success-soft text-on-success-soft',
  NEUTRAL: 'bg-neutral-soft text-on-neutral-soft',
  NEGATIVE: 'bg-danger-soft text-on-danger-soft',
};

const KIND_TABS: Record<ReasonKind, { icon: string; labelKey: string }> = {
  LOSS: { icon: 'tablerThumbDown', labelKey: 'reasons.tabs.loss' },
  WIN: { icon: 'tablerTrophy', labelKey: 'reasons.tabs.win' },
  DISQUALIFICATION: { icon: 'tablerUserX', labelKey: 'reasons.tabs.disqualification' },
  ACTIVITY_OUTCOME: { icon: 'tablerChecklist', labelKey: 'reasons.tabs.activityOutcome' },
  CONTACT_ROLE: { icon: 'tablerUsersGroup', labelKey: 'reasons.tabs.contactRole' },
};

@Component({
  selector: 'app-reasons-page',
  imports: [NgIcon, TranslocoPipe, ActionsMenu, Button, Field, SettingsFrame, Switch, ReasonModal, FullState],
  providers: [
    provideTranslocoScope('settings', { scope: 'settings-reasons', alias: 'reasons' }),
    provideIcons({
      tablerChecklist,
      tablerEye,
      tablerListCheck,
      tablerLock,
      tablerPencil,
      tablerThumbDown,
      tablerToggleRight,
      tablerTrophy,
      tablerUserX,
      tablerUsersGroup,
    }),
  ],
  templateUrl: './reasons-page.html',
  host: { class: 'flex flex-1 shrink-0 flex-col' },
})
export class ReasonsPage {
  private static nextId = 0;
  protected readonly uid = `reasons-page-${++ReasonsPage.nextId}`;

  private readonly notify = inject(Notify);
  private readonly injector = inject(Injector);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly crmModules = inject(CrmModules);
  protected readonly language = inject(LanguageState).current;

  private readonly reasonModal = viewChild.required(ReasonModal);
  private readonly tabButtons = viewChildren<ElementRef<HTMLButtonElement>>('tabBtn');

  protected readonly canRead = computed(() => runInInjectionContext(this.injector, () => tenantWide('crm.settings.read')));
  protected readonly readOnly = signal(false);
  protected readonly canManage = computed(() => !this.readOnly() && runInInjectionContext(this.injector, () => tenantWide('crm.settings.manage')));
  protected readonly limits = REASON_LIMITS;
  protected readonly kindTabs = KIND_TABS;
  protected readonly skeletonRows = [0, 1, 2, 3, 4];

  protected readonly reasons = signal<Reason[]>([]);
  protected readonly loading = signal(true);
  protected readonly failure = signal<ReturnType<typeof reasonsError> | null>(null);
  protected readonly search = signal('');
  protected readonly showInactive = signal(false);
  private readonly busyIds = signal<ReadonlySet<string>>(new Set());

  private loadSeq = 0;

  protected readonly visibleKinds = computed<ReasonKind[]>(() => {
    const leadsOn = this.crmModules.leadsAnywhere();
    const oppsOn = this.crmModules.opportunitiesAnywhere();
    return REASON_KINDS.filter((kind) => {
      if (kind === 'DISQUALIFICATION') return leadsOn;
      if (kind === 'LOSS' || kind === 'WIN') return oppsOn;
      return true;
    });
  });

  protected readonly activeKind = linkedSignal<ReasonKind[], ReasonKind>({
    source: this.visibleKinds,
    computation: (kinds, previous) => {
      const prev = previous?.value;
      if (prev && kinds.includes(prev)) return prev;
      return kinds[0] ?? 'ACTIVITY_OUTCOME';
    },
  });

  protected readonly isActivityOutcome = computed(() => this.activeKind() === 'ACTIVITY_OUTCOME');
  protected readonly atLimit = computed(() => this.reasons().length >= REASON_LIMITS.maxCount);

  protected readonly gridColumnsClass = computed(() => {
    if (this.isActivityOutcome()) {
      return this.canManage() ? 'grid-cols-crm-reason-outcome-row-actions' : 'grid-cols-crm-reason-outcome-row';
    }
    return this.canManage() ? 'grid-cols-crm-reason-row-actions' : 'grid-cols-crm-reason-row';
  });

  protected readonly kindCounts = computed<Record<ReasonKind, number>>(() => {
    const counts: Record<ReasonKind, number> = {
      LOSS: 0,
      WIN: 0,
      DISQUALIFICATION: 0,
      ACTIVITY_OUTCOME: 0,
      CONTACT_ROLE: 0,
    };
    for (const item of this.reasons()) {
      counts[item.reasonKind] += 1;
    }
    return counts;
  });

  protected readonly visibleReasons = computed(() => {
    const kind = this.activeKind();
    const showInactive = this.showInactive();
    const term = this.search().trim().toLowerCase();

    return this.reasons().filter((item) => {
      if (item.reasonKind !== kind) return false;
      if (!showInactive && !item.isActive) return false;
      if (!term) return true;
      return (
        item.code.toLowerCase().includes(term) ||
        item.nameEn.toLowerCase().includes(term) ||
        item.nameAr.toLowerCase().includes(term) ||
        (item.definitionEn?.toLowerCase().includes(term) ?? false) ||
        (item.definitionAr?.toLowerCase().includes(term) ?? false)
      );
    });
  });

  protected readonly nextSortOrder = computed(() => {
    const kind = this.activeKind();
    let maxOrder = 0;
    for (const item of this.reasons()) {
      if (item.reasonKind === kind && item.sortOrder > maxOrder) {
        maxOrder = item.sortOrder;
      }
    }
    const next = maxOrder <= 0 ? 10 : Math.floor(maxOrder / 10) * 10 + 10;
    return Math.min(next, REASON_LIMITS.sortOrderMax);
  });

  constructor() {
    void this.crmModules.ensureLoaded();
    void this.load();
  }

  protected async load(): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.failure.set(null);
    if (!this.canRead()) {
      this.loading.set(false);
      return;
    }
    try {
      const { items } = await listReasons();
      if (seq !== this.loadSeq) return;
      this.reasons.set(items);
    } catch (error) {
      if (seq === this.loadSeq) {
        this.failure.set(reasonsError(this.transloco, error));
      }
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  protected goHome(): void {
    void this.router.navigateByUrl('/workspace/home');
  }

  protected onTabKeydown(event: KeyboardEvent): void {
    const kinds = this.visibleKinds();
    if (kinds.length === 0) return;
    const currentIdx = kinds.indexOf(this.activeKind());
    const rtl = this.language() === 'ar';
    const nextKey = rtl ? 'ArrowLeft' : 'ArrowRight';
    const prevKey = rtl ? 'ArrowRight' : 'ArrowLeft';

    let nextIdx = -1;
    if (event.key === nextKey) nextIdx = (currentIdx + 1) % kinds.length;
    else if (event.key === prevKey) nextIdx = (currentIdx - 1 + kinds.length) % kinds.length;
    else if (event.key === 'Home') nextIdx = 0;
    else if (event.key === 'End') nextIdx = kinds.length - 1;
    else return;

    event.preventDefault();
    this.activeKind.set(kinds[nextIdx]);
    this.tabButtons()[nextIdx]?.nativeElement.focus();
  }

  protected openCreate(): void {
    if (!this.canManage() || this.atLimit()) return;
    this.reasonModal().openCreate(this.activeKind(), this.nextSortOrder());
  }

  protected openEdit(reason: Reason): void {
    this.reasonModal().openEdit(reason);
  }

  protected clearSearch(): void {
    this.search.set('');
  }

  protected primaryName(reason: Reason): string {
    return reasonNameIn(reason, this.language());
  }

  protected secondaryName(reason: Reason): string {
    return reasonOtherNameIn(reason, this.language());
  }

  protected definitionText(reason: Reason): string | null {
    return reasonDefinitionIn(reason, this.language());
  }

  protected polarityClass(polarity: ReasonPolarity): string {
    return POLARITY_BADGE[polarity];
  }

  protected rowActions(reason: Reason): ActionItem[] {
    this.i18n();
    if (!this.canManage()) return [];
    const items: ActionItem[] = [
      {
        id: 'open',
        title: this.transloco.translate('reasons.actions.open'),
        icon: 'tablerEye',
        tile: 'bg-icon-blue',
      },
      {
        id: 'edit',
        title: this.transloco.translate('reasons.actions.edit'),
        icon: 'tablerPencil',
        tile: 'bg-icon-navy',
      },
    ];

    if (reason.isActive) {
      items.push({
        id: 'deactivate',
        title: this.transloco.translate('reasons.actions.deactivate'),
        icon: 'tablerToggleRight',
        tile: 'bg-icon-orange',
        disabled: reason.isSystem,
        reason: reason.isSystem ? this.transloco.translate('reasons.systemLocked') : undefined,
      });
    } else {
      items.push({
        id: 'activate',
        title: this.transloco.translate('reasons.actions.activate'),
        icon: 'tablerToggleRight',
        tile: 'bg-icon-orange',
      });
    }

    return items;
  }

  protected async handleAction(reason: Reason, selection: ActionSelection): Promise<void> {
    if (selection.id === 'open' || selection.id === 'edit') {
      this.openEdit(reason);
      return;
    }
    if (selection.id !== 'activate' && selection.id !== 'deactivate') return;
    if (!this.canManage() || (reason.isSystem && selection.id === 'deactivate') || this.busyIds().has(reason.id)) return;

    const nextActive = selection.id === 'activate';
    this.setBusy(reason.id, true);
    try {
      const updated = await updateReason(reason.id, reason.revision, { isActive: nextActive });
      this.upsertReason(updated);
      this.notify.success(
        this.transloco.translate(nextActive ? 'reasons.toasts.reasonActivated' : 'reasons.toasts.reasonDeactivated'),
      );
    } catch (error) {
      if (errorCodeOf(error) === 'CRM_REASON_REVISION_STALE' || errorCodeOf(error) === 'CRM_DASHBOARD_REVISION_MISMATCH') {
        this.reasonModal().openConflict(reason, { isActive: nextActive });
        return;
      }
      this.reasonModal().showWriteError(error);
      if (errorCodeOf(error) === 'CRM_REASON_NOT_FOUND') await this.load();
    } finally {
      this.setBusy(reason.id, false);
    }
  }

  protected onReasonSaved(reason: Reason): void {
    this.upsertReason(reason);
  }

  private upsertReason(reason: Reason): void {
    const kindOrder = new Map(REASON_KINDS.map((value, index) => [value, index]));
    this.reasons.update((current) => {
      const exists = current.some((item) => item.id === reason.id);
      const next = exists
        ? current.map((item) => (item.id === reason.id ? reason : item))
        : [...current, reason];
      return next.sort((a, b) => {
        const kindDiff = (kindOrder.get(a.reasonKind) ?? 0) - (kindOrder.get(b.reasonKind) ?? 0);
        if (kindDiff !== 0) return kindDiff;
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return a.code.localeCompare(b.code);
      });
    });
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
