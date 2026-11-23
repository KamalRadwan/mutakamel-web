import { accessMessage, accessMismatch, accessReadOnly, accessValidation } from '../access-errors';
import { ConflictDialog } from '../../../../../shared/ui/conflict-dialog/conflict-dialog';
import { can } from '../../../../../shared/widgets/dashboard/analytics-permissions';
import { Component, computed, inject, output, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerClipboardCheck,
  tablerX,
} from '@ng-icons/tabler-icons';
import { addDays } from 'date-fns';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { formatDate } from '../../../../../shared/ui/chart/chart-format';
import { DateField } from '../../../../../shared/ui/date-time/date-field';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { Segmented, SegmentedOption } from '../../../../../shared/ui/segmented/segmented';
import {
  errorCodeOf,
} from '../../../../../shared/widgets/dashboard/analytics-api';
import { errorDetailField } from '../../shared/api-error-details';
import {
  decideAccessRequest,
  getAccessRequest,
  personName,
  resourceLabel,
} from '../access.api';
import type { AccessLevel, AccessRequest } from '../access.model';
import { OrgApi } from '../../../../../shared/widgets/dashboard/org.api';

function formatIsoDay(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

@Component({
  selector: 'app-decide-modal',
  imports: [
    NgIcon,
    TranslocoPipe,
    Button,
    ConflictDialog,
    DateField,
    Dropdown,
    Field,
    Modal,
    Segmented,
  ],
  viewProviders: [provideTranslocoScope({ scope: 'crm-access', alias: 'access' }, { scope: 'analytics', alias: 'analytics' })],
  providers: [
    provideIcons({
      tablerClipboardCheck,
      tablerX,
    }),
  ],
  templateUrl: './decide-modal.html',
})
export class DecideModal {
  private readonly org = inject(OrgApi);
  private static nextId = 0;
  protected readonly uid = `access-decide-${++DecideModal.nextId}`;

  private readonly modal = viewChild.required(Modal);
  protected readonly conflictOpen = signal(false);
  protected readonly readOnly = signal(false);
  readonly readOnlyChange = output<boolean>();
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;

  readonly decided = output<AccessRequest | null>();

  protected readonly request = signal<AccessRequest | null>(null);
  protected readonly decision = signal<'APPROVED' | 'REJECTED'>('APPROVED');
  protected readonly grantedLevel = signal<AccessLevel>('VIEW');
  protected readonly grantedExpiresAt = signal<string | null>(null);
  protected readonly note = signal('');
  protected readonly submitting = signal(false);
  protected readonly submitted = signal(false);
  protected readonly serverGrantedError = signal<string | null>(null);
  protected readonly serverExpiresError = signal<string | null>(null);
  protected readonly serverNoteError = signal<string | null>(null);

  protected readonly minExpiryDate = formatIsoDay(addDays(new Date(this.org.now()), 1));

  protected readonly decisionOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    this.language();
    return [
      { value: 'APPROVED', disabled: this.readOnly(), label: this.transloco.translate('access.decide.approve') },
      { value: 'REJECTED', disabled: this.readOnly(), label: this.transloco.translate('access.decide.reject') },
    ];
  });

  protected readonly grantedLevelOptions = computed<DropdownOption<AccessLevel>[]>(() => {
    this.i18n();
    this.language();
    const req = this.request();
    const viewOpt: DropdownOption<AccessLevel> = {
      value: 'VIEW',
      label: this.transloco.translate('access.level.VIEW'),
    };
    if (!req || req.requestedLevel === 'VIEW') {
      return [viewOpt];
    }
    return [
      viewOpt,
      {
        value: 'EDIT',
        label: this.transloco.translate('access.level.EDIT'),
      },
    ];
  });

  protected readonly requesterLabel = computed(() => {
    const req = this.request();
    return req ? personName(req.requesterUserId, this.language()) : '—';
  });

  protected readonly resourceLabel = computed(() => {
    const req = this.request();
    return req ? resourceLabel(req) : '—';
  });

  protected readonly waitingUntilText = computed(() => {
    const req = this.request();
    return req ? formatDate(req.pendingUntil, this.language()) : '—';
  });

  protected readonly noteError = computed<string | null>(() => {
    this.i18n();
    const srv = this.serverNoteError();
    if (srv) return srv;
    const trimmed = this.note().trim();
    if (trimmed.length > 500) {
      return this.transloco.translate('access.errors.maxLength', { max: 500 });
    }
    if (this.submitted() && this.decision() === 'REJECTED' && trimmed.length === 0) {
      return this.transloco.translate('access.errors.noteRequired');
    }
    return null;
  });

  protected readonly grantedLevelError = computed<string | null>(() => this.serverGrantedError());
  protected readonly expiresError = computed<string | null>(() => this.serverExpiresError());

  open(request: AccessRequest): void {
    if (!can('crm.dashboards.share')) return;
    this.request.set(request);
    this.decision.set('APPROVED');
    this.grantedLevel.set(request.requestedLevel);
    const reqExpiry = request.requestedExpiresAt ?? null;
    this.grantedExpiresAt.set(reqExpiry && reqExpiry >= this.minExpiryDate ? reqExpiry : null);
    this.note.set('');
    this.submitting.set(false);
    this.submitted.set(false);
    this.clearServerErrors();
    this.modal().open();
  }

  protected close(): void {
    this.modal().close();
  }

  protected onModalClosed(): void {
    this.submitting.set(false);
    this.submitted.set(false);
    this.clearServerErrors();
  }

  protected onDecisionChange(next: string | null): void {
    if (next !== 'APPROVED' && next !== 'REJECTED') return;
    this.decision.set(next);
    this.clearServerErrors();
  }

  protected onGrantedLevelChange(level: AccessLevel): void {
    this.grantedLevel.set(level);
    this.serverGrantedError.set(null);
  }

  protected onExpiresChange(value: string | null): void {
    this.grantedExpiresAt.set(value);
    this.serverExpiresError.set(null);
  }

  protected clearExpires(): void {
    if (this.readOnly()) return;
    this.grantedExpiresAt.set(null);
    this.serverExpiresError.set(null);
  }

  protected onNoteInput(event: Event): void {
    this.note.set((event.target as HTMLTextAreaElement).value);
    this.serverNoteError.set(null);
  }

  protected async submit(): Promise<void> {
    const req = this.request();
    if (!req || req.status !== 'PENDING' || this.submitting() || this.readOnly() || !can('crm.dashboards.share')) return;

    this.submitted.set(true);
    this.clearServerErrors();

    const trimmedNote = this.note().trim();
    if (trimmedNote.length > 500) return;
    if (this.decision() === 'REJECTED' && trimmedNote.length === 0) return;

    this.submitting.set(true);
    try {
      const updated = await decideAccessRequest(req.id, {
        revision: req.revision,
        decision: this.decision(),
        ...(this.decision() === 'APPROVED'
          ? {
              grantedLevel: this.grantedLevel(),
              grantedExpiresAt: this.grantedExpiresAt(),
            }
          : {}),
        ...(trimmedNote ? { note: trimmedNote } : {}),
      });
      this.notify.success(
        this.transloco.translate(
          updated.status === 'APPROVED' ? 'access.toast.approved' : 'access.toast.rejected',
        ),
      );
      this.close();
      this.decided.emit(updated);
    } catch (error) {
      await this.handleSubmitError(error, req);
    } finally {
      this.submitting.set(false);
    }
  }

  private async handleSubmitError(error: unknown, current: AccessRequest): Promise<void> {
    if (accessReadOnly(error) || accessMismatch(error)) {
      this.readOnly.set(true);
      this.readOnlyChange.emit(true);
    }
    const code = errorCodeOf(error);
    if (code === 'CRM_ACCESS_REQUEST_EXPIRED') {
      this.notify.warning(accessMessage(this.transloco, error));
      this.close();
      this.decided.emit(null);
      return;
    }

    if (error instanceof Error && code && /_(STALE|CONFLICT)$/.test(code)) {
      this.conflictOpen.set(true);
      return;
    }

    if (accessValidation(this.transloco, error, { grantedLevel: this.serverGrantedError, grantedExpiresAt: this.serverExpiresError, note: this.serverNoteError })) return;
    const field = errorDetailField(error);
    const message = accessMessage(this.transloco, error);

    if (field === 'note' || code === 'CRM_ACCESS_REQUEST_NOTE_REQUIRED') {
      this.serverNoteError.set(message);
      return;
    }
    if (field === 'grantedLevel' || code === 'CRM_ACCESS_REQUEST_GRANT_EXCEEDS_REQUEST') {
      this.serverGrantedError.set(message);
      return;
    }
    if (field === 'grantedExpiresAt' || code === 'CRM_SHARE_EXPIRY_INVALID') {
      this.serverExpiresError.set(message);
      return;
    }

    this.notify.error(message);
  }

  protected async resolveConflict(reload: boolean): Promise<void> {
    this.conflictOpen.set(false);
    const current = this.request();
    if (!current) return;
    try {
      const fresh = await getAccessRequest(current.id);
      if (reload) this.open(fresh);
      else this.request.set({ ...current, revision: fresh.revision, status: fresh.status });
      if (fresh.status !== 'PENDING') this.readOnly.set(true);
      this.decided.emit(fresh);
    } catch (error) { this.notify.error(accessMessage(this.transloco, error)); }
  }

  private clearServerErrors(): void {
    this.serverGrantedError.set(null);
    this.serverExpiresError.set(null);
    this.serverNoteError.set(null);
  }
}
