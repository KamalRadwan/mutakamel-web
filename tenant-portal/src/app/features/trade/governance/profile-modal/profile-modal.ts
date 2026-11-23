import { Component, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { tablerFileSettings } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { ScopeState } from '../../../../core/scope/scope';
import { Button } from '../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Dropdown, type DropdownOption } from '../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../shared/ui/field/field';
import { Modal } from '../../../../shared/ui/modal/modal';
import { errorCodeOf, newIdempotencyKey, tradeContext } from '../../shared/trade-api';
import {
  isForbiddenError,
  isPublicationUnavailableError,
  resolveProfileErrorMessage,
} from '../document-profiles-page/profile-access';
import type { ScopeTarget } from '../policy.model';
import { CODE_PATTERN } from '../policy.registry';
import { createProfile } from '../profiles.api';
import type { DocumentProfileRecord } from '../profiles.model';
import { DOCUMENT_TYPES, type DocumentType } from '../profiles.registry';

@Component({
  selector: 'app-profile-modal',
  imports: [TranslocoPipe, Button, ConfirmDialog, Dropdown, Field, Modal],
  providers: [provideIcons({ tablerFileSettings })],
  templateUrl: './profile-modal.html',
})
export class ProfileModal {
  private static nextId = 0;
  protected readonly uid = `gov-profile-modal-${++ProfileModal.nextId}`;

  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly lang = inject(LanguageState).current;
  private readonly scopeState = inject(ScopeState);
  private readonly notify = inject(Notify);

  private readonly modal = viewChild.required(Modal);
  private readonly discardDialog = viewChild.required<ConfirmDialog>('discardDialog');

  readonly scopeTarget = input<ScopeTarget>('COMPANY');
  readonly created = output<DocumentProfileRecord>();
  readonly forbidden = output<void>();
  readonly publicationUnavailable = output<void>();

  protected readonly code = signal('');
  protected readonly documentType = signal<DocumentType>('QUOTATION');
  protected readonly submitted = signal(false);
  protected readonly saving = signal(false);
  protected readonly serverCodeError = signal<string | null>(null);
  protected readonly serverScopeError = signal(false);

  private allowClose = false;
  private confirmingLeave = false;
  private lastFingerprint = '';
  private lastIdempotencyKey = '';

  protected readonly isBranchScope = computed(() => this.scopeTarget() === 'BRANCH');

  protected readonly typeOptions = computed<DropdownOption<DocumentType>[]>(() => {
    this.i18n();
    return DOCUMENT_TYPES.map((type) => ({
      value: type,
      label: this.transloco.translate(`profiles.types.${type}`),
    }));
  });

  protected readonly scopeDisplay = computed(() => {
    this.i18n();
    const target = this.scopeTarget();
    const scopeName = this.transloco.translate(`governance.scope.${target}`);
    if (target === 'TENANT') {
      return scopeName;
    }
    const language = this.lang();
    const company = this.scopeState.company();
    const companyName = language === 'ar' ? (company?.nameAr ?? '') : (company?.nameEn ?? '');
    if (target === 'COMPANY') {
      return `${scopeName} · ${companyName}`;
    }
    const branch = this.scopeState.branch();
    const branchName = language === 'ar' ? (branch?.nameAr ?? '') : (branch?.nameEn ?? '');
    const pair = this.transloco.translate('profiles.modal.scopePair', {
      company: companyName,
      branch: branchName,
    });
    return `${scopeName} · ${pair}`;
  });

  protected readonly codeError = computed<string | null>(() => {
    this.i18n();
    const server = this.serverCodeError();
    if (server) return server;
    if (!this.submitted()) return null;
    const trimmed = this.code().trim().toUpperCase();
    if (!trimmed) {
      return this.transloco.translate('profiles.modal.codeRequired');
    }
    if (!CODE_PATTERN.test(trimmed)) {
      return this.transloco.translate('profiles.modal.codeInvalid');
    }
    return null;
  });

  protected readonly scopeError = computed<string | null>(() => {
    this.i18n();
    if (this.isBranchScope() || this.serverScopeError()) {
      return this.transloco.translate('profiles.modal.branchScopeError');
    }
    return null;
  });

  protected readonly dirty = computed(() => this.code().trim().length > 0);

  open(defaultType?: DocumentType): void {
    this.code.set('');
    this.documentType.set(defaultType && DOCUMENT_TYPES.includes(defaultType) ? defaultType : 'QUOTATION');
    this.submitted.set(false);
    this.saving.set(false);
    this.serverCodeError.set(null);
    this.serverScopeError.set(false);
    this.allowClose = false;
    this.lastFingerprint = '';
    this.lastIdempotencyKey = '';
    this.modal().open();
  }

  protected onCodeInput(event: Event): void {
    this.serverCodeError.set(null);
    this.code.set((event.target as HTMLInputElement).value);
  }

  protected onTypeChange(nextType: DocumentType): void {
    this.serverCodeError.set(null);
    this.documentType.set(nextType);
  }

  protected async requestClose(): Promise<void> {
    if (this.saving()) return;
    if (!(await this.confirmLeave())) return;
    this.allowClose = true;
    this.modal().close();
  }

  protected onModalClosed(): void {
    if (!this.allowClose && this.dirty()) {
      this.modal().open();
      void this.confirmModalClose();
      return;
    }
    this.allowClose = false;
    this.submitted.set(false);
    this.saving.set(false);
    this.serverCodeError.set(null);
    this.serverScopeError.set(false);
  }

  protected async submit(): Promise<void> {
    if (this.saving() || this.isBranchScope()) return;
    this.submitted.set(true);
    this.serverCodeError.set(null);
    this.serverScopeError.set(false);

    const normalizedCode = this.code().trim().toUpperCase();
    if (!normalizedCode || !CODE_PATTERN.test(normalizedCode)) return;

    const payload = {
      code: normalizedCode,
      documentType: this.documentType(),
      scopeTarget: this.scopeTarget(),
    };
    const fingerprint = `${payload.scopeTarget}:${payload.documentType}:${payload.code}`;
    if (fingerprint !== this.lastFingerprint || !this.lastIdempotencyKey) {
      this.lastFingerprint = fingerprint;
      this.lastIdempotencyKey = newIdempotencyKey();
    }

    this.saving.set(true);
    try {
      const created = await createProfile(payload, {
        idempotencyKey: this.lastIdempotencyKey,
        ctx: tradeContext(this.scopeState, this.scopeTarget()),
      });
      this.lastFingerprint = '';
      this.lastIdempotencyKey = '';
      this.notify.success(this.transloco.translate('profiles.toasts.profileCreated', { code: created.code }));
      this.allowClose = true;
      this.modal().close();
      this.created.emit(created);
    } catch (error) {
      if (isForbiddenError(error)) {
        this.allowClose = true;
        this.modal().close();
        this.forbidden.emit();
        return;
      }
      if (isPublicationUnavailableError(error)) {
        this.allowClose = true;
        this.modal().close();
        this.publicationUnavailable.emit();
        return;
      }
      const errCode = errorCodeOf(error);
      if (errCode === 'TRADE.DOCUMENT_PROFILE.IDENTITY_TAKEN') {
        this.serverCodeError.set(this.transloco.translate('governance.errors.TRADE.DOCUMENT_PROFILE.IDENTITY_TAKEN'));
      } else if (errCode === 'TRADE.DOCUMENT_PROFILE.SCOPE_NOT_ALLOWED') {
        this.serverScopeError.set(true);
      } else {
        this.notify.error(resolveProfileErrorMessage(this.transloco, error));
      }
    } finally {
      this.saving.set(false);
    }
  }

  private async confirmModalClose(): Promise<void> {
    if (await this.confirmLeave()) {
      this.allowClose = true;
      this.modal().close();
    }
  }

  private async confirmLeave(): Promise<boolean> {
    if (!this.dirty()) return true;
    if (this.confirmingLeave) return false;
    this.confirmingLeave = true;
    try {
      return await this.discardDialog().open();
    } finally {
      this.confirmingLeave = false;
    }
  }
}
