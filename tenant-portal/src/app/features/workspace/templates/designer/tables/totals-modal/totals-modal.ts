import { Component, computed, inject, input, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerArrowDown,
  tablerArrowUp,
  tablerBraces,
  tablerCheck,
  tablerPlus,
  tablerSum,
  tablerTrash,
} from '@ng-icons/tabler-icons';
import { Button } from '../../../../../../shared/ui/button/button';
import { Checkbox } from '../../../../../../shared/ui/checkbox/checkbox';
import { Dropdown, DropdownOption } from '../../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../../shared/ui/field/field';
import { Modal } from '../../../../../../shared/ui/modal/modal';
import type { TemplateFieldDataType, TemplateTotalsRow } from '../../../templates.model';
import { DesignerState } from '../../designer-state';
import { MAX_TOTALS_ROWS, OpenFieldPickerFn, buildEmptyTotalsRow } from '../table-ops';

const TOTALS_DATA_TYPES: readonly TemplateFieldDataType[] = [
  'CURRENCY',
  'DECIMAL',
  'NUMBER',
  'PERCENTAGE',
];

@Component({
  selector: 'app-tpl-totals-modal',
  imports: [NgIcon, TranslocoPipe, Modal, Button, Dropdown, Field, Checkbox],
  providers: [provideIcons({ tablerSum, tablerPlus, tablerTrash, tablerArrowUp, tablerArrowDown, tablerBraces, tablerCheck })],
  templateUrl: './totals-modal.html',
})
export class TotalsModal {
  private static nextId = 0;
  protected readonly uid = `totals-modal-${++TotalsModal.nextId}`;

  protected readonly state = inject(DesignerState);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  private readonly modal = viewChild.required<Modal>('totalsModal');

  readonly pickField = input.required<OpenFieldPickerFn>();

  protected readonly editingNodeId = signal<string | null>(null);
  protected readonly rows = signal<TemplateTotalsRow[]>([buildEmptyTotalsRow()]);
  protected readonly attemptedApply = signal(false);
  private readonly touchedLabels = signal<ReadonlySet<string>>(new Set());
  private readonly touchedValues = signal<ReadonlySet<string>>(new Set());

  protected readonly readOnly = computed(() => this.state.readOnly());

  protected readonly emphasisOptions = computed<DropdownOption<TemplateTotalsRow['emphasis']>[]>(() => {
    this.i18n();
    return [
      { value: 'NORMAL', label: this.transloco.translate('tplTables.emphasis.NORMAL') },
      { value: 'STRONG', label: this.transloco.translate('tplTables.emphasis.STRONG') },
      { value: 'GRAND_TOTAL', label: this.transloco.translate('tplTables.emphasis.GRAND_TOTAL') },
    ];
  });

  protected readonly canApply = computed(() => {
    if (this.readOnly()) return false;
    const list = this.rows();
    if (list.length === 0 || list.length > MAX_TOTALS_ROWS) return false;
    return list.every(
      (row) =>
        row.label.trim().length > 0 &&
        row.label.length <= 500 &&
        row.binding.path.trim().length > 0,
    );
  });

  openInsert(): void {
    this.editingNodeId.set(null);
    this.rows.set([buildEmptyTotalsRow()]);
    this.attemptedApply.set(false);
    this.touchedLabels.set(new Set());
    this.touchedValues.set(new Set());
    this.modal().open();
  }

  openEdit(nodeId: string): void {
    const node = this.state.document()?.nodes[nodeId];
    if (!node || node.type !== 'totals') return;
    this.editingNodeId.set(nodeId);
    this.rows.set(
      node.props.rows.length > 0 ? structuredClone(node.props.rows) : [buildEmptyTotalsRow()],
    );
    this.attemptedApply.set(false);
    this.touchedLabels.set(new Set());
    this.touchedValues.set(new Set());
    this.modal().open();
  }

  protected addRow(): void {
    if (this.readOnly() || this.rows().length >= MAX_TOTALS_ROWS) return;
    this.rows.update((list) => [...list, buildEmptyTotalsRow()]);
  }

  protected removeRow(index: number): void {
    if (this.readOnly() || this.rows().length <= 1) return;
    this.rows.update((list) => list.filter((_, i) => i !== index));
  }

  protected moveRow(index: number, delta: -1 | 1): void {
    if (this.readOnly()) return;
    const target = index + delta;
    const list = this.rows();
    if (target < 0 || target >= list.length) return;
    const next = [...list];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    this.rows.set(next);
  }

  protected onLabelInput(index: number, event: Event): void {
    const label = (event.target as HTMLInputElement).value;
    this.updateRow(index, { label });
  }

  protected markLabelTouched(rowId: string): void {
    this.touchedLabels.update((set) => {
      if (set.has(rowId)) return set;
      const next = new Set(set);
      next.add(rowId);
      return next;
    });
  }

  private markValueTouched(rowId: string): void {
    this.touchedValues.update((set) => {
      if (set.has(rowId)) return set;
      const next = new Set(set);
      next.add(rowId);
      return next;
    });
  }

  protected updateRow(index: number, patch: Partial<TemplateTotalsRow>): void {
    if (this.readOnly()) return;
    this.rows.update((list) => list.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  protected async pickRowValue(index: number): Promise<void> {
    if (this.readOnly()) return;
    const row = this.rows()[index];
    if (!row) return;
    try {
      const picked = await this.pickField()({
        purpose: 'BINDING',
        accept: 'SCALAR',
        dataTypes: TOTALS_DATA_TYPES,
        initial: row.binding.path ? row.binding : undefined,
      });
      if (!picked) return;
      const binding = picked.binding
        ? structuredClone(picked.binding)
        : { path: picked.path, nullBehavior: 'EMPTY' as const };
      const nextLabel = row.label.trim() ? row.label : this.state.fieldLabel(picked.path);
      this.updateRow(index, { binding, label: nextLabel });
    } finally {
      this.markValueTouched(row.id);
    }
  }

  protected labelError(row: TemplateTotalsRow): string | null {
    this.i18n();
    if (row.label.length > 500) {
      return this.transloco.translate('tplTables.totals.labelTooLong');
    }
    if (!this.attemptedApply() && !this.touchedLabels().has(row.id)) return null;
    if (!row.label.trim()) return this.transloco.translate('tplTables.totals.labelRequired');
    return null;
  }

  protected valueError(row: TemplateTotalsRow): string | null {
    this.i18n();
    if (!this.attemptedApply() && !this.touchedValues().has(row.id)) return null;
    if (!row.binding.path.trim()) return this.transloco.translate('tplTables.totals.valueRequired');
    return null;
  }

  protected apply(): void {
    this.attemptedApply.set(true);
    if (!this.canApply()) return;
    const cleaned = this.rows().map((r) => ({
      ...r,
      label: r.label.trim(),
      binding: structuredClone(r.binding),
    }));

    const existingId = this.editingNodeId();
    if (existingId) {
      this.state.updateNode(existingId, { props: { rows: cleaned } }, 'updateTotals');
    } else {
      this.state.insertNode({ type: 'totals', props: { rows: cleaned } });
    }
    this.modal().close();
  }

  protected cancel(): void {
    this.modal().close();
  }
}
