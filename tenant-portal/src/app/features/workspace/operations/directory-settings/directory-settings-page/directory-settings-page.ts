import { Component, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { Router, RouterLink, Routes } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAdjustments,
  tablerCopy,
  tablerInfoCircle,
  tablerLock,
  tablerRefresh,
} from '@ng-icons/tabler-icons';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { Switch } from '../../../../../shared/ui/switch/switch';
import { UnsavedDialog } from '../../../../../shared/ui/unsaved-dialog/unsaved-dialog';
import { ApiError, errorCodeOf, errorMessage } from '../../../staff/shared/staff.api';
import { StaffSession } from '../../../staff/shared/staff-session';
import { getDirectorySettings, updateDirectorySettings } from '../directory-settings.api';
import {
  DIRECTORY_SETTINGS_LIMITS,
  DUPLICATE_SCOPES,
  DirectorySettings,
  DirectorySettingsPatch,
  DuplicateScope,
} from '../directory-settings.model';
import { correlationIdOf } from '../../../../../core/api/api-errors';

const FORBIDDEN_ERROR_CODES = new Set([
  'TENANT_WIDE_PERMISSION_REQUIRED',
  'BRANCH_PERMISSION_DENIED',
  'PERMISSION_SCOPE_UNAVAILABLE',
]);

interface ParsedLimit {
  value: number | null;
  errorKey: 'required' | 'range' | null;
}

function parseLimit(raw: string): ParsedLimit {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { value: null, errorKey: 'required' };
  }
  if (!/^\d+$/.test(trimmed)) {
    return { value: null, errorKey: 'range' };
  }
  const num = Number(trimmed);
  if (
    !Number.isSafeInteger(num) ||
    num < DIRECTORY_SETTINGS_LIMITS.min ||
    num > DIRECTORY_SETTINGS_LIMITS.max
  ) {
    return { value: null, errorKey: 'range' };
  }
  return { value: num, errorKey: null };
}

function isForbiddenError(error: unknown): boolean {
  const code = errorCodeOf(error);
  if (code && FORBIDDEN_ERROR_CODES.has(code)) return true;
  return error instanceof ApiError && error.status === 403;
}

function hasCrmRoute(routes: Routes): boolean {
  for (const route of routes) {
    if (route.path === 'crm/settings' || route.path === 'crm' || route.path?.startsWith('crm/')) {
      return true;
    }
    if (route.children && hasCrmRoute(route.children)) {
      return true;
    }
  }
  return false;
}

@Component({
  selector: 'app-directory-settings-page',
  imports: [NgIcon, RouterLink, TranslocoPipe, Button, Dropdown, Field, Switch, UnsavedDialog],
  providers: [
    provideTranslocoScope('settings', { scope: 'ws-directory-settings', alias: 'wsDirSettings' }),
    provideIcons({
      tablerCopy,
      tablerAdjustments,
      tablerInfoCircle,
      tablerLock,
      tablerRefresh,
    }),
  ],
  templateUrl: './directory-settings-page.html',
  host: {
    class: 'flex min-h-0 flex-1 flex-col',
    '(window:beforeunload)': 'onBeforeUnload($event)',
  },
})
export class DirectorySettingsPage {
  private static nextId = 0;
  protected readonly uid = `dir-settings-${++DirectorySettingsPage.nextId}`;

  private readonly router = inject(Router);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly session = inject(StaffSession);
  private readonly i18n = translationEvents(this.transloco);

  private readonly unsavedDialog = viewChild.required(UnsavedDialog);

  protected readonly limits = DIRECTORY_SETTINGS_LIMITS;
  protected readonly crmAvailable = computed(() => hasCrmRoute(this.router.config));

  protected readonly saved = signal<DirectorySettings | null>(null);
  protected readonly loading = signal(true);
  protected readonly forbidden = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly loadCorrelationId = signal<string | null>(null);
  protected readonly saving = signal(false);

