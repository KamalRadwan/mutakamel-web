import { Component, computed, inject, input, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../../core/i18n/translation-events';
import { FormField, form, readonly } from '@angular/forms/signals';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerEyeOff, tablerPlus, tablerTrash } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../../core/i18n/language';
import { Button } from '../../../../../../shared/ui/button/button';
import { Dropdown, DropdownOption } from '../../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../../shared/ui/field/field';
import { Modal } from '../../../../../../shared/ui/modal/modal';
import { Segmented, SegmentedOption } from '../../../../../../shared/ui/segmented/segmented';
import type {
  TemplateCompareOperator,
  TemplateFieldDataType,
  TemplateVisibilityExpression,
  TemplateVisibilityRule,
} from '../../../templates.model';
import { DesignerState } from '../../designer-state';
import type { FieldPickOptions, FieldPickResult } from '../field-picker/field-picker';

type VisOperator = 'IS_NULL' | 'IS_NOT_NULL' | TemplateCompareOperator;

interface ConditionRow {
  uid: string;
  path: string;
  operator: VisOperator;
  valueStr: string;
  valueNum: number | null;
  valueBool: boolean;
}

const MAX_CONDITIONS = 16;
const BASE_OPERATORS: readonly VisOperator[] = ['IS_NULL', 'IS_NOT_NULL', 'EQ', 'NE'];
const ORDERABLE_OPERATORS: readonly VisOperator[] = ['IS_NULL', 'IS_NOT_NULL', 'EQ', 'NE', 'LT', 'LTE', 'GT', 'GTE'];

let nextCondId = 1;
function newCondUid(): string {
  return `vis-${nextCondId++}`;
}

function emptyConditionRow(): ConditionRow {
  return {
    uid: newCondUid(),
    path: '',
    operator: 'IS_NOT_NULL',
    valueStr: '',
    valueNum: null,
    valueBool: true,
  };
}

