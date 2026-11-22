import { Component, computed, effect, inject, resource, signal, untracked, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerEye, tablerLock, tablerPhoto, tablerRefresh } from '@ng-icons/tabler-icons';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { SettingsNotice } from '../../../../../shared/ui/settings-notice/settings-notice';
import { BrandingAssetCard } from '../branding-asset-card/branding-asset-card';
import { BrandingColoursCard } from '../branding-colours-card/branding-colours-card';
import { BrandingIdentityCard } from '../branding-identity-card/branding-identity-card';
import { BrandingPreviewModal } from '../branding-preview-modal/branding-preview-modal';
import { BrandingUploadModal } from '../branding-upload-modal/branding-upload-modal';
import { getBranding, updateBranding } from '../branding.api';
import {
  BRANDING_HEX_PATTERN,
  BRANDING_TEXT_MAX,
  Branding,
  BrandingAssetKind,
  BrandingColoursErrors,
  BrandingIdentityErrors,
  UpdateBrandingBody,
  brandingErrorKey,
} from '../branding.model';
import { coreFieldErrors, fieldMessages, hasOtherFields } from '../../core-response.model';

/** UpdateBrandingDto field -> the form field that shows its CORE_VALIDATION_FAILED message. */
const SERVER_FIELDS = ['appName', 'tabTitle', 'primaryColor', 'secondaryColor'] as const;

const CAN_READ = true; // later branding.read
const CAN_MANAGE = true; // later branding.manage, tenant-wide only (not per company)

type EditableField = 'appName' | 'tabTitle' | 'primary' | 'secondary';

interface BrandingDraft {
  appName: string;
  tabTitle: string;
  primaryColor: string;
  secondaryColor: string;
}

type TouchedState = Record<EditableField, boolean>;

const EMPTY_DRAFT: BrandingDraft = {
  appName: '',
  tabTitle: '',
  primaryColor: '',
  secondaryColor: '',
};

const UNTOUCHED: TouchedState = {
  appName: false,
  tabTitle: false,
  primary: false,
  secondary: false,
};

function valueOrNull(value: string): string | null {
  return value.trim() || null;
}

function draftFromBranding(record: Branding): BrandingDraft {
  return {
    appName: record.appName ?? '',
    tabTitle: record.tabTitle ?? '',
    primaryColor: record.primaryColor ?? '',
    secondaryColor: record.secondaryColor ?? '',
  };
}

@Component({
  selector: 'app-branding-page',
  imports: [
    TranslocoPipe,
    NgIcon,
    Button,
    ConfirmDialog,
    SettingsNotice,
    BrandingIdentityCard,
    BrandingColoursCard,
    BrandingAssetCard,
    BrandingUploadModal,
    BrandingPreviewModal,
  ],
  providers: [provideIcons({ tablerEye, tablerRefresh, tablerPhoto, tablerLock })],
  templateUrl: './branding-page.html',
  host: { class: 'flex min-h-0 flex-1 flex-col gap-8 p-12' },
})
export class BrandingPage {
  private static nextId = 0;
  protected readonly uid = `branding-page-${++BrandingPage.nextId}`;

  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  private readonly identityCard = viewChild(BrandingIdentityCard);
  private readonly coloursCard = viewChild(BrandingColoursCard);
  private readonly uploadModal = viewChild.required(BrandingUploadModal);
  private readonly previewModal = viewChild.required(BrandingPreviewModal);
  private readonly discardDialog = viewChild.required<ConfirmDialog>('discardDialog');

  protected readonly canRead = CAN_READ;
  protected readonly canManage = CAN_MANAGE;

  private readonly loaded = resource({
    loader: () => (this.canRead ? getBranding() : Promise.resolve(null)),
  });

  protected readonly baseline = signal<Branding | null>(null);
  protected readonly draft = signal<BrandingDraft>({ ...EMPTY_DRAFT });
  protected readonly saving = signal(false);
  private readonly touched = signal<TouchedState>({ ...UNTOUCHED });
  private readonly submitAttempted = signal(false);

  private lastLoadedRecord: Branding | null = null;
  private lastHandledError: unknown = null;
  private pendingSave: { signature: string; key: string } | null = null;

  protected readonly loading = this.loaded.isLoading;
  protected readonly loadFailed = computed(
    () => this.baseline() === null && !this.loading() && Boolean(this.loaded.error()),
  );
  protected readonly uploading = computed(() => this.uploadModal().uploading());
  protected readonly uploadingKind = computed(() =>
    this.uploadModal().uploading() ? this.uploadModal().activeKind() : null,
  );

