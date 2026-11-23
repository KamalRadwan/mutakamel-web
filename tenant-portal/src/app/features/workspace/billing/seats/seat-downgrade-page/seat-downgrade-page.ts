import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerArrowLeft,
  tablerCheck,
  tablerCircleCheck,
  tablerCloudOff,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { Checkbox } from '../../../../../shared/ui/checkbox/checkbox';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { UnsavedDialog } from '../../../../../shared/ui/unsaved-dialog/unsaved-dialog';
import { errorCodeOf, errorMessage, listAllPages, newIdempotencyKey } from '../../../staff/shared/staff.api';
import { OrganizationReadApi } from '../../../staff/shared/organization-read.api';
import { SeatCascadeConfirm } from '../../../seats/cascade-confirm/cascade-confirm';
import { isCascadeRequired, seatErrorMessage } from '../../../seats/seat-errors';
import { SeatPreviewApi } from '../../../seats/seats.api';
import {
  FreeUpPreview,
  HolderRoleLookups,
  ModuleUsage,
  SeatHolder,
  SeatHolderRole,
  SeatUsage,
  holderRoleLabel,
  parseScopeString,
} from '../../../seats/seats.model';
import { StaffSession } from '../../../staff/shared/staff-session';
import { formatBillingDate } from '../../overview/overview-dates';
import { loadSeatsChangeQueries } from '../../shared/change-link';

const STEPPER_STEPS = [
  { num: 1 as const, key: 'choose' },
  { num: 2 as const, key: 'keep' },
  { num: 3 as const, key: 'review' },
] as const;
const SKELETON_ROWS = [1, 2, 3, 4] as const;

type StepNum = 1 | 2 | 3;

@Component({
  selector: 'app-seat-downgrade-page',
  imports: [
    NgIcon,
    RouterLink,
    TranslocoPipe,
    Button,
    Checkbox,
    ConfirmDialog,
    Dropdown,
    Field,
    Modal,
    UnsavedDialog,
  ],
  providers: [
    provideTranslocoScope('settings', 'seats', { scope: 'seats-billing', alias: 'sb' }),
    provideIcons({
      tablerArrowLeft,
      tablerCheck,
      tablerCircleCheck,
      tablerAlertTriangle,
      tablerCloudOff,
    }),
  ],
  templateUrl: './seat-downgrade-page.html',
  host: { class: 'flex min-h-0 flex-1 flex-col gap-10 overflow-y-auto p-12' },
})
export class SeatDowngradePage {
  private static nextId = 0;
  protected readonly uid = `seat-downgrade-${++SeatDowngradePage.nextId}`;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly seatsTranslation = toSignal(this.transloco.selectTranslation('seats'));
  private readonly notify = inject(Notify);
  private readonly cascadeConfirm = inject(SeatCascadeConfirm);
  private readonly session = inject(StaffSession);
  private readonly seatsApi = inject(SeatPreviewApi);
  private readonly organizationApi = inject(OrganizationReadApi);
  protected readonly language = inject(LanguageState).current;

  private readonly companyNames = signal<ReadonlyMap<string, string>>(new Map());
  private readonly branchNames = signal<ReadonlyMap<string, string>>(new Map());

  private readonly confirmFreeDialog = viewChild.required<ConfirmDialog>('confirmFreeDialog');
  private readonly unsavedDialog = viewChild.required(UnsavedDialog);
  private readonly conflictModal = viewChild.required<Modal>('conflictModal');

  protected get isOwner(): boolean {
    return this.session.isOwner();
  }
  protected readonly steps = STEPPER_STEPS;
  protected readonly skeletonRows = SKELETON_ROWS;

  protected readonly loading = signal(true);
  protected readonly loadFailed = signal(false);
  protected readonly usage = signal<SeatUsage | null>(null);

