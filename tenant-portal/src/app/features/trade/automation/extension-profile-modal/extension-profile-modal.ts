import { Component, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { tablerPuzzle } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { ScopeState } from '../../../../core/scope/scope';
import { Button } from '../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Dropdown, type DropdownOption } from '../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../shared/ui/field/field';
import { Modal } from '../../../../shared/ui/modal/modal';
import { ApiError, errorCodeOf } from '../../shared/trade-api';
import { ActionKeys } from '../automation-shared/action-keys';
import { ExtensionFieldModal } from '../extension-field-modal/extension-field-modal';
import { createProfile } from '../extensions.api';
import type { ScopeTarget } from '../automation-fake-actors';
import type { CreateExtensionProfileInput, ExtensionProfile, ExtensionProfileDraftResult } from '../extensions.model';
import { TARGET_CODES, toFieldInput } from '../extensions.registry';

type TargetCode = ExtensionProfile['targetCode'];

const PROFILE_CODE_RE = /^[A-Z][A-Z0-9_]{1,79}$/;

let nextProfileModalId = 0;

@Component({
  selector: 'app-extension-profile-modal',
  imports: [TranslocoPipe, Button, ConfirmDialog, Dropdown, Field, Modal, ExtensionFieldModal],
  providers: [provideIcons({ tablerPuzzle })],
  templateUrl: './extension-profile-modal.html',
})
export class ExtensionProfileModal {
  protected readonly uid = `ext-profile-modal-${++nextProfileModalId}`;

  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;
  private readonly scopeState = inject(ScopeState);
  private readonly notify = inject(Notify);

  private readonly modal = viewChild.required(Modal);
  private readonly firstField = viewChild.required(ExtensionFieldModal);
  private readonly discardDialog = viewChild.required<ConfirmDialog>('discardDialog');

  readonly scopeTarget = input<ScopeTarget>('COMPANY');
  readonly created = output<ExtensionProfileDraftResult>();

  protected readonly code = signal('');
  protected readonly targetCode = signal<TargetCode>('CATALOG_ITEM');
  private readonly initialTarget = signal<TargetCode>('CATALOG_ITEM');
  protected readonly submitted = signal(false);
  protected readonly saving = signal(false);
  private readonly serverCodeError = signal<string | null>(null);

  private allowClose = false;
  private confirmingLeave = false;
  private readonly keys = new ActionKeys();

  protected readonly isBranchScope = computed(() => this.scopeTarget() === 'BRANCH');

  protected readonly scopeDisplay = computed(() => {
    this.i18n();
    const lang = this.language();
    const scope = this.scopeTarget();
    const scopeLabel = this.transloco.translate(`extensions.scope.${scope}`);
    if (scope === 'TENANT') {
      return scopeLabel;
    }
    const comp = this.scopeState.company();
    const compName = lang === 'ar' ? comp.nameAr : comp.nameEn;
    if (scope === 'COMPANY') {
      return `${scopeLabel} · ${compName}`;
    }
    const br = this.scopeState.branch();
    const brName = lang === 'ar' ? br.nameAr : br.nameEn;
    return `${scopeLabel} · ${compName} · ${brName}`;
  });

  protected readonly scopeError = computed<string | null>(() => {
    this.i18n();
    if (!this.isBranchScope()) return null;
    return this.transloco.translate('extensions.create.branchForbidden');
  });

  protected readonly targetOptions = computed<DropdownOption<TargetCode>[]>(() => {
    this.i18n();
    return TARGET_CODES.map((value) => ({
      value,
      label: this.transloco.translate(`extensions.targets.${value}`),
    }));
  });

  protected readonly targetHintText = computed(() => {
    this.i18n();
    return this.transloco.translate(`extensions.targetHints.${this.targetCode()}`);
  });

  protected readonly codeError = computed<string | null>(() => {
    this.i18n();
    const server = this.serverCodeError();
    if (server) return server;
    if (!this.submitted()) return null;
    const raw = this.code().trim();
    if (!raw) {
      return this.transloco.translate('extensions.create.errors.codeRequired');
    }
    if (!PROFILE_CODE_RE.test(raw)) {
      return this.transloco.translate('extensions.create.errors.codePattern');
    }
    return null;
  });

  protected readonly dirty = computed(() => {
    if (this.code() !== '' || this.targetCode() !== this.initialTarget()) return true;
    return this.firstField().isDirty();
  });

  open(initialTarget?: TargetCode): void {
    const resolvedTarget: TargetCode =
      initialTarget && (TARGET_CODES as readonly string[]).includes(initialTarget)
        ? initialTarget
        : 'CATALOG_ITEM';
    this.code.set('');
    this.initialTarget.set(resolvedTarget);
    this.targetCode.set(resolvedTarget);
    this.submitted.set(false);
    this.saving.set(false);
    this.serverCodeError.set(null);
    this.allowClose = false;
    this.keys.done('create');
    this.firstField().reset(resolvedTarget);
    this.modal().open();
  }

  protected onCodeInput(event: Event): void {
    this.code.set((event.target as HTMLInputElement).value);
    this.serverCodeError.set(null);
  }

  protected onTargetChange(next: TargetCode): void {
    this.targetCode.set(next);
    this.serverCodeError.set(null);
  }

  protected async submit(): Promise<void> {
    if (this.saving() || this.isBranchScope()) return;

    this.submitted.set(true);
    this.serverCodeError.set(null);

    const field = this.firstField().validateAndBuild();
    if (this.codeError() || !field) {
      return;
    }

    const scopeTarget = this.scopeTarget();
    if (scopeTarget === 'BRANCH') return;
    const body: CreateExtensionProfileInput = {
      code: this.code().trim(),
      targetCode: this.targetCode(),
      scopeTarget,
      fields: [toFieldInput(field)],
    };

    this.saving.set(true);
    try {
      const created = await createProfile(body, this.keys.for('create', body));
      this.keys.done('create');
      this.notify.success(this.transloco.translate('extensions.create.toastCreated'));
      this.allowClose = true;
      this.modal().close();
      this.created.emit(created);
    } catch (error) {
      const code = errorCodeOf(error);
      if (code === 'TRADE.EXTENSION.DEFINITION_CONFLICT') {
        this.keys.done('create');
        this.serverCodeError.set(this.transloco.translate('extensions.create.errors.codeConflict'));
        return;
      }
      this.notify.error(this.resolveErrorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }

  protected async requestClose(): Promise<void> {
    if (this.saving()) return;
    if (!(await this.confirmLeave())) return;
    this.allowClose = true;
    this.modal().close();
  }

  protected onModalClosed(): void {
    if (!this.allowClose && this.saving()) {
      this.modal().open();
      return;
    }
    if (!this.allowClose && this.dirty()) {
      this.modal().open();
      void this.confirmModalClose();
      return;
    }
    this.allowClose = false;
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

  private resolveErrorMessage(error: unknown): string {
    if (!(error instanceof ApiError)) {
      return this.transloco.translate('extensions.errors.network');
    }
    const reason = error.details?.['reason']?.[0];
    const candidates: string[] = [];
    if (reason) {
      candidates.push(`automation.errors.${error.code}.${reason}`);
      candidates.push(`extensions.errors.${error.code}.${reason}`);
    }
    candidates.push(`automation.errors.${error.code}`);
    candidates.push(`extensions.errors.${error.code}`);
    candidates.push(`tradeShared.errors.${error.code.replaceAll('.', '_')}`);
    for (const key of candidates) {
      const translated = this.transloco.translate(key);
      if (translated !== key) return translated;
    }
    return this.transloco.translate('extensions.errors.generic');
  }
}
