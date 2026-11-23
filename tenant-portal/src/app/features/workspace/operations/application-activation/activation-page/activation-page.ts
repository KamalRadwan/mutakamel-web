import { Component, DestroyRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { PluralKeyPipe } from '../../../../../core/i18n/plural';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerApps,
  tablerBuildingStore,
  tablerCalculator,
  tablerCornerDownRight,
  tablerExclamationCircle,
  tablerLock,
  tablerPuzzle,
  tablerRefresh,
  tablerShoppingCart,
  tablerUsers,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { TenantScopeState } from '../../../../../core/scope/tenant-scope';
import { WorkspaceLookups } from '../../../../../shared/widgets/workspace-lookups/workspace-lookups.api';
import type { WorkspaceApp, WorkspaceCompany } from '../../../../../shared/widgets/workspace-lookups/workspace-lookups.model';
import { FullState } from '../../../../../shared/ui/full-state/full-state';
import { Button } from '../../../../../shared/ui/button/button';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { Switch } from '../../../../../shared/ui/switch/switch';
import { ModuleTileLook, moduleTileOf } from '../../../seats/seats.model';
import { ActivationApi } from '../activation.api';
import {
  ActivationListItem,
  AddonActivationPendingCommand,
} from '../activation.model';
import { BranchOverridesModal } from '../branch-overrides-modal/branch-overrides-modal';
import { ReasonModal } from '../reason-modal/reason-modal';
import { rectInPage, viewport } from '../../../../../shared/ui/overlay/zoom';
import { ApiError, correlationIdOf, errorCodeOf, errorMessage, writeErrorMessage } from '../../../../../core/api/api-errors';

interface PendingCommandState {
  commandId: string;
  companyId: string;
  appKey: string;
  addonKey: string;
  validatedBranchCount: number | null;
  startedAt: number;
  foreignActor: boolean;
}

const SKELETON_ROWS = [1, 2, 3, 4, 5] as const;
const STORAGE_PREFIX = 'ws-activation:';
const FAST_POLL_INTERVAL_MS = 2000;
const SLOW_POLL_INTERVAL_MS = 5000;
const FAST_POLL_WINDOW_MS = 20_000;

function pendingStorageKey(companyId: string, appKey: string, addonKey: string): string {
  return `${STORAGE_PREFIX}${companyId}:${appKey}:${addonKey}`;
}

function readStoredCommandId(companyId: string, appKey: string, addonKey: string): string | null {
  try {
    const value = sessionStorage.getItem(pendingStorageKey(companyId, appKey, addonKey));
    return value && value.trim() ? value.trim() : null;
  } catch {
    return null;
  }
}

function writeStoredCommandId(companyId: string, appKey: string, addonKey: string, commandId: string): void {
  try {
    sessionStorage.setItem(pendingStorageKey(companyId, appKey, addonKey), commandId);
  } catch {
    // Storage unavailable
  }
}

function clearStoredCommandId(companyId: string, appKey: string, addonKey: string): void {
  try {
    sessionStorage.removeItem(pendingStorageKey(companyId, appKey, addonKey));
  } catch {
    // Storage unavailable
  }
}

/** Maintenance refusals have their own message, even though they also use 403. */
function isForbiddenError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403 && !error.code.startsWith('TENANT_MAINTENANCE_');
}

/** The backend sends the progress counters as decimal strings. */
function validatedBranches(command: AddonActivationPendingCommand): number {
  return Number(command.progress.validatedBranchCount);
}

@Component({
  selector: 'app-activation-page',
  imports: [
    FullState,
    TranslocoPipe, PluralKeyPipe,
    NgIcon,
    Button,
    Dropdown,
    Field,
    Switch,
    ReasonModal,
    BranchOverridesModal,
  ],
  providers: [
    provideTranslocoScope('settings', { scope: 'ws-app-activation', alias: 'wsActivation' }),
    provideIcons({
      tablerUsers,
      tablerShoppingCart,
      tablerCalculator,
      tablerApps,
      tablerPuzzle,
      tablerCornerDownRight,
      tablerRefresh,
      tablerLock,
      tablerBuildingStore,
      tablerExclamationCircle,
    }),
  ],
  templateUrl: './activation-page.html',
  host: { class: 'flex flex-1 shrink-0 flex-col gap-8 p-12' },
})
export class ActivationPage {
  private static nextId = 0;
  protected readonly uid = `ws-activation-${++ActivationPage.nextId}`;

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

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;
  private readonly scope = inject(TenantScopeState);
  private readonly api = inject(ActivationApi);
  private readonly lookups = inject(WorkspaceLookups);

