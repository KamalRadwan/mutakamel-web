import { Component, DestroyRef, computed, effect, inject, resource, signal, untracked, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { CanDeactivateFn, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerClock,
  tablerCloudOff,
  tablerCoin,
  tablerHeadset,
  tablerLanguage,
  tablerLock,
  tablerRefresh,
} from '@ng-icons/tabler-icons';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { Segmented, SegmentedOption } from '../../../../../shared/ui/segmented/segmented';
import { Switch } from '../../../../../shared/ui/switch/switch';
import { UnsavedDialog } from '../../../../../shared/ui/unsaved-dialog/unsaved-dialog';
import { ApiError, errorCodeOf } from '../../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { SettingsNotice } from '../../../../../shared/ui/settings-notice/settings-notice';
import { TimezonePicker } from '../timezone-picker/timezone-picker';
import {
  getWorkspaceSettings,
  listCurrencyCatalogue,
  listTimezones,
  updateWorkspaceSettings,
} from '../workspace-settings.api';
import {
  CURRENCY_CODE_LENGTH,
  CurrencyOption,
  TIMEZONE_MAX_LENGTH,
  TimezoneOption,
  UpdateWorkspaceSettingsRequest,
  WorkspaceLanguage,
  WorkspaceSettings,
  formatTimezoneOffset,
} from '../workspace-settings.model';

const CAN_VIEW = true; // workspace.read
const CAN_MANAGE = true; // workspace.manage, tenant-wide (later from the session)
const SKELETON_CARDS = [0, 1, 2, 3] as const;
const LIVE_CLOCK_INTERVAL_MS = 10_000;
const CURRENCY_CODE_RE = /^[A-Za-z]{3}$/;
const TIME_SENTINEL = '\u0000TIME\u0000';
const OFFSET_SENTINEL = '\u0000OFFSET\u0000';

type PageFullState = 'forbidden' | 'notReady' | 'loadFailed' | null;
type ServerErrorField = 'language' | 'currency' | 'timezone';
type ServerFieldErrorCodes = Partial<Record<ServerErrorField, string>>;

interface LocalTimeSegment {
  kind: 'text' | 'time' | 'offset';
  value: string;
}

function statusOf(error: unknown): number | null {
  if (error instanceof ApiError) return error.status;
  if (error && typeof error === 'object' && 'status' in error) {
    const value = (error as { status: unknown }).status;
    return typeof value === 'number' ? value : null;
  }
  return null;
}

@Component({
  selector: 'app-workspace-settings-page',
  imports: [
    RouterLink,
    NgIcon,
    TranslocoPipe,
    Button,
    Dropdown,
    Field,
    Segmented,
    SettingsNotice,
    Switch,
    TimezonePicker,
    UnsavedDialog,
  ],
  providers: [
    provideTranslocoScope({ scope: 'ws-general', alias: 'wsGeneral' }),
    provideIcons({
      tablerLanguage,
      tablerCoin,
      tablerClock,
      tablerHeadset,
      tablerLock,
      tablerRefresh,
      tablerCloudOff,
    }),
  ],
  templateUrl: './workspace-settings-page.html',
  host: { class: 'flex min-h-0 flex-1 flex-col gap-8 p-12' },
})
export class WorkspaceSettingsPage {
  private static nextId = 0;
  protected readonly uid = `workspace-settings-page-${++WorkspaceSettingsPage.nextId}`;

  private readonly destroyRef = inject(DestroyRef);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  private readonly unsavedDialog = viewChild.required<UnsavedDialog>('unsavedDialog');

  protected readonly canManage = CAN_MANAGE;
  protected readonly skeletonCards = SKELETON_CARDS;
  protected readonly currencyCodeLength = CURRENCY_CODE_LENGTH;

  protected readonly saved = signal<WorkspaceSettings | null>(null);
  protected readonly currencies = signal<CurrencyOption[]>([]);
  protected readonly timezones = signal<TimezoneOption[]>([]);
  protected readonly currencyListFailed = signal(false);
  protected readonly retryingCurrencies = signal(false);
  /** Settings are required; the currency and time zone lists are optional (null when their read failed). */
  private readonly loaded = resource({
    params: () => (CAN_VIEW ? true : undefined),
    loader: async () => {
      const [settingsResult, currenciesResult, timezonesResult] = await Promise.allSettled([
        getWorkspaceSettings(),
        listCurrencyCatalogue(),
        listTimezones(),
      ]);
      if (settingsResult.status === 'rejected') throw settingsResult.reason;
      return {
        settings: settingsResult.value,
        currencies: currenciesResult.status === 'fulfilled' ? currenciesResult.value : null,
        timezones: timezonesResult.status === 'fulfilled' ? timezonesResult.value : null,
      };
    },
  });
  protected readonly loading = this.loaded.isLoading;
  protected readonly saving = signal(false);
  protected readonly fullState = computed<PageFullState>(() => {
    if (!CAN_VIEW) return 'forbidden';
    if (this.loading()) return null;
    const error = this.loaded.error();
    if (!error) return null;
    const code = errorCodeOf(error);
    if (code === 'TENANT_NOT_READY') return 'notReady';
    if (statusOf(error) === 403 || code === 'TENANT_WIDE_PERMISSION_REQUIRED') return 'forbidden';
    return 'loadFailed';
  });

  protected readonly languageDraft = signal<WorkspaceLanguage>('en');
  protected readonly currencyDraft = signal('');
  protected readonly timezoneDraft = signal('');
  protected readonly allowSupportDraft = signal(true);
  protected readonly serverErrorCodes = signal<ServerFieldErrorCodes>({});
  private readonly clockTick = signal(Date.now());

  private currencySeq = 0;
  private pendingIdemKey: string | null = null;
  private beforeUnloadAttached = false;

  private readonly onBeforeUnload = (event: BeforeUnloadEvent): void => {
    if (!this.dirty()) return;
    event.preventDefault();
    event.returnValue = '';
  };

  protected readonly dirty = computed(() => {
    const current = this.saved();
    if (!this.canManage || !current) return false;

    const draftLang = this.languageDraft().trim().toLowerCase();
    const savedCurr = (current.defaultCurrencyCode ?? '').trim().toUpperCase();
    const draftCurr = this.currencyDraft().trim().toUpperCase();
    const draftTz = this.timezoneDraft().trim();

    return (
      draftLang !== current.defaultLanguage ||
      draftCurr !== savedCurr ||
      draftTz !== current.timezone ||
      this.allowSupportDraft() !== current.allowSupport
    );
  });

  protected readonly changedBody = computed<UpdateWorkspaceSettingsRequest>(() => {
    const current = this.saved();
    if (!current) return {};

    const body: UpdateWorkspaceSettingsRequest = {};
    const draftLang = this.languageDraft().trim().toLowerCase();
    if ((draftLang === 'en' || draftLang === 'ar') && draftLang !== current.defaultLanguage) {
      body.defaultLanguage = draftLang;
    }

    const savedCurr = (current.defaultCurrencyCode ?? '').trim().toUpperCase();
    const draftCurr = this.currencyDraft().trim().toUpperCase();
    if (draftCurr && draftCurr !== savedCurr) {
      body.defaultCurrencyCode = draftCurr;
    }

    const draftTz = this.timezoneDraft().trim();
    if (draftTz !== current.timezone) {
      body.timezone = draftTz;
    }

    const draftSupport = this.allowSupportDraft();
    if (draftSupport !== current.allowSupport) {
      body.allowSupport = draftSupport;
    }

    return body;
  });

  protected readonly isValid = computed(() => {
    const tz = this.timezoneDraft().trim();
    if (!tz || tz.length > TIMEZONE_MAX_LENGTH) return false;

    const curr = this.currencyDraft().trim();
    if (curr && !CURRENCY_CODE_RE.test(curr)) return false;

    return true;
  });

  protected readonly canSave = computed(
    () =>
      this.canManage &&
      this.dirty() &&
      this.isValid() &&
      !this.saving() &&
      !this.loading() &&
      Object.keys(this.changedBody()).length > 0,
  );

  protected readonly languageError = computed(() => {
    this.i18n();
    const code = this.serverErrorCodes().language;
    return code ? this.translateCode(code) : null;
  });

  protected readonly currencyError = computed(() => {
    this.i18n();
    if (this.saved()) {
      const trimmed = this.currencyDraft().trim();
      if (trimmed && !CURRENCY_CODE_RE.test(trimmed)) {
        return this.transloco.translate('wsGeneral.currency.invalidCode');
      }
    }
    const code = this.serverErrorCodes().currency;
    return code ? this.translateCode(code) : null;
  });

  protected readonly timezoneError = computed(() => {
    this.i18n();
    if (this.saved()) {
      const trimmed = this.timezoneDraft().trim();
      if (!trimmed) {
        return this.transloco.translate('wsGeneral.timezone.required');
      }
      if (trimmed.length > TIMEZONE_MAX_LENGTH) {
        return this.transloco.translate('wsGeneral.errors.TIMEZONE_INVALID');
      }
    }
    const code = this.serverErrorCodes().timezone;
    return code ? this.translateCode(code) : null;
  });

  protected readonly languageOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    const disabled = !this.canManage || this.saving();
    return [
      { value: 'en', label: this.transloco.translate('wsGeneral.language.en'), disabled },
      { value: 'ar', label: this.transloco.translate('wsGeneral.language.ar'), disabled },
    ];
  });

  protected readonly currencyDropdownOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const savedCurr = (this.saved()?.defaultCurrencyCode ?? '').trim().toUpperCase();
    const draftCurr = this.currencyDraft().trim().toUpperCase();
    const result: DropdownOption<string>[] = [];
    const seen = new Set<string>();

    if (!savedCurr && !draftCurr) {
      seen.add('');
      result.push({
        value: '',
        label: this.transloco.translate('wsGeneral.currency.notSet'),
      });
    }

    for (const currency of this.currencies()) {
      const code = currency.code.trim().toUpperCase();
      if (seen.has(code)) continue;
      seen.add(code);
      result.push({
        value: code,
        label: this.transloco.translate('wsGeneral.currency.option', {
          name: currency.name,
          code,
          symbol: currency.symbol,
        }),
      });
    }

    if (savedCurr && !seen.has(savedCurr)) {
      seen.add(savedCurr);
      result.push({ value: savedCurr, label: savedCurr });
    }

    if (draftCurr && !seen.has(draftCurr)) {
      seen.add(draftCurr);
      result.push({ value: draftCurr, label: draftCurr });
    }

    return result;
  });

  protected readonly liveLocalTime = computed<LocalTimeSegment[] | null>(() => {
    this.i18n();
    const now = new Date(this.clockTick());
    const tz = this.timezoneDraft().trim();
    if (!tz) return null;

    let timeText: string;
    try {
      timeText = new Intl.DateTimeFormat('en-GB', {
        timeZone: tz,
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).format(now);
    } catch {
      return null;
    }

    const offsetText = `UTC${formatTimezoneOffset(tz, now)}`;
    const pattern = this.transloco.translate('wsGeneral.timezone.localTime', {
      time: TIME_SENTINEL,
      offset: OFFSET_SENTINEL,
    });

    const parts = pattern.split(/(\u0000TIME\u0000|\u0000OFFSET\u0000)/);
    const segments: LocalTimeSegment[] = [];
    for (const part of parts) {
      if (!part) continue;
      if (part === TIME_SENTINEL) {
        segments.push({ kind: 'time', value: timeText });
      } else if (part === OFFSET_SENTINEL) {
        segments.push({ kind: 'offset', value: offsetText });
      } else {
        segments.push({ kind: 'text', value: part });
      }
    }
    return segments;
  });

  constructor() {
    const timer = setInterval(() => {
      this.clockTick.set(Date.now());
    }, LIVE_CLOCK_INTERVAL_MS);

    effect(() => {
      if (typeof window === 'undefined') return;
      const isDirty = this.dirty();
      if (isDirty && !this.beforeUnloadAttached) {
        window.addEventListener('beforeunload', this.onBeforeUnload);
        this.beforeUnloadAttached = true;
      } else if (!isDirty && this.beforeUnloadAttached) {
        window.removeEventListener('beforeunload', this.onBeforeUnload);
        this.beforeUnloadAttached = false;
      }
    });

    this.destroyRef.onDestroy(() => {
      clearInterval(timer);
      if (typeof window !== 'undefined' && this.beforeUnloadAttached) {
        window.removeEventListener('beforeunload', this.onBeforeUnload);
        this.beforeUnloadAttached = false;
      }
    });

    effect(() => {
      if (!this.loaded.hasValue()) return;
      const { settings, currencies, timezones } = this.loaded.value();
      untracked(() => {
        this.currencies.set(currencies ?? []);
        this.currencyListFailed.set(currencies === null);
        this.timezones.set(timezones ?? []);
        this.applySettings(settings);
      });
    });
  }

  async confirmLeave(): Promise<boolean> {
    if (this.saving()) return false;
    if (!this.dirty()) return true;
    const choice = await this.unsavedDialog().open();
    if (choice === 'discard') return true;
    if (choice === 'save') return this.save();
    return false;
  }

  protected load(): void {
    if (!CAN_VIEW) return;
    this.loaded.reload();
  }

  protected async retryCurrencies(): Promise<void> {
    if (this.retryingCurrencies() || this.saving()) return;
    const seq = ++this.currencySeq;
    this.retryingCurrencies.set(true);
    try {
      const list = await listCurrencyCatalogue();
      if (seq !== this.currencySeq) return;
      this.currencies.set(list);
      this.currencyListFailed.set(false);
    } catch {
      if (seq !== this.currencySeq) return;
      this.currencyListFailed.set(true);
    } finally {
      if (seq === this.currencySeq) {
        this.retryingCurrencies.set(false);
      }
    }
  }

  protected onLanguageChange(value: string | null): void {
    if (!this.canManage || this.saving()) return;
    if (value !== 'en' && value !== 'ar') return;
    this.languageDraft.set(value);
    this.clearFieldError('language');
    this.pendingIdemKey = null;
  }

  protected onCurrencyChange(value: string): void {
    if (!this.canManage || this.saving()) return;
    this.currencyDraft.set(value.trim().toUpperCase());
    this.clearFieldError('currency');
    this.pendingIdemKey = null;
  }

  protected onCurrencyManualInput(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const start = inputEl.selectionStart;
    const end = inputEl.selectionEnd;
    const upper = inputEl.value.toUpperCase();
    if (inputEl.value !== upper) {
      inputEl.value = upper;
      if (start !== null && end !== null) {
        inputEl.setSelectionRange(start, end);
      }
    }
    this.currencyDraft.set(upper);
    this.clearFieldError('currency');
    this.pendingIdemKey = null;
  }

  protected onTimezoneChange(value: string): void {
    if (!this.canManage || this.saving()) return;
    this.timezoneDraft.set(value);
    this.clearFieldError('timezone');
    this.pendingIdemKey = null;
  }

  protected onAllowSupportChange(next: boolean): void {
    if (!this.canManage || this.saving()) return;
    this.allowSupportDraft.set(next);
    this.pendingIdemKey = null;
  }

  protected undo(): void {
    const current = this.saved();
    if (!current || this.saving()) return;
    this.applySettings(current);
  }

  protected async onReloadClick(): Promise<void> {
    if (this.loading() || this.saving()) return;
    if (this.dirty()) {
      const choice = await this.unsavedDialog().open();
      if (choice === 'cancel') return;
      if (choice === 'save') {
        const ok = await this.save();
        if (!ok) return;
      }
    }
    this.load();
  }

  protected async save(): Promise<boolean> {
    const current = this.saved();
    if (!this.canManage || !current || this.saving() || this.loading() || !this.dirty() || !this.isValid()) {
      return false;
    }

    const body = this.changedBody();
    if (Object.keys(body).length === 0) return false;

    const idempotencyKey = (this.pendingIdemKey ??= newIdempotencyKey());
    this.saving.set(true);
    this.serverErrorCodes.set({});

    try {
      const updated = await updateWorkspaceSettings(body, idempotencyKey);
      this.applySettings(updated);
      // Later refresh the app locale and time zone from the response.
      this.notify.success(this.transloco.translate('wsGeneral.toast.saved'));
      return true;
    } catch (error) {
      const code = errorCodeOf(error);
      if (code === 'LANGUAGE_INVALID') {
        this.serverErrorCodes.update((prev) => ({ ...prev, language: code }));
      } else if (code === 'CURRENCY_NOT_ENABLED') {
        this.serverErrorCodes.update((prev) => ({ ...prev, currency: code }));
      } else if (code === 'TIMEZONE_INVALID') {
        this.serverErrorCodes.update((prev) => ({ ...prev, timezone: code }));
      } else {
        // The key now belongs to another body: the next save must start a new action.
        if (code === 'GW.IDEM.MISMATCH') this.pendingIdemKey = null;
        this.notify.error(
          this.transloco.translate('wsGeneral.toast.failedTitle'),
          this.resolveErrorMessage(error),
        );
      }
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  private applySettings(settings: WorkspaceSettings): void {
    this.saved.set(settings);
    this.languageDraft.set(settings.defaultLanguage);
    this.currencyDraft.set(settings.defaultCurrencyCode ?? '');
    this.timezoneDraft.set(settings.timezone);
    this.allowSupportDraft.set(settings.allowSupport);
    this.serverErrorCodes.set({});
    this.pendingIdemKey = null;
  }

  private clearFieldError(field: ServerErrorField): void {
    if (!this.serverErrorCodes()[field]) return;
    this.serverErrorCodes.update((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  private translateCode(code: string): string {
    const directKey = `wsGeneral.errors.${code}`;
    const direct = this.transloco.translate(directKey);
    if (direct !== directKey) return direct;
    return this.transloco.translate('wsGeneral.errors.generic');
  }

  private resolveErrorMessage(error: unknown): string {
    const code = errorCodeOf(error);
    if (code) {
      const directKey = `wsGeneral.errors.${code}`;
      const direct = this.transloco.translate(directKey);
      if (direct !== directKey) return direct;

      // Gateway codes (GW.IDEM.*) contain dots, so they cannot be translation keys.
      if (code === 'GW.IDEM.MISMATCH') return this.transloco.translate('wsGeneral.errors.IDEM_MISMATCH');
      if (code === 'GW.IDEM.IN_FLIGHT') return this.transloco.translate('wsGeneral.errors.IDEM_IN_FLIGHT');
      if (code.startsWith('IDEM_') || code.startsWith('GW.IDEM.')) {
        return this.transloco.translate('wsGeneral.errors.IDEM_BAD_VALUE');
      }
    }

    const status = statusOf(error);
    if (status === 0) return this.transloco.translate('wsGeneral.errors.network');
    if (status === 403) return this.transloco.translate('wsGeneral.errors.permission');
    return this.transloco.translate('wsGeneral.errors.generic');
  }
}

export const workspaceSettingsLeaveGuard: CanDeactivateFn<WorkspaceSettingsPage> = (page) =>
  page.confirmLeave();