  protected readonly duplicateScope = signal<DuplicateScope>('TENANT');
  protected readonly preventDuplicateEmail = signal(true);
  protected readonly preventDuplicatePhone = signal(true);
  protected readonly preventDuplicateWhatsapp = signal(true);
  protected readonly maxContactsInput = signal('20');
  protected readonly maxAddressesInput = signal('20');
  protected readonly maxContactsTouched = signal(false);
  protected readonly maxAddressesTouched = signal(false);

  private loadSeq = 0;

  private readonly parsedMaxContacts = computed(() => parseLimit(this.maxContactsInput()));
  private readonly parsedMaxAddresses = computed(() => parseLimit(this.maxAddressesInput()));

  private readonly maxContactsDirty = computed(() => {
    const current = this.saved();
    if (!current) return false;
    const parsed = this.parsedMaxContacts();
    return parsed.value === null || parsed.value !== current.maxContactMethodsPerParty;
  });

  private readonly maxAddressesDirty = computed(() => {
    const current = this.saved();
    if (!current) return false;
    const parsed = this.parsedMaxAddresses();
    return parsed.value === null || parsed.value !== current.maxAddressesPerParty;
  });

  protected readonly maxContactsError = computed<string | null>(() => {
    this.i18n();
    const key = this.parsedMaxContacts().errorKey;
    if (!key || (!this.maxContactsTouched() && !this.maxContactsDirty())) return null;
    return this.transloco.translate(`wsDirSettings.validation.${key}`, {
      min: DIRECTORY_SETTINGS_LIMITS.min,
      max: DIRECTORY_SETTINGS_LIMITS.max,
    });
  });

  protected readonly maxAddressesError = computed<string | null>(() => {
    this.i18n();
    const key = this.parsedMaxAddresses().errorKey;
    if (!key || (!this.maxAddressesTouched() && !this.maxAddressesDirty())) return null;
    return this.transloco.translate(`wsDirSettings.validation.${key}`, {
      min: DIRECTORY_SETTINGS_LIMITS.min,
      max: DIRECTORY_SETTINGS_LIMITS.max,
    });
  });

  protected readonly valid = computed(
    () => this.parsedMaxContacts().errorKey === null && this.parsedMaxAddresses().errorKey === null,
  );

  protected readonly dirty = computed(() => {
    const current = this.saved();
    if (!current) return false;
    return (
      this.duplicateScope() !== current.duplicateScope ||
      this.preventDuplicateEmail() !== current.preventDuplicateEmail ||
      this.preventDuplicatePhone() !== current.preventDuplicatePhone ||
      this.preventDuplicateWhatsapp() !== current.preventDuplicateWhatsapp ||
      this.maxContactsDirty() ||
      this.maxAddressesDirty()
    );
  });

  protected readonly canSave = computed(
    () => this.dirty() && this.valid() && !this.saving() && !this.loading(),
  );

  protected readonly scopeOptions = computed<DropdownOption<DuplicateScope>[]>(() => {
    this.i18n();
    return DUPLICATE_SCOPES.map((value) => ({
      value,
      label: this.transloco.translate(`wsDirSettings.scope.${value}`),
    }));
  });

  protected readonly scopeHint = computed(() => {
    this.i18n();
    return this.transloco.translate(
      this.duplicateScope() === 'BRANCH'
        ? 'wsDirSettings.duplicates.scopeHintBranch'
        : 'wsDirSettings.duplicates.scopeHint',
    );
  });

  constructor() {
    if (!this.session.me()) {
      void this.session.load().catch(() => undefined);
    }

    effect(() => {
      const me = this.session.me();
      if (!me) return;

      if (!this.session.isTenantWide('directory.settings.manage')) {
        untracked(() => {
          this.loadSeq++;
          this.forbidden.set(true);
          this.loading.set(false);
          this.loadFailed.set(false);
          this.loadCorrelationId.set(null);
          this.saved.set(null);
        });
        return;
      }

      if (untracked(() => this.forbidden() || (!this.saved() && !this.loadFailed()))) {
        void untracked(() => this.load());
      }
    });
  }

