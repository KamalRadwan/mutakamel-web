import { Component, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerFlask, tablerPlus, tablerTrash } from '@ng-icons/tabler-icons';
import { Button } from '../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Dropdown, type DropdownOption } from '../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../shared/ui/field/field';
import { Modal } from '../../../../shared/ui/modal/modal';
import { Segmented, type SegmentedOption } from '../../../../shared/ui/segmented/segmented';
import type { PolicyRule, PolicyTestCase } from '../policy.model';
import {
  FACTS,
  FACTS_BY_KIND,
  type FactType,
  OUTCOMES,
  isDecimalString,
  isMoneyFact,
  type PolicyFactDefinition,
  type PolicyKind,
  type PolicyOutcome,
  RULE_CODE,
} from '../policy.registry';

interface FactRow {
  id: number;
  fact: string;
  value: string | number | boolean;
}

const MAX_SELECTED_VALUE = 120;

let nextPolicyTestModalId = 0;

@Component({
  selector: 'app-policy-test-modal',
  imports: [NgIcon, TranslocoPipe, Button, ConfirmDialog, Dropdown, Field, Modal, Segmented],
  providers: [provideIcons({ tablerFlask, tablerPlus, tablerTrash })],
  templateUrl: './policy-test-modal.html',
})
export class PolicyTestModal {
  protected readonly uid = `policy-test-modal-${++nextPolicyTestModalId}`;
  private static nextRowId = 0;

  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly modal = viewChild.required(Modal);
  private readonly discardDialog = viewChild.required(ConfirmDialog);

  readonly kind = input('');
  readonly rules = input<readonly PolicyRule[]>([]);
  readonly facts = input<readonly PolicyFactDefinition[]>(FACTS);
  readonly factsByKind = input<Readonly<Record<string, readonly string[]>>>(FACTS_BY_KIND);
  readonly existingCodes = input<readonly string[]>([]);

  readonly saved = output<{ index: number | null; testCase: PolicyTestCase }>();

  protected readonly editingIndex = signal<number | null>(null);
  protected readonly code = signal('');
  protected readonly factRows = signal<FactRow[]>([]);
  protected readonly expectedOutcome = signal<PolicyOutcome>('ALLOW');
  protected readonly expectedRuleCode = signal('');
  protected readonly expectedSelectedValue = signal('');
  protected readonly submitted = signal(false);

  private readonly isOpen = signal(false);
  private readonly initialSnapshot = signal('');
  private allowClose = false;
  private reopening = false;

  protected readonly modalTitle = computed(() => {
    this.i18n();
    return this.transloco.translate(
      this.editingIndex() === null ? 'policy.tests.modal.createTitle' : 'policy.tests.modal.editTitle',
    );
  });

  protected readonly maxSelectedValue = MAX_SELECTED_VALUE;

  protected readonly supportedFactKeys = computed<readonly string[]>(() => {
    const map = this.factsByKind();
    return map[this.kind()] ?? map[this.kind() as PolicyKind] ?? [];
  });

  private readonly factMap = computed(() => new Map(this.facts().map((f) => [f.key, f])));

