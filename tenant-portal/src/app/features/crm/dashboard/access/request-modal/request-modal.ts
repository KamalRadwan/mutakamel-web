import { Component, computed, inject, output, signal, viewChild } from '@angular/core';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerKey, tablerX } from '@ng-icons/tabler-icons';
import { addDays } from 'date-fns';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { errorCodeOf } from '../../../../../core/api/api-errors';
import { Button } from '../../../../../shared/ui/button/button';
import { DateField } from '../../../../../shared/ui/date-time/date-field';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { Segmented, type SegmentedOption } from '../../../../../shared/ui/segmented/segmented';
import { can } from '../../../../../shared/widgets/dashboard/analytics-permissions';
import { errorDetailField } from '../../shared/api-error-details';
import { accessCanRetry, accessMessage, accessMismatch, accessReadOnly, accessValidation } from '../access-errors';
import { submitAccessRequest } from '../access.api';
import type { AccessLevel, AccessRequest, AccessResourceType } from '../access.model';

@Component({
  selector: 'app-request-modal',
  imports: [NgIcon, TranslocoPipe, Button, DateField, Field, Modal, Segmented],
  viewProviders: [provideTranslocoScope({ scope: 'crm-access', alias: 'access' }, { scope: 'analytics', alias: 'analytics' })],
  providers: [provideIcons({ tablerKey, tablerX })],
  templateUrl: './request-modal.html',
})
export class RequestModal {
  private static nextId = 0;
  protected readonly uid = `access-request-${++RequestModal.nextId}`;
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;
  private readonly modal = viewChild.required(Modal);
  readonly created = output<AccessRequest>();
  protected readonly resourceType = signal<AccessResourceType>('DASHBOARD');
  protected readonly resourceId = signal('');
  protected readonly requestedLevel = signal<AccessLevel>('VIEW');
  protected readonly requestedExpiresAt = signal<string | null>(null);
  protected readonly purpose = signal('');
  protected readonly submitting = signal(false);
  protected readonly submitted = signal(false);
  protected readonly readOnly = signal(false);
  readonly readOnlyChange = output<boolean>();
  protected readonly serverResourceError = signal<string | null>(null);
  protected readonly serverLevelError = signal<string | null>(null);
  protected readonly serverExpiresError = signal<string | null>(null);
  protected readonly serverPurposeError = signal<string | null>(null);
  protected readonly minExpiryDate = addDays(new Date(), 1).toISOString().slice(0, 10);
  private idemFingerprint: string | null = null;
  private idemKey: string | null = null;
  protected readonly levelOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    this.language();
    return [
      { value: 'VIEW', disabled: this.readOnly(), label: this.transloco.translate('access.level.VIEW') },
      { value: 'EDIT', disabled: this.readOnly(), label: this.transloco.translate('access.level.EDIT') },
    ];
  });

  protected readonly resourceError = computed<string | null>(() => {
    this.i18n();
    const srv = this.serverResourceError();
    if (srv) return srv;
    if (this.submitted() && !this.resourceId()) {
      return this.transloco.translate('access.errors.resourceRequired');
    }
    return null;
  });

  protected readonly levelError = computed<string | null>(() => this.serverLevelError());
  protected readonly expiresError = computed<string | null>(() => this.serverExpiresError());

  protected readonly purposeError = computed<string | null>(() => {
    this.i18n();
    const srv = this.serverPurposeError();
    if (srv) return srv;
    const trimmed = this.purpose().trim();
    if (trimmed.length > 250) {
      return this.transloco.translate('access.errors.maxLength', { max: 250 });
    }
    if (this.submitted() && trimmed.length === 0) {
      return this.transloco.translate('access.errors.purposeRequired');
    }
    return null;
  });

  open(resourceType: AccessResourceType, resourceId: string): void {
    if (!can('crm.dashboards.read') || !resourceId || !['DASHBOARD', 'WIDGET'].includes(resourceType)) return;
    this.resourceType.set(resourceType);
    this.resourceId.set(resourceId);
    this.requestedLevel.set('VIEW');
    this.requestedExpiresAt.set(null);
    this.purpose.set('');
    this.submitted.set(false);
    this.submitting.set(false);
    this.idemFingerprint = null;
    this.idemKey = null;
    this.clearServerErrors();
    this.modal().open();
  }
  protected close(): void { this.modal().close(); }
  protected onModalClosed(): void { this.clearServerErrors(); }
  protected onLevelChange(next: string | null): void {
    if (next !== 'VIEW' && next !== 'EDIT') return;
    this.requestedLevel.set(next);
    this.serverLevelError.set(null);
  }

  protected onExpiresChange(value: string | null): void {
    this.requestedExpiresAt.set(value);
    this.serverExpiresError.set(null);
  }

  protected clearExpires(): void {
    if (this.readOnly()) return;
    this.requestedExpiresAt.set(null);
    this.serverExpiresError.set(null);
  }

  protected onPurposeInput(event: Event): void {
    this.purpose.set((event.target as HTMLTextAreaElement).value);
    this.serverPurposeError.set(null);
  }

  protected async submit(): Promise<void> {
    if (this.submitting() || this.readOnly() || !can('crm.dashboards.read')) return;
    this.submitted.set(true);
    this.clearServerErrors();

    const resourceId = this.resourceId();
    const purpose = this.purpose().trim();
    if (!resourceId || purpose.length === 0 || purpose.length > 250) {
      return;
    }

    const body = {
      resourceType: this.resourceType(),
      resourceId,
      requestedLevel: this.requestedLevel(),
      purpose,
      requestedExpiresAt: this.requestedExpiresAt(),
    };
    const fingerprint = JSON.stringify(body);
    if (this.idemFingerprint !== fingerprint || !this.idemKey) {
      this.idemFingerprint = fingerprint;
      this.idemKey = newIdempotencyKey();
    }

    this.submitting.set(true);
    try {
      const created = await submitAccessRequest(body, this.idemKey);
      this.notify.success(this.transloco.translate('access.toast.requested'));
      this.close();
      this.created.emit(created);
    } catch (error) {
      this.handleSubmitError(error);
    } finally {
      this.submitting.set(false);
    }
  }

  private handleSubmitError(error: unknown): void {
    if (!accessCanRetry(error)) {
      this.idemKey = null;
      this.idemFingerprint = null;
    }
    if (accessReadOnly(error) || accessMismatch(error)) {
      this.readOnly.set(true);
      this.readOnlyChange.emit(true);
    }
    const code = errorCodeOf(error);
    if (accessValidation(this.transloco, error, { resourceId: this.serverResourceError, requestedLevel: this.serverLevelError, requestedExpiresAt: this.serverExpiresError, purpose: this.serverPurposeError })) return;
    const field = errorDetailField(error);
    const message = accessMessage(this.transloco, error);

    if (field === 'resourceId' || code === 'CRM_ACCESS_REQUEST_NOT_FOUND') {
      this.serverResourceError.set(message);
      return;
    }
    if (field === 'purpose') {
      this.serverPurposeError.set(message);
      return;
    }
    if (field === 'requestedExpiresAt' || code === 'CRM_SHARE_EXPIRY_INVALID') {
      this.serverExpiresError.set(message);
      return;
    }
    if (
      field === 'requestedLevel' ||
      code === 'CRM_ACCESS_REQUEST_ALREADY_GRANTED' ||
      code === 'CRM_ACCESS_REQUEST_PENDING_EXISTS' ||
      code === 'CRM_SHARE_MANAGE_NOT_ENABLED'
    ) {
      this.serverLevelError.set(message);
      return;
    }

    this.notify.error(message);
  }

  private clearServerErrors(): void {
    this.serverResourceError.set(null);
    this.serverLevelError.set(null);
    this.serverExpiresError.set(null);
    this.serverPurposeError.set(null);
  }

}