  protected readonly step = signal<StepNum>(1);
  protected readonly moduleKey = signal('');
  protected readonly targetInput = signal('');
  protected readonly targetTouched = signal(false);
  protected readonly step1Submitted = signal(false);

  protected readonly holdersLoading = signal(false);
  protected readonly holders = signal<SeatHolder[]>([]);
  protected readonly keptUserIds = signal<string[]>([]);

  protected readonly previewLoading = signal(false);
  protected readonly preview = signal<FreeUpPreview | null>(null);

  protected readonly freeing = signal(false);
  protected readonly freed = signal(false);
  protected readonly reloadingConflict = signal(false);

  private initialModuleKey = '';
  private initialTargetInput = '';
  private loadedForConfig: { moduleKey: string; targetSeats: number } | null = null;
  private loadSeq = 0;
  private holdersSeq = 0;
  private previewSeq = 0;

  protected readonly modules = computed(() => this.usage()?.modules ?? []);

  protected readonly selectedModule = computed<ModuleUsage | null>(() => {
    const list = this.modules();
    if (!list.length) return null;
    const key = this.moduleKey();
    return list.find((m) => m.moduleKey === key) ?? list[0];
  });

  protected readonly selectedModuleName = computed(() => {
    const mod = this.selectedModule();
    return mod ? this.moduleName(mod) : '';
  });

