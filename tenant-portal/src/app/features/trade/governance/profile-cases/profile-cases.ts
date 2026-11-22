import { ChangeDetectorRef, Component, computed, inject, input, model, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerChecklist,
  tablerCircleCheck,
  tablerCircleX,
  tablerPlus,
} from '@ng-icons/tabler-icons';
import { ActionItem, ActionSelection, ActionsMenu } from '../../../../shared/ui/actions-menu/actions-menu';
import { Badge } from '../../../../shared/ui/badge/badge';
import { Button } from '../../../../shared/ui/button/button';
import { Field } from '../../../../shared/ui/field/field';
import { Modal } from '../../../../shared/ui/modal/modal';
import { Segmented, type SegmentedOption } from '../../../../shared/ui/segmented/segmented';
import { TagPicker, type TagOption } from '../../../../shared/ui/tag-picker/tag-picker';
import { CODE_PATTERN } from '../policy.registry';
import type {
  ProfileRequiredCaseInput,
  ProfileValidationRun,
  ProfileValidationRunResult,
} from '../profiles.model';
import type { ProfileFamilyRegistry } from '../profiles.registry';

const MAX_CUSTOM_CASES = 20;
const MAX_INLINE_FIELD_CHIPS = 3;

@Component({
  selector: 'app-profile-cases',
  imports: [NgIcon, TranslocoPipe, ActionsMenu, Badge, Button, Field, Modal, Segmented, TagPicker],
  providers: [provideIcons({ tablerPlus, tablerChecklist, tablerCircleCheck, tablerCircleX })],
  templateUrl: './profile-cases.html',
  host: { class: 'flex flex-col gap-12 min-w-0' },
})
export class ProfileCases {
  private static nextId = 0;
  protected readonly uid = `gov-profile-cases-${++ProfileCases.nextId}`;

  private readonly cdr = inject(ChangeDetectorRef);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  private readonly caseModal = viewChild.required<Modal>('caseModal');

  readonly family = input.required<ProfileFamilyRegistry>();
  readonly readonly = input(false);
  readonly validationRun = input<ProfileValidationRun | null>(null);
  /** Author cases as the backend takes them: input keys are the field codes the case fills. */
  readonly cases = model.required<ProfileRequiredCaseInput[]>();

  protected readonly maxCases = MAX_CUSTOM_CASES;

  // Add / Edit modal draft state
  protected readonly editingIndex = signal<number | null>(null);
  protected readonly draftCode = signal('');
  protected readonly draftInputFields = signal<string[]>([]);
  protected readonly draftShouldBeValid = signal(true);
  protected readonly modalSubmitted = signal(false);

  protected readonly systemTableTrack = 'grid-cols-trade-profile-system-case-row';
  protected readonly customTableTrack = computed(() =>
    this.readonly()
      ? 'grid-cols-trade-profile-case-row'
      : 'grid-cols-trade-profile-case-row-actions',
  );

  protected readonly resultsByCode = computed<ReadonlyMap<string, ProfileValidationRunResult>>(() => {
    const run = this.validationRun();
    if (!run) return new Map();
    return new Map(run.results.filter((r) => r.code).map((r) => [r.code as string, r]));
  });

  protected readonly fieldTagOptions = computed<TagOption[]>(() => {
    this.i18n();
    return this.family().fields.map((f) => ({
      id: f.code,
      name: this.transloco.translate(`profiles.registry.fields.${f.code}`),
      backgroundColor: null,
      textColor: null,
    }));
  });

