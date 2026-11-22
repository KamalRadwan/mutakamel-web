import { Component, computed, inject, input, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerBraces, tablerMathFunction, tablerTable } from '@ng-icons/tabler-icons';
import { Button } from '../../../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Field } from '../../../../../../shared/ui/field/field';
import { Modal } from '../../../../../../shared/ui/modal/modal';
import { Segmented, SegmentedOption } from '../../../../../../shared/ui/segmented/segmented';
import type {
  TemplateBinding,
  TemplateFormulaExpression,
  TemplateStaticTableColumn,
  TemplateTableCellValue,
  TemplateTableRow,
} from '../../../templates.model';
import { BindingFormat, DesignerState } from '../../designer-state';
import {
  FormulaReadableLabels,
  MAX_STATIC_TABLE_ROWS,
  MAX_TABLE_COLUMNS,
  OpenFieldPickerFn,
  OtherFormulaOption,
  formatFormulaReadable,
  validateStaticCellMerge,
} from '../table-ops';
import type { FormulaBuildOptions, FormulaBuildResult } from '../formula-builder/formula-builder';

export interface CellEditRequest {
  context: 'STATIC_CELL' | 'DYNAMIC_CELL';
  value: TemplateTableCellValue;
  rowArrayPath?: string;
  otherFormulas?: readonly OtherFormulaOption[];
  staticGrid?: {
    rows: readonly TemplateTableRow[];
    columns: readonly TemplateStaticTableColumn[];
    rowIndex: number;
    colIndex: number;
    rowSpan: number;
    colSpan: number;
  };
}

export interface CellEditResult {
  value: TemplateTableCellValue;
  rowSpan?: number;
  colSpan?: number;
  clearCoveredCoords?: readonly { rowIndex: number; colIndex: number }[];
}

export type OpenFormulaBuilderFn = (options: FormulaBuildOptions) => Promise<FormulaBuildResult | null>;

@Component({
  selector: 'app-tpl-cell-editor-modal',
  imports: [NgIcon, TranslocoPipe, Modal, Button, Field, Segmented, ConfirmDialog],
  providers: [provideIcons({ tablerTable, tablerBraces, tablerMathFunction })],
  templateUrl: './cell-editor-modal.html',
})
export class CellEditorModal {
  private static nextId = 0;
  protected readonly uid = `cell-editor-${++CellEditorModal.nextId}`;

  protected readonly state = inject(DesignerState);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  private readonly modal = viewChild.required<Modal>('cellModal');
  private readonly mergeConfirm = viewChild.required<ConfirmDialog>('mergeConfirm');

  readonly pickField = input.required<OpenFieldPickerFn>();
  readonly openFormula = input.required<OpenFormulaBuilderFn>();

  protected readonly request = signal<CellEditRequest>({
    context: 'STATIC_CELL',
    value: { kind: 'TEXT', value: '' },
  });
  protected readonly mode = signal<'TEXT' | 'BINDING' | 'FORMULA'>('TEXT');
  protected readonly textValue = signal('');
  protected readonly binding = signal<TemplateBinding>({ path: '', nullBehavior: 'EMPTY' });
  protected readonly formulaExpr = signal<TemplateFormulaExpression | null>(null);
  protected readonly formulaFormat = signal<BindingFormat | undefined>(undefined);
  protected readonly rowSpanInput = signal('1');
  protected readonly colSpanInput = signal('1');
  protected readonly confirmCoveredCount = signal(0);

  private resolver: ((result: CellEditResult | null) => void) | null = null;
  private isOpen = false;
  private confirmingMerge = false;

  protected readonly readOnly = computed(() => this.state.readOnly());
  protected readonly isStaticWithGrid = computed(
    () => this.request().context === 'STATIC_CELL' && Boolean(this.request().staticGrid),
  );
  protected readonly isDynamic = computed(() => this.request().context === 'DYNAMIC_CELL');

