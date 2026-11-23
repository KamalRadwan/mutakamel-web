import { Component, ElementRef, Injector, afterNextRender, computed, inject, output, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { tablerThumbDown } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { Button } from '../../../../shared/ui/button/button';
import { Dropdown, DropdownOption } from '../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../shared/ui/field/field';
import { Modal } from '../../../../shared/ui/modal/modal';
import { listReasons } from '../../settings/reasons/reasons.api';
import { ApiError } from '../../settings/shared/settings-api';
import { leadErrorState } from '../lead-list';
import { Notify } from '../../../../core/notify/notify';
import { moveLead } from '../leads.api';
import { LeadDetail, LeadStage, MoveErrorCode, nameIn } from '../leads.model';

interface Reason {
  id: string;
  nameEn: string;
  nameAr: string;
}

interface Request {
  leadId: string;
  leadName: string;
  stage: LeadStage;
  resolve: (saved: LeadDetail | null) => void;
  reject: (error: unknown) => void;
}

/** The move errors the dialog shows on its reason field; any other error closes it and goes to the caller. */
const REASON_ERRORS: readonly MoveErrorCode[] = ['CRM_REASON_REQUIRED', 'CRM_REASON_UNAVAILABLE', 'CRM_REASON_KIND_MISMATCH'];

export function reasonErrorCode(error: unknown): MoveErrorCode | null {
  return error instanceof ApiError && REASON_ERRORS.includes(error.code as MoveErrorCode) ? error.code as MoveErrorCode : null;
}

/**
 * Single-lead move into a Disqualified stage: pick an active DISQUALIFICATION reason, then
 * POST /leads/:id/stage { stageId, disqualificationReasonId }. Resolves with the saved lead, or null on cancel.
 */
@Component({
  selector: 'app-lead-disqualify',
  imports: [TranslocoPipe, Button, Dropdown, Field, Modal],
  providers: [provideIcons({ tablerThumbDown })],
  templateUrl: './lead-disqualify.html',
  host: { class: 'contents' },
})
export class LeadDisqualify {
  readonly writeBlocked = output<void>();
  protected readonly readOnly = signal(false);
  private static nextId = 0;
  protected readonly reasonId = `lead-disqualify-${++LeadDisqualify.nextId}-reason`;

  private readonly transloco = inject(TranslocoService);
  private readonly notify = inject(Notify);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;
  private readonly modal = viewChild.required(Modal);
  private readonly injector = inject(Injector);
  /** Holds focus while the reasons load, so the field's "!" hint (first focusable) never opens on top of the subtitle. */
  private readonly focusStart = viewChild.required<ElementRef<HTMLElement>>('focusStart');
  private focusReasonPending = false;

  protected readonly request = signal<Request | null>(null);
  protected readonly reasons = signal<Reason[]>([]);
  protected readonly reasonsLoading = signal(false);
  protected readonly reasonsUnavailable = signal(false);
  protected readonly selectedReasonId = signal('');
  protected readonly submitting = signal(false);
  protected readonly errorCode = signal<MoveErrorCode | null>(null);
  private loadSeq = 0;

  protected readonly stageName = computed(() => {
    const stage = this.request()?.stage;
    return stage ? nameIn(stage, this.language()) : '';
  });

  /** Lead name isolated (FSI/PDI) so a mixed-script name cannot reorder the arrow and stage. */
  protected readonly subtitle = computed(() => {
    const name = this.request()?.leadName;
    if (!name) return '';
    const arrow = this.language() === 'ar' ? '←' : '→';
    return `⁨${name}⁩ ${arrow} ${this.stageName()}`;
  });

  protected readonly reasonOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const lang = this.language();
    return [
      { value: '', label: this.transloco.translate('leads.disqualify.choose') },
      ...this.reasons().map((reason) => ({ value: reason.id, label: nameIn(reason, lang) })),
    ];
  });

  protected readonly noReasons = computed(() => !this.reasonsLoading() && this.reasons().length === 0);

  protected readonly reasonError = computed<string | null>(() => {
    this.i18n();
    const code = this.errorCode();
    return code ? this.transloco.translate(`leads.move.errors.${code}`, { stage: this.stageName() }) : null;
  });

  protected readonly describedBy = computed(
    () => `${this.reasonId}-hint${this.reasonError() ? ` ${this.reasonId}-error` : ''}`,
  );

  open(lead: { id: string; displayName: string }, stage: LeadStage): Promise<LeadDetail | null> {
    this.request()?.resolve(null);
    return new Promise((resolve, reject) => {
      this.request.set({ leadId: lead.id, leadName: lead.displayName, stage, resolve, reject });
      this.selectedReasonId.set('');
      this.errorCode.set(null);
      this.submitting.set(false);
      this.readOnly.set(false);
      this.modal().open();
      this.focusStart().nativeElement.focus();
      this.focusReasonPending = true;
      void this.loadReasons();
    });
  }

  protected onReasonChange(reasonId: string): void {
    this.selectedReasonId.set(reasonId);
    this.errorCode.set(null);
  }

  protected async confirm(): Promise<void> {
    const req = this.request();
    if (!req || this.readOnly() || this.submitting() || this.reasonsLoading() || this.reasonsUnavailable() || this.noReasons()) return;
    const reasonId = this.selectedReasonId();
    if (!reasonId) {
      this.errorCode.set('CRM_REASON_REQUIRED');
      return;
    }
    this.submitting.set(true);
    this.errorCode.set(null);
    try {
      const saved = await moveLead(req.leadId, req.stage.id, reasonId);
      this.finish(req, () => req.resolve(saved));
    } catch (error) {
      const code = reasonErrorCode(error);
      if (!code) {
        if (error instanceof ApiError && (error.status === 404 || error.code === 'LEAD_ALREADY_CONVERTED')) {
          this.finish(req, () => req.reject(error));
          return;
        }
        const mapped = leadErrorState(this.transloco, error);
        if (mapped.readOnly) { this.readOnly.set(true); this.writeBlocked.emit(); }
        this.notify.error(error instanceof ApiError && error.status === 401 ? this.transloco.translate('leads.notSaved') : mapped.message);
        return;
      }
      if (this.request() !== req) return;
      this.errorCode.set(code);
      if (code === 'CRM_REASON_UNAVAILABLE') {
        this.selectedReasonId.set('');
        void this.loadReasons();
      }
    } finally {
      if (this.request() === req) this.submitting.set(false);
    }
  }

  protected cancel(): void {
    if (this.submitting()) return;
    this.modal().close();
  }

  /** The modal closed by Cancel, the header close, Escape or the backdrop. */
  protected onClosed(): void {
    const req = this.request();
    if (!req) return;
    this.request.set(null);
    req.resolve(null);
  }

  private finish(req: Request, settle: () => void): void {
    if (this.request() !== req) return;
    this.request.set(null);
    this.modal().close();
    settle();
  }

  private async loadReasons(): Promise<void> {
    const seq = ++this.loadSeq;
    this.reasonsLoading.set(true);
    this.reasonsUnavailable.set(false);
    this.reasons.set([]);
    try {
      const list = await listReasons({ kind: 'DISQUALIFICATION', active: 'true' });
      if (seq === this.loadSeq) this.reasons.set(list.items);
    } catch {
      if (seq === this.loadSeq) this.reasonsUnavailable.set(true);
    } finally {
      if (seq === this.loadSeq) {
        this.reasonsLoading.set(false);
        this.focusReasonWhenReady();
      }
    }
  }

  /** Initial focus goes to the reason dropdown once it renders, unless the user has already moved focus. */
  private focusReasonWhenReady(): void {
    if (!this.focusReasonPending) return;
    this.focusReasonPending = false;
    afterNextRender(
      () => {
        const start = this.focusStart().nativeElement;
        if (!this.request() || document.activeElement !== start) return;
        const trigger = start.querySelector<HTMLButtonElement>(`#${this.reasonId}`);
        if (trigger && !trigger.disabled) trigger.focus();
      },
      { injector: this.injector },
    );
  }
}
