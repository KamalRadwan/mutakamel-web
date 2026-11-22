import { Component, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { tablerGitBranch } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { ScopeState } from '../../../../core/scope/scope';
import { Button } from '../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Field } from '../../../../shared/ui/field/field';
import { Modal } from '../../../../shared/ui/modal/modal';
import { ApiError, newIdempotencyKey } from '../../shared/trade-api';
import { createDefinition } from '../policy.api';
import type { GovernedDefinitionRecord, ScopeTarget } from '../policy.model';
import { ACTIVE_WORKFLOW_KINDS, CODE_PATTERN } from '../policy.registry';

@Component({
  selector: 'app-workflow-modal',
  imports: [TranslocoPipe, Button, ConfirmDialog, Field, Modal],
  providers: [provideIcons({ tablerGitBranch })],
  templateUrl: './workflow-modal.html',
})
export class WorkflowModal {
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly lang = inject(LanguageState).current;
  private readonly notify = inject(Notify);
  private readonly scopeState = inject(ScopeState);
  private readonly modal = viewChild.required(Modal);
  private readonly discardDialog = viewChild.required(ConfirmDialog);

  readonly scope = input<ScopeTarget>('COMPANY');
  readonly created = output<GovernedDefinitionRecord>();

  protected readonly fixedKind = ACTIVE_WORKFLOW_KINDS[0];
  protected readonly code = signal('');
  protected readonly saving = signal(false);
  protected readonly submitted = signal(false);
  protected readonly serverCodeError = signal<string | null>(null);

  private readonly isOpen = signal(false);
  private allowClose = false;
  private reopening = false;
  private idemKey = newIdempotencyKey();

  protected readonly kindDisplay = computed(() => {
    this.i18n();
    return this.transloco.translate(`workflows.kinds.${this.fixedKind}.name`);
  });

  protected readonly scopeDisplay = computed(() => {
    this.i18n();
    const currentLang = this.lang();
    const target = this.scope();
    const level = this.transloco.translate(`governance.scope.${target}`);
    const company = this.scopeState.company();
    const branch = this.scopeState.branch();
    const companyName = currentLang === 'ar' ? company?.nameAr : company?.nameEn;
    const branchName = currentLang === 'ar' ? branch?.nameAr : branch?.nameEn;
    if (target === 'TENANT') return level;
    if (target === 'COMPANY') {
      return companyName ? `${level} · ${companyName}` : level;
    }
    return [level, companyName, branchName].filter(Boolean).join(' · ');
  });

  protected readonly codeError = computed<string | null>(() => {
    this.i18n();
    const serverErr = this.serverCodeError();
    if (serverErr) return serverErr;
    if (!this.submitted()) return null;
    const trimmed = this.code().trim();
    if (!trimmed) return this.transloco.translate('workflows.createModal.codeRequired');
    if (!CODE_PATTERN.test(trimmed)) return this.transloco.translate('workflows.createModal.codeInvalid');
    return null;
  });

  protected readonly dirty = computed(() => this.isOpen() && this.code() !== '');

  open(): void {
    this.code.set('');
    this.saving.set(false);
    this.submitted.set(false);
    this.serverCodeError.set(null);
    this.idemKey = newIdempotencyKey();
    this.allowClose = false;
    this.isOpen.set(true);
    this.modal().open();
  }

  protected onCodeInput(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const upper = inputEl.value.toUpperCase();
    if (inputEl.value !== upper) {
      const pos = inputEl.selectionStart;
      inputEl.value = upper;
      if (pos !== null) inputEl.setSelectionRange(pos, pos);
    }
    this.code.set(upper);
    if (this.serverCodeError()) {
      this.serverCodeError.set(null);
    }
  }

  protected async submit(): Promise<void> {
    if (this.saving()) return;
    this.submitted.set(true);
    this.serverCodeError.set(null);
    const trimmed = this.code().trim();
    if (!trimmed || !CODE_PATTERN.test(trimmed)) return;

    this.saving.set(true);
    try {
      const def = await createDefinition(
        'workflow',
        { code: trimmed, workflowKind: this.fixedKind, scopeTarget: this.scope() },
        { idempotencyKey: this.idemKey },
      );
      this.notify.success(this.transloco.translate('workflows.createModal.createdToast'));
      this.allowClose = true;
      this.isOpen.set(false);
      this.created.emit(def);
      this.modal().close();
    } catch (err) {
      if (err instanceof ApiError) {
        this.idemKey = newIdempotencyKey();
        if (err.code === 'TRADE.POLICY.CODE_TAKEN') {
          this.serverCodeError.set(this.transloco.translate('workflows.createModal.codeTaken'));
          return;
        }
        const reason = err.details?.['reason']?.[0];
        if (reason) {
          const reasonKey = `governance.errors.${err.code.replaceAll('.', '_')}_${reason}`;
          const reasonMsg = this.transloco.translate(reasonKey);
          if (reasonMsg !== reasonKey) {
            this.notify.error(reasonMsg);
            return;
          }
        }
        const codeKey = `governance.errors.${err.code.replaceAll('.', '_')}`;
        const codeMsg = this.transloco.translate(codeKey);
        this.notify.error(codeMsg !== codeKey ? codeMsg : this.transloco.translate('tradeShared.errors.generic'));
      } else {
        this.notify.error(this.transloco.translate('tradeShared.errors.network'));
      }
    } finally {
      this.saving.set(false);
    }
  }

  protected async requestClose(): Promise<void> {
    if (this.saving()) return;
    if (!this.dirty()) {
      this.allowClose = true;
      this.isOpen.set(false);
      this.modal().close();
      return;
    }
    const ok = await this.discardDialog().open();
    if (ok) {
      this.allowClose = true;
      this.isOpen.set(false);
      this.modal().close();
    }
  }

  protected onModalClosed(): void {
    if (this.reopening) return;
    if (this.allowClose) {
      this.allowClose = false;
      this.isOpen.set(false);
      return;
    }
    if (this.dirty()) {
      void this.confirmDiscardAfterClose();
    } else {
      this.isOpen.set(false);
    }
  }

  private async confirmDiscardAfterClose(): Promise<void> {
    const ok = await this.discardDialog().open();
    if (ok) {
      this.isOpen.set(false);
      return;
    }
    this.reopening = true;
    this.modal().open();
    queueMicrotask(() => {
      this.reopening = false;
    });
  }
}
