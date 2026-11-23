import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  resource,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { CanDeactivateFn, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerClock,
  tablerCloudOff,
  tablerLanguage,
  tablerLock,
  tablerRefresh,
} from '@ng-icons/tabler-icons';
import {
  ApiError,
  errorCodeOf,
  errorMessage,
  fieldErrorsOf,
} from '../../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { AuthSession } from '../../../../../core/auth/auth-session';
import { hasTenantWidePermission } from '../../../../../core/auth/tenant-wide-permission';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { ConflictDialog } from '../../../../../shared/ui/conflict-dialog/conflict-dialog';
import { Dropdown, type DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { Segmented, type SegmentedOption } from '../../../../../shared/ui/segmented/segmented';
import { SettingsNotice } from '../../../../../shared/ui/settings-notice/settings-notice';
import { Switch } from '../../../../../shared/ui/switch/switch';
import { UnsavedDialog } from '../../../../../shared/ui/unsaved-dialog/unsaved-dialog';
import { ActionKeys } from '../../core-response.model';
import { TimezonePicker } from '../timezone-picker/timezone-picker';
import { WorkspaceSettingsApi } from '../workspace-settings.api';
import {
  SESSION_POLICY_FIELDS,
  TIMEZONE_MAX_LENGTH,
  formatTimezoneOffset,
  type ActiveCurrency,
  type SessionPolicyFieldKey,
  type SessionPolicyResult,
  type TimezoneOption,
  type UpdateSessionPolicyRequest,
  type UpdateWorkspaceSettingsRequest,
  type WorkspaceLanguage,
  type WorkspaceSettings,
} from '../workspace-settings.model';

type Card = 'general' | 'session';
type HeldAction = { key: string; bodyJson: string };

@Component({
  selector: 'app-workspace-settings-page',
  imports: [
    RouterLink,
    NgIcon,
    TranslocoPipe,
    Button,
    ConfirmDialog,
    ConflictDialog,
    Dropdown,
    Field,
    Segmented,
    SettingsNotice,
    Switch,
    TimezonePicker,
    UnsavedDialog,
  ],
  providers: [
    provideTranslocoScope(
      { scope: 'ws-general', alias: 'wsGeneral' },
      { scope: 'ws-session', alias: 'wsSession' },
    ),
    provideIcons({ tablerLanguage, tablerClock, tablerLock, tablerRefresh, tablerCloudOff }),
  ],
  templateUrl: './workspace-settings-page.html',
  host: { class: 'flex min-h-0 flex-1 flex-col gap-8 p-12' },
})
export class WorkspaceSettingsPage {
  private static nextId = 0;
  protected readonly uid = `workspace-settings-page-${++WorkspaceSettingsPage.nextId}`;
  protected readonly skeletonCards = [0, 1] as const;
  private readonly api = inject(WorkspaceSettingsApi);
  private readonly auth = inject(AuthSession);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly unsavedDialog = viewChild.required<UnsavedDialog>('unsavedDialog');
  private readonly confirmDialog = viewChild.required<ConfirmDialog>('confirmDialog');
  protected readonly confirmText = signal('');
  protected readonly confirmTitle = signal('');
  protected readonly conflictOpen = signal(false);
  protected readonly saved = signal<WorkspaceSettings | null>(null);
  protected readonly savedPolicy = signal<SessionPolicyResult | null>(null);
  protected readonly currencies = signal<ActiveCurrency[]>([]);
  protected readonly timezones = signal<TimezoneOption[]>([]);
  protected readonly languageDraft = signal<WorkspaceLanguage>('en');
  protected readonly timezoneDraft = signal('');
  protected readonly allowSupportDraft = signal(true);
  protected readonly sessionDraft = signal<Partial<Record<SessionPolicyFieldKey, string>>>({});
  protected readonly savingGeneral = signal(false);
  protected readonly savingSession = signal(false);
  protected readonly changingCurrency = signal(false);
  protected readonly refreshingPolicy = signal(false);
  protected readonly generalErrors = signal<Record<string, string>>({});
  protected readonly sessionErrors = signal<Record<string, string>>({});
  private readonly planBlocked = signal(false);
  private readonly generalScoped = signal(false);
  private readonly sessionScoped = signal(false);
  private generalAction: HeldAction | null = null;
  private sessionAction: HeldAction | null = null;
  private readonly currencyKeys = new ActionKeys(newIdempotencyKey);
  private readonly clockTick = signal(Date.now());

  protected readonly canView = computed(
    () => this.auth.me()?.permissions.includes('workspace.read') === true,
  );
  protected readonly canManage = computed(
    () =>
      !this.planBlocked() &&
      !this.generalScoped() &&
      hasTenantWidePermission(this.auth.me(), 'workspace.manage'),
  );
  protected readonly canManageSession = computed(
    () =>
      !this.planBlocked() &&
      !this.sessionScoped() &&
      hasTenantWidePermission(this.auth.me(), 'workspace.session-policy.manage'),
  );
  protected readonly canManageCurrency = computed(
    () =>
      !this.planBlocked() &&
      hasTenantWidePermission(this.auth.me(), 'currencies.currency.manage') &&
      this.currencies().length > 0,
  );
  protected readonly busy = computed(
    () =>
      this.savingGeneral() ||
      this.savingSession() ||
      this.changingCurrency() ||
      this.refreshingPolicy(),
  );
  protected readonly generalReason = computed(() =>
    this.planBlocked()
      ? 'wsGeneral.planReadOnly'
      : this.generalScoped()
        ? 'wsGeneral.needsTenantWide'
        : 'wsGeneral.bar.readOnlyHint',
  );
  protected readonly sessionReason = computed(() =>
    this.planBlocked()
      ? 'wsSession.planReadOnly'
      : this.sessionScoped()
        ? 'wsSession.needsTenantWide'
        : 'wsSession.ownerOnly',
  );

  private readonly loaded = resource({
    params: () => (this.canView() ? this.auth.me()?.id : undefined),
    loader: async () => {
      const [settings, session, currencies, timezones] = await Promise.allSettled([
        this.api.getSettings(),
        this.api.getSessionPolicy(),
        hasTenantWidePermission(this.auth.me(), 'currencies.currency.manage')
          ? this.api.listActiveCurrencies()
          : Promise.resolve([]),
        this.api.listTimezones(),
      ]);
      if (settings.status === 'rejected') throw settings.reason;
      if (
        session.status === 'rejected' &&
        !(session.reason instanceof ApiError && session.reason.status === 403)
      )
        throw session.reason;
      return {
        settings: settings.value,
        session: session.status === 'fulfilled' ? session.value : null,
        currencies: currencies.status === 'fulfilled' ? currencies.value : [],
        timezones: timezones.status === 'fulfilled' ? timezones.value : [],
      };
    },
  });
  protected readonly loading = this.loaded.isLoading;
  protected readonly fullState = computed(() => {
    if (!this.canView()) return 'forbidden';
    if (this.loading()) return null;
    const error = this.loaded.error();
    if (!error) return null;
    if (errorCodeOf(error) === 'TENANT_NOT_READY') return 'notReady';
    return error instanceof ApiError && error.status === 403 ? 'forbidden' : 'loadFailed';
  });

  protected readonly changedBody = computed<UpdateWorkspaceSettingsRequest>(() => {
    const saved = this.saved();
    if (!saved) return {};
    const body: UpdateWorkspaceSettingsRequest = {};
    if (this.languageDraft() !== saved.defaultLanguage) body.defaultLanguage = this.languageDraft();
    if (this.timezoneDraft().trim() !== saved.timezone) body.timezone = this.timezoneDraft().trim();
    if (this.allowSupportDraft() !== saved.allowSupport)
      body.allowSupport = this.allowSupportDraft();
    return body;
  });
  protected readonly generalDirty = computed(() => Object.keys(this.changedBody()).length > 0);
  protected readonly sessionFields = computed(() => {
    this.i18n();
    const policy = this.savedPolicy()?.data;
    if (!policy) return [];
    const fields = SESSION_POLICY_FIELDS.map((key) => {
      const text = this.sessionDraft()[key] ?? String(policy.effective[key]);
      const value = /^\d+$/.test(text.trim()) ? Number(text) : null;
      const bounds = { ...policy.limits[key], default: policy.defaults[key] };
      const localError =
        value === null || !Number.isSafeInteger(value) || value < bounds.min || value > bounds.max
          ? this.transloco.translate('wsGeneral.sessionPolicy.rangeError', bounds)
          : null;
      const hint =
        this.transloco.translate(`wsGeneral.sessionPolicy.${key}.hint`, bounds) +
        ' ' +
        this.transloco.translate('wsSession.defaultHint', bounds);
      return { key, text, value, hint, error: this.sessionErrors()[key] ?? localError };
    });
    const idle = fields.find((field) => field.key === 'idleTimeoutSeconds');
    const absolute = fields.find((field) => field.key === 'absoluteTimeoutSeconds');
    if (
      idle?.value != null &&
      absolute?.value != null &&
      !idle.error &&
      idle.value > absolute.value
    ) {
      idle.error = this.transloco.translate(
        'wsSession.errors.SESSION_POLICY_IDLE_EXCEEDS_ABSOLUTE',
      );
    }
    return fields;
  });
  protected readonly sessionDirty = computed(() =>
    this.sessionFields().some(
      (field) => field.text !== String(this.savedPolicy()?.data.effective[field.key]),
    ),
  );
  protected readonly dirty = computed(() => this.generalDirty() || this.sessionDirty());
  protected readonly timezoneError = computed(() => {
    this.i18n();
    const zone = this.timezoneDraft().trim();
    if (!zone) return this.transloco.translate('wsGeneral.timezone.required');
    return (
      this.generalErrors()['timezone'] ??
      (zone.length > TIMEZONE_MAX_LENGTH
        ? this.transloco.translate('wsGeneral.errors.TIMEZONE_INVALID')
        : null)
    );
  });
  protected readonly canSaveGeneral = computed(
    () =>
      this.canManage() &&
      this.generalDirty() &&
      !this.timezoneError() &&
      !this.savingGeneral() &&
      !this.loading(),
  );
  protected readonly canSaveSession = computed(
    () =>
      this.canManageSession() &&
      this.sessionDirty() &&
      !this.sessionFields().some((field) => field.error) &&
      !this.savingSession() &&
      !this.refreshingPolicy() &&
      !this.conflictOpen() &&
      !this.loading(),
  );
  protected readonly languageOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    return ['en', 'ar'].map((value) => ({
      value,
      label: this.transloco.translate(`wsGeneral.language.${value}`),
      disabled: !this.canManage() || this.savingGeneral(),
    }));
  });
  protected readonly currencyOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const options = this.currencies().map((currency) => ({
      value: currency.id,
      label: `${currency.code} · ${currency.name}`,
    }));
    if (
      !this.currencies().some((currency) => currency.code === this.saved()?.defaultCurrencyCode)
    ) {
      options.unshift({
        value: '',
        label:
          this.saved()?.defaultCurrencyCode ??
          this.transloco.translate('wsGeneral.currency.notSet'),
      });
    }
    return options;
  });
  protected readonly selectedCurrency = computed(
    () =>
      this.currencies().find((currency) => currency.code === this.saved()?.defaultCurrencyCode)
        ?.id ?? '',
  );
  protected readonly liveLocalTime = computed(() => {
    this.i18n();
    const now = new Date(this.clockTick());
    try {
      const time = new Intl.DateTimeFormat('en-GB', {
        timeZone: this.timezoneDraft(),
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).format(now);
      const offset = `UTC${formatTimezoneOffset(this.timezoneDraft(), now)}`;
      const pattern = this.transloco.translate('wsGeneral.timezone.localTime', {
        time: '\u0000TIME\u0000',
        offset: '\u0000OFFSET\u0000',
      });
      return pattern
        .split(/(\u0000TIME\u0000|\u0000OFFSET\u0000)/)
        .filter(Boolean)
        .map((part) => ({
          ltr: part === '\u0000TIME\u0000' || part === '\u0000OFFSET\u0000',
          text: part === '\u0000TIME\u0000' ? time : part === '\u0000OFFSET\u0000' ? offset : part,
        }));
    } catch {
      return [];
    }
  });

  constructor() {
    const timer = setInterval(() => this.clockTick.set(Date.now()), 10_000);
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (this.dirty()) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    effect((onCleanup) => {
      if (!this.dirty()) return;
      window.addEventListener('beforeunload', onBeforeUnload);
      onCleanup(() => window.removeEventListener('beforeunload', onBeforeUnload));
    });
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
    effect(() => {
      if (!this.loaded.hasValue()) return;
      const value = this.loaded.value();
      untracked(() => {
        this.applySettings(value.settings);
        this.applyPolicy(value.session);
        this.currencies.set(value.currencies);
        this.timezones.set(value.timezones);
        this.notify.connectionRestored();
      });
    });
    effect(() => {
      const error = this.loaded.error();
      if (error instanceof ApiError && error.status === 0) {
        untracked(() =>
          this.notify.connectionLost(
            this.transloco.translate('wsGeneral.states.failedTitle'),
            this.message(error, 'general'),
          ),
        );
      }
    });
  }

  async confirmLeave(): Promise<boolean> {
    if (this.busy()) return false;
    if (!this.dirty()) return true;
    const choice = await this.unsavedDialog().open();
    if (choice === 'discard') return true;
    if (choice !== 'save') return false;
    // Each card remains an independent action even when leaving the page.
    const results = await Promise.all([
      this.generalDirty() ? this.saveGeneral() : true,
      this.sessionDirty() ? this.saveSession() : true,
    ]);
    return results.every(Boolean) && !this.dirty();
  }

  protected load(): void {
    this.loaded.reload();
  }
  protected async reload(): Promise<void> {
    if (!this.loading() && !this.busy() && (await this.confirmLeave())) this.load();
  }
  protected onLanguageChange(value: string | null): void {
    if (this.canManage() && !this.savingGeneral() && (value === 'en' || value === 'ar')) {
      this.languageDraft.set(value);
      this.clearGeneralError('defaultLanguage');
    }
  }
  protected onTimezoneChange(value: string): void {
    if (this.canManage() && !this.savingGeneral()) {
      this.timezoneDraft.set(value);
      this.clearGeneralError('timezone');
    }
  }
  protected onAllowSupportChange(value: boolean): void {
    if (this.canManage() && !this.savingGeneral()) {
      this.allowSupportDraft.set(value);
      this.clearGeneralError('allowSupport');
    }
  }
  protected onSessionInput(key: SessionPolicyFieldKey, event: Event): void {
    if (!this.canManageSession() || this.savingSession() || this.refreshingPolicy()) return;
    this.sessionDraft.update((draft) => ({
      ...draft,
      [key]: (event.target as HTMLInputElement).value,
    }));
    this.sessionErrors.update((errors) => {
      const next = { ...errors };
      delete next[key];
      return next;
    });
  }
  protected undoGeneral(): void {
    if (!this.savingGeneral() && this.saved()) this.applySettings(this.saved()!);
  }
  protected undoSession(): void {
    if (!this.savingSession() && !this.refreshingPolicy()) this.applyPolicy(this.savedPolicy());
  }

  protected async saveGeneral(): Promise<boolean> {
    if (!this.canSaveGeneral()) return false;
    const body = this.changedBody();
    const bodyJson = JSON.stringify(body);
    if (this.generalAction?.bodyJson !== bodyJson)
      this.generalAction = { bodyJson, key: newIdempotencyKey() };
    this.savingGeneral.set(true);
    this.generalErrors.set({});
    try {
      const result = await this.api.updateSettings(body, this.generalAction.key);
      this.applySettings(result);
      await this.auth.reloadProfile(this.auth.requestVersion());
      this.notify.success(this.transloco.translate('wsGeneral.toast.saved'));
      return true;
    } catch (error) {
      this.handleError(error, 'general');
      return false;
    } finally {
      this.savingGeneral.set(false);
    }
  }

  protected async saveSession(): Promise<boolean> {
    if (!this.canSaveSession()) return false;
    const override = { ...this.savedPolicy()!.data.effective };
    for (const field of this.sessionFields()) override[field.key] = field.value!;
    return this.writePolicy({ override });
  }

  protected async restoreDefaults(): Promise<void> {
    if (
      !this.canManageSession() ||
      this.busy() ||
      this.loading() ||
      this.conflictOpen() ||
      !this.savedPolicy()?.data.override
    )
      return;
    this.confirmTitle.set(this.transloco.translate('wsSession.restoreDefaults'));
    this.confirmText.set(this.transloco.translate('wsSession.restoreDefaultsConfirm'));
    this.savingSession.set(true);
    try {
      if (await this.confirmDialog().open()) await this.writePolicy({ override: null });
    } finally {
      this.savingSession.set(false);
    }
  }

  private async writePolicy(body: UpdateSessionPolicyRequest): Promise<boolean> {
    const etag = this.savedPolicy()?.etag;
    if (!etag) {
      this.handleError(new ApiError(428, 'SESSION_POLICY_PRECONDITION_REQUIRED'), 'session');
      return false;
    }
    // If-Match is part of the request identity: a conflict resolution starts a new action.
    const bodyJson = JSON.stringify([body, etag]);
    if (this.sessionAction?.bodyJson !== bodyJson)
      this.sessionAction = { bodyJson, key: newIdempotencyKey() };
    this.savingSession.set(true);
    this.sessionErrors.set({});
    try {
      this.applyPolicy(await this.api.updateSessionPolicy(body, this.sessionAction.key, etag));
      this.notify.success(this.transloco.translate('wsSession.saved'));
      return true;
    } catch (error) {
      this.handleError(error, 'session');
      return false;
    } finally {
      this.savingSession.set(false);
    }
  }

  protected async resolveConflict(keepChanges: boolean): Promise<void> {
    if (this.refreshingPolicy()) return;
    this.refreshingPolicy.set(true);
    try {
      const latest = await this.api.getSessionPolicy();
      if (keepChanges) {
        const current = this.savedPolicy();
        if (current) this.savedPolicy.set({ data: current.data, etag: latest.etag });
        this.sessionAction = null;
        this.sessionErrors.set({});
      } else this.applyPolicy(latest);
      this.conflictOpen.set(false);
    } catch (error) {
      this.notify.error(
        this.transloco.translate('wsSession.saveFailed'),
        this.message(error, 'session'),
      );
    } finally {
      this.refreshingPolicy.set(false);
    }
  }

  protected async changeCurrency(id: string): Promise<void> {
    const currency = this.currencies().find((item) => item.id === id);
    if (
      !currency ||
      currency.code === this.saved()?.defaultCurrencyCode ||
      !this.canManageCurrency() ||
      this.busy() ||
      this.loading()
    )
      return;
    this.changingCurrency.set(true);
    this.confirmTitle.set(this.transloco.translate('wsGeneral.currency.changeInCurrencies'));
    this.confirmText.set(
      this.transloco.translate('wsGeneral.currency.setDefaultConfirm', { code: currency.code }),
    );
    try {
      if (!(await this.confirmDialog().open())) return;
      const signature = `set-default:${id}`;
      await this.api.setDefaultCurrency(id, this.currencyKeys.keyFor(signature));
      this.currencyKeys.done(signature);
      const settings = await this.api.getSettings();
      // Currency is a separate action; preserve unsaved general fields.
      this.saved.update((saved) =>
        saved ? { ...saved, defaultCurrencyCode: settings.defaultCurrencyCode } : settings,
      );
      this.notify.success(this.transloco.translate('wsGeneral.toast.saved'));
    } catch (error) {
      this.handleError(error, 'general');
    } finally {
      this.changingCurrency.set(false);
      // The dropdown owns a model, so explicitly restore the authoritative value after cancellation/failure.
      this.currencyDropdown()?.value.set(this.selectedCurrency());
    }
  }
  private readonly currencyDropdown = viewChild<Dropdown<string>>('currencyDropdown');

  private applySettings(settings: WorkspaceSettings): void {
    this.saved.set(settings);
    this.languageDraft.set(settings.defaultLanguage);
    this.timezoneDraft.set(settings.timezone);
    this.allowSupportDraft.set(settings.allowSupport);
    this.generalErrors.set({});
    this.generalAction = null;
  }
  private applyPolicy(policy: SessionPolicyResult | null): void {
    this.savedPolicy.set(policy);
    this.sessionDraft.set({});
    this.sessionErrors.set({});
    this.sessionAction = null;
  }
  private clearGeneralError(field: string): void {
    this.generalErrors.update((errors) => {
      const next = { ...errors };
      delete next[field];
      return next;
    });
  }
  private handleError(error: unknown, card: Card): void {
    const code = errorCodeOf(error);
    if (error instanceof ApiError && error.status === 403) {
      if (code === 'ACCESS_POLICY_BLOCKED') this.planBlocked.set(true);
      if (code === 'TENANT_WIDE_PERMISSION_REQUIRED')
        (card === 'general' ? this.generalScoped : this.sessionScoped).set(true);
    }
    if (
      card === 'session' &&
      error instanceof ApiError &&
      (error.status === 412 ||
        (error.status === 409 &&
          (code === 'SESSION_POLICY_IDEMPOTENCY_CONFLICT' ||
            code === 'SESSION_POLICY_PRECONDITION_FAILED')))
    ) {
      this.conflictOpen.set(true);
      return;
    }
    const errors = Object.fromEntries(
      Object.entries(fieldErrorsOf(error)).map(([field, messages]) => [
        field.replace(/^override\./, ''),
        messages[0] ?? this.message(error, card),
      ]),
    );
    if (code === 'TIMEZONE_INVALID') errors['timezone'] = this.message(error, card);
    if (code === 'LANGUAGE_INVALID') errors['defaultLanguage'] = this.message(error, card);
    if (
      card === 'session' &&
      code === 'SESSION_POLICY_LIMIT_EXCEEDED' &&
      error instanceof ApiError
    ) {
      for (const field of SESSION_POLICY_FIELDS) {
        const range = error.details?.[field] ?? error.details?.[`override.${field}`];
        if (range)
          errors[field] = this.transloco.translate(
            'wsSession.errors.SESSION_POLICY_LIMIT_EXCEEDED',
            { range: Array.isArray(range) ? range.join(', ') : String(range) },
          );
      }
    }
    if (code === 'SESSION_POLICY_IDLE_EXCEEDS_ABSOLUTE')
      errors['idleTimeoutSeconds'] = this.message(error, card);
    (card === 'general' ? this.generalErrors : this.sessionErrors).set(errors);
    if (Object.keys(errors).length) return;
    const title = this.transloco.translate(
      card === 'general' ? 'wsGeneral.toast.failedTitle' : 'wsSession.saveFailed',
    );
    if (error instanceof ApiError && error.status === 0)
      this.notify.connectionLost(title, this.message(error, card));
    else this.notify.error(title, this.message(error, card));
  }
  private message(error: unknown, card: Card): string {
    const scope = card === 'general' ? 'wsGeneral' : 'wsSession';
    if (error instanceof ApiError && error.status === 401)
      return this.transloco.translate(`${scope}.notSaved`);
    return errorMessage(error, scope, this.transloco);
  }
}

export const workspaceSettingsLeaveGuard: CanDeactivateFn<WorkspaceSettingsPage> = (page) =>
  page.confirmLeave();
