import {
  Component,
  ElementRef,
  Injector,
  computed,
  effect,
  inject,
  resource,
  runInInjectionContext,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerChevronDown,
  tablerExclamationCircle,
  tablerLayoutKanban,
  tablerLoader2,
  tablerMail,
  tablerPhoneCall,
  tablerX,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { Button } from '../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { ConflictDialog } from '../../../../shared/ui/conflict-dialog/conflict-dialog';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { Field } from '../../../../shared/ui/field/field';
import { Menu, MenuItem } from '../../../../shared/ui/menu/menu';
import { Modal } from '../../../../shared/ui/modal/modal';
import { rectInPage, viewport } from '../../../../shared/ui/overlay/zoom';
import { Switch } from '../../../../shared/ui/switch/switch';
import { CrmCallSettings } from '../../../../shared/widgets/phone-actions/crm-call-settings';
import { StaffReadAccess } from '../../../workspace/staff/staff-read-access';
import { CrmModules } from '../../shared/crm-modules/crm-modules';
import { updateCompanyModules } from '../../shared/crm-modules/crm-modules.api';
import {
  CrmModule,
  CrmModuleCompany,
  CrmModuleOverride,
} from '../../shared/crm-modules/crm-modules.model';
import { nameIn } from '../pipelines/pipelines.model';
import { fieldErrorsOf, isValidationError } from '../../../../core/api/api-errors';
import { ApiError, crmSettingsError, errorCodeOf } from '../shared/settings-api';
import { anyGrant, tenantWide } from '../shared/settings-access';
import {
  getCorePhoneSummary,
  getCrmSettings,
  getGeneralPipelines,
  updateCrmSettings,
} from './general.api';
import { CorePhoneSummary, GENERAL_LIMITS } from './general.model';
import { SettingsSection } from './settings-section/settings-section';

type HeaderTooltipKey = 'leads' | 'opportunities' | 'clickToCall' | 'logCalls';

interface PendingModuleConflict {
  companyId: string;
  module: CrmModule;
  value: boolean | null;
}

@Component({
  selector: 'app-general-page',
  imports: [
    NgIcon,
    RouterLink,
    TranslocoPipe,
    Button,
    ConfirmDialog,
    ConflictDialog,
    FullState,
    Field,
    Menu,
    Modal,
    SettingsSection,
    Switch,
  ],
  providers: [
    provideTranslocoScope('settings', { scope: 'settings-general', alias: 'general' }),
    provideIcons({
      tablerLayoutKanban,
      tablerMail,
      tablerPhoneCall,
      tablerAlertTriangle,
      tablerExclamationCircle,
      tablerChevronDown,
      tablerLoader2,
      tablerX,
    }),
  ],
  templateUrl: './general-page.html',
  host: { class: 'flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto p-12' },
})
export class GeneralPage {
  private static nextId = 0;
  protected readonly uid = `general-page-${++GeneralPage.nextId}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  // Error helpers probe optional keys; avoid reporting those probes as missing UI translations.
  private readonly errorTranslation = (key: string, params?: Record<string, unknown>): string =>
    Object.hasOwn(this.transloco.getTranslation(this.transloco.getActiveLang()), key)
      ? this.transloco.translate(key, params)
      : key;
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;
  protected readonly crmModules = inject(CrmModules);
  private readonly crmCallSettings = inject(CrmCallSettings);
  private readonly staffRead = inject(StaffReadAccess);

  protected readonly retentionConflictOpen = signal(false);
  protected readonly retentionLabel = computed(() => {
    this.i18n();
    return this.transloco.translate('general.retention.title');
  });
  private readonly confirmRetentionDialog =
    viewChild.required<ConfirmDialog>('confirmRetentionDialog');
  protected readonly retentionConfirmText = signal('');
  private readonly modulesConflictModal = viewChild.required<Modal>('modulesConflictModal');
  private readonly confirmOffDialog = viewChild.required<ConfirmDialog>('confirmOffDialog');

  private readonly readOnly = signal(false);
  protected readonly canManage = computed(
    () =>
      !this.readOnly() &&
      runInInjectionContext(this.injector, () => tenantWide('crm.settings.manage')),
  );
  protected readonly canReadPhoneSettings = computed(() =>
    runInInjectionContext(this.injector, () => anyGrant('webphone.settings.read')),
  );
  protected readonly canReadPhoneExtensions = computed(() =>
    runInInjectionContext(this.injector, () => anyGrant('webphone.extensions.read')),
  );
  private readonly canReadPipelines = computed(() =>
    runInInjectionContext(this.injector, () => anyGrant('crm.pipelines.read')),
  );
  protected readonly canOpenStaffUsers = computed(() => this.staffRead.allows('users'));
  protected readonly limits = GENERAL_LIMITS;

  private readonly settingsResource = resource({
    loader: () => getCrmSettings(),
  });

  private readonly pipelinesResource = resource({
    params: () => (this.canReadPipelines() ? true : undefined),
    loader: () => getGeneralPipelines(),
  });

  protected readonly loading = computed(() => this.settingsResource.isLoading());
  protected readonly failed = computed(() => Boolean(this.settingsResource.error()));
  protected readonly loadError = computed(() => {
    this.i18n();
    return crmSettingsError(this.errorTranslation, this.settingsResource.error(), 'general');
  });
  protected readonly settings = computed(() =>
    this.settingsResource.hasValue() ? this.settingsResource.value() : null,
  );

  protected readonly defaultPipelineName = computed(() => {
    const current = this.settings();
    if (!current || !this.pipelinesResource.hasValue()) return '';
    const list = this.pipelinesResource.value();
    const match = list.find((item) => item.id === current.defaultPipelineId);
    return match ? nameIn(match, this.language()) : '';
  });

  private retainedDraft: { key: string; value: string } | null = null;

  private readonly retentionSyncKey = computed(() => {
    const current = this.settings();
    return current
      ? `${current.outboundEmailContentRetentionDays}:${current.outboundEmailRetentionPolicyRevision}`
      : null;
  });

  protected readonly modulesLoading = signal(false);
  protected readonly modulesFailed = computed(() => this.crmModules.error() !== null);
  protected readonly modulesLoadError = computed(() => {
    this.i18n();
    return crmSettingsError(this.errorTranslation, this.crmModules.error(), 'general');
  });
  protected readonly companySearch = signal('');
  protected readonly moduleSaving = signal<Record<CrmModule, boolean>>({
    leads: false,
    opportunities: false,
  });
  protected readonly savingCells = signal<ReadonlySet<string>>(new Set());
  protected readonly confirmOffTitle = signal('');
  protected readonly confirmOffText = signal('');
  protected readonly modulesConflictBusy = signal(false);
  protected readonly pendingModuleConflict = signal<PendingModuleConflict | null>(null);

  protected readonly activeHeaderTip = signal<HeaderTooltipKey | null>(null);
  protected readonly headerTipPlace = signal({ top: 0, start: 0 });
  private readonly leadsHeaderTip = viewChild<ElementRef<HTMLElement>>('leadsHeaderTip');
  private readonly opportunitiesHeaderTip =
    viewChild<ElementRef<HTMLElement>>('opportunitiesHeaderTip');

  protected readonly companies = computed(() => this.crmModules.state()?.companies ?? []);
  protected readonly showCompanySearch = computed(() => this.companies().length > 8);
  protected readonly filteredCompanies = computed(() => {
    const list = this.companies();
    const term = this.companySearch().trim().toLowerCase();
    if (!term) return list;
    return list.filter(
      (company) =>
        company.name.toLowerCase().includes(term) || company.code.toLowerCase().includes(term),
    );
  });

  protected readonly conversionSaving = signal(false);
  protected readonly clickToCallSaving = signal(false);
  protected readonly logCallsSaving = signal(false);
  protected readonly phoneSummary = signal<CorePhoneSummary | null>(null);
  protected readonly phoneSummaryLoading = signal(false);
  protected readonly phoneSummaryNotSubscribed = signal(false);
  protected readonly phoneSummaryProvisioning = signal(false);
  protected readonly phoneSummaryFailed = signal(false);
  private readonly phoneSummaryError = signal<unknown>(null);
  protected readonly phoneLoadError = computed(() => {
    this.i18n();
    return crmSettingsError(this.errorTranslation, this.phoneSummaryError(), 'general');
  });
  protected readonly retentionInput = signal('');
  protected readonly retentionTouched = signal(false);
  protected readonly retentionSaving = signal(false);
  protected readonly retentionConflictBusy = signal(false);
  protected readonly retentionServerError = signal<string | null>(null);
  protected readonly settingsBusy = computed(
    () =>
      this.moduleSaving().leads ||
      this.moduleSaving().opportunities ||
      this.conversionSaving() ||
      this.clickToCallSaving() ||
      this.logCallsSaving() ||
      this.retentionSaving() ||
      this.retentionConflictBusy(),
  );
  private moduleWriteQueue: Promise<void> = Promise.resolve();

  protected readonly parsedRetentionDays = computed(() => {
    const raw = this.retentionInput().trim();
    if (!raw) return null;
    const num = Number(raw);
    return Number.isInteger(num) ? num : NaN;
  });

  protected readonly retentionErrorKey = computed<string | null>(() => {
    const raw = this.retentionInput().trim();
    if (!raw) return 'required';
    const num = this.parsedRetentionDays();
    if (
      num === null ||
      Number.isNaN(num) ||
      num < GENERAL_LIMITS.retentionMin ||
      num > GENERAL_LIMITS.retentionMax
    ) {
      return 'retentionRange';
    }
    return null;
  });

  protected readonly retentionValid = computed(() => this.retentionErrorKey() === null);

  protected readonly retentionDirty = computed(() => {
    const current = this.settings();
    const parsed = this.parsedRetentionDays();
    if (!current || parsed === null || Number.isNaN(parsed)) return false;
    return parsed !== current.outboundEmailContentRetentionDays;
  });

  constructor() {
    void this.loadModules();
    void this.loadPhoneSummary();

    effect(() => {
      if (!this.retentionSyncKey()) return;
      const current = untracked(() => this.settings());
      if (!current) return;
      untracked(() => {
        const key = `${current.outboundEmailContentRetentionDays}:${current.outboundEmailRetentionPolicyRevision}`;
        this.retentionInput.set(
          this.retainedDraft?.key === key
            ? this.retainedDraft.value
            : String(current.outboundEmailContentRetentionDays),
        );
        this.retainedDraft = null;
        this.retentionTouched.set(false);
      });
    });
  }

  protected reloadSettings(): void {
    this.settingsResource.reload();
  }

  protected async retryModules(): Promise<void> {
    if (this.modulesLoading()) return;
    this.modulesLoading.set(true);
    try {
      await this.crmModules.reload();
    } finally {
      this.modulesLoading.set(false);
    }
  }

  protected onCompanySearchInput(event: Event): void {
    this.companySearch.set((event.target as HTMLInputElement).value);
  }

  protected async toggleModuleDefault(module: CrmModule, next: boolean): Promise<void> {
    const current = this.settings();
    const key = module === 'leads' ? 'leadsEnabled' : 'opportunitiesEnabled';
    if (!this.canManage() || !current || this.settingsBusy()) return;
    if (next === current[key]) return;
    this.moduleSaving.update((state) => ({ ...state, [module]: true }));

    if (!next) {
      // Optimistically update before opening confirm so ui-switch resets cleanly on cancel
      this.settingsResource.set({ ...current, [key]: false });
      const moduleName = this.transloco.translate(
        module === 'leads' ? 'general.modules.nameLeads' : 'general.modules.nameOpportunities',
      );
      const inheritingCount = this.companies().filter(
        (company) => company.override[key] === null,
      ).length;
      this.confirmOffTitle.set(
        this.transloco.translate('general.modules.confirmDefaultOffTitle', { module: moduleName }),
      );
      this.confirmOffText.set(
        this.transloco.translate(
          this.companies().length
            ? 'general.modules.confirmDefaultOffText'
            : 'general.modules.confirmDefaultOffWaveA',
          {
            n: inheritingCount,
            module: moduleName,
          },
        ),
      );
      if (!(await this.confirmOffDialog().open())) {
        this.settingsResource.set(current);
        this.moduleSaving.update((state) => ({ ...state, [module]: false }));
        return;
      }
    }

    this.settingsResource.set({ ...current, [key]: next });
    try {
      const updated = await updateCrmSettings({ [key]: next });
      this.settingsResource.set(updated);
      await this.crmModules.reload();
      this.notify.success(this.transloco.translate('general.toast.saved'));
    } catch (error) {
      this.settingsResource.set(current);
      this.showErrorToast(error);
    } finally {
      this.moduleSaving.update((state) => ({ ...state, [module]: false }));
    }
  }

  protected async toggleQualifiedRequired(next: boolean): Promise<void> {
    const current = this.settings();
    if (!this.canManage() || !current || this.settingsBusy()) return;
    if (next === current.requireQualifiedStageForConversion) return;

    this.conversionSaving.set(true);
    this.settingsResource.set({ ...current, requireQualifiedStageForConversion: next });
    try {
      const updated = await updateCrmSettings({ requireQualifiedStageForConversion: next });
      this.settingsResource.set(updated);
      this.notify.success(this.transloco.translate('general.toast.saved'));
    } catch (error) {
      this.settingsResource.set(current);
      this.showErrorToast(error);
    } finally {
      this.conversionSaving.set(false);
    }
  }

  protected isCellSaving(companyId: string, module: CrmModule): boolean {
    return this.savingCells().has(`${companyId}:${module}`);
  }

  protected companyCellMenuLabel(company: CrmModuleCompany, module: CrmModule): string {
    this.i18n();
    const colKey =
      module === 'leads' ? 'general.modules.colLeads' : 'general.modules.colOpportunities';
    return `${company.name} — ${this.transloco.translate(colKey)}`;
  }

  protected readonly companyCellMenus = computed(() => {
    this.i18n();
    const defaults = this.crmModules.state()?.defaults;
    const menus: Record<string, Record<CrmModule, MenuItem[]>> = {};
    for (const company of this.companies()) {
      menus[company.companyId] = {
        leads: this.buildCompanyCellMenu(company, defaults?.leadsEnabled ?? true, 'leadsEnabled'),
        opportunities: this.buildCompanyCellMenu(
          company,
          defaults?.opportunitiesEnabled ?? true,
          'opportunitiesEnabled',
        ),
      };
    }
    return menus;
  });

  private buildCompanyCellMenu(
    company: CrmModuleCompany,
    defaultVal: boolean,
    key: 'leadsEnabled' | 'opportunitiesEnabled',
  ): MenuItem[] {
    const override = company.override[key];
    const defaultLabel = this.transloco.translate(
      defaultVal ? 'general.modules.on' : 'general.modules.off',
    );
    return [
      {
        id: 'inherit',
        label: this.transloco.translate('general.modules.inherit', { value: defaultLabel }),
        selected: override === null,
      },
      {
        id: 'on',
        label: this.transloco.translate('general.modules.on'),
        selected: override === true,
      },
      {
        id: 'off',
        label: this.transloco.translate('general.modules.off'),
        selected: override === false,
      },
    ];
  }

  protected onCompanyCellClick(event: MouseEvent): void {
    const target = event.target as Element | null;
    if (target?.closest('ui-menu')) return;
    const trigger = (event.currentTarget as HTMLElement).querySelector<HTMLButtonElement>(
      'ui-menu button',
    );
    if (!trigger) return;
    const wasOpen = trigger.getAttribute('aria-expanded') === 'true';
    if (!wasOpen) {
      queueMicrotask(() => trigger.click());
    }
  }

  protected async onCompanyModuleSelected(
    company: CrmModuleCompany,
    module: CrmModule,
    choice: string,
  ): Promise<void> {
    if (
      !this.canManage() ||
      this.pendingModuleConflict() ||
      this.isCellSaving(company.companyId, module)
    )
      return;
    const key = module === 'leads' ? 'leadsEnabled' : 'opportunitiesEnabled';
    const nextOverride: boolean | null = choice === 'on' ? true : choice === 'off' ? false : null;
    if (nextOverride === company.override[key]) return;

    if (nextOverride === false) {
      const moduleName = this.transloco.translate(
        module === 'leads' ? 'general.modules.nameLeads' : 'general.modules.nameOpportunities',
      );
      this.confirmOffTitle.set(
        this.transloco.translate('general.modules.confirmCompanyOffTitle', {
          module: moduleName,
          company: company.name,
        }),
      );
      const offText = this.transloco.translate('general.modules.confirmCompanyOffText', {
        module: moduleName,
        company: company.name,
      });
      this.confirmOffText.set(
        module === 'opportunities'
          ? `${offText} ${this.transloco.translate('general.modules.confirmCompanyOffOpportunitiesNote')}`
          : offText,
      );
      if (!(await this.confirmOffDialog().open())) return;
    }

    await this.saveCompanyModule(company.companyId, module, nextOverride);
  }

  protected async reloadModulesConflict(): Promise<void> {
    if (this.modulesConflictBusy()) return;
    this.modulesConflictBusy.set(true);
    try {
      await this.crmModules.reload();
      if (this.crmModules.error()) throw this.crmModules.error();
      this.pendingModuleConflict.set(null);
      this.modulesConflictModal().close();
    } catch (error) {
      this.showErrorToast(error);
    } finally {
      this.modulesConflictBusy.set(false);
    }
  }

  protected async keepCompanyModuleOverStale(): Promise<void> {
    const pending = this.pendingModuleConflict();
    if (!pending || !this.canManage() || this.modulesConflictBusy()) return;
    this.modulesConflictBusy.set(true);
    try {
      await this.crmModules.reload();
      if (this.crmModules.error()) throw this.crmModules.error();
      const fresh = this.crmModules.state();
      if (!fresh) {
        this.showErrorToast(new Error('modules unavailable'));
        return;
      }
      const patch: Partial<CrmModuleOverride> =
        pending.module === 'leads'
          ? { leadsEnabled: pending.value }
          : { opportunitiesEnabled: pending.value };
      const updated = await updateCompanyModules(pending.companyId, patch, fresh.revision);
      this.crmModules.apply(updated);
      this.pendingModuleConflict.set(null);
      this.modulesConflictModal().close();
      this.notify.success(this.transloco.translate('general.toast.saved'));
    } catch (error) {
      await this.handleCompanyModuleError(error, pending);
    } finally {
      this.modulesConflictBusy.set(false);
    }
  }

  protected placeHeaderTooltip(
    key: HeaderTooltipKey,
    triggerEl: HTMLElement,
    customTipEl?: HTMLElement,
  ): void {
    const rect = rectInPage(triggerEl);
    const tipEl =
      customTipEl ??
      (key === 'leads'
        ? this.leadsHeaderTip()?.nativeElement
        : this.opportunitiesHeaderTip()?.nativeElement);
    const tip = tipEl ? rectInPage(tipEl) : { width: 240, height: 20 };
    const { width } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';

    let start = (rtl ? width - rect.right : rect.left) + rect.width + 6;
    if (start + tip.width > width - 8) {
      const altStart = (rtl ? width - rect.right : rect.left) - 6 - tip.width;
      start = altStart >= 8 ? altStart : Math.max(8, width - 8 - tip.width);
    }

    const top = Math.max(8, rect.bottom - tip.height);
    this.headerTipPlace.set({ top, start });
    this.activeHeaderTip.set(key);
  }

  protected hideHeaderTooltip(): void {
    this.activeHeaderTip.set(null);
  }

  protected onRetentionInput(event: Event): void {
    this.retentionServerError.set(null);
    this.retentionInput.set((event.target as HTMLInputElement).value);
  }

  protected async saveRetention(): Promise<void> {
    const current = this.settings();
    const days = this.parsedRetentionDays();
    if (
      !this.canManage() ||
      !current ||
      !this.retentionDirty() ||
      !this.retentionValid() ||
      days === null ||
      this.settingsBusy()
    ) {
      return;
    }

    this.retentionTouched.set(true);
    this.retentionSaving.set(true);
    try {
      if (days < current.outboundEmailContentRetentionDays) {
        this.retentionConfirmText.set(
          this.transloco.translate('general.retention.confirmText', {
            old: current.outboundEmailContentRetentionDays,
            next: days,
          }),
        );
        if (!(await this.confirmRetentionDialog().open())) return;
        if (!this.canManage()) return;
      }
      const updated = await updateCrmSettings({
        outboundEmailContentRetentionDays: days,
        expectedOutboundEmailRetentionPolicyRevision: current.outboundEmailRetentionPolicyRevision,
      });
      this.settingsResource.set(updated);
      this.retentionInput.set(String(updated.outboundEmailContentRetentionDays));
      this.retentionTouched.set(false);
      this.notify.success(this.transloco.translate('general.toast.saved'));
    } catch (error) {
      if (errorCodeOf(error) === 'CRM_OUTBOUND_EMAIL_RETENTION_POLICY_STALE') {
        this.retentionConflictOpen.set(true);
        return;
      }
      const messages = fieldErrorsOf(error)['outboundEmailContentRetentionDays'];
      if (messages?.length) {
        this.retentionServerError.set(messages.join(' '));
        return;
      }
      this.showErrorToast(error);
    } finally {
      this.retentionSaving.set(false);
    }
  }

  protected async reloadRetention(): Promise<void> {
    if (this.retentionConflictBusy()) return;
    this.retentionConflictBusy.set(true);
    try {
      const fresh = await getCrmSettings();
      this.settingsResource.set(fresh);
      this.retentionInput.set(String(fresh.outboundEmailContentRetentionDays));
      this.retentionTouched.set(false);
      this.retentionConflictOpen.set(false);
    } catch (error) {
      this.showErrorToast(error);
    } finally {
      this.retentionConflictBusy.set(false);
    }
  }

  protected async saveRetentionOverStale(): Promise<void> {
    const days = this.parsedRetentionDays();
    if (days === null || !this.retentionValid() || this.retentionConflictBusy()) return;

    this.retentionConflictBusy.set(true);
    try {
      const fresh = await getCrmSettings();
      this.retainedDraft = {
        key: `${fresh.outboundEmailContentRetentionDays}:${fresh.outboundEmailRetentionPolicyRevision}`,
        value: String(days),
      };
      this.settingsResource.set(fresh);
      this.retentionInput.set(String(days));
      this.retentionConflictOpen.set(false);
    } catch (error) {
      this.showErrorToast(error);
    } finally {
      this.retentionConflictBusy.set(false);
    }
  }

  protected async retryPhoneSummary(): Promise<void> {
    if (this.phoneSummaryLoading()) return;
    await this.loadPhoneSummary();
  }

  protected async toggleClickToCall(next: boolean): Promise<void> {
    const current = this.settings();
    if (!this.canManage() || !current || this.settingsBusy()) return;
    if (next === current.clickToCallEnabled) return;

    this.clickToCallSaving.set(true);
    this.settingsResource.set({ ...current, clickToCallEnabled: next });
    try {
      const updated = await updateCrmSettings({ clickToCallEnabled: next });
      this.settingsResource.set(updated);
      void this.crmCallSettings.refresh();
      this.notify.success(this.transloco.translate('general.toast.saved'));
    } catch (error) {
      this.settingsResource.set(current);
      this.showErrorToast(error);
    } finally {
      this.clickToCallSaving.set(false);
    }
  }

  protected async toggleLogCalls(next: boolean): Promise<void> {
    const current = this.settings();
    if (!this.canManage() || !current || this.settingsBusy()) return;
    if (next === current.logCallsAsActivities) return;

    this.logCallsSaving.set(true);
    this.settingsResource.set({ ...current, logCallsAsActivities: next });
    try {
      const updated = await updateCrmSettings({ logCallsAsActivities: next });
      this.settingsResource.set(updated);
      this.notify.success(this.transloco.translate('general.toast.saved'));
    } catch (error) {
      this.settingsResource.set(current);
      this.showErrorToast(error);
    } finally {
      this.logCallsSaving.set(false);
    }
  }

  private async loadPhoneSummary(): Promise<void> {
    if (!this.canReadPhoneSettings()) return;
    this.phoneSummaryLoading.set(true);
    this.phoneSummaryNotSubscribed.set(false);
    this.phoneSummaryProvisioning.set(false);
    this.phoneSummaryFailed.set(false);
    try {
      const summary = await runInInjectionContext(this.injector, getCorePhoneSummary);
      this.phoneSummary.set(summary);
    } catch (error) {
      this.phoneSummary.set(null);
      this.phoneSummaryError.set(error);
      if (errorCodeOf(error) === 'WEBPHONE_MODULE_NOT_PURCHASED') {
        this.phoneSummaryNotSubscribed.set(true);
      } else if (errorCodeOf(error) === 'WEBPHONE_PROVISIONING_PENDING') {
        this.phoneSummaryProvisioning.set(true);
      } else {
        this.phoneSummaryFailed.set(true);
      }
    } finally {
      this.phoneSummaryLoading.set(false);
    }
  }

  private async loadModules(): Promise<void> {
    if (!this.crmModules.state()) {
      this.modulesLoading.set(true);
    }
    try {
      await this.crmModules.ensureLoaded();
    } finally {
      this.modulesLoading.set(false);
    }
  }

  private saveCompanyModule(
    companyId: string,
    module: CrmModule,
    value: boolean | null,
  ): Promise<void> {
    const cellKey = `${companyId}:${module}`;
    this.setCellSaving(cellKey, true);
    const run = this.moduleWriteQueue.then(() =>
      this.runCompanyModuleSave(companyId, module, value, cellKey),
    );
    this.moduleWriteQueue = run.catch(() => {});
    return run;
  }

  private async runCompanyModuleSave(
    companyId: string,
    module: CrmModule,
    value: boolean | null,
    cellKey: string,
  ): Promise<void> {
    const state = this.crmModules.state();
    if (!state || !this.canManage() || this.pendingModuleConflict()) {
      this.setCellSaving(cellKey, false);
      return;
    }

    const patch: Partial<CrmModuleOverride> =
      module === 'leads' ? { leadsEnabled: value } : { opportunitiesEnabled: value };
    try {
      const result = await updateCompanyModules(companyId, patch, state.revision);
      this.crmModules.apply(result);
      this.notify.success(this.transloco.translate('general.toast.saved'));
    } catch (error) {
      await this.handleCompanyModuleError(error, { companyId, module, value });
    } finally {
      this.setCellSaving(cellKey, false);
    }
  }

  private async handleCompanyModuleError(
    error: unknown,
    pending: PendingModuleConflict,
  ): Promise<void> {
    const code = errorCodeOf(error);
    if (code === 'CRM_MODULE_SETTINGS_STALE') {
      // A stale write is retried only after the user chooses Keep my changes.
      this.pendingModuleConflict.set(pending);
      await this.crmModules.reload();
      this.modulesConflictModal().open();
      return;
    }
    if (code === 'CRM_COMPANY_NOT_FOUND') {
      await this.retryModules();
      this.pendingModuleConflict.set(null);
      this.modulesConflictModal().close();
    }
    this.showErrorToast(error);
  }

  private setCellSaving(key: string, saving: boolean): void {
    this.savingCells.update((current) => {
      const next = new Set(current);
      if (saving) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  private showErrorToast(error: unknown): void {
    const state = crmSettingsError(this.errorTranslation, error, 'general');
    if (state.readOnly) this.readOnly.set(true);
    if (error instanceof ApiError && error.status === 401) {
      this.notify.error(this.transloco.translate('general.errors.notSaved'));
      return;
    }
    if (isValidationError(error)) {
      // 400 CRM_VALIDATION_FAILED: details are field-path -> message lists (already localized by the backend).
      const base = this.transloco.translate('general.errors.CRM_VALIDATION_FAILED');
      const messages = Object.values(fieldErrorsOf(error)).flat();
      this.notify.error(messages.length > 0 ? `${base} ${messages.join(' ')}` : base);
      return;
    }
    this.notify.error(state.message);
  }
}