function toFiniteOrNull(val: unknown): number | null {
  if (typeof val === 'number') return Number.isFinite(val) ? val : null;
  if (typeof val === 'string') {
    const t = val.trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function isSimpleLeaf(expr: TemplateVisibilityExpression): expr is
  | { kind: 'COMPARE'; operator: TemplateCompareOperator; path: string; value: string | number | boolean }
  | { kind: 'IS_NULL'; path: string }
  | { kind: 'IS_NOT_NULL'; path: string } {
  return expr.kind === 'COMPARE' || expr.kind === 'IS_NULL' || expr.kind === 'IS_NOT_NULL';
}

function fromLeaf(expr: TemplateVisibilityExpression): ConditionRow {
  if (expr.kind === 'IS_NULL') {
    return { uid: newCondUid(), path: expr.path, operator: 'IS_NULL', valueStr: '', valueNum: null, valueBool: true };
  }
  if (expr.kind === 'IS_NOT_NULL') {
    return {
      uid: newCondUid(),
      path: expr.path,
      operator: 'IS_NOT_NULL',
      valueStr: '',
      valueNum: null,
      valueBool: true,
    };
  }
  if (expr.kind === 'COMPARE') {
    return {
      uid: newCondUid(),
      path: expr.path,
      operator: expr.operator,
      valueStr: typeof expr.value === 'boolean' ? '' : String(expr.value),
      valueNum: toFiniteOrNull(expr.value),
      valueBool: typeof expr.value === 'boolean' ? expr.value : true,
    };
  }
  return emptyConditionRow();
}

function fromLegacyRule(rule: TemplateVisibilityRule): ConditionRow {
  switch (rule.operator) {
    case 'EXISTS':
      return {
        uid: newCondUid(),
        path: rule.path,
        operator: 'IS_NOT_NULL',
        valueStr: '',
        valueNum: null,
        valueBool: true,
      };
    case 'NOT_EXISTS':
      return { uid: newCondUid(), path: rule.path, operator: 'IS_NULL', valueStr: '', valueNum: null, valueBool: true };
    case 'EQUALS':
      return {
        uid: newCondUid(),
        path: rule.path,
        operator: 'EQ',
        valueStr: rule.value !== undefined && typeof rule.value !== 'boolean' ? String(rule.value) : '',
        valueNum: toFiniteOrNull(rule.value),
        valueBool: typeof rule.value === 'boolean' ? rule.value : true,
      };
    case 'NOT_EQUALS':
      return {
        uid: newCondUid(),
        path: rule.path,
        operator: 'NE',
        valueStr: rule.value !== undefined && typeof rule.value !== 'boolean' ? String(rule.value) : '',
        valueNum: toFiniteOrNull(rule.value),
        valueBool: typeof rule.value === 'boolean' ? rule.value : true,
      };
    case 'TRUTHY':
      return { uid: newCondUid(), path: rule.path, operator: 'EQ', valueStr: 'true', valueNum: null, valueBool: true };
    case 'FALSY':
      return { uid: newCondUid(), path: rule.path, operator: 'EQ', valueStr: 'false', valueNum: null, valueBool: false };
  }
}

@Component({
  selector: 'app-tpl-visibility-modal',
  imports: [FormField, NgIcon, TranslocoPipe, Button, Dropdown, Field, Modal, Segmented],
  providers: [provideIcons({ tablerEyeOff, tablerPlus, tablerTrash })],
  templateUrl: './visibility-modal.html',
  host: { class: 'contents' },
})
export class VisibilityModal {
  protected readonly state = inject(DesignerState);
  private readonly transloco = inject(TranslocoService);
  private readonly language = inject(LanguageState).current;
  private readonly i18n = translationEvents(this.transloco);

  readonly pickField = input.required<(options: FieldPickOptions) => Promise<FieldPickResult | null>>();

  private readonly modal = viewChild.required<Modal>('visModal');
  private readonly targetNodeId = signal<string | null>(null);

  protected readonly complexReadOnly = signal(false);
  protected readonly complexExpression = signal<TemplateVisibilityExpression | null>(null);
  protected readonly mode = signal<string | null>('ALWAYS');
  protected readonly matchKind = signal<'ALL' | 'ANY'>('ALL');
  protected readonly visModel = signal<{ rows: ConditionRow[] }>({ rows: [] });
  protected readonly visForm = form(this.visModel, (p) => {
    readonly(p, () => this.state.readOnly());
  });
  protected readonly rows = computed(() => this.visModel().rows);
  protected readonly attempted = signal(false);

  open(nodeId: string): void {
    const node = this.state.document()?.nodes[nodeId];
    if (!node) return;

    this.targetNodeId.set(nodeId);
    this.attempted.set(false);
    this.complexReadOnly.set(false);
    this.complexExpression.set(null);

    if (node.visibilityExpression) {
      const expr = node.visibilityExpression;
      if ((expr.kind === 'ALL' || expr.kind === 'ANY') && expr.operands.length <= MAX_CONDITIONS && expr.operands.every(isSimpleLeaf)) {
        this.mode.set('CONDITIONAL');
        this.matchKind.set(expr.kind);
        this.visModel.set({ rows: expr.operands.length > 0 ? expr.operands.map(fromLeaf) : [emptyConditionRow()] });
      } else if (isSimpleLeaf(expr)) {
        this.mode.set('CONDITIONAL');
        this.matchKind.set('ALL');
        this.visModel.set({ rows: [fromLeaf(expr)] });
      } else {
        this.complexReadOnly.set(true);
        this.complexExpression.set(expr);
        this.mode.set('CONDITIONAL');
        this.visModel.set({ rows: [] });
      }
    } else if (node.visibilityRule) {
      this.mode.set('CONDITIONAL');
      this.matchKind.set('ALL');
      this.visModel.set({ rows: [fromLegacyRule(node.visibilityRule)] });
    } else {
      this.mode.set('ALWAYS');
      this.matchKind.set('ALL');
      this.visModel.set({ rows: [emptyConditionRow()] });
    }

    this.modal().open();
  }

  protected readonly modeOptions = computed<SegmentedOption[]>(() => {
    this.language();
    this.i18n();
    const ro = this.state.readOnly();
    return [
      { value: 'ALWAYS', label: this.transloco.translate('tplFields.visibility.always'), disabled: ro },
      { value: 'CONDITIONAL', label: this.transloco.translate('tplFields.visibility.when'), disabled: ro },
    ];
  });

  protected readonly matchOptions = computed<DropdownOption<'ALL' | 'ANY'>[]>(() => {
    this.language();
    this.i18n();
    return (['ALL', 'ANY'] as const).map((k) => ({
      value: k,
      label: this.transloco.translate(`tplFields.visibility.match.${k}`),
    }));
  });

  protected readonly baseOperatorOptions = computed<DropdownOption<VisOperator>[]>(() => {
    this.language();
    this.i18n();
    return BASE_OPERATORS.map((op) => ({
      value: op,
      label: this.transloco.translate(`tplFields.visibility.operators.${op}`),
    }));
  });

  protected readonly orderableOperatorOptions = computed<DropdownOption<VisOperator>[]>(() => {
    this.language();
    this.i18n();
    return ORDERABLE_OPERATORS.map((op) => ({
      value: op,
      label: this.transloco.translate(`tplFields.visibility.operators.${op}`),
    }));
  });

  protected operatorOptionsFor(path: string): DropdownOption<VisOperator>[] {
    return this.isOrderableType(path) ? this.orderableOperatorOptions() : this.baseOperatorOptions();
  }

  protected readonly booleanOptions = computed<DropdownOption<boolean>[]>(() => {
    this.language();
    this.i18n();
    return [
      { value: true, label: this.transloco.translate('tplFields.visibility.yes') },
      { value: false, label: this.transloco.translate('tplFields.visibility.no') },
    ];
  });

  protected readonly complexSentence = computed(() => {
    this.language();
    this.i18n();
    const expr = this.complexExpression();
    return expr ? this.describeExpression(expr) : '';
  });

  protected readonly canApply = computed(() => {
    if (this.state.readOnly() || this.complexReadOnly()) return false;
    if (this.mode() === 'ALWAYS') return true;
    const list = this.rows();
    if (list.length === 0 || list.length > MAX_CONDITIONS) return false;
    return list.every((r, idx) => !this.rowPathErrorInternal(r) && !this.rowValueErrorInternal(r, idx));
  });

  protected fieldDataType(path: string): TemplateFieldDataType | null {
    if (!path) return null;
    return this.state.schema()?.fields.find((f) => f.path === path)?.dataType ?? null;
  }

  protected isNumericType(path: string): boolean {
    const dt = this.fieldDataType(path);
    return dt === 'NUMBER' || dt === 'DECIMAL' || dt === 'CURRENCY' || dt === 'PERCENTAGE';
  }

  protected isOrderableType(path: string): boolean {
    const dt = this.fieldDataType(path);
    return (
      dt === 'NUMBER' ||
      dt === 'DECIMAL' ||
      dt === 'CURRENCY' ||
      dt === 'PERCENTAGE' ||
      dt === 'DATE' ||
      dt === 'DATETIME'
    );
  }

  protected isBooleanType(path: string): boolean {
    return this.fieldDataType(path) === 'BOOLEAN';
  }

  protected needsValue(op: VisOperator): boolean {
    return op !== 'IS_NULL' && op !== 'IS_NOT_NULL';
  }

  protected rowPathError(row: ConditionRow): string | null {
    return this.attempted() ? this.rowPathErrorInternal(row) : null;
  }

  protected rowValueError(row: ConditionRow, index: number): string | null {
    return this.attempted() ? this.rowValueErrorInternal(row, index) : null;
  }

  protected async chooseField(rowIndex: number): Promise<void> {
    if (this.state.readOnly()) return;
    const current = this.rows()[rowIndex];
    const picked = await this.pickField()({
      purpose: 'PATH',
      accept: 'SCALAR',
      initial: current?.path ? { path: current.path } : undefined,
    });
    if (!picked) return;
    const allowOrdering = this.isOrderableType(picked.path);
    this.visModel.update((m) => ({
      rows: m.rows.map((r, i) => {
        if (i !== rowIndex) return r;
        const resetOrderOp =
          !allowOrdering && (r.operator === 'LT' || r.operator === 'LTE' || r.operator === 'GT' || r.operator === 'GTE');
        return {
          ...r,
          path: picked.path,
          ...(resetOrderOp ? { operator: 'EQ' as VisOperator } : {}),
        };
      }),
    }));
  }

  protected updateOperator(rowIndex: number, operator: VisOperator): void {
    this.visModel.update((m) => ({
      rows: m.rows.map((r, i) => (i === rowIndex ? { ...r, operator } : r)),
    }));
  }

  protected updateValueBool(rowIndex: number, valueBool: boolean): void {
    this.visModel.update((m) => ({
      rows: m.rows.map((r, i) => (i === rowIndex ? { ...r, valueBool } : r)),
    }));
  }

  protected addCondition(): void {
    if (this.state.readOnly() || this.rows().length >= MAX_CONDITIONS) return;
    this.visModel.update((m) => ({ rows: [...m.rows, emptyConditionRow()] }));
  }

  protected removeCondition(rowIndex: number): void {
    if (this.state.readOnly()) return;
    this.visModel.update((m) => {
      const next = m.rows.filter((_, i) => i !== rowIndex);
      return { rows: next.length > 0 ? next : [emptyConditionRow()] };
    });
  }

  protected removeComplexCondition(): void {
    if (this.state.readOnly()) return;
    this.complexReadOnly.set(false);
    this.complexExpression.set(null);
    this.mode.set('ALWAYS');
    this.visModel.set({ rows: [emptyConditionRow()] });
  }

  protected apply(): void {
    this.attempted.set(true);
    if (!this.canApply()) return;
    const id = this.targetNodeId();
    if (!id) return;

    const currentMode = this.mode();
    if (currentMode === 'ALWAYS') {
      this.state.apply('updateVisibility', (doc) => {
        const target = doc.nodes[id];
        if (!target) return;
        delete target.visibilityRule;
        delete target.visibilityExpression;
      });
      this.modal().close();
      return;
    }

    const operands: TemplateVisibilityExpression[] = this.rows().map((row) => {
      if (row.operator === 'IS_NULL') return { kind: 'IS_NULL', path: row.path };
      if (row.operator === 'IS_NOT_NULL') return { kind: 'IS_NOT_NULL', path: row.path };

      let value: string | number | boolean = row.valueStr;
      if (this.isBooleanType(row.path)) {
        value = row.valueBool;
      } else if (this.isNumericType(row.path)) {
        value = row.valueNum ?? 0;
      }

      return {
        kind: 'COMPARE',
        operator: row.operator,
        path: row.path,
        value,
      };
    });

    const expr: TemplateVisibilityExpression = {
      kind: this.matchKind(),
      operands,
    };

    this.state.apply('updateVisibility', (doc) => {
      const target = doc.nodes[id];
      if (!target) return;
      delete target.visibilityRule;
      target.visibilityExpression = expr;
    });
    this.modal().close();
  }

  protected cancel(): void {
    this.modal().close();
  }

  private rowPathErrorInternal(row: ConditionRow): string | null {
    return row.path.trim() ? null : this.transloco.translate('tplFields.visibility.fieldRequired');
  }

  private rowValueErrorInternal(row: ConditionRow, index: number): string | null {
    if (!this.needsValue(row.operator) || this.isBooleanType(row.path)) return null;
    if (this.isNumericType(row.path)) {
      const hasParse = this.visForm.rows[index]?.valueNum().errors().some((e) => e.kind === 'parse') ?? false;
      if (hasParse) return this.transloco.translate('tplFields.visibility.numberInvalid');
      if (row.valueNum === null) return this.transloco.translate('tplFields.visibility.valueRequired');
      if (!Number.isFinite(row.valueNum)) return this.transloco.translate('tplFields.visibility.numberInvalid');
      return null;
    }
    return row.valueStr.trim() ? null : this.transloco.translate('tplFields.visibility.valueRequired');
  }

  private describeExpression(expr: TemplateVisibilityExpression): string {
    switch (expr.kind) {
      case 'IS_NULL':
        return `${this.state.fieldLabel(expr.path)} ${this.transloco.translate('tplFields.visibility.operators.IS_NULL')}`;
      case 'IS_NOT_NULL':
        return `${this.state.fieldLabel(expr.path)} ${this.transloco.translate('tplFields.visibility.operators.IS_NOT_NULL')}`;
      case 'COMPARE': {
        const val =
          typeof expr.value === 'boolean'
            ? this.transloco.translate(expr.value ? 'tplFields.visibility.yes' : 'tplFields.visibility.no')
            : String(expr.value);
        return `${this.state.fieldLabel(expr.path)} ${this.transloco.translate(`tplFields.visibility.operators.${expr.operator}`)} ${val}`;
      }
      case 'NOT':
        return this.transloco.translate('tplFields.visibility.notPrefix', {
          expr: this.describeExpression(expr.operand),
        });
      case 'ALL':
        return `(${expr.operands.map((o) => this.describeExpression(o)).join(this.transloco.translate('tplFields.visibility.andJoin'))})`;
      case 'ANY':
        return `(${expr.operands.map((o) => this.describeExpression(o)).join(this.transloco.translate('tplFields.visibility.orJoin'))})`;
    }
  }
}