  protected readonly outcomeOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    return OUTCOMES.map((value) => ({
      value,
      label: this.transloco.translate(`policy.outcomes.${value}`),
    }));
  });

  protected readonly booleanOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    return [
      { value: 'true', label: this.transloco.translate('policy.rules.yes') },
      { value: 'false', label: this.transloco.translate('policy.rules.no') },
    ];
  });

  protected readonly expectedRuleOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const opts: DropdownOption<string>[] = [
      { value: '', label: this.transloco.translate('policy.tests.modal.anyOrDefaultRule') },
    ];
    const seen = new Set<string>(['']);
    for (const rule of this.rules()) {
      const c = rule.code.trim();
      if (c && !seen.has(c)) {
        seen.add(c);
        opts.push({ value: c, label: c });
      }
    }
    const current = this.expectedRuleCode().trim();
    if (current && !seen.has(current)) {
      opts.push({ value: current, label: current });
    }
    return opts;
  });

  protected readonly codeError = computed<string | null>(() => {
    this.i18n();
    if (!this.submitted()) return null;
    const trimmed = this.code().trim();
    if (!RULE_CODE.test(trimmed)) {
      return this.transloco.translate('policy.tests.modal.codeError');
    }
    const editingIdx = this.editingIndex();
    const duplicate = this.existingCodes().some((c, i) => i !== editingIdx && c.trim() === trimmed);
    if (duplicate) {
      return this.transloco.translate('policy.tests.modal.codeDuplicate');
    }
    return null;
  });

  protected readonly factsListError = computed<string | null>(() => {
    this.i18n();
    if (!this.submitted()) return null;
    if (this.factRows().length === 0) {
      return this.transloco.translate('policy.tests.modal.factsRequired');
    }
    return null;
  });

  protected readonly selectedValueError = computed<string | null>(() => {
    this.i18n();
    if (!this.submitted() || this.expectedOutcome() !== 'SELECT') return null;
    const sv = this.expectedSelectedValue().trim();
    if (!sv || sv.length > MAX_SELECTED_VALUE) {
      return this.transloco.translate('policy.tests.modal.expectedSelectedValueError');
    }
    return null;
  });

  protected readonly canAddFact = computed(() => this.firstUnusedFactKey() !== null);

  protected readonly dirty = computed(() => {
    if (!this.isOpen()) return false;
    return this.snapshotCurrent() !== this.initialSnapshot();
  });

  openCreate(): void {
    const firstKey = this.supportedFactKeys()[0] ?? this.facts()[0]?.key ?? 'totalAmount';
    this.editingIndex.set(null);
    this.code.set('');
    this.factRows.set([this.makeDefaultRow(firstKey)]);
    this.expectedOutcome.set('ALLOW');
    this.expectedRuleCode.set('');
    this.expectedSelectedValue.set('');
    this.submitted.set(false);
    this.initialSnapshot.set(this.snapshotCurrent());
    this.allowClose = false;
    this.isOpen.set(true);
    this.modal().open();
  }

  openEdit(index: number, testCase: PolicyTestCase): void {
    this.editingIndex.set(index);
    this.code.set(testCase.code);
    const entries = Object.entries(testCase.facts ?? {});
    this.factRows.set(
      entries.map(([fact, value]) => ({
        id: ++PolicyTestModal.nextRowId,
        fact,
        // Legacy numeric money facts load as decimal strings.
        value: isMoneyFact(fact) && typeof value === 'number' ? String(value) : value,
      })),
    );
    this.expectedOutcome.set(testCase.expectedOutcome);
    this.expectedRuleCode.set(testCase.expectedRuleCode ?? '');
    this.expectedSelectedValue.set(testCase.expectedSelectedValue ?? '');
    this.submitted.set(false);
    this.initialSnapshot.set(this.snapshotCurrent());
    this.allowClose = false;
    this.isOpen.set(true);
    this.modal().open();
  }

  protected factTypeOf(factKey: string): FactType {
    return this.factMap().get(factKey)?.type ?? 'string';
  }

  protected factOptionsForRow(rowIndex: number, currentFact: string): DropdownOption<string>[] {
    this.i18n();
    const usedByOthers = new Set(
      this.factRows()
        .filter((_, idx) => idx !== rowIndex)
        .map((r) => r.fact),
    );

    const supportedSet = new Set(this.supportedFactKeys());
    const ordered: PolicyFactDefinition[] = [
      ...this.facts().filter((f) => supportedSet.has(f.key)),
      ...this.facts().filter((f) => !supportedSet.has(f.key)),
    ];

    const opts: DropdownOption<string>[] = [];
    let hasCurrent = false;
    for (const def of ordered) {
      if (def.key === currentFact || !usedByOthers.has(def.key)) {
        if (def.key === currentFact) hasCurrent = true;
        opts.push({
          value: def.key,
          label: this.transloco.translate(`policy.facts.${def.key}`),
        });
      }
    }
    if (currentFact && !hasCurrent) {
      opts.unshift({ value: currentFact, label: currentFact });
    }
    return opts;
  }

  protected rowValueError(row: FactRow): string | null {
    this.i18n();
    if (!this.submitted()) return null;
    const type = this.factTypeOf(row.fact);
    if (isMoneyFact(row.fact)) {
      if (!isDecimalString(row.value)) {
        return this.transloco.translate('policy.rules.validation.genericInvalid');
      }
    } else if (type === 'number') {
      const n = typeof row.value === 'number' ? row.value : Number(row.value);
      if (row.value === '' || row.value === null || row.value === undefined || !Number.isFinite(n)) {
        return this.transloco.translate('policy.rules.validation.genericInvalid');
      }
    } else if (type === 'string') {
      if (typeof row.value !== 'string' || !row.value.trim()) {
        return this.transloco.translate('policy.rules.validation.genericInvalid');
      }
    }
    return null;
  }

  protected numberTextValue(val: string | number | boolean): string {
    return typeof val === 'number' && Number.isFinite(val)
      ? String(val)
      : typeof val === 'string'
        ? val
        : '';
  }

  protected stringTextValue(val: string | number | boolean): string {
    return typeof val === 'string' ? val : val === null || val === undefined ? '' : String(val);
  }

  protected boolStringValue(val: string | number | boolean): string {
    return val === true ? 'true' : 'false';
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
  }

  protected onFactChange(idx: number, nextFact: string): void {
    const prevRows = this.factRows();
    const prev = prevRows[idx];
    if (!prev || prev.fact === nextFact) return;
    const prevType = this.factTypeOf(prev.fact);
    const nextType = this.factTypeOf(nextFact);
    let nextValue = prev.value;
    if (prevType !== nextType || isMoneyFact(prev.fact) !== isMoneyFact(nextFact)) {
      nextValue = this.defaultValueForType(nextType, nextFact);
    }
    this.factRows.update((rows) =>
      rows.map((r, i) => (i === idx ? { ...r, fact: nextFact, value: nextValue } : r)),
    );
  }

  protected onRowNumberInput(idx: number, event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    if (raw === '') {
      this.patchRowValue(idx, '');
      return;
    }
    if (isMoneyFact(this.factRows()[idx]?.fact ?? '')) {
      this.patchRowValue(idx, raw.trim());
      return;
    }
    const parsed = Number(raw);
    this.patchRowValue(idx, Number.isFinite(parsed) ? parsed : raw);
  }

  protected onRowStringInput(idx: number, event: Event): void {
    this.patchRowValue(idx, (event.target as HTMLInputElement).value);
  }

  protected onRowBoolChange(idx: number, value: string | null): void {
    this.patchRowValue(idx, value === 'true');
  }

  protected addFactRow(): void {
    const key = this.firstUnusedFactKey();
    if (!key) return;
    this.factRows.update((rows) => [...rows, this.makeDefaultRow(key)]);
  }

  protected removeFactRow(idx: number): void {
    this.factRows.update((rows) => rows.filter((_, i) => i !== idx));
  }

  protected onExpectedOutcomeChange(value: string | null): void {
    const outcome = (value ?? '') as PolicyOutcome;
    this.expectedOutcome.set(outcome);
    if (outcome !== 'SELECT') {
      this.expectedSelectedValue.set('');
    }
  }

  protected onSelectedValueInput(event: Event): void {
    this.expectedSelectedValue.set((event.target as HTMLInputElement).value);
  }

  protected save(): void {
    this.submitted.set(true);
    if (
      this.codeError() ||
      this.factsListError() ||
      this.selectedValueError() ||
      this.factRows().some((r) => this.rowValueError(r) !== null)
    ) {
      return;
    }

    const factsRecord: Record<string, string | number | boolean> = {};
    for (const row of this.factRows()) {
      const type = this.factTypeOf(row.fact);
      if (isMoneyFact(row.fact)) {
        factsRecord[row.fact] = String(row.value).trim();
      } else if (type === 'number') {
        factsRecord[row.fact] = Number(row.value);
      } else if (type === 'boolean') {
        factsRecord[row.fact] = Boolean(row.value);
      } else {
        factsRecord[row.fact] = String(row.value).trim();
      }
    }

    const testCase: PolicyTestCase = {
      code: this.code().trim(),
      facts: factsRecord,
      expectedOutcome: this.expectedOutcome(),
      expectedRuleCode: this.expectedRuleCode().trim() || null,
      expectedSelectedValue:
        this.expectedOutcome() === 'SELECT' ? this.expectedSelectedValue().trim() : null,
    };

    this.allowClose = true;
    this.isOpen.set(false);
    this.saved.emit({ index: this.editingIndex(), testCase });
    this.modal().close();
  }

  protected async requestClose(): Promise<void> {
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

  private patchRowValue(idx: number, value: string | number | boolean): void {
    this.factRows.update((rows) => rows.map((r, i) => (i === idx ? { ...r, value } : r)));
  }

  private makeDefaultRow(factKey: string): FactRow {
    return {
      id: ++PolicyTestModal.nextRowId,
      fact: factKey,
      value: this.defaultValueForType(this.factTypeOf(factKey), factKey),
    };
  }

  private defaultValueForType(type: FactType, factKey: string): string | number | boolean {
    if (type === 'boolean') return false;
    if (isMoneyFact(factKey)) return '0';
    if (type === 'number') return 0;
    return '';
  }

  private firstUnusedFactKey(): string | null {
    const used = new Set(this.factRows().map((r) => r.fact));
    for (const key of this.supportedFactKeys()) {
      if (!used.has(key)) return key;
    }
    for (const def of this.facts()) {
      if (!used.has(def.key)) return def.key;
    }
    return null;
  }

  private snapshotCurrent(): string {
    return JSON.stringify({
      code: this.code(),
      rows: this.factRows().map((r) => [r.fact, r.value]),
      expectedOutcome: this.expectedOutcome(),
      expectedRuleCode: this.expectedRuleCode(),
      expectedSelectedValue: this.expectedSelectedValue(),
    });
  }
}