  protected readonly modeOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    return [
      { value: 'TEXT', label: this.transloco.translate('tplTables.cell.text'), disabled: this.readOnly() },
      { value: 'BINDING', label: this.transloco.translate('tplTables.cell.field'), disabled: this.readOnly() },
      { value: 'FORMULA', label: this.transloco.translate('tplTables.cell.formula'), disabled: this.readOnly() },
    ];
  });

  protected readonly mergeValidation = computed(() => {
    const grid = this.request().staticGrid;
    if (!grid) {
      return { valid: true, reason: null, coveredWithContent: [], coveredAll: [] };
    }
    const rSpan = Number(this.rowSpanInput());
    const cSpan = Number(this.colSpanInput());
    if (
      !Number.isInteger(rSpan) ||
      rSpan < 1 ||
      rSpan > MAX_STATIC_TABLE_ROWS ||
      !Number.isInteger(cSpan) ||
      cSpan < 1 ||
      cSpan > MAX_TABLE_COLUMNS
    ) {
      return { valid: false, reason: 'OUT_OF_BOUNDS' as const, coveredWithContent: [], coveredAll: [] };
    }
    return validateStaticCellMerge(
      grid.rows,
      grid.columns,
      grid.rowIndex,
      grid.colIndex,
      rSpan,
      cSpan,
    );
  });

  protected readonly spanError = computed(() => {
    this.i18n();
    const res = this.mergeValidation();
    if (res.valid) return null;
    return res.reason === 'OVERLAP'
      ? this.transloco.translate('tplTables.cell.mergeOverlap')
      : this.transloco.translate('tplTables.cell.mergeOutOfBounds');
  });

  protected readonly formulaSummary = computed(() => {
    this.i18n();
    const expr = this.formulaExpr();
    if (!expr) return this.transloco.translate('tplTables.cell.noFormula');
    const labels: FormulaReadableLabels = {
      yes: this.transloco.translate('tplTables.formula.yes'),
      no: this.transloco.translate('tplTables.formula.no'),
      empty: this.transloco.translate('tplTables.formula.emptyValue'),
      fnGated: this.transloco.translate('tplTables.formula.functionGated'),
      sumRows: this.transloco.translate('tplTables.formula.sumRows'),
      ifWord: this.transloco.translate('tplTables.formula.words.if'),
      thenWord: this.transloco.translate('tplTables.formula.words.then'),
      elseWord: this.transloco.translate('tplTables.formula.words.else'),
      isEmptyWord: this.transloco.translate('tplTables.formula.words.isEmpty'),
      roundWord: this.transloco.translate('tplTables.formula.words.round'),
      sumWord: this.transloco.translate('tplTables.formula.words.sum'),
      absWord: this.transloco.translate('tplTables.formula.words.abs'),
      trimWord: this.transloco.translate('tplTables.formula.words.trim'),
      minWord: this.transloco.translate('tplTables.formula.words.min'),
      maxWord: this.transloco.translate('tplTables.formula.words.max'),
      coalesceWord: this.transloco.translate('tplTables.formula.words.coalesce'),
      concatWord: this.transloco.translate('tplTables.formula.words.concat'),
      addDaysWord: this.transloco.translate('tplTables.formula.words.addDays'),
      diffDaysWord: this.transloco.translate('tplTables.formula.words.diffDays'),
      unsetSlot: this.transloco.translate('tplTables.formula.unset'),
    };
    return formatFormulaReadable(
      expr,
      (p) => this.state.fieldLabel(p),
      (id) => this.request().otherFormulas?.find((f) => f.formulaId === id)?.name ?? id,
      labels,
    );
  });

  protected readonly canApply = computed(() => {
    if (this.readOnly()) return false;
    if (!this.mergeValidation().valid) return false;
    const mode = this.mode();
    if (mode === 'TEXT') return this.textValue().length <= 2000;
    if (mode === 'BINDING') return this.binding().path.trim().length > 0;
    return this.formulaExpr() !== null;
  });

  open(req: CellEditRequest): Promise<CellEditResult | null> {
    this.settle(null);
    this.request.set(req);
    this.mode.set(req.value.kind);

    if (req.value.kind === 'TEXT') {
      this.textValue.set(req.value.value);
      this.binding.set({ path: '', nullBehavior: 'EMPTY' });
      this.formulaExpr.set(null);
      this.formulaFormat.set(undefined);
    } else if (req.value.kind === 'BINDING') {
      this.textValue.set('');
      this.binding.set(structuredClone(req.value.binding));
      this.formulaExpr.set(null);
      this.formulaFormat.set(undefined);
    } else {
      this.textValue.set('');
      this.binding.set({ path: '', nullBehavior: 'EMPTY' });
      this.formulaExpr.set(structuredClone(req.value.expression));
      this.formulaFormat.set(req.value.format ? structuredClone(req.value.format) : undefined);
    }

    this.rowSpanInput.set(String(req.staticGrid?.rowSpan ?? 1));
    this.colSpanInput.set(String(req.staticGrid?.colSpan ?? 1));

    this.isOpen = true;
    this.modal().open();

    return new Promise<CellEditResult | null>((resolve) => {
      this.resolver = resolve;
    });
  }

  protected onModeChange(next: string | null): void {
    if (this.readOnly() || (next !== 'TEXT' && next !== 'BINDING' && next !== 'FORMULA')) return;
    this.mode.set(next);
  }

  protected onTextInput(event: Event): void {
    this.textValue.set((event.target as HTMLTextAreaElement).value);
  }

  protected onRowSpanInput(event: Event): void {
    this.rowSpanInput.set((event.target as HTMLInputElement).value);
  }

  protected onColSpanInput(event: Event): void {
    this.colSpanInput.set((event.target as HTMLInputElement).value);
  }

  protected async pickCellField(useDocumentField = false): Promise<void> {
    if (this.readOnly()) return;
    const req = this.request();
    const isRow = req.context === 'DYNAMIC_CELL' && !useDocumentField;
    const current = this.binding();
    const picked = await this.pickField()({
      purpose: 'BINDING',
      accept: isRow ? 'ROW_SCALAR' : 'SCALAR',
      rowArrayPath: isRow ? req.rowArrayPath : undefined,
      initial: current.path ? current : undefined,
    });
    if (!picked) return;
    this.binding.set(
      picked.binding ? structuredClone(picked.binding) : { path: picked.path, nullBehavior: 'EMPTY' },
    );
  }

  protected async editCellFormula(): Promise<void> {
    if (this.readOnly()) return;
    const req = this.request();
    const result = await this.openFormula()({
      context: req.context,
      expression: this.formulaExpr() ?? undefined,
      format: this.formulaFormat(),
      rowArrayPath: req.rowArrayPath,
      otherFormulas: req.otherFormulas,
    });
    if (!result) return;
    this.formulaExpr.set(result.expression);
    this.formulaFormat.set(result.format);
  }

  protected async apply(): Promise<void> {
    if (!this.canApply()) return;
    const merge = this.mergeValidation();
    if (!merge.valid) return;

    if (this.isStaticWithGrid() && merge.coveredWithContent.length > 0) {
      this.confirmCoveredCount.set(merge.coveredWithContent.length);
      this.confirmingMerge = true;
      const confirmed = await this.mergeConfirm().open();
      this.confirmingMerge = false;
      if (!confirmed) return;
    }

    const mode = this.mode();
    let value: TemplateTableCellValue;
    if (mode === 'TEXT') {
      value = { kind: 'TEXT', value: this.textValue() };
    } else if (mode === 'BINDING') {
      value = { kind: 'BINDING', binding: structuredClone(this.binding()) };
    } else {
      const expr = this.formulaExpr();
      if (!expr) return;
      const fmt = this.formulaFormat();
      value = {
        kind: 'FORMULA',
        expression: structuredClone(expr),
        ...(fmt ? { format: structuredClone(fmt) } : {}),
      };
    }

    const grid = this.request().staticGrid;
    const result: CellEditResult = {
      value,
      ...(grid
        ? {
            rowSpan: Math.max(1, Math.trunc(Number(this.rowSpanInput()) || 1)),
            colSpan: Math.max(1, Math.trunc(Number(this.colSpanInput()) || 1)),
            clearCoveredCoords: merge.coveredAll,
          }
        : {}),
    };

    this.isOpen = false;
    this.modal().close();
    this.settle(result);
  }

  protected cancel(): void {
    this.isOpen = false;
    this.modal().close();
    this.settle(null);
  }

  protected onModalClosed(): void {
    if (this.confirmingMerge) {
      this.modal().open();
      return;
    }
    if (this.isOpen) {
      this.isOpen = false;
      this.settle(null);
    }
  }

  private settle(result: CellEditResult | null): void {
    const res = this.resolver;
    this.resolver = null;
    res?.(result);
  }
}
