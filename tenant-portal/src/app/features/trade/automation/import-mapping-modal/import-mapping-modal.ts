import { Component, computed, inject, output, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { tablerTable } from '@ng-icons/tabler-icons';
import { Notify } from '../../../../core/notify/notify';
import { ScopeState } from '../../../../core/scope/scope';
import { Button } from '../../../../shared/ui/button/button';
import { Dropdown, type DropdownOption } from '../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../shared/ui/field/field';
import { Modal } from '../../../../shared/ui/modal/modal';
import { Segmented, type SegmentedOption } from '../../../../shared/ui/segmented/segmented';
import { ApiError } from '../../shared/trade-api';
import { ActionKeys } from '../automation-shared/action-keys';
import { createMapping } from '../imports.api';
import type { CreateImportMappingInput, ImportMapping, MappingFieldInput } from '../imports.model';
import {
  IMPORT_TARGETS,
  MAPPING_CODE_PATTERN,
  type ImportLookupCode,
  type ImportTargetCode,
  type ImportTransformCode,
} from '../imports.registry';
import {
  defaultTransformForField,
  englishSourceColumnName,
  getTargetFields,
  translateImportError,
} from '../mapping-rows/mapping-rows';

let nextMappingModalSeq = 0;

@Component({
  selector: 'app-import-mapping-modal',
  imports: [TranslocoPipe, Button, Dropdown, Field, Modal, Segmented],
  providers: [provideIcons({ tablerTable })],
  templateUrl: './import-mapping-modal.html',
})
export class ImportMappingModal {
  private readonly modal = viewChild.required(Modal);
  private readonly scopeState = inject(ScopeState);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly keys = new ActionKeys();
  private readonly i18n = translationEvents(this.transloco);

  protected readonly uid = `import-mapping-modal-${++nextMappingModalSeq}`;
  protected readonly targetCodes: ImportTargetCode[] = IMPORT_TARGETS.map((t) => t.code);

  readonly created = output<ImportMapping>();

  protected readonly code = signal('');
  protected readonly targetCode = signal<ImportTargetCode>(this.targetCodes[0]);
  protected readonly level = signal<'COMPANY' | 'BRANCH'>('COMPANY');
  protected readonly submitted = signal(false);
  protected readonly saving = signal(false);
  protected readonly codeConflictError = signal<string | null>(null);

  protected readonly hasBranch = computed(() => !!this.scopeState.branch()?.id);

  protected readonly targetOptions = computed<DropdownOption<ImportTargetCode>[]>(() => {
    this.i18n();
    return this.targetCodes.map((value) => ({
      value,
      label: this.transloco.translate(`imports.targets.${value}.label`),
    }));
  });

  protected readonly targetHintText = computed(() => {
    this.i18n();
    const key = `imports.targets.${this.targetCode()}.hint`;
    const text = this.transloco.translate(key);
    return text && text !== key ? text : null;
  });

  protected readonly levelOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    const options: SegmentedOption[] = [
      { value: 'COMPANY', label: this.transloco.translate('imports.mappingModal.levelCompany') },
    ];
    if (this.hasBranch()) {
      options.push({ value: 'BRANCH', label: this.transloco.translate('imports.mappingModal.levelBranch') });
    }
    return options;
  });

  protected readonly codeError = computed<string | null>(() => {
    this.i18n();
    if (this.codeConflictError()) return this.codeConflictError();
    if (!this.submitted()) return null;
    const trimmed = this.code().trim();
    if (!trimmed) return this.transloco.translate('imports.mappingModal.codeRequired');
    if (!MAPPING_CODE_PATTERN.test(trimmed)) return this.transloco.translate('imports.mappingModal.codePattern');
    return null;
  });

  open(): void {
    this.code.set('');
    this.targetCode.set(this.targetCodes[0]);
    this.level.set('COMPANY');
    this.submitted.set(false);
    this.saving.set(false);
    this.codeConflictError.set(null);
    this.modal().open();
  }

  close(): void {
    this.modal().close();
  }

  protected onCodeInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.code.set(value);
    if (this.codeConflictError()) {
      this.codeConflictError.set(null);
    }
  }

  protected onLevelChange(value: string | null): void {
    this.level.set(value === 'BRANCH' && this.hasBranch() ? 'BRANCH' : 'COMPANY');
  }

  protected async submit(): Promise<void> {
    this.submitted.set(true);
    this.codeConflictError.set(null);
    const trimmedCode = this.code().trim();
    if (!trimmedCode || !MAPPING_CODE_PATTERN.test(trimmedCode) || this.saving()) return;

    const target = this.targetCode();
    const targetFields = getTargetFields(target);
    const requiredOnly = targetFields.filter((f) => f.required);
    const seedFields = requiredOnly.length > 0 ? requiredOnly : targetFields.slice(0, 1);

    const fields: MappingFieldInput[] = seedFields.map((field, index) => ({
      sourceColumnCode: englishSourceColumnName(field.code),
      sourceOrdinal: index,
      targetFieldCode: field.code,
      transformCode: defaultTransformForField(field) as ImportTransformCode,
      ...(field.lookupCode ? { lookupCode: field.lookupCode as ImportLookupCode } : {}),
      isRequired: true,
    }));

    const selectedLevel = this.level() === 'BRANCH' && this.hasBranch() ? 'BRANCH' : 'COMPANY';
    const branchId = selectedLevel === 'BRANCH' ? this.scopeState.branch()?.id : undefined;

    this.saving.set(true);
    try {
      const body: CreateImportMappingInput = {
        code: trimmedCode,
        targetCode: target,
        scopeTarget: selectedLevel,
        ...(branchId ? { branchId } : {}),
        executionMode: 'PER_ROW',
        fields,
      };
      const mapping = await createMapping(body, this.keys.for('create', body));
      this.keys.done('create');
      this.notify.success(this.transloco.translate('imports.mappingModal.createdToast'));
      this.modal().close();
      this.created.emit(mapping);
    } catch (error) {
      // The backend reports a taken code as 422 MAPPING_INVALID; the seeded columns are always valid here.
      if (error instanceof ApiError && error.status === 422 && error.code === 'TRADE.IMPORT.MAPPING_INVALID') {
        this.keys.done('create');
        this.codeConflictError.set(this.transloco.translate('imports.mappingModal.codeConflict'));
      } else {
        this.notify.error(translateImportError(this.transloco, error));
      }
    } finally {
      this.saving.set(false);
    }
  }
}
