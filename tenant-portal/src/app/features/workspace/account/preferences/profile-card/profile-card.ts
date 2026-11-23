import {
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerPhoto, tablerTrash, tablerUser } from '@ng-icons/tabler-icons';
import { AuthSession } from '../../../../../core/auth/auth-session';
import type { TenantMe } from '../../../../../core/auth/auth-session.model';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Field } from '../../../../../shared/ui/field/field';
import { ApiError, errorCodeOf, fieldErrorsOf } from '../../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { AccountSection } from '../../shared/account-section/account-section';
import { PreferencesApi, preferencesErrorMessage } from '../preferences.api';
import { AVATAR_MAX_BYTES, AVATAR_TYPES, NAME_MAX, OwnNamePatch } from '../preferences.model';

@Component({
  selector: 'app-profile-card',
  imports: [NgIcon, TranslocoPipe, Button, ConfirmDialog, Field, AccountSection],
  providers: [provideIcons({ tablerUser, tablerPhoto, tablerTrash })],
  templateUrl: './profile-card.html',
})
export class ProfileCard {
  private static nextId = 0;
  protected readonly uid = `profile-card-${++ProfileCard.nextId}`;

  private readonly session = inject(AuthSession);
  private readonly api = inject(PreferencesApi);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  private readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');
  private readonly removePhotoDialog = viewChild.required<ConfirmDialog>('removePhotoDialog');

  readonly me = input.required<TenantMe>();

  protected readonly nameMax = NAME_MAX;

  protected readonly firstNameDraft = signal('');
  protected readonly lastNameDraft = signal('');
  protected readonly firstNameTouched = signal(false);
  protected readonly lastNameTouched = signal(false);
  protected readonly submitted = signal(false);
  protected readonly savingName = signal(false);
  protected readonly uploadingPhoto = signal(false);
  protected readonly removingPhoto = signal(false);
  protected readonly avatarError = signal<string | null>(null);
  protected readonly avatarPresent = linkedSignal(() => this.me().hasAvatar);
  protected readonly avatarFailed = signal(false);
  private readonly avatarRevision = signal(0);
  protected readonly avatarUrl = computed(() =>
    this.avatarPresent() && !this.avatarFailed() ? this.api.avatarUrl(this.avatarRevision()) : null,
  );
  private readonly nameErrors = signal<Record<string, string[]>>({});

  /** Key of the last failed name save; reused when the same patch is saved again (retry). */
  private pendingNameKey: { key: string; bodyJson: string } | null = null;

  private readonly nameSyncKey = computed(() => `${this.me().firstName}\u0000${this.me().lastName}`);

  protected readonly initials = computed(() => {
    const current = this.me();
    return [current.firstName.trim()[0], current.lastName.trim()[0]]
      .filter((ch): ch is string => Boolean(ch))
      .join('')
      .toUpperCase();
  });

  protected readonly firstNameError = computed(() => {
    this.i18n();
    const serverError = this.nameErrors()['firstName'];
    if (serverError) return serverError.join(' ') || this.transloco.translate('wsAccPrefs.errors.CORE_VALIDATION_FAILED');
    if (!this.submitted() && !this.firstNameTouched()) return null;
    if (!this.firstNameDraft().trim()) {
      return this.transloco.translate('wsAccPrefs.profile.required');
    }
    return null;
  });

  protected readonly lastNameError = computed(() => {
    this.i18n();
    const serverError = this.nameErrors()['lastName'];
    if (serverError) return serverError.join(' ') || this.transloco.translate('wsAccPrefs.errors.CORE_VALIDATION_FAILED');
    if (!this.submitted() && !this.lastNameTouched()) return null;
    if (!this.lastNameDraft().trim()) {
      return this.transloco.translate('wsAccPrefs.profile.required');
    }
    return null;
  });

  protected readonly valid = computed(() => {
    const first = this.firstNameDraft().trim();
    const last = this.lastNameDraft().trim();
    return first.length > 0 && first.length <= NAME_MAX && last.length > 0 && last.length <= NAME_MAX;
  });

  protected readonly dirty = computed(() => {
    const current = this.me();
    return (
      this.firstNameDraft().trim() !== current.firstName.trim() ||
      this.lastNameDraft().trim() !== current.lastName.trim()
    );
  });

  constructor() {
    effect(() => {
      this.nameSyncKey();
      const current = untracked(() => this.me());
      untracked(() => {
        this.firstNameDraft.set(current.firstName);
        this.lastNameDraft.set(current.lastName);
        this.firstNameTouched.set(false);
        this.lastNameTouched.set(false);
        this.submitted.set(false);
      });
    });
  }

  protected onFirstNameInput(event: Event): void {
    this.nameErrors.update(({ firstName, ...rest }) => rest);
    this.firstNameDraft.set((event.target as HTMLInputElement).value);
  }