  protected readonly moduleOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    return this.modules().map((mod) => ({
      value: mod.moduleKey,
      label: this.moduleName(mod),
    }));
  });

  protected readonly maxTarget = computed(() => {
    const mod = this.selectedModule();
    return mod ? Math.max(0, mod.capacity - 1) : 0;
  });

  protected readonly canReduceModule = computed(() => (this.selectedModule()?.capacity ?? 0) > 1);

  protected readonly parsedTarget = computed<number | null>(() => {
    const raw = this.targetInput().trim();
    if (!/^\d+$/.test(raw)) return null;
    const value = Number(raw);
    return Number.isSafeInteger(value) ? value : null;
  });

  protected readonly targetSeats = computed(() => this.parsedTarget() ?? 1);

  protected readonly targetError = computed<string | null>(() => {
    this.i18n();
    const mod = this.selectedModule();
    if (!mod) return null;
    if (mod.capacity <= 1) {
      return this.transloco.translate('sb.down.cannotReduce');
    }
    const show = this.targetTouched() || this.step1Submitted();
    if (!show) return null;
    const parsed = this.parsedTarget();
    const max = mod.capacity - 1;
    if (parsed === null || parsed < 1 || parsed > max) {
      return this.transloco.translate('sb.down.targetInvalid', { max });
    }
    return null;
  });

  protected readonly step1Valid = computed(() => {
    const mod = this.selectedModule();
    const parsed = this.parsedTarget();
    return Boolean(mod && mod.capacity > 1 && parsed !== null && parsed >= 1 && parsed <= mod.capacity - 1);
  });

  protected readonly tooManySelected = computed(() => this.keptUserIds().length > this.targetSeats());

  protected readonly keptSet = computed(() => new Set(this.keptUserIds()));

  protected readonly removalByUserId = computed(() => {
    const map = new Map<string, FreeUpPreview['removals'][number]>();
    for (const item of this.preview()?.removals ?? []) {
      map.set(item.userId, item);
    }
    return map;
  });

  protected readonly removals = computed(() => this.preview()?.removals ?? []);

  protected readonly choicesMade = computed(() => {
    if (this.freed() || this.loading() || this.loadFailed()) return false;
    if (this.step() > 1) return true;
    return this.moduleKey() !== this.initialModuleKey || this.targetInput() !== this.initialTargetInput;
  });

  protected readonly changeQueries = signal<ReadonlyMap<string, { add: string }>>(new Map());

  constructor() {
    void loadSeatsChangeQueries().then((queries) => this.changeQueries.set(queries));
    void this.loadUsage();
    void this.loadScopeLookups();
  }

  async canDeactivate(): Promise<boolean> {
    if (!this.isOwner || this.freed() || !this.choicesMade()) return true;
    const choice = await this.unsavedDialog().open();
    return choice === 'discard';
  }

  protected reload(): void {
    void this.loadUsage();
  }

  protected moduleName(mod: Pick<ModuleUsage, 'moduleKey' | 'nameI18n'>): string {
    return this.language() === 'ar' ? mod.nameI18n.ar : mod.nameI18n.en;
  }

  protected formatDate(iso: string): string {
    return formatBillingDate(iso, this.language());
  }

  protected onModuleChange(nextKey: string): void {
    if (nextKey === this.moduleKey()) return;
    this.holdersSeq++;
    this.previewSeq++;
    this.holdersLoading.set(false);
    this.previewLoading.set(false);
    this.moduleKey.set(nextKey);
    const mod = this.modules().find((m) => m.moduleKey === nextKey);
    this.targetInput.set(mod && mod.capacity > 1 ? String(mod.capacity - 1) : '');
    this.targetTouched.set(false);
    this.step1Submitted.set(false);
    this.loadedForConfig = null;
    this.preview.set(null);
  }

  protected onTargetInput(event: Event): void {
    this.previewSeq++;
    this.preview.set(null);
    this.previewLoading.set(false);
    this.targetInput.set((event.target as HTMLInputElement).value);
    this.targetTouched.set(true);
  }

  protected async goToStep2(): Promise<void> {
    if (!this.isOwner) return;
    this.step1Submitted.set(true);
    if (!this.step1Valid()) return;
    const mod = this.selectedModule();
    if (!mod) return;
    const target = this.targetSeats();

    if (
      this.loadedForConfig &&
      this.loadedForConfig.moduleKey === mod.moduleKey &&
      this.loadedForConfig.targetSeats === target &&
      this.holders().length > 0
    ) {
      this.step.set(2);
      return;
    }

    const seq = ++this.holdersSeq;
    this.holdersLoading.set(true);
    this.step.set(2);
    try {
      const all = await this.fetchAllHolders(mod.moduleKey);
      if (seq !== this.holdersSeq) return;
      this.holders.set(all);
      const preChecked = this.earliestKeeperIds(all, target);
      this.keptUserIds.set(preChecked);
      this.loadedForConfig = { moduleKey: mod.moduleKey, targetSeats: target };
      await this.refreshPreview(mod.moduleKey, target, preChecked);
    } catch (error) {
      if (seq !== this.holdersSeq) return;
      this.step.set(1);
      this.showError(error);
    } finally {
      if (seq === this.holdersSeq) {
        this.holdersLoading.set(false);
      }
    }
  }

  protected backToStep1(): void {
    if (this.freeing()) return;
    this.step.set(1);
  }

  protected backToStep2(): void {
    if (this.freeing()) return;
    this.step.set(2);
  }

  protected isKept(userId: string): boolean {
    return this.keptSet().has(userId);
  }

  protected onKeeperRowClick(userId: string, event: Event): void {
    if (this.holdersLoading() || this.freeing()) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('ui-checkbox, label, input, button')) return;
    this.toggleKeeper(userId, !this.isKept(userId));
  }

  protected toggleKeeper(userId: string, checked: boolean): void {
    if (this.holdersLoading() || this.freeing()) return;
    const next = checked
      ? Array.from(new Set([...this.keptUserIds(), userId]))
      : this.keptUserIds().filter((id) => id !== userId);
    this.keptUserIds.set(next);

    const mod = this.selectedModule();
    if (!mod) return;
    if (next.length <= this.targetSeats()) {
      void this.refreshPreview(mod.moduleKey, this.targetSeats(), next);
    }
  }

  protected async goToStep3(): Promise<void> {
    const mod = this.selectedModule();
    if (!mod || this.tooManySelected() || this.holdersLoading() || this.previewLoading()) return;
    if (!this.preview()) {
      await this.refreshPreview(mod.moduleKey, this.targetSeats(), this.keptUserIds());
    }
    if (this.preview()?.fits) this.step.set(3);
  }

  protected roleLabel(role: SeatHolderRole): string {
    return holderRoleLabel(role, this.roleLookups());
  }

  protected alsoLosesLabel(alsoLoses: { moduleKey: string; nameI18n: { en: string; ar: string } }[]): string {
    const sep = this.language() === 'ar' ? '، ' : ', ';
    return alsoLoses
      .map((item) => (this.language() === 'ar' ? item.nameI18n.ar : item.nameI18n.en))
      .join(sep);
  }

  protected rolesListLabel(roles: { roleName: string; scope: string }[]): string {
    const sep = this.language() === 'ar' ? '، ' : ', ';
    const lookups = this.roleLookups();
    return roles
      .map((r) => {
        const parsed = parseScopeString(r.scope);
        if (parsed) {
          return holderRoleLabel({ roleName: r.roleName, scope: parsed }, lookups);
        }
        return r.scope ? `${r.roleName} · ${r.scope}` : r.roleName;
      })
      .join(sep);
  }

  private roleLookups(): HolderRoleLookups {
    this.seatsTranslation();
    return {
      companies: this.companyNames(),
      branches: this.branchNames(),
      scopeLabels: {
        TENANT: this.transloco.translate('seats.holders.scope.TENANT'),
        COMPANY: this.transloco.translate('seats.holders.scope.COMPANY'),
        BRANCH: this.transloco.translate('seats.holders.scope.BRANCH'),
      },
    };
  }

  private async loadScopeLookups(): Promise<void> {
    const [companiesRes, branchesRes] = await Promise.allSettled([
      listAllPages((q) => this.organizationApi.listCompanies(q)),
      listAllPages((q) => this.organizationApi.listBranches(q)),
    ]);
    if (companiesRes.status === 'fulfilled') {
      this.companyNames.set(new Map(companiesRes.value.map((c) => [c.id, c.name])));
    }
    if (branchesRes.status === 'fulfilled') {
      this.branchNames.set(new Map(branchesRes.value.map((b) => [b.id, b.name])));
    }
  }

  protected addonsListLabel(addons: string[]): string {
    const sep = this.language() === 'ar' ? '، ' : ', ';
    return addons.join(sep);
  }

  protected async submitFreeUp(): Promise<void> {
    const mod = this.selectedModule();
    const currentUsage = this.usage();
    if (!this.isOwner || !mod || !currentUsage || this.freeing() || this.freed() ||
      this.previewLoading() || !this.preview()?.fits || this.tooManySelected()) return;

    const confirmed = await this.confirmFreeDialog().open();
    if (!confirmed) return;

    this.freeing.set(true);
    try {
      await this.executeFreeUp(mod.moduleKey, this.targetSeats(), this.keptUserIds(), currentUsage.revision, false);
    } finally {
      this.freeing.set(false);
    }
  }

  protected async reloadAfterConflict(): Promise<void> {
    if (this.reloadingConflict()) return;
    this.reloadingConflict.set(true);
    try {
      await this.loadUsage();
      this.conflictModal().close();
    } finally {
      this.reloadingConflict.set(false);
    }
  }

  protected closeConflictModal(): void {
    if (this.reloadingConflict()) return;
    this.conflictModal().close();
  }

  protected goBackToSeats(): void {
    void this.router.navigate(['/workspace/billing/subscription']);
  }

  private async executeFreeUp(
    moduleKey: string,
    targetSeats: number,
    keepUserIds: string[],
    revision: number,
    confirmAddonCascade: boolean,
  ): Promise<void> {
    try {
      const updated = await this.seatsApi.freeUp(
        {
          moduleKey,
          targetSeats,
          keepUserIds,
          expectedUsageRevision: revision,
          ...(confirmAddonCascade ? { confirmAddonCascade: true } : {}),
        },
        newIdempotencyKey(),
      );
      this.usage.set(updated);
      this.freed.set(true);
    } catch (error) {
      if (!confirmAddonCascade) {
        const cascade = isCascadeRequired(error);
        if (cascade) {
          const accepted = await this.cascadeConfirm.confirm(cascade.addons);
          if (!accepted) return;
          await this.executeFreeUp(moduleKey, targetSeats, keepUserIds, revision, true);
          return;
        }
      }

      const code = errorCodeOf(error);
      if (code === 'SEAT_USAGE_STALE') {
        this.conflictModal().open();
        return;
      }
      if (code === 'SEAT_KEEP_LIST_TOO_LARGE') {
        this.step.set(2);
        this.showError(error);
        return;
      }
      this.showError(error);
    }
  }

  private async loadUsage(): Promise<void> {
    const seq = ++this.loadSeq;
    this.holdersSeq++;
    this.previewSeq++;
    this.preview.set(null);
    this.holdersLoading.set(false);
    this.previewLoading.set(false);
    this.loading.set(true);
    this.loadFailed.set(false);
    try {
      const data = await this.seatsApi.getSeatUsage();
      if (seq !== this.loadSeq) return;
      this.usage.set(data);
      this.step.set(1);
      this.holders.set([]);
      this.keptUserIds.set([]);
      this.preview.set(null);
      this.loadedForConfig = null;
      this.freed.set(false);
      this.targetTouched.set(false);
      this.step1Submitted.set(false);

      const queryModule = this.route.snapshot.queryParamMap.get('module');
      const preset = data.modules.find((m) => m.moduleKey === queryModule) ?? data.modules[0] ?? null;
      const presetKey = preset?.moduleKey ?? '';
      const presetTarget = preset && preset.capacity > 1 ? String(preset.capacity - 1) : '';
      this.moduleKey.set(presetKey);
      this.targetInput.set(presetTarget);
      this.initialModuleKey = presetKey;
      this.initialTargetInput = presetTarget;
    } catch (error) {
      if (seq !== this.loadSeq) return;
      this.loadFailed.set(true);
      this.showError(error);
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  private async fetchAllHolders(moduleKey: string): Promise<SeatHolder[]> {
    const all: SeatHolder[] = [];
    let page = 1;
    const limit = 100;
    while (true) {
      const res = await this.seatsApi.listSeatHolders(moduleKey, { page, limit });
      all.push(...res.data);
      if (!res.meta.hasNext) break;
      page += 1;
    }
    return all;
  }

  private earliestKeeperIds(holders: readonly SeatHolder[], target: number): string[] {
    return holders
      .slice()
      .sort((a, b) => {
        const ta = Date.parse(a.grantedAt);
        const tb = Date.parse(b.grantedAt);
        if (!Number.isNaN(ta) && !Number.isNaN(tb) && ta !== tb) return ta - tb;
        return a.grantedAt.localeCompare(b.grantedAt);
      })
      .slice(0, Math.max(0, target))
      .map((h) => h.userId);
  }

  private async refreshPreview(moduleKey: string, targetSeats: number, keepUserIds: string[]): Promise<void> {
    const seq = ++this.previewSeq;
    this.preview.set(null);
    this.previewLoading.set(true);
    try {
      const res = await this.seatsApi.freeUpPreview({ moduleKey, targetSeats, keepUserIds });
      if (seq !== this.previewSeq) return;
      this.preview.set(res);
    } catch (error) {
      if (seq !== this.previewSeq) return;
      this.showError(error);
    } finally {
      if (seq === this.previewSeq) {
        this.previewLoading.set(false);
      }
    }
  }

  private showError(error: unknown): void {
    const msg =
      seatErrorMessage(this.transloco, error) ??
      errorMessage(error, 'sb', this.transloco);
    this.notify.error(msg);
  }
}