  protected readonly dirty = computed(() => {
    const base = this.baseline();
    if (!base) return false;
    const current = this.draft();
    return (
      valueOrNull(current.appName) !== (base.appName || null) ||
      valueOrNull(current.tabTitle) !== (base.tabTitle || null) ||
      valueOrNull(current.primaryColor) !== (base.primaryColor || null) ||
      valueOrNull(current.secondaryColor) !== (base.secondaryColor || null)
    );
  });

  private readonly rawErrorKeys = computed<Record<EditableField, string | null>>(() => {
    const current = this.draft();
    const primary = current.primaryColor.trim();
    const secondary = current.secondaryColor.trim();
    return {
      appName: current.appName.trim().length > BRANDING_TEXT_MAX ? 'wsBranding.validation.textTooLong' : null,
      tabTitle: current.tabTitle.trim().length > BRANDING_TEXT_MAX ? 'wsBranding.validation.textTooLong' : null,
      primary: primary.length > 0 && !BRANDING_HEX_PATTERN.test(primary) ? 'wsBranding.validation.colourInvalid' : null,
      secondary:
        secondary.length > 0 && !BRANDING_HEX_PATTERN.test(secondary) ? 'wsBranding.validation.colourInvalid' : null,
    };
  });

  protected readonly valid = computed(() => {
    const errs = this.rawErrorKeys();
    return !errs.appName && !errs.tabTitle && !errs.primary && !errs.secondary;
  });

  /** Messages of the last CORE_VALIDATION_FAILED, already in the request language; cleared on edit. */
  private readonly serverErrors = signal<Partial<Record<(typeof SERVER_FIELDS)[number], string>>>({});

  protected readonly identityErrors = computed<BrandingIdentityErrors>(() => {
    this.i18n();
    const errs = this.rawErrorKeys();
    const shown = this.touched();
    const force = this.submitAttempted();
    const server = this.serverErrors();
    return {
      appName: (force || shown.appName) && errs.appName ? this.transloco.translate(errs.appName) : (server.appName ?? null),
      tabTitle: (force || shown.tabTitle) && errs.tabTitle ? this.transloco.translate(errs.tabTitle) : (server.tabTitle ?? null),
    };
  });

  protected readonly coloursErrors = computed<BrandingColoursErrors>(() => {
    this.i18n();
    const errs = this.rawErrorKeys();
    const shown = this.touched();
    const force = this.submitAttempted();
    const server = this.serverErrors();
    return {
      primary: (force || shown.primary) && errs.primary ? this.transloco.translate(errs.primary) : (server.primaryColor ?? null),
      secondary:
        (force || shown.secondary) && errs.secondary ? this.transloco.translate(errs.secondary) : (server.secondaryColor ?? null),
    };
  });

  protected readonly canSave = computed(
    () =>
      this.canManage &&
      this.baseline() !== null &&
      !this.loading() &&
      !this.saving() &&
      !this.uploading() &&
      this.dirty() &&
      this.valid(),
  );

  constructor() {
    effect(() => {
      if (!this.canRead || this.loaded.isLoading()) return;

      const err = this.loaded.error();
      if (err && err !== this.lastHandledError) {
        this.lastHandledError = err;
        if (untracked(() => this.baseline() !== null)) {
          this.notify.error(this.transloco.translate(brandingErrorKey(err)));
        }
        return;
      }

      if (this.loaded.hasValue()) {
        const value = this.loaded.value();
        if (value && value !== this.lastLoadedRecord) {
          this.lastLoadedRecord = value;
          this.lastHandledError = null;
          untracked(() => this.applyLoadedRecord(value));
        }
      }
    });
  }

  protected onAppNameChange(value: string): void {
    this.draft.update((d) => ({ ...d, appName: value }));
    this.serverErrors.update((e) => ({ ...e, appName: undefined }));
  }

  protected onTabTitleChange(value: string): void {
    this.draft.update((d) => ({ ...d, tabTitle: value }));
    this.serverErrors.update((e) => ({ ...e, tabTitle: undefined }));
  }

  protected onPrimaryChange(value: string): void {
    this.draft.update((d) => ({ ...d, primaryColor: value }));
    this.serverErrors.update((e) => ({ ...e, primaryColor: undefined }));
  }

  protected onSecondaryChange(value: string): void {
    this.draft.update((d) => ({ ...d, secondaryColor: value }));
    this.serverErrors.update((e) => ({ ...e, secondaryColor: undefined }));
  }

  protected markTouched(field: EditableField): void {
    this.touched.update((state) => (state[field] ? state : { ...state, [field]: true }));
  }

