import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerPhoto, tablerTrash, tablerUser } from '@ng-icons/tabler-icons';
import { CurrentUser } from '../../../../../core/auth/current-user';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Field } from '../../../../../shared/ui/field/field';
import { errorCodeOf } from '../../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { AccountSection } from '../../shared/account-section/account-section';
import { deleteAvatar, getAvatar, updateMyName, uploadAvatar } from '../preferences.api';
import { AVATAR_MAX_BYTES, AVATAR_TYPES, AccountMe, NAME_MAX, OwnNamePatch } from '../preferences.model';

@Component({
  selector: 'app-profile-card',
  imports: [NgIcon, TranslocoPipe, Button, ConfirmDialog, Field, AccountSection],
  providers: [provideIcons({ tablerUser, tablerPhoto, tablerTrash })],
  templateUrl: './profile-card.html',
})
export class ProfileCard {
  private static nextId = 0;
  protected readonly uid = `profile-card-${++ProfileCard.nextId}`;

  private readonly destroyRef = inject(DestroyRef);
  private readonly currentUser = inject(CurrentUser);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  private readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');
  private readonly removePhotoDialog = viewChild.required<ConfirmDialog>('removePhotoDialog');

  readonly me = input.required<AccountMe>();
  readonly meChange = output<AccountMe>();

  protected readonly nameMax = NAME_MAX;

  protected readonly firstNameDraft = signal('');
  protected readonly lastNameDraft = signal('');
  protected readonly firstNameTouched = signal(false);
  protected readonly lastNameTouched = signal(false);
  protected readonly submitted = signal(false);
  protected readonly savingName = signal(false);
  protected readonly uploadingPhoto = signal(false);
  protected readonly removingPhoto = signal(false);
  protected readonly avatarUrl = signal<string | null>(null);

  /** Key of the last failed name save; reused when the same patch is saved again (retry). */
  private pendingNameKey: { key: string; patchJson: string } | null = null;
  private currentObjectUrl: string | null = null;
  private avatarLoadSeq = 0;
  private destroyed = false;

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
    if (!this.submitted() && !this.firstNameTouched()) return null;
    if (!this.firstNameDraft().trim()) {
      return this.transloco.translate('wsAccPrefs.profile.required');
    }
    return null;
  });

  protected readonly lastNameError = computed(() => {
    this.i18n();
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
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      this.setAvatarUrl(null);
    });

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

    effect(() => {
      const hasAvatar = this.me().hasAvatar;
      untracked(() => {
        if (hasAvatar) {
          if (!this.currentObjectUrl) {
            void this.loadAvatar();
          }
        } else {
          this.avatarLoadSeq++;
          this.setAvatarUrl(null);
        }
      });
    });
  }

  protected onFirstNameInput(event: Event): void {
    this.firstNameDraft.set((event.target as HTMLInputElement).value);
  }

  protected onLastNameInput(event: Event): void {
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

    if (!(AVATAR_TYPES as readonly string[]).includes(file.type)) {
      this.notify.error(this.transloco.translate('wsAccPrefs.errors.PARTY_IMAGE_INVALID'));
      return;
    }

    if (file.size > AVATAR_MAX_BYTES) {
      this.notify.error(this.transloco.translate('wsAccPrefs.errors.PARTY_IMAGE_TOO_LARGE'));
      return;
    }

    this.uploadingPhoto.set(true);
    try {
      await uploadAvatar(file);
      await this.loadAvatar();
      this.meChange.emit({ ...this.me(), hasAvatar: true });
      this.notify.success(this.transloco.translate('wsAccPrefs.toast.photoSaved'));
    } catch (error) {
      this.notify.error(this.resolveError(error));
    } finally {
      this.uploadingPhoto.set(false);
    }
  }

  protected async requestRemovePhoto(): Promise<void> {
    if (!this.me().hasAvatar || this.uploadingPhoto() || this.removingPhoto()) return;

    const confirmed = await this.removePhotoDialog().open();
    if (!confirmed) return;

    this.removingPhoto.set(true);
    try {
      await deleteAvatar();
      this.avatarLoadSeq++;
      this.setAvatarUrl(null);
      this.meChange.emit({ ...this.me(), hasAvatar: false });
      this.notify.success(this.transloco.translate('wsAccPrefs.toast.photoRemoved'));
    } catch (error) {
      this.notify.error(this.resolveError(error));
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

    this.savingName.set(true);
    try {
      const patchJson = JSON.stringify(patch);
      if (!this.pendingNameKey || this.pendingNameKey.patchJson !== patchJson) {
        this.pendingNameKey = { key: newIdempotencyKey(), patchJson };
      }
      const updated = await updateMyName(patch, this.pendingNameKey.key);
      this.pendingNameKey = null;
      // PATCH users/me returns the user view without hasAvatar: keep the rest of the current me.
      this.meChange.emit({ ...current, firstName: updated.firstName, lastName: updated.lastName, email: updated.email });
      this.currentUser.user.set({
        displayName: `${updated.firstName} ${updated.lastName}`.trim(),
        email: updated.email,
      });
      this.firstNameDraft.set(updated.firstName);
      this.lastNameDraft.set(updated.lastName);
      this.firstNameTouched.set(false);
      this.lastNameTouched.set(false);
      this.submitted.set(false);
      this.notify.success(this.transloco.translate('wsAccPrefs.toast.nameSaved'));
    } catch (error) {
      this.notify.error(this.resolveError(error));
    } finally {
      this.savingName.set(false);
    }
  }

  private async loadAvatar(): Promise<void> {
    const seq = ++this.avatarLoadSeq;
    try {
      const blob = await getAvatar();
      if (this.destroyed || seq !== this.avatarLoadSeq) return;
      this.setAvatarUrl(URL.createObjectURL(blob));
    } catch {
      if (!this.destroyed && seq === this.avatarLoadSeq) {
        this.setAvatarUrl(null);
      }
    }
  }

  private setAvatarUrl(next: string | null): void {
    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl);
    }
    this.currentObjectUrl = next;
    this.avatarUrl.set(next);
  }

  private resolveError(error: unknown): string {
    const code = errorCodeOf(error);
    if (code) {
      const key = `wsAccPrefs.errors.${code}`;
      const translated = this.transloco.translate(key);
      if (translated !== key) return translated;
    }
    return this.transloco.translate('wsAccPrefs.errors.generic');
  }
}
