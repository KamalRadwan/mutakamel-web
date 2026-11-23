import { Component, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { tablerShieldCheck } from '@ng-icons/tabler-icons';
import { Notify } from '../../../../core/notify/notify';
import { ScopeState } from '../../../../core/scope/scope';
import { Button } from '../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Dropdown, type DropdownOption } from '../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../shared/ui/field/field';
import { Modal } from '../../../../shared/ui/modal/modal';
import { ApiError, type TradeContext, errorCodeOf, newIdempotencyKey } from '../../shared/trade-api';
import { createDefinition } from '../policy.api';
import type { GovernedDefinitionRecord, ScopeTarget } from '../policy.model';
import { ACTIVE_POLICY_KINDS, CODE_PATTERN, type PolicyKind } from '../policy.registry';
import { isForbiddenError } from '../pricing.service';

@Component({
  selector: 'app-policy-modal',
  imports: [TranslocoPipe, Button, ConfirmDialog, Dropdown, Field, Modal],
  providers: [provideIcons({ tablerShieldCheck })],
  templateUrl: './policy-modal.html',
})
export class PolicyModal {
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly notify = inject(Notify);
  private readonly scopeState = inject(ScopeState);
  private readonly modal = viewChild.required(Modal);
  private readonly discardDialog = viewChild.required(ConfirmDialog);

  readonly kinds = input<readonly PolicyKind[]>(ACTIVE_POLICY_KINDS);
  readonly scope = input<ScopeTarget>('COMPANY');
  readonly ctx = input<TradeContext>({});
  readonly created = output<GovernedDefinitionRecord>();
  readonly forbidden = output<void>();

  protected readonly code = signal('');
  protected readonly kind = signal<PolicyKind>('PRICING_GUARD');
  protected readonly saving = signal(false);
  protected readonly submitted = signal(false);
  protected readonly serverCodeError = signal<string | null>(null);

  private readonly isOpen = signal(false);
  private initialKind: PolicyKind = 'PRICING_GUARD';
  private allowClose = false;
  private reopening = false;
  private idemKey = newIdempotencyKey();

  protected readonly kindOptions = computed<DropdownOption<PolicyKind>[]>(() => {
    this.i18n();
    return this.kinds().map((k) => ({
      value: k,
      label: this.transloco.translate(`policy.kinds.${k}.name`),
    }));
  });

  protected readonly kindDescription = computed(() => {
    this.i18n();
    return this.transloco.translate(`policy.kinds.${this.kind()}.desc`);
  });

  protected readonly scopeDisplay = computed(() => {
    this.i18n();
    const target = this.scope();
    const level = this.transloco.translate(`governance.scope.${target}`);
    const ar = this.transloco.getActiveLang() === 'ar';
    const companyName = ar ? this.scopeState.company()?.nameAr : this.scopeState.company()?.nameEn;
    const branchName = ar ? this.scopeState.branch()?.nameAr : this.scopeState.branch()?.nameEn;
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
    if (!trimmed) return this.transloco.translate('policy.createModal.codeRequired');
    if (!CODE_PATTERN.test(trimmed)) return this.transloco.translate('policy.createModal.codeInvalid');
    return null;
  });

  protected readonly dirty = computed(
    () => this.isOpen() && (this.code() !== '' || this.kind() !== this.initialKind),
  );

  open(): void {
    const defaultKind = this.kinds()[0] ?? 'PRICING_GUARD';
    this.initialKind = defaultKind;
    this.code.set('');
    this.kind.set(defaultKind);
    this.saving.set(false);
    this.submitted.set(false);
    this.serverCodeError.set(null);
    this.idemKey = newIdempotencyKey();
    this.allowClose = false;
    this.isOpen.set(true);
    this.modal().open();
  }

  protected onCodeInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const upper = input.value.toUpperCase();
    if (input.value !== upper) {
      const pos = input.selectionStart;
      input.value = upper;
      if (pos !== null) input.setSelectionRange(pos, pos);
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
        'policy',
        { code: trimmed, policyKind: this.kind(), scopeTarget: this.scope() },
        { idempotencyKey: this.idemKey, ctx: this.ctx() },
      );
      this.notify.success(this.transloco.translate('policy.createModal.createdToast'));
      this.allowClose = true;
      this.isOpen.set(false);
      this.created.emit(def);
      this.modal().close();
    } catch (err) {
      if (isForbiddenError(err)) {
        this.allowClose = true;
        this.isOpen.set(false);
        this.modal().close();
        this.forbidden.emit();
        return;
      }
      if (err instanceof ApiError) {
        this.idemKey = newIdempotencyKey();
        const apiCode = errorCodeOf(err);
        if (apiCode === 'TRADE.POLICY.CODE_TAKEN') {
          this.serverCodeError.set(this.transloco.translate('policy.createModal.codeTaken'));
          return;
        }
        const key = `governance.errors.${(apiCode ?? '').replaceAll('.', '_')}`;
        const translated = this.transloco.translate(key);
        this.notify.error(
          translated !== key ? translated : this.transloco.translate('tradeShared.errors.generic'),
        );
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
