import { Component, computed, effect, inject, input, linkedSignal, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerArrowLeft,
  tablerArrowsLeftRight,
  tablerExclamationCircle,
  tablerLock,
  tablerRefresh,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { errorMessage } from '../../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { SettingsNotice } from '../../../../../shared/ui/settings-notice/settings-notice';
import { listAllPages, listBranches, listCompanies } from '../../../staff/shared/staff.api';
import { StaffSession } from '../../../staff/shared/staff-session';
import { seatErrorMessage } from '../../seat-errors';
import { getSeatUsage, listSeatHolders, swapSeat } from '../../seats.api';
import { ModuleUsage, SeatHolder, SeatHolderRole, SeatUsage, holderRoleLabel } from '../../seats.model';
import {
  OverCapacityNotice,
  formatSeatDate,
  isModuleAffected,
  isModuleInGrace,
  moduleDisplayName,
} from '../over-capacity-notice.service';
import { rectInPage, viewport } from '../../../../../shared/ui/overlay/zoom';

const HOLDER_PAGE_SIZE = 100;

let nextSwapPageId = 0;

@Component({
  selector: 'app-seat-swap-page',
  imports: [NgIcon, RouterLink, TranslocoPipe, Button, ConfirmDialog, Dropdown, Field, SettingsNotice],
  providers: [
    provideTranslocoScope('settings', { scope: 'seats-over-capacity', alias: 'oc' }, { scope: 'seats', alias: 'seats' }),
    provideIcons({ tablerAlertTriangle, tablerArrowLeft, tablerArrowsLeftRight, tablerExclamationCircle, tablerLock, tablerRefresh }),
  ],
  templateUrl: './seat-swap-page.html',
  host: { class: 'flex flex-1 shrink-0 flex-col gap-10 p-12' },
})
export class SeatSwapPage {
  protected readonly uid = `seat-swap-${++nextSwapPageId}`;

  /** One "!" hint per column header; every row's control points at it with aria-describedby. */
  protected readonly colTip = signal<string | null>(null);
  protected readonly colTipPlace = signal({ top: 0, start: 0 });

  protected showColTip(key: string, trigger: HTMLElement, tip: HTMLElement): void {
    const rect = rectInPage(trigger);
    const box = rectInPage(tip);
    const { width } = viewport();
    const rtl = getComputedStyle(trigger).direction === 'rtl';
    let start = (rtl ? width - rect.left : rect.right) + 6;
    if (start + box.width > width - 8) {
      const alt = (rtl ? width - rect.right : rect.left) - 6 - box.width;
      start = alt >= 8 ? alt : Math.max(8, width - 8 - box.width);
    }
    this.colTipPlace.set({ top: Math.max(8, rect.bottom - box.height), start });
    this.colTip.set(key);
  }

  protected hideColTip(): void {
    this.colTip.set(null);
  }

  // WCAG 1.4.13: Escape dismisses an open hint without closing the surrounding page or modal.
  protected onColTipEscape(event: Event): void {
    if (this.colTip() === null) return;
    event.stopPropagation();
    this.colTip.set(null);
  }

  private readonly router = inject(Router);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly seatsTranslation = toSignal(this.transloco.selectTranslation('seats'));
  private readonly notice = inject(OverCapacityNotice);
  private readonly session = inject(StaffSession);
  protected readonly language = inject(LanguageState).current;

  private readonly companyNames = signal<ReadonlyMap<string, string>>(new Map());
  private readonly branchNames = signal<ReadonlyMap<string, string>>(new Map());

  private readonly confirmDialog = viewChild.required(ConfirmDialog);

  /** Bound from the `?module=` query parameter. */
  readonly moduleParam = input<string | undefined>(undefined, { alias: 'module' });

  protected get isOwner(): boolean {
    return this.session.isOwner();
  }
  protected readonly skeletonRows = [0, 1, 2, 3, 4];

  protected readonly usage = signal<SeatUsage | null>(null);
  protected readonly loadingUsage = signal(true);
  protected readonly usageError = signal(false);

  protected readonly holders = signal<SeatHolder[]>([]);
  protected readonly loadingHolders = signal(false);
  protected readonly holdersError = signal(false);

  protected readonly selectedReleaseId = signal<string | null>(null);
  protected readonly selectedKeepId = signal<string | null>(null);
  protected readonly swapping = signal(false);

  private readonly usageVersion = signal(0);
  private usageSeq = 0;
  private holdersSeq = 0;

  protected readonly affectedModules = computed<ModuleUsage[]>(() =>
    (this.usage()?.modules ?? []).filter(isModuleAffected),
  );

  protected readonly selectedModuleKey = linkedSignal<{ param: string | undefined; keys: string[] }, string>({
    source: () => ({
      param: this.moduleParam(),
      keys: this.affectedModules().map((module) => module.moduleKey),
    }),
    computation: ({ param, keys }, previous) => {
      if (keys.length === 0) return '';
      if (param && param !== previous?.source.param && keys.includes(param)) {
        return param;
      }
      const current = previous?.value;
      if (current && keys.includes(current)) {
        return current;
      }
      if (param && keys.includes(param)) {
        return param;
      }
      return keys[0];
    },
  });

  protected readonly activeModule = computed<ModuleUsage | null>(() => {
    const key = this.selectedModuleKey();
    return this.affectedModules().find((module) => module.moduleKey === key) ?? null;
  });

  protected readonly moduleOptions = computed<DropdownOption<string>[]>(() => {
    const lang = this.language();
    return this.affectedModules().map((module) => ({
      value: module.moduleKey,
      label: moduleDisplayName(module, lang),
    }));
  });

  protected readonly activeModuleName = computed(() => {
    const module = this.activeModule();
    return module ? moduleDisplayName(module, this.language()) : '';
  });

  protected readonly inGrace = computed(() => {
    const module = this.activeModule();
    if (!module) return false;
    return isModuleInGrace(module) && !this.holders().some((holder) => holder.accessState === 'OVER_CAPACITY');
  });

  protected readonly graceDate = computed(() => formatSeatDate(this.activeModule()?.graceUntil, this.language()));
  protected readonly sinceDate = computed(() =>
    formatSeatDate(this.activeModule()?.overCapacitySince, this.language()),
  );

  protected readonly haveSeatHolders = computed<SeatHolder[]>(() => {
    const module = this.activeModule();
    const list = this.holders();
    if (!module) return [];
    if (this.inGrace()) {
      return sortByGrantAsc(list).slice(0, Math.max(0, module.capacity));
    }
    return list.filter((holder) => holder.accessState === 'ACTIVE');
  });

  protected readonly readOnlyHolders = computed<SeatHolder[]>(() => {
    const module = this.activeModule();
    const list = this.holders();
    if (!module) return [];
    if (this.inGrace()) {
      return sortByGrantAsc(list).slice(Math.max(0, module.capacity));
    }
    return list.filter((holder) => holder.accessState === 'OVER_CAPACITY');
  });

  protected readonly canPickHolders = computed(
    () => this.isOwner && !this.inGrace() && !this.swapping() && !this.loadingHolders(),
  );

  protected readonly canSwap = computed(
    () =>
      this.canPickHolders() &&
      this.selectedKeepId() !== null &&
      this.selectedReleaseId() !== null,
  );

  protected readonly confirmText = computed(() => {
    this.i18n();
    const keep = this.readOnlyHolders().find((holder) => holder.userId === this.selectedKeepId())?.name ?? '';
    const release = this.haveSeatHolders().find((holder) => holder.userId === this.selectedReleaseId())?.name ?? '';
    return this.transloco.translate('oc.swap.confirm', { keep, release });
  });

  constructor() {
    effect(() => {
      this.usageVersion();
      const moduleKey = this.selectedModuleKey();
      this.selectedReleaseId.set(null);
      this.selectedKeepId.set(null);
      if (moduleKey) {
        void this.loadHolders(moduleKey);
      } else {
        this.holdersSeq++;
        this.holders.set([]);
        this.loadingHolders.set(false);
        this.holdersError.set(false);
      }
    });

    void this.loadUsage();
    void this.loadScopeLookups();
  }

  protected selectModule(moduleKey: string): void {
    if (moduleKey === this.selectedModuleKey()) return;
    this.selectedModuleKey.set(moduleKey);
    void this.router.navigate([], {
      queryParams: { module: moduleKey },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected reload(): void {
    void this.loadUsage();
  }

  protected formatDate(iso: string | null | undefined): string {
    return formatSeatDate(iso, this.language());
  }

  protected roleLabel(role: SeatHolderRole): string {
    this.seatsTranslation();
    return holderRoleLabel(role, {
      companies: this.companyNames(),
      branches: this.branchNames(),
      scopeLabels: {
        TENANT: this.transloco.translate('seats.holders.scope.TENANT'),
        COMPANY: this.transloco.translate('seats.holders.scope.COMPANY'),
        BRANCH: this.transloco.translate('seats.holders.scope.BRANCH'),
      },
    });
  }

  private async loadScopeLookups(): Promise<void> {
    const [companiesRes, branchesRes] = await Promise.allSettled([
      listAllPages((q) => listCompanies(q)),
      listAllPages((q) => listBranches(q)),
    ]);
    if (companiesRes.status === 'fulfilled') {
      this.companyNames.set(new Map(companiesRes.value.map((c) => [c.id, c.name])));
    }
    if (branchesRes.status === 'fulfilled') {
      this.branchNames.set(new Map(branchesRes.value.map((b) => [b.id, b.name])));
    }
  }

  protected async requestSwap(): Promise<void> {
    if (!this.canSwap()) return;
    const moduleKey = this.selectedModuleKey();
    const keepUserId = this.selectedKeepId();
    const releaseUserId = this.selectedReleaseId();
    if (!moduleKey || !keepUserId || !releaseUserId) return;

    const confirmed = await this.confirmDialog().open();
    if (!confirmed) return;

    this.swapping.set(true);
    try {
      const updatedUsage = await swapSeat(moduleKey, { keepUserId, releaseUserId }, newIdempotencyKey());
      this.usage.set(updatedUsage);
      this.usageVersion.update((version) => version + 1);
      this.notify.success(this.transloco.translate('oc.swap.done'));
      await this.notice.refresh();
    } catch (error) {
      this.notify.error(seatErrorMessage(this.transloco, error) ?? errorMessage(error, 'seats', this.transloco));
    } finally {
      this.swapping.set(false);
    }
  }

  private async loadUsage(): Promise<void> {
    const seq = ++this.usageSeq;
    this.loadingUsage.set(true);
    this.usageError.set(false);
    try {
      const usage = await getSeatUsage();
      if (seq !== this.usageSeq) return;
      this.usage.set(usage);
      this.usageVersion.update((version) => version + 1);
    } catch {
      if (seq !== this.usageSeq) return;
      this.usageError.set(true);
    } finally {
      if (seq === this.usageSeq) {
        this.loadingUsage.set(false);
      }
    }
  }

  private async loadHolders(moduleKey: string): Promise<void> {
    const seq = ++this.holdersSeq;
    this.loadingHolders.set(true);
    this.holdersError.set(false);
    try {
      const all: SeatHolder[] = [];
      let page = 1;
      while (true) {
        const result = await listSeatHolders(moduleKey, { page, limit: HOLDER_PAGE_SIZE });
        if (seq !== this.holdersSeq) return;
        all.push(...result.data);
        if (!result.meta.hasNext) break;
        page++;
      }
      this.holders.set(all);
    } catch {
      if (seq !== this.holdersSeq) return;
      this.holdersError.set(true);
    } finally {
      if (seq === this.holdersSeq) {
        this.loadingHolders.set(false);
      }
    }
  }
}

function sortByGrantAsc(holders: readonly SeatHolder[]): SeatHolder[] {
  return [...holders].sort((a, b) => {
    const timeA = Date.parse(a.grantedAt);
    const timeB = Date.parse(b.grantedAt);
    if (Number.isNaN(timeA) && Number.isNaN(timeB)) return 0;
    if (Number.isNaN(timeA)) return 1;
    if (Number.isNaN(timeB)) return -1;
    return timeA - timeB;
  });
}