  private readonly destroyRef = inject(DestroyRef);
  private readonly queryParams = toSignal(this.route.queryParamMap);

  private readonly reasonModal = viewChild.required(ReasonModal);
  private readonly branchOverridesModal = viewChild.required(BranchOverridesModal);

  protected readonly skeletonRows = SKELETON_ROWS;
  protected readonly companiesLoading = signal(true);
  protected readonly companies = signal<WorkspaceCompany[]>([]);
  protected readonly selectedCompanyId = signal('');
  protected readonly appNames = signal<ReadonlyMap<string, WorkspaceApp>>(new Map());

  protected readonly loading = signal(false);
  protected readonly rows = signal<ActivationListItem[]>([]);
  protected readonly loadFailed = signal(false);
  protected readonly apiForbidden = signal(false);
  protected readonly correlationId = signal<string | null>(null);
  protected readonly pendingCommands = signal<ReadonlyMap<string, PendingCommandState>>(new Map());
  protected readonly busyRows = signal<ReadonlySet<string>>(new Set());

  private readonly initialized = signal(false);
  private readonly pollTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private loadSeq = 0;
  private destroyed = false;

  protected readonly companyOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const list = this.companies();
    if (list.length === 0) {
      return [{ value: '', label: this.transloco.translate('wsActivation.company.placeholder') }];
    }
    return list.map((company) => ({
      value: company.id,
      label: company.name,
    }));
  });

  protected readonly selectedCompany = computed(
    () => this.companies().find((c) => c.id === this.selectedCompanyId()) ?? null,
  );

  private companyPermission(key: string): boolean {
    const me = this.scope.me();
    if (!me) return false;
    if (me.isTenantOwner) return true;
    // V-A1: companyIds still includes parents of GLOBAL branch grants. Exact COMPANY projection is pending.
    return me.permissions.includes(key) && me.permissionScopes?.[key]?.tenantWide === true;
  }

  protected readonly isForbidden = computed(() => this.apiForbidden());
  protected readonly canManage = computed(() => Boolean(this.selectedCompanyId()) && this.companyPermission('applications.activation.manage'));
  protected readonly canManageBranch = (branchId: string): boolean => {
    const me = this.scope.me();
    if (!me) return false;
    const key = 'applications.activation.manage';
    const grant = me.permissionScopes?.[key];
    return me.isTenantOwner || (me.permissions.includes(key) &&
      (grant?.tenantWide === true || grant?.branchIds.includes(branchId) === true));
  };

  private readonly appEnabledByKey = computed(() => {
    const map = new Map<string, boolean>();
    for (const item of this.rows()) {
      if (item.resource.kind === 'APPLICATION_ACTIVATION') {
        map.set(item.target.applicationKey, item.resource.state === 'STORED' && item.resource.enabled === true);
      }
    }
    return map;
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      this.clearAllPollTimers();
    });

    effect(() => {
      const params = this.queryParams();
      if (!this.initialized() || !params) return;
      const qpCompanyId = params.get('companyId')?.trim() ?? '';
      if (!qpCompanyId || qpCompanyId === this.selectedCompanyId()) return;
      if (!this.companies().some((c) => c.id === qpCompanyId)) return;

      untracked(() => {
        this.clearAllPollTimers();
        this.selectedCompanyId.set(qpCompanyId);
        void this.loadActivations(qpCompanyId);
      });
    });

    void this.initialize();
  }

  protected reload(): void {
    if (this.loading() || this.companiesLoading()) return;
    const companyId = this.selectedCompanyId();
    if (!companyId) {
      void this.initialize();
      return;
    }
    void this.loadActivations(companyId);
  }

  protected onCompanyChange(companyId: string): void {
    if (!companyId || companyId === this.selectedCompanyId()) return;
    this.clearAllPollTimers();
    this.selectedCompanyId.set(companyId);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { companyId },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    void this.loadActivations(companyId);
  }

  protected trackRow(row: ActivationListItem): string {
    return `${row.target.applicationKey}:${row.target.addonKey ?? ''}`;
  }

  protected appTile(appKey: string): ModuleTileLook {
    return moduleTileOf(appKey);
  }

  protected isAddonRow(row: ActivationListItem): boolean {
    return row.resource.kind === 'ADDON_ACTIVATION';
  }

  protected rowName(row: ActivationListItem): string {
    this.i18n();
    if (row.resource.kind === 'ADDON_ACTIVATION' && row.target.addonKey) {
      return this.addonDisplayName(row.target.addonKey);
    }
    return this.appDisplayName(row.target.applicationKey);
  }

  protected parentAppName(row: ActivationListItem): string {
    this.i18n();
    return this.appDisplayName(row.target.applicationKey);
  }

  protected isRowOn(row: ActivationListItem): boolean {
    if (row.resource.kind === 'BRANCH_OVERRIDE') return false;
    return row.resource.state === 'STORED' && row.resource.enabled === true;
  }

  protected isParentAppOn(row: ActivationListItem): boolean {
    return this.appEnabledByKey().get(row.target.applicationKey) === true;
  }

  protected pendingForRow(row: ActivationListItem): PendingCommandState | null {
    if (row.resource.kind !== 'ADDON_ACTIVATION' || !row.target.addonKey) return null;
    const key = pendingStorageKey(
      row.scope.companyId,
      row.target.applicationKey,
      row.target.addonKey,
    );
    return this.pendingCommands().get(key) ?? null;
  }

  protected isRowPending(row: ActivationListItem): boolean {
    return this.pendingForRow(row) !== null;
  }

  protected isSwitchDisabled(row: ActivationListItem): boolean {
    if (!this.canManage()) return true;
    if (this.isRowPending(row)) return true;
    if (this.busyRows().has(this.trackRow(row))) return true;
    if (this.isAddonRow(row) && !this.isRowOn(row) && !this.isParentAppOn(row)) return true;
    return false;
  }

  protected switchDisabledReason(row: ActivationListItem): string | null {
    this.i18n();
    if (this.isAddonRow(row) && !this.isRowOn(row) && !this.isParentAppOn(row)) {
      return this.transloco.translate('wsActivation.reasons.turnOnParentFirst', {
        app: this.parentAppName(row),
      });
    }
    return null;
  }

  protected statusText(row: ActivationListItem): string {
    this.i18n();
    if (this.isRowPending(row)) {
      return this.transloco.translate('wsActivation.status.applying');
    }
    if (row.resource.state === 'NOT_CREATED') {
      return this.transloco.translate('wsActivation.status.notCreated');
    }
    if (row.resource.kind !== 'BRANCH_OVERRIDE' && row.resource.enabled === true) {
      return this.transloco.translate('wsActivation.status.on');
    }
    return this.transloco.translate('wsActivation.status.off');
  }

  protected onSwitchToggle(row: ActivationListItem, _nextChecked: boolean, sw: Switch): void {
    const currentlyOn = this.isRowOn(row);
    sw.checked.set(currentlyOn);
    if (this.isSwitchDisabled(row)) return;

    const nextEnabled = !currentlyOn;
    const companyId = this.selectedCompanyId();
    const companyName = this.selectedCompany()?.name ?? companyId;
    const name = this.rowName(row);
    const isTurningOff = !nextEnabled;

    const title = this.transloco.translate(
      isTurningOff ? 'wsActivation.reasonModal.turnOffTitle' : 'wsActivation.reasonModal.turnOnTitle',
      { name, company: companyName },
    );
    const confirmLabel = this.transloco.translate(
      isTurningOff ? 'wsActivation.reasonModal.turnOffConfirm' : 'wsActivation.reasonModal.turnOnConfirm',
    );
    const tile = isTurningOff
      ? 'bg-icon-red'
      : row.resource.kind === 'ADDON_ACTIVATION'
        ? 'bg-icon-violet'
        : this.appTile(row.target.applicationKey).tile;
    const icon =
      row.resource.kind === 'ADDON_ACTIVATION'
        ? 'tablerPuzzle'
        : this.appTile(row.target.applicationKey).icon;

    let revision = row.resource.revision;
    let definitionVersionId = row.resource.kind === 'ADDON_ACTIVATION' ? row.resource.definitionVersionId : null;
    this.reasonModal().open(
      {
        title,
        confirmLabel,
        danger: isTurningOff,
        icon,
        tile,
      },
      async (reason, idempotencyKey) => {
        const rowId = this.trackRow(row);
        this.setRowBusy(rowId, true);
        try {
          if (row.resource.kind === 'APPLICATION_ACTIVATION') {
            const result = await this.api.setCompanyApplication(
              companyId,
              row.target.applicationKey,
              {
                expectedActivationRevision: revision,
                enabled: nextEnabled,
                reason,
              },
              idempotencyKey,
            );
            if (!result.changed) this.notify.info(this.transloco.translate('wsActivation.toast.alreadyInState'));
            else this.notify.success(
              this.transloco.translate(
                nextEnabled ? 'wsActivation.toast.turnedOn' : 'wsActivation.toast.turnedOff',
                { name },
              ),
            );
            await this.loadActivations(companyId);
            return true;
          }

          if (row.resource.kind === 'ADDON_ACTIVATION' && row.target.addonKey) {
            const addonKey = row.target.addonKey;
            if (!definitionVersionId) {
              const singleton = await this.api.getCompanyAddon(companyId, row.target.applicationKey, addonKey);
              definitionVersionId = singleton.source.selectedDefinitionVersionId;
            }
            if (!definitionVersionId) {
              this.notify.error(this.transloco.translate('wsActivation.errors.addonNotAvailable'));
              return true;
            }

            const result = await this.api.setCompanyAddon(
              companyId,
              row.target.applicationKey,
              addonKey,
              {
                expectedActivationRevision: revision,
                enabled: nextEnabled,
                reason,
                definitionVersionId,
              },
              idempotencyKey,
            );

            if (result.state === 'PENDING') {
              this.startPendingCommand(companyId, row.target.applicationKey, addonKey, result);
              return true;
            }

            if (!result.changed) this.notify.info(this.transloco.translate('wsActivation.toast.alreadyInState'));
            else this.notify.success(
              this.transloco.translate(
                nextEnabled ? 'wsActivation.toast.turnedOn' : 'wsActivation.toast.turnedOff',
                { name },
              ),
            );
            await this.loadActivations(companyId);
            return true;
          }

          return true;
        } catch (error) {
          return this.handleWriteError(error, name, companyId, async (keep) => {
            if (!keep) { await this.loadActivations(companyId); return; }
            const fresh = row.resource.kind === 'ADDON_ACTIVATION' && row.target.addonKey
              ? await this.api.getCompanyAddon(companyId, row.target.applicationKey, row.target.addonKey)
              : await this.api.getCompanyApplication(companyId, row.target.applicationKey);
            revision = fresh.resource.revision;
          });
        } finally {
          this.setRowBusy(rowId, false);
        }
      },
    );
  }

  protected openBranchOverrides(row: ActivationListItem): void {
    if (row.resource.kind !== 'ADDON_ACTIVATION' || !row.target.addonKey) return;
    const company = this.selectedCompany();
    if (!company) return;

    this.branchOverridesModal().open({
      companyId: company.id,
      companyName: company.name,
      appKey: row.target.applicationKey,
      addonKey: row.target.addonKey,
      addonName: this.rowName(row),
      companyAddonExists: row.resource.state === 'STORED',
      companyApplicationExists: this.rows().some((item) => item.target.applicationKey === row.target.applicationKey &&
        item.resource.kind === 'APPLICATION_ACTIVATION' && item.resource.state === 'STORED'),
    });
  }

  private async initialize(): Promise<void> {
    this.companiesLoading.set(true);
    this.loadFailed.set(false);
    this.apiForbidden.set(false);
    this.correlationId.set(null);

    try {
      const [companiesList, apps] = await Promise.all([
        this.lookups.allCompanies({ status: 'ACTIVE' }),
        this.lookups.appsOverview().catch(() => []),
      ]);
      if (this.destroyed) return;
      this.appNames.set(new Map(apps.map((app) => [app.moduleKey, app])));
      this.companies.set(companiesList);

      const initialCompanyId = this.resolveInitialCompanyId(companiesList);
      const requestedCompanyId = this.route.snapshot.queryParamMap.get('companyId')?.trim() ?? '';
      if (requestedCompanyId && companiesList.length > 0 && requestedCompanyId !== initialCompanyId) {
        this.notify.warning(this.transloco.translate('wsActivation.errors.companyNotFound'));
      }
      this.selectedCompanyId.set(initialCompanyId);
      this.initialized.set(true);

      if (initialCompanyId) {
        await this.loadActivations(initialCompanyId);
      }
    } catch (error) {
      if (this.destroyed) return;
      const fromQuery = this.route.snapshot.queryParamMap.get('companyId')?.trim() ?? '';
      if (fromQuery) {
        this.selectedCompanyId.set(fromQuery);
        this.initialized.set(true);
        await this.loadActivations(fromQuery);
      } else if (isForbiddenError(error)) {
        this.apiForbidden.set(true);
      } else if (error instanceof ApiError && error.status < 500 && error.status !== 0) {
        this.notify.error(errorMessage(error, 'wsActivation', this.transloco));
      } else {
        this.loadFailed.set(true);
        this.correlationId.set(correlationIdOf(error));
      }
    } finally {
      if (!this.destroyed) {
        this.companiesLoading.set(false);
      }
    }
  }

  private resolveInitialCompanyId(companies: readonly WorkspaceCompany[]): string {
    const fromQuery = this.route.snapshot.queryParamMap.get('companyId')?.trim() ?? '';
    if (fromQuery && (companies.length === 0 || companies.some((c) => c.id === fromQuery))) {
      return fromQuery;
    }

    const fromScope = this.scope.selection()?.companyId ?? '';
    if (fromScope && companies.some((c) => c.id === fromScope)) {
      return fromScope;
    }

    const firstActive = companies.find((c) => c.status === 'ACTIVE');
    return firstActive?.id ?? companies[0]?.id ?? '';
  }

  private async loadActivations(companyId: string): Promise<void> {
    if (!companyId) return;

    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.loadFailed.set(false);
    this.apiForbidden.set(false);
    this.correlationId.set(null);

    try {
      const items = await this.api.listAllCompanyActivations(companyId);
      if (this.destroyed || seq !== this.loadSeq || companyId !== this.selectedCompanyId()) return;
      this.rows.set(items);
      this.resumePendingCommands(companyId, items);
    } catch (error) {
      if (this.destroyed || seq !== this.loadSeq || companyId !== this.selectedCompanyId()) return;
      this.rows.set([]);
      if (isForbiddenError(error)) {
        this.apiForbidden.set(true);
      } else if (error instanceof ApiError && error.status < 500 && error.status !== 0) {
        this.notify.error(errorMessage(error, 'wsActivation', this.transloco));
      } else {
        this.loadFailed.set(true);
        this.correlationId.set(correlationIdOf(error));
      }
    } finally {
      if (!this.destroyed && seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  private startPendingCommand(
    companyId: string,
    appKey: string,
    addonKey: string,
    command: AddonActivationPendingCommand,
  ): void {
    const key = pendingStorageKey(companyId, appKey, addonKey);
    writeStoredCommandId(companyId, appKey, addonKey, command.commandId);
    this.setPendingState(key, {
      commandId: command.commandId,
      companyId,
      appKey,
      addonKey,
      validatedBranchCount: validatedBranches(command),
      startedAt: Date.now(),
      foreignActor: false,
    });
    this.schedulePoll(key, FAST_POLL_INTERVAL_MS);
  }

  private resumePendingCommands(companyId: string, items: readonly ActivationListItem[]): void {
    for (const item of items) {
      if (item.resource.kind !== 'ADDON_ACTIVATION' || !item.target.addonKey) continue;
      const appKey = item.target.applicationKey;
      const addonKey = item.target.addonKey;
      const commandId = readStoredCommandId(companyId, appKey, addonKey);
      if (!commandId) continue;

      const key = pendingStorageKey(companyId, appKey, addonKey);
      const existing = this.pendingCommands().get(key);
      if (existing && existing.commandId === commandId) {
        if (!existing.foreignActor && !this.pollTimers.has(key)) {
          this.schedulePoll(key, this.pollIntervalFor(existing.startedAt));
        }
        continue;
      }

      this.setPendingState(key, {
        commandId,
        companyId,
        appKey,
        addonKey,
        validatedBranchCount: null,
        startedAt: Date.now(),
        foreignActor: false,
      });
      this.schedulePoll(key, FAST_POLL_INTERVAL_MS);
    }
  }

  private schedulePoll(key: string, delayMs: number): void {
    this.clearPollTimer(key);
    if (this.destroyed) return;
    const timer = setTimeout(() => {
      this.pollTimers.delete(key);
      void this.pollCommand(key);
    }, delayMs);
    this.pollTimers.set(key, timer);
  }

  private async pollCommand(key: string): Promise<void> {
    if (this.destroyed) return;
    const entry = this.pendingCommands().get(key);
    if (!entry || entry.foreignActor || entry.companyId !== this.selectedCompanyId()) return;

    try {
      const result = await this.api.getAddonCommand(
        entry.companyId,
        entry.appKey,
        entry.addonKey,
        entry.commandId,
      );
      if (this.destroyed || entry.companyId !== this.selectedCompanyId()) return;

      if (result.state === 'PENDING') {
        this.setPendingState(key, {
          ...entry,
          validatedBranchCount: validatedBranches(result),
        });
        this.schedulePoll(key, this.pollIntervalFor(entry.startedAt));
        return;
      }

      clearStoredCommandId(entry.companyId, entry.appKey, entry.addonKey);
      this.removePendingState(key);

      if (result.state === 'COMMITTED') {
        const name = this.addonDisplayName(entry.addonKey);
        this.notify.success(this.transloco.translate('wsActivation.toast.turnedOn', { name }));
        await this.loadActivations(entry.companyId);
        return;
      }

      if (result.state === 'REJECTED') {
        this.notify.error(this.transloco.translate(`wsActivation.rejected.${result.reason}`));
        await this.loadActivations(entry.companyId);
      }
    } catch (error) {
      if (this.destroyed || entry.companyId !== this.selectedCompanyId()) return;

      // The status route answers 403 ACCESS_POLICY_BLOCKED for another actor and for a command it no longer knows.
      if (isForbiddenError(error)) {
        clearStoredCommandId(entry.companyId, entry.appKey, entry.addonKey);
        this.setPendingState(key, { ...entry, foreignActor: true, validatedBranchCount: null });
        return;
      }

      this.schedulePoll(key, this.pollIntervalFor(entry.startedAt));
    }
  }

  private pollIntervalFor(startedAt: number): number {
    return Date.now() - startedAt < FAST_POLL_WINDOW_MS ? FAST_POLL_INTERVAL_MS : SLOW_POLL_INTERVAL_MS;
  }

  private handleWriteError(error: unknown, name: string, companyId: string, refresh: (keep: boolean) => Promise<void>): boolean {
    this.reasonModal().retainKeyFor(error);
    const code = errorCodeOf(error);
    if (code === 'APPLICATION_ACTIVATION_REVISION_STALE' || code === 'ADDON_REVISION_STALE') {
      this.reasonModal().showConflict(refresh);
      return false;
    }
    this.notify.error(code === 'APPLICATION_ALLOWANCE_NOT_READY'
      ? this.transloco.translate('wsActivation.errors.APPLICATION_ALLOWANCE_NOT_READY', { name })
      : writeErrorMessage(error, 'wsActivation', this.transloco));
    if (code === 'ADDON_OPERATION_UNCERTAIN') void this.loadActivations(companyId);
    return false;
  }

  private appDisplayName(key: string): string {
    return this.appNames().get(key)?.nameI18n[this.language()] || key;
  }

  private addonDisplayName(key: string): string {
    return this.appDisplayName(key);
  }

  private setPendingState(key: string, value: PendingCommandState): void {
    this.pendingCommands.update((current) => {
      const next = new Map(current);
      next.set(key, value);
      return next;
    });
  }

  private removePendingState(key: string): void {
    this.pendingCommands.update((current) => {
      if (!current.has(key)) return current;
      const next = new Map(current);
      next.delete(key);
      return next;
    });
  }

  private clearPollTimer(key: string): void {
    const existing = this.pollTimers.get(key);
    if (existing !== undefined) {
      clearTimeout(existing);
      this.pollTimers.delete(key);
    }
  }

  private clearAllPollTimers(): void {
    for (const timer of this.pollTimers.values()) {
      clearTimeout(timer);
    }
    this.pollTimers.clear();
  }

  private setRowBusy(rowId: string, busy: boolean): void {
    this.busyRows.update((current) => {
      const next = new Set(current);
      if (busy) next.add(rowId);
      else next.delete(rowId);
      return next;
    });
  }
}