  protected onFormEnter(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      event.preventDefault();
      void this.save();
    }
  }

  protected async save(event?: Event): Promise<void> {
    event?.preventDefault();
    const base = this.baseline();
    if (!this.canManage || !base || this.loading() || this.saving() || this.uploading()) return;

    this.submitAttempted.set(true);

    if (!this.valid()) {
      this.focusFirstInvalid();
      return;
    }

    const body = this.buildPatchBody(base, this.draft());
    if (Object.keys(body).length === 0) return;

    const signature = JSON.stringify(body);
    const idempotencyKey =
      this.pendingSave && this.pendingSave.signature === signature
        ? this.pendingSave.key
        : newIdempotencyKey();
    this.pendingSave = { signature, key: idempotencyKey };

    this.saving.set(true);
    this.serverErrors.set({});
    try {
      const updated = await updateBranding(body, idempotencyKey);
      this.pendingSave = null;
      this.applyLoadedRecord(updated);
      this.notify.success(this.transloco.translate('wsBranding.saved'));
    } catch (error) {
      const fields = coreFieldErrors(error);
      if (fields) this.serverErrors.set(fieldMessages(fields, SERVER_FIELDS));
      if (!fields || hasOtherFields(fields, SERVER_FIELDS)) {
        this.notify.error(this.transloco.translate(brandingErrorKey(error)));
      }
    } finally {
      this.saving.set(false);
    }
  }

  protected undo(): void {
    if (this.saving() || this.uploading()) return;
    const base = this.baseline();
    if (!base) return;
    this.draft.set(draftFromBranding(base));
    this.resetFormMeta();
  }

  protected async reload(): Promise<void> {
    if (this.loading() || this.saving() || this.uploading()) return;
    if (this.dirty()) {
      const confirmed = await this.discardDialog().open();
      if (!confirmed) return;
    }
    this.resetFormMeta();
    this.lastHandledError = null;
    this.loaded.reload();
  }

  protected openPreview(): void {
    const base = this.baseline();
    if (!base || this.loading() || this.loadFailed()) return;
    const current = this.draft();
    this.previewModal().open({
      appName: current.appName,
      tabTitle: current.tabTitle,
      primary: current.primaryColor,
      secondary: current.secondaryColor,
      logoUrl: base.logoUrl,
      iconUrl: base.iconUrl,
    });
  }

  protected openUpload(kind: BrandingAssetKind): void {
    if (!this.canManage || this.saving() || this.uploading()) return;
    const base = this.baseline();
    this.uploadModal().open(kind, kind === 'logo' ? (base?.logoUrl ?? null) : (base?.iconUrl ?? null));
  }

  protected onAssetSaved(event: { kind: BrandingAssetKind; branding: Branding }): void {
    const incoming = event.branding;
    this.baseline.update((current) =>
      current
        ? {
            ...current,
            id: incoming.id,
            hasLogo: incoming.hasLogo,
            hasIcon: incoming.hasIcon,
            logoUrl: incoming.logoUrl,
            iconUrl: incoming.iconUrl,
            createdAt: incoming.createdAt,
            updatedAt: incoming.updatedAt,
          }
        : incoming,
    );
  }

  private applyLoadedRecord(record: Branding): void {
    this.baseline.set(record);
    this.draft.set(draftFromBranding(record));
    this.resetFormMeta();
  }

  private resetFormMeta(): void {
    this.touched.set({ ...UNTOUCHED });
    this.submitAttempted.set(false);
    this.pendingSave = null;
  }

  private buildPatchBody(base: Branding, current: BrandingDraft): UpdateBrandingBody {
    const body: UpdateBrandingBody = {};
    const nextAppName = valueOrNull(current.appName);
    if (nextAppName !== (base.appName || null)) {
      body.appName = nextAppName;
    }
    const nextTabTitle = valueOrNull(current.tabTitle);
    if (nextTabTitle !== (base.tabTitle || null)) {
      body.tabTitle = nextTabTitle;
    }
    const nextPrimary = valueOrNull(current.primaryColor);
    if (nextPrimary !== (base.primaryColor || null)) {
      body.primaryColor = nextPrimary;
    }
    const nextSecondary = valueOrNull(current.secondaryColor);
    if (nextSecondary !== (base.secondaryColor || null)) {
      body.secondaryColor = nextSecondary;
    }
    return body;
  }

  private focusFirstInvalid(): void {
    const errs = this.rawErrorKeys();
    if (errs.appName) {
      this.identityCard()?.focusField('appName');
      return;
    }
    if (errs.tabTitle) {
      this.identityCard()?.focusField('tabTitle');
      return;
    }
    if (errs.primary) {
      this.coloursCard()?.focusField('primary');
      return;
    }
    if (errs.secondary) {
      this.coloursCard()?.focusField('secondary');
    }
  }
}