  protected readonly shouldBeValidOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    return [
      { value: 'yes', label: this.transloco.translate('tradeShared.common.yes') },
      { value: 'no', label: this.transloco.translate('tradeShared.common.no') },
    ];
  });

  protected readonly caseMenuItems = computed<ActionItem[]>(() => {
    this.i18n();
    return [
      {
        id: 'edit',
        title: this.transloco.translate('profiles.cases.actions.edit'),
        icon: 'tablerEdit',
        tile: 'bg-icon-orange',
      },
      {
        id: 'delete',
        title: this.transloco.translate('profiles.cases.actions.delete'),
        icon: 'tablerTrash',
        tile: 'bg-icon-red',
        danger: true,
      },
    ];
  });

  protected readonly codeError = computed<string | null>(() => {
    this.i18n();
    if (!this.modalSubmitted()) return null;
    const normalized = this.draftCode().trim().toUpperCase();
    if (!normalized) {
      return this.transloco.translate('profiles.cases.modal.codeRequired');
    }
    if (!CODE_PATTERN.test(normalized)) {
      return this.transloco.translate('profiles.cases.modal.codeInvalid');
    }
    const editIdx = this.editingIndex();
    const systemConflict = this.family().systemCases.some((c) => c.code === normalized);
    const customConflict = this.cases().some(
      (c, idx) => idx !== editIdx && c.code.toUpperCase() === normalized,
    );
    if (systemConflict || customConflict) {
      return this.transloco.translate('profiles.cases.modal.codeDuplicate');
    }
    return null;
  });

  protected resultFor(code: string): ProfileValidationRunResult | null {
    return this.resultsByCode().get(code) ?? null;
  }

  protected fieldsOf(item: ProfileRequiredCaseInput): string[] {
    return Object.keys(item.input);
  }

  protected visibleFieldChips(codes: readonly string[]): string[] {
    return codes.slice(0, MAX_INLINE_FIELD_CHIPS);
  }

  protected hiddenFieldsCount(codes: readonly string[]): number {
    return Math.max(0, codes.length - MAX_INLINE_FIELD_CHIPS);
  }

  protected allFieldLabelsTitle(codes: readonly string[]): string {
    this.i18n();
    return codes
      .map((code) => this.transloco.translate(`profiles.registry.fields.${code}`))
      .join(', ');
  }

  protected openAddModal(): void {
    if (this.readonly() || this.cases().length >= MAX_CUSTOM_CASES) return;
    this.editingIndex.set(null);
    this.draftCode.set('');
    this.draftInputFields.set([]);
    this.draftShouldBeValid.set(true);
    this.modalSubmitted.set(false);
    this.cdr.detectChanges();
    this.caseModal().open();
  }

  protected openEditModal(index: number): void {
    if (this.readonly()) return;
    const target = this.cases()[index];
    if (!target) return;
    this.editingIndex.set(index);
    this.draftCode.set(target.code);
    this.draftInputFields.set(this.fieldsOf(target));
    this.draftShouldBeValid.set(target.expectedValid);
    this.modalSubmitted.set(false);
    this.cdr.detectChanges();
    this.caseModal().open();
  }

  protected onCaseAction(index: number, selection: ActionSelection): void {
    if (this.readonly()) return;
    if (selection.id === 'edit') {
      this.openEditModal(index);
    } else if (selection.id === 'delete') {
      this.cases.update((list) => list.filter((_, i) => i !== index));
    }
  }

  protected onCodeInput(event: Event): void {
    this.draftCode.set((event.target as HTMLInputElement).value);
  }

  protected onShouldBeValidChange(value: string | null): void {
    this.draftShouldBeValid.set(value !== 'no');
  }

  protected closeModal(): void {
    this.caseModal().close();
  }

  protected saveCase(): void {
    if (this.readonly()) return;
    this.modalSubmitted.set(true);
    if (this.codeError()) return;

    const normalized = this.draftCode().trim().toUpperCase();
    const nextCase: ProfileRequiredCaseInput = {
      code: normalized,
      input: Object.fromEntries(this.draftInputFields().map((field) => [field, 'sample'])),
      expectedValid: this.draftShouldBeValid(),
    };

    const editIdx = this.editingIndex();
    if (editIdx === null) {
      if (this.cases().length >= MAX_CUSTOM_CASES) return;
      this.cases.update((list) => [...list, nextCase]);
    } else {
      this.cases.update((list) => list.map((item, i) => (i === editIdx ? nextCase : item)));
    }
    this.caseModal().close();
  }
}