  async canDeactivate(): Promise<boolean> {
    if (this.saving()) return false;
    if (!this.dirty()) return true;

    const choice = await this.unsavedDialog().open();
    if (choice === 'cancel') return false;
    if (choice === 'discard') {
      this.undo();
      return true;
    }
    if (!this.valid()) {
      this.maxContactsTouched.set(true);
      this.maxAddressesTouched.set(true);
      return false;
    }
    return this.save();
  }

  protected reload(): void {
    void this.load();
  }

  protected onMaxContactsInput(event: Event): void {
    this.maxContactsInput.set((event.target as HTMLInputElement).value);
  }

  protected onMaxAddressesInput(event: Event): void {
    this.maxAddressesInput.set((event.target as HTMLInputElement).value);
  }

  protected undo(): void {
    const current = this.saved();
    if (!current) return;
    this.syncDraft(current);
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    void this.save();
  }

  protected async save(): Promise<boolean> {
    this.maxContactsTouched.set(true);
    this.maxAddressesTouched.set(true);

    const current = this.saved();
    if (!current || !this.valid() || !this.dirty() || this.saving()) {
      return false;
    }

    const patch: Partial<DirectorySettingsPatch> = {};
    const scope = this.duplicateScope();
    const email = this.preventDuplicateEmail();
    const phone = this.preventDuplicatePhone();
    const whatsapp = this.preventDuplicateWhatsapp();
    const maxContacts = this.parsedMaxContacts().value;
    const maxAddresses = this.parsedMaxAddresses().value;

    if (scope !== current.duplicateScope) {
      patch.duplicateScope = scope;
    }
    if (email !== current.preventDuplicateEmail) {
      patch.preventDuplicateEmail = email;
    }
    if (phone !== current.preventDuplicatePhone) {
      patch.preventDuplicatePhone = phone;
    }
    if (whatsapp !== current.preventDuplicateWhatsapp) {
      patch.preventDuplicateWhatsapp = whatsapp;
    }
    if (maxContacts !== null && maxContacts !== current.maxContactMethodsPerParty) {
      patch.maxContactMethodsPerParty = maxContacts;
    }
    if (maxAddresses !== null && maxAddresses !== current.maxAddressesPerParty) {
      patch.maxAddressesPerParty = maxAddresses;
    }

    if (Object.keys(patch).length === 0) {
      this.syncDraft(current);
      return true;
    }

    this.saving.set(true);
    try {
      const updated = await updateDirectorySettings(patch);
      this.saved.set(updated);
      this.syncDraft(updated);
      this.notify.success(this.transloco.translate('wsDirSettings.toast.saved'));
      return true;
    } catch (error) {
      this.notify.error(errorMessage(error, 'wsDirSettings', this.transloco));
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  protected onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.dirty()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  private async load(): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.forbidden.set(false);
    this.loadFailed.set(false);
    this.loadCorrelationId.set(null);

    try {
      const result = await getDirectorySettings();
      if (seq !== this.loadSeq) return;
      this.saved.set(result);
      this.syncDraft(result);
    } catch (error) {
      if (seq !== this.loadSeq) return;
      if (isForbiddenError(error)) {
        this.forbidden.set(true);
        this.saved.set(null);
      } else {
        this.loadFailed.set(true);
        this.loadCorrelationId.set(correlationIdOf(error));
      }
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  private syncDraft(settings: DirectorySettings): void {
    this.duplicateScope.set(settings.duplicateScope);
    this.preventDuplicateEmail.set(settings.preventDuplicateEmail);
    this.preventDuplicatePhone.set(settings.preventDuplicatePhone);
    this.preventDuplicateWhatsapp.set(settings.preventDuplicateWhatsapp);
    this.maxContactsInput.set(String(settings.maxContactMethodsPerParty));
    this.maxAddressesInput.set(String(settings.maxAddressesPerParty));
    this.maxContactsTouched.set(false);
    this.maxAddressesTouched.set(false);
  }
}
