import { Component, computed, inject, output, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { tablerPlus } from '@ng-icons/tabler-icons';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { Checkbox } from '../../../../../shared/ui/checkbox/checkbox';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { Switch } from '../../../../../shared/ui/switch/switch';
import { TagOption, TagPicker } from '../../../../../shared/ui/tag-picker/tag-picker';
import { ApiError, errorCodeOf, errorKey, newIdempotencyKey } from '../../../shared/trade-api';
import { isForbiddenError, isIdempotencyMismatch } from '../configuration-access';
import { createDefinition } from '../configuration.api';
import {
  type CreatedConfigDefinition,
  type MergeStrategy,
  RISK_CLASSES,
  type RiskClass,
  type ScopeTarget,
  type ValueSchema,
} from '../configuration.model';
import { allowedMergesForSchema, stableJson } from '../value-schema';

type CreateValueType = 'boolean' | 'integer' | 'number' | 'string' | 'choiceList';

const KEY_PATTERN = /^trade\.[a-z0-9][a-z0-9_.-]{1,110}$/;

@Component({
  selector: 'app-config-definition-create-modal',
  imports: [TranslocoPipe, Modal, Field, Dropdown, Switch, Checkbox, TagPicker, Button, ConfirmDialog],
  providers: [provideIcons({ tablerPlus })],
  templateUrl: './definition-create-modal.html',
})
export class DefinitionCreateModal {
  private static nextId = 0;
  protected readonly uid = `cfg-create-${++DefinitionCreateModal.nextId}`;

  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly notify = inject(Notify);

  private readonly modal = viewChild.required(Modal);
  private readonly discardDialog = viewChild.required<ConfirmDialog>('discardDialog');

  readonly created = output<CreatedConfigDefinition>();
  readonly forbidden = output<void>();

  protected readonly keyValue = signal('');
  protected readonly valueType = signal<CreateValueType>('integer');
  protected readonly minText = signal('');
  protected readonly maxText = signal('');
  protected readonly maxLengthText = signal('');
  protected readonly choices = signal<string[]>([]);
  protected readonly choiceOptions = signal<TagOption[]>([]);
  protected readonly severalChoices = signal(false);
  protected readonly allowTenant = signal(true);
  protected readonly allowCompany = signal(true);
  protected readonly allowBranch = signal(true);
  protected readonly mergeStrategy = signal<MergeStrategy>('OVERRIDE');
  protected readonly riskClass = signal<RiskClass>('LOW');
  protected readonly requireCompanyBaseline = signal(false);

  protected readonly saving = signal(false);
  protected readonly attemptedSubmit = signal(false);
  protected readonly keyTakenError = signal(false);
  private readonly serverKeyError = signal<string | null>(null);

  private isOpen = false;
  private allowClose = false;
  private confirmingLeave = false;
  private initialFingerprint = '';
  private lastSubmitFingerprint = '';
  private lastIdempotencyKey = '';

  protected readonly createChoiceTagFn = (name: string) => this.createChoiceTag(name);

  protected readonly typeOptions = computed<DropdownOption<CreateValueType>[]>(() => {
    this.i18n();
    return [
      { value: 'boolean', label: this.transloco.translate('tradeConfig.type.boolean') },
      { value: 'integer', label: this.transloco.translate('tradeConfig.type.integer') },
      { value: 'number', label: this.transloco.translate('tradeConfig.type.number') },
      { value: 'string', label: this.transloco.translate('tradeConfig.type.string') },
      { value: 'choiceList', label: this.transloco.translate('tradeConfig.type.choiceList') },
    ];
  });

  protected readonly riskOptions = computed<DropdownOption<RiskClass>[]>(() => {
    this.i18n();
    return RISK_CLASSES.map((risk) => ({
      value: risk,
      label: this.transloco.translate(`tradeConfig.risk.${risk}`),
    }));
  });

  protected readonly currentSchema = computed<ValueSchema>(() => this.buildSchema());

  protected readonly mergeOptions = computed<DropdownOption<MergeStrategy>[]>(() => {
    this.i18n();
    return allowedMergesForSchema(this.currentSchema()).map((merge) => ({
      value: merge,
      label: this.transloco.translate(`tradeConfig.merge.${merge}`),
    }));
  });

  protected readonly keyError = computed<string | null>(() => {
    this.i18n();
    if (this.keyTakenError()) {
      return this.transloco.translate('tradeConfig.createModal.keyTaken');
    }
    const serverErr = this.serverKeyError();
    if (serverErr) return serverErr;
    if (!this.attemptedSubmit()) return null;
    const normalized = this.keyValue().trim().toLowerCase();
    if (!KEY_PATTERN.test(normalized)) {
      return this.transloco.translate('tradeConfig.createModal.keyInvalid');
    }
    return null;
  });

  protected readonly minError = computed<string | null>(() => {
    this.i18n();
    if (!this.attemptedSubmit()) return null;
    const vt = this.valueType();
    if (vt !== 'integer' && vt !== 'number') return null;
    const raw = this.minText().trim();
    if (!raw) return null;
    const num = Number(raw);
    if (!Number.isFinite(num) || (vt === 'integer' && !Number.isSafeInteger(num))) {
      return this.transloco.translate('tradeConfig.createModal.minInvalid');
    }
    return null;
  });

  protected readonly maxError = computed<string | null>(() => {
    this.i18n();
    if (!this.attemptedSubmit()) return null;
    const vt = this.valueType();
    if (vt !== 'integer' && vt !== 'number') return null;
    const rawMax = this.maxText().trim();
    if (!rawMax) return null;
    const maxNum = Number(rawMax);
    if (!Number.isFinite(maxNum) || (vt === 'integer' && !Number.isSafeInteger(maxNum))) {
      return this.transloco.translate('tradeConfig.createModal.maxInvalid');
    }
    const rawMin = this.minText().trim();
    if (rawMin) {
      const minNum = Number(rawMin);
      if (Number.isFinite(minNum) && minNum > maxNum) {
        return this.transloco.translate('tradeConfig.createModal.rangeInvalid');
      }
    }
    return null;
  });

  protected readonly maxLengthError = computed<string | null>(() => {
    this.i18n();
    if (!this.attemptedSubmit() || this.valueType() !== 'string') return null;
    const raw = this.maxLengthText().trim();
    if (!raw) return null;
    const num = Number(raw);
    if (!Number.isSafeInteger(num) || num < 1 || num > 2000) {
      return this.transloco.translate('tradeConfig.createModal.maxLengthInvalid');
    }
    return null;
  });

  protected readonly choicesError = computed<string | null>(() => {
    this.i18n();
    if (!this.attemptedSubmit() || this.valueType() !== 'choiceList') return null;
    if (this.choices().length === 0) {
      return this.transloco.translate('tradeConfig.createModal.choicesRequired');
    }
    return null;
  });

  protected readonly scopesError = computed<string | null>(() => {
    this.i18n();
    if (!this.attemptedSubmit()) return null;
    if (!this.allowTenant() && !this.allowCompany() && !this.allowBranch()) {
      return this.transloco.translate('tradeConfig.createModal.scopesRequired');
    }
    return null;
  });

  protected readonly dirty = computed(() => {
    if (!this.isOpen) return false;
    return this.snapshotFingerprint() !== this.initialFingerprint;
  });

  open(): void {
    this.keyValue.set('');
    this.valueType.set('integer');
    this.minText.set('');
    this.maxText.set('');
    this.maxLengthText.set('');
    this.choices.set([]);
    this.choiceOptions.set([]);
    this.severalChoices.set(false);
    this.allowTenant.set(true);
    this.allowCompany.set(true);
    this.allowBranch.set(true);
    this.mergeStrategy.set('OVERRIDE');
    this.riskClass.set('LOW');
    this.requireCompanyBaseline.set(false);
    this.saving.set(false);
    this.attemptedSubmit.set(false);
    this.keyTakenError.set(false);
    this.serverKeyError.set(null);
    this.allowClose = false;
    this.lastSubmitFingerprint = '';
    this.lastIdempotencyKey = '';
    this.isOpen = true;
    this.initialFingerprint = this.snapshotFingerprint();
    this.modal().open();
  }

  protected onKeyInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value.toLowerCase();
    this.keyValue.set(raw);
    this.keyTakenError.set(false);
    this.serverKeyError.set(null);
  }

  protected onValueTypeChange(nextType: CreateValueType): void {
    this.valueType.set(nextType);
    this.syncMergeToSchema();
  }

  protected onSeveralChoicesChange(checked: boolean): void {
    this.severalChoices.set(checked);
    this.syncMergeToSchema();
  }

  protected onMinInput(event: Event): void {
    this.minText.set((event.target as HTMLInputElement).value);
  }

  protected onMaxInput(event: Event): void {
    this.maxText.set((event.target as HTMLInputElement).value);
  }

  protected onMaxLengthInput(event: Event): void {
    this.maxLengthText.set((event.target as HTMLInputElement).value);
  }

  protected describedBy(suffix: string, hasError: boolean): string {
    const base = `${this.uid}-${suffix}-hint`;
    return hasError ? `${base} ${this.uid}-${suffix}-error` : base;
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
    this.isOpen = false;
    this.allowClose = false;
    this.saving.set(false);
    this.attemptedSubmit.set(false);
    this.keyTakenError.set(false);
    this.serverKeyError.set(null);
  }

  protected async submit(): Promise<void> {
    if (this.saving()) return;
    this.attemptedSubmit.set(true);
    this.keyTakenError.set(false);
    this.serverKeyError.set(null);

    if (
      this.keyError() ||
      this.minError() ||
      this.maxError() ||
      this.maxLengthError() ||
      this.choicesError() ||
      this.scopesError()
    ) {
      return;
    }

    const allowedScopes: ScopeTarget[] = [];
    if (this.allowTenant()) allowedScopes.push('TENANT');
    if (this.allowCompany()) allowedScopes.push('COMPANY');
    if (this.allowBranch()) allowedScopes.push('BRANCH');

    const body = {
      key: this.keyValue().trim().toLowerCase(),
      valueSchema: this.buildSchema(),
      allowedScopes,
      mergeStrategy: this.mergeStrategy(),
      riskClass: this.riskClass(),
      companyLockPolicy: this.allowBranch()
        ? { requireCompanyBaseline: this.requireCompanyBaseline() }
        : {},
    };

    const fingerprint = stableJson(body);
    if (fingerprint !== this.lastSubmitFingerprint || !this.lastIdempotencyKey) {
      this.lastSubmitFingerprint = fingerprint;
      this.lastIdempotencyKey = newIdempotencyKey();
    }

    this.saving.set(true);
    try {
      const result = await createDefinition(body, this.lastIdempotencyKey);
      this.lastSubmitFingerprint = '';
      this.lastIdempotencyKey = '';
      this.notify.success(this.transloco.translate('tradeConfig.toasts.definitionCreated'));
      this.allowClose = true;
      this.modal().close();
      this.created.emit(result);
    } catch (error) {
      if (isForbiddenError(error)) {
        this.saving.set(false);
        this.allowClose = true;
        this.modal().close();
        this.forbidden.emit();
        return;
      }
      const code = errorCodeOf(error);
      if (isIdempotencyMismatch(code)) {
        this.lastSubmitFingerprint = '';
        this.lastIdempotencyKey = '';
      }
      if (code === 'TRADE.CONFIGURATION.KEY_TAKEN') {
        this.keyTakenError.set(true);
      } else if (code === 'TRADE.VALIDATION_FAILED') {
        this.attemptedSubmit.set(true);
        if (error instanceof ApiError && error.details?.['key']?.length) {
          this.serverKeyError.set(this.transloco.translate('tradeConfig.createModal.keyInvalid'));
        } else {
          this.notify.error(this.transloco.translate(errorKey(error)));
        }
      } else {
        this.notify.error(this.transloco.translate(errorKey(error)));
      }
    } finally {
      this.saving.set(false);
    }
  }

  private async createChoiceTag(name: string): Promise<TagOption> {
    const trimmed = name.trim();
    const opt: TagOption = { id: trimmed, name: trimmed, backgroundColor: null, textColor: null };
    this.choiceOptions.update((list) => [...list.filter((item) => item.id !== opt.id), opt]);
    return opt;
  }

  private syncMergeToSchema(): void {
    const allowed = allowedMergesForSchema(this.buildSchema());
    if (!allowed.includes(this.mergeStrategy())) {
      this.mergeStrategy.set('OVERRIDE');
    }
  }

  private buildSchema(): ValueSchema {
    const vt = this.valueType();
    switch (vt) {
      case 'boolean':
        return { type: 'boolean' };
      case 'integer':
      case 'number': {
        const schema: ValueSchema = { type: vt };
        const minRaw = this.minText().trim();
        const maxRaw = this.maxText().trim();
        if (minRaw && Number.isFinite(Number(minRaw))) {
          schema.minimum = Number(minRaw);
        }
        if (maxRaw && Number.isFinite(Number(maxRaw))) {
          schema.maximum = Number(maxRaw);
        }
        return schema;
      }
      case 'string': {
        const schema: ValueSchema = { type: 'string', minLength: 0 };
        const maxLenRaw = this.maxLengthText().trim();
        if (maxLenRaw && Number.isSafeInteger(Number(maxLenRaw))) {
          schema.maxLength = Number(maxLenRaw);
        }
        return schema;
      }
      case 'choiceList': {
        const enumValues = [...this.choices()];
        if (this.severalChoices()) {
          return {
            type: 'array',
            items: { type: 'string', enum: enumValues },
            minItems: 1,
            maxItems: Math.max(1, enumValues.length),
          };
        }
        return {
          type: 'string',
          enum: enumValues,
        };
      }
    }
  }

  private snapshotFingerprint(): string {
    return stableJson({
      key: this.keyValue(),
      valueType: this.valueType(),
      min: this.minText(),
      max: this.maxText(),
      maxLength: this.maxLengthText(),
      choices: this.choices(),
      severalChoices: this.severalChoices(),
      allowTenant: this.allowTenant(),
      allowCompany: this.allowCompany(),
      allowBranch: this.allowBranch(),
      merge: this.mergeStrategy(),
      risk: this.riskClass(),
      lock: this.requireCompanyBaseline(),
    });
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