  protected onLastNameInput(event: Event): void {
    this.nameErrors.update(({ lastName, ...rest }) => rest);
    this.lastNameDraft.set((event.target as HTMLInputElement).value);
  }

  protected pickPhoto(): void {
    if (this.uploadingPhoto() || this.removingPhoto()) return;
    this.fileInput().nativeElement.click();
  }

  protected async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || this.uploadingPhoto() || this.removingPhoto()) return;

    this.avatarError.set(null);
    if (!(AVATAR_TYPES as readonly string[]).includes(file.type)) {
      this.avatarError.set(this.transloco.translate('wsAccPrefs.errors.PARTY_IMAGE_INVALID'));
      return;
    }

    if (file.size > AVATAR_MAX_BYTES) {
      this.avatarError.set(this.transloco.translate('wsAccPrefs.errors.PARTY_IMAGE_TOO_LARGE'));
      return;
    }

    this.uploadingPhoto.set(true);
    try {
      await this.api.uploadAvatar(file);
      this.refreshAvatar(true);
      await this.session.reloadProfile(this.session.requestVersion());
      this.notify.success(this.transloco.translate('wsAccPrefs.toast.photoSaved'));
    } catch (error) {
      if (error instanceof ApiError && (error.status === 413 || error.status === 415)) {
        const code = error.status === 413 ? 'PARTY_IMAGE_TOO_LARGE' : 'PARTY_IMAGE_INVALID';
        this.avatarError.set(this.transloco.translate(`wsAccPrefs.errors.${code}`));
      } else {
        this.notify.error(preferencesErrorMessage(error, this.transloco, 'write'));
      }
    } finally {
      this.uploadingPhoto.set(false);
    }
  }

  protected async requestRemovePhoto(): Promise<void> {
    if (!this.avatarPresent() || this.uploadingPhoto() || this.removingPhoto()) return;

    const confirmed = await this.removePhotoDialog().open();
    if (!confirmed) return;

    this.removingPhoto.set(true);
    this.avatarError.set(null);
    try {
      try {
        await this.api.deleteAvatar();
      } catch (error) {
        if (errorCodeOf(error) !== 'PARTY_IMAGE_NOT_FOUND') throw error;
      }
      this.refreshAvatar(false);
      await this.session.reloadProfile(this.session.requestVersion());
      this.notify.success(this.transloco.translate('wsAccPrefs.toast.photoRemoved'));
    } catch (error) {
      this.notify.error(preferencesErrorMessage(error, this.transloco, 'write'));
    } finally {
      this.removingPhoto.set(false);
    }
  }

  protected undoName(): void {
    if (this.savingName()) return;
    const current = this.me();
    this.firstNameDraft.set(current.firstName);
    this.lastNameDraft.set(current.lastName);
    this.firstNameTouched.set(false);
    this.lastNameTouched.set(false);
    this.submitted.set(false);
    this.nameErrors.set({});
    this.pendingNameKey = null;
  }

  protected async saveName(event?: Event): Promise<void> {
    event?.preventDefault();
    this.submitted.set(true);

    if (!this.dirty() || !this.valid() || this.savingName()) return;

    const current = this.me();
    const nextFirst = this.firstNameDraft().trim();
    const nextLast = this.lastNameDraft().trim();
    const patch: OwnNamePatch = {};

    if (nextFirst !== current.firstName.trim()) {
      patch.firstName = nextFirst;
    }
    if (nextLast !== current.lastName.trim()) {
      patch.lastName = nextLast;
    }

    const version = this.session.requestVersion();
    this.savingName.set(true);
    this.nameErrors.set({});
    try {
      const bodyJson = JSON.stringify(patch);
      if (!this.pendingNameKey || this.pendingNameKey.bodyJson !== bodyJson) {
        this.pendingNameKey = { key: newIdempotencyKey(), bodyJson };
      }
      const updated = await this.api.updateMyName(patch, this.pendingNameKey.key);
      this.pendingNameKey = null;
      await this.session.reloadProfile(version);
      this.firstNameDraft.set(updated.firstName);
      this.lastNameDraft.set(updated.lastName);
      this.firstNameTouched.set(false);
      this.lastNameTouched.set(false);
      this.submitted.set(false);
      this.notify.success(this.transloco.translate('wsAccPrefs.toast.nameSaved'));
    } catch (error) {
      const fields = fieldErrorsOf(error);
      this.nameErrors.set(fields);
      if ((!fields['firstName'] && !fields['lastName']) || fields['_']) {
        this.notify.error(preferencesErrorMessage(error, this.transloco, 'write'));
      }
    } finally {
      this.savingName.set(false);
    }
  }

  private refreshAvatar(present: boolean): void {
    this.avatarRevision.update((revision) => revision + 1);
    this.avatarFailed.set(false);
    this.avatarPresent.set(present);
  }
}
