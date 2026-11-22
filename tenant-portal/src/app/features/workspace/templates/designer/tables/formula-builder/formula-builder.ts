import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, input, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerBraces,
  tablerCheck,
  tablerLock,
  tablerMathFunction,
  tablerPlus,
  tablerTrash,
} from '@ng-icons/tabler-icons';
import { Button } from '../../../../../../shared/ui/button/button';
import { Checkbox } from '../../../../../../shared/ui/checkbox/checkbox';
import { DateField } from '../../../../../../shared/ui/date-time/date-field';
import { Dropdown, DropdownOption } from '../../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../../shared/ui/field/field';
import { Modal } from '../../../../../../shared/ui/modal/modal';
import { Segmented, SegmentedOption } from '../../../../../../shared/ui/segmented/segmented';
import type {
  TemplateCompareOperator,
  TemplateFieldDataType,
  TemplateFormulaDimension,
  TemplateFormulaRounding,
} from '../../../templates.model';
import { BindingFormat, DesignerState, FormulaExpression } from '../../designer-state';
import { FieldPicker } from '../../fields/field-picker/field-picker';
import {
  FormulaReadableLabels,
  MAX_FORMULA_STEPS,
  OpenFieldPickerFn,
  OtherFormulaOption,
  countFormulaAstNodes,
  formatFormulaReadable,
} from '../table-ops';

export interface FormulaBuildOptions {
  context: 'NODE' | 'STATIC_CELL' | 'DYNAMIC_CELL' | 'FUNCTION';
  expression?: FormulaExpression;
  format?: BindingFormat;
  rowArrayPath?: string;
  parameters?: readonly { name: string; type: string; dimension?: string }[];
  otherFormulas?: readonly { formulaId: string; name: string }[];
}

export type FormulaBuildResult = { expression: FormulaExpression; format?: BindingFormat };

type EditableOpKind =
  | 'DIRECT'
  | 'ADD'
  | 'SUBTRACT'
  | 'MULTIPLY'
  | 'SUM'
  | 'DIVIDE'
  | 'ROUND'
  | 'MIN'
  | 'MAX'
  | 'COALESCE'
  | 'CONCAT'
  | 'ABS'
  | 'NEGATE'
  | 'IS_NULL'
  | 'TRIM'
  | 'DATE_ADD_DAYS'
  | 'DATE_DIFF_DAYS'
  | 'COMPARE'
  | 'IF'
  | 'SUM_ROWS';

type SlotValueType =
  | 'FIELD'
  | 'NUMBER'
  | 'TEXT'
  | 'DATE'
  | 'BOOLEAN'
  | 'EMPTY'
  | 'FORMULA_REF'
  | 'PARAMETER'
  | 'OPERATION'
  | 'FUNCTION_CALL';

interface EditableFormulaBlock {
  uid: string;
  valueType: SlotValueType;
  opKind: EditableOpKind;
  operands: EditableFormulaBlock[];
  scale: string;
  rounding: TemplateFormulaRounding;
  compareOp: TemplateCompareOperator;
  sumRowsSourcePath: string;
  fieldKind: 'BINDING' | 'ROW_BINDING' | 'ROOT_BINDING';
  path: string;
  currencyCodePath?: string;
  decimalValue: string;
  dimension: TemplateFormulaDimension;
  currencyCode?: string;
  unitCode?: string;
  stringValue: string;
  dateValue: string;
  boolValue: boolean;
  formulaId: string;
  parameterName: string;
  preservedAst?: Extract<FormulaExpression, { kind: 'FUNCTION_CALL' }>;
}

const DECIMAL_RE = /^-?\d{1,30}(\.\d{1,18})?$/;
const NUMERIC_DATA_TYPES: readonly TemplateFieldDataType[] = [
  'NUMBER',
  'DECIMAL',
  'CURRENCY',
  'PERCENTAGE',
];
const DATE_DATA_TYPES: readonly TemplateFieldDataType[] = ['DATE', 'DATETIME'];
const TEXT_DATA_TYPES: readonly TemplateFieldDataType[] = ['STRING'];

let nextBlockUid = 0;

function newBlockUid(): string {
  return `fb-${++nextBlockUid}`;
}

function makeEmptyLeaf(
  valueType: SlotValueType,
  context: FormulaBuildOptions['context'],
  rowArrayPath?: string,
  defaultParam?: string,
  defaultFormulaId?: string,
): EditableFormulaBlock {
  return {
    uid: newBlockUid(),
    valueType,
    opKind: 'ADD',
    operands: [],
    scale: '2',
    rounding: 'HALF_UP',
    compareOp: 'EQ',
    sumRowsSourcePath: rowArrayPath ?? '',
    fieldKind: context === 'DYNAMIC_CELL' && rowArrayPath ? 'ROW_BINDING' : 'BINDING',
    path: '',
    decimalValue: '0',
    dimension: 'SCALAR',
    stringValue: '',
    dateValue: '',
    boolValue: true,
    formulaId: defaultFormulaId ?? '',
    parameterName: defaultParam ?? '',
  };
}

function makeDefaultOperationBlock(
  opKind: EditableOpKind,
  context: FormulaBuildOptions['context'],
  rowArrayPath?: string,
  defaultParam?: string,
): EditableFormulaBlock {
  const defaultSlotType: SlotValueType = context === 'FUNCTION' ? 'PARAMETER' : 'FIELD';
  const block = makeEmptyLeaf('OPERATION', context, rowArrayPath, defaultParam);
  block.opKind = opKind;
  block.operands = createSlotsForOp(opKind, [], defaultSlotType, context, rowArrayPath, defaultParam);
  return block;
}

function slotCountForOp(op: EditableOpKind): { min: number; max: number } {
  switch (op) {
    case 'DIRECT':
    case 'ROUND':
    case 'ABS':
    case 'NEGATE':
    case 'IS_NULL':
    case 'TRIM':
    case 'SUM_ROWS':
      return { min: 1, max: 1 };
    case 'SUBTRACT':
    case 'DIVIDE':
    case 'DATE_ADD_DAYS':
    case 'DATE_DIFF_DAYS':
    case 'COMPARE':
      return { min: 2, max: 2 };
    case 'IF':
      return { min: 3, max: 3 };
    default:
      return { min: 2, max: 32 };
  }
}

function createSlotsForOp(
  op: EditableOpKind,
  existing: readonly EditableFormulaBlock[],
  defaultSlotType: SlotValueType,
  context: FormulaBuildOptions['context'],
  rowArrayPath?: string,
  defaultParam?: string,
): EditableFormulaBlock[] {
  const { min, max } = slotCountForOp(op);
  const kept = existing.slice(0, max);
  while (kept.length < min) {
    kept.push(makeEmptyLeaf(defaultSlotType, context, rowArrayPath, defaultParam));
  }
  return kept;
}

function astToEditableBlock(
  expr: FormulaExpression,
  context: FormulaBuildOptions['context'],
  rowArrayPath?: string,
  isRoot = false,
): EditableFormulaBlock {
  const base = makeEmptyLeaf('FIELD', context, rowArrayPath);
  switch (expr.kind) {
    case 'DECIMAL_LITERAL':
      base.valueType = 'NUMBER';
      base.decimalValue = expr.value;
      base.dimension = expr.dimension ?? 'SCALAR';
      base.currencyCode = expr.currencyCode;
      base.unitCode = expr.unitCode;
      break;
    case 'STRING_LITERAL':
      base.valueType = 'TEXT';
      base.stringValue = expr.value;
      break;
    case 'DATE_LITERAL':
      base.valueType = 'DATE';
      base.dateValue = expr.value;
      break;
    case 'BOOLEAN_LITERAL':
      base.valueType = 'BOOLEAN';
      base.boolValue = expr.value;
      break;
    case 'NULL_LITERAL':
      base.valueType = 'EMPTY';
      break;
    case 'BINDING':
      base.valueType = 'FIELD';
      base.fieldKind = 'BINDING';
      base.path = expr.path;
      base.currencyCodePath = expr.currencyCodePath;
      break;
    case 'ROOT_BINDING':
      base.valueType = 'FIELD';
      base.fieldKind = 'ROOT_BINDING';
      base.path = expr.path;
      break;
    case 'ROW_BINDING':
      base.valueType = 'FIELD';
      base.fieldKind = 'ROW_BINDING';
      base.path = expr.path;
      break;
    case 'FORMULA_REF':
      base.valueType = 'FORMULA_REF';
      base.formulaId = expr.formulaId;
      break;
    case 'PARAMETER':
      base.valueType = 'PARAMETER';
      base.parameterName = expr.name;
      break;
    case 'FUNCTION_CALL':
      base.valueType = 'FUNCTION_CALL';
      base.preservedAst = structuredClone(expr);
      break;
    case 'ADD':
    case 'SUBTRACT':
    case 'MULTIPLY':
    case 'SUM':
    case 'MIN':
    case 'MAX':
    case 'COALESCE':
    case 'CONCAT':
      return {
        ...base,
        valueType: 'OPERATION',
        opKind: expr.kind,
        operands: expr.operands.map((op) => astToEditableBlock(op, context, rowArrayPath, false)),
      };
    case 'DIVIDE':
      return {
        ...base,
        valueType: 'OPERATION',
        opKind: 'DIVIDE',
        scale: String(expr.scale),
        rounding: expr.rounding,
        operands: [
          astToEditableBlock(expr.dividend, context, rowArrayPath, false),
          astToEditableBlock(expr.divisor, context, rowArrayPath, false),
        ],
      };
    case 'ROUND':
      return {
        ...base,
        valueType: 'OPERATION',
        opKind: 'ROUND',
        scale: String(expr.scale),
        rounding: expr.rounding,
        operands: [astToEditableBlock(expr.value, context, rowArrayPath, false)],
      };
    case 'ABS':
    case 'NEGATE':
    case 'IS_NULL':
    case 'TRIM':
      return {
        ...base,
        valueType: 'OPERATION',
        opKind: expr.kind,
        operands: [astToEditableBlock(expr.value, context, rowArrayPath, false)],
      };
    case 'DATE_ADD_DAYS':
      return {
        ...base,
        valueType: 'OPERATION',
        opKind: 'DATE_ADD_DAYS',
        operands: [
          astToEditableBlock(expr.date, context, rowArrayPath, false),
          astToEditableBlock(expr.days, context, rowArrayPath, false),
        ],
      };
    case 'DATE_DIFF_DAYS':
      return {
        ...base,
        valueType: 'OPERATION',
        opKind: 'DATE_DIFF_DAYS',
        operands: [
          astToEditableBlock(expr.left, context, rowArrayPath, false),
          astToEditableBlock(expr.right, context, rowArrayPath, false),
        ],
      };
    case 'COMPARE':
      return {
        ...base,
        valueType: 'OPERATION',
        opKind: 'COMPARE',
        compareOp: expr.operator,
        operands: [
          astToEditableBlock(expr.left, context, rowArrayPath, false),
          astToEditableBlock(expr.right, context, rowArrayPath, false),
        ],
      };
    case 'IF':
      return {
        ...base,
        valueType: 'OPERATION',
        opKind: 'IF',
        operands: [
          astToEditableBlock(expr.condition, context, rowArrayPath, false),
          astToEditableBlock(expr.whenTrue, context, rowArrayPath, false),
          astToEditableBlock(expr.whenFalse, context, rowArrayPath, false),
        ],
      };
    case 'SUM_ROWS':
      return {
        ...base,
        valueType: 'OPERATION',
        opKind: 'SUM_ROWS',
        sumRowsSourcePath: expr.sourcePath,
        operands: [astToEditableBlock(expr.item, 'DYNAMIC_CELL', expr.sourcePath, false)],
      };
  }

  if (isRoot) {
    const wrapper = makeEmptyLeaf('OPERATION', context, rowArrayPath);
    wrapper.opKind = 'DIRECT';
    wrapper.operands = [base];
    return wrapper;
  }
  return base;
}

function editableBlockToAst(block: EditableFormulaBlock): FormulaExpression {
  if (block.valueType === 'OPERATION') {
    const ops = block.operands.map((child) => editableBlockToAst(child));
    const parsedScale = Math.min(18, Math.max(0, Math.trunc(Number(block.scale) || 0)));

    switch (block.opKind) {
      case 'DIRECT':
        return ops[0] ?? { kind: 'NULL_LITERAL' };
      case 'ADD':
      case 'SUBTRACT':
      case 'MULTIPLY':
      case 'SUM':
      case 'MIN':
      case 'MAX':
      case 'COALESCE':
      case 'CONCAT':
        return { kind: block.opKind, operands: ops };
      case 'DIVIDE':
        return {
          kind: 'DIVIDE',
          dividend: ops[0] ?? { kind: 'NULL_LITERAL' },
          divisor: ops[1] ?? { kind: 'NULL_LITERAL' },
          scale: parsedScale,
          rounding: block.rounding,
        };
      case 'ROUND':
        return {
          kind: 'ROUND',
          value: ops[0] ?? { kind: 'NULL_LITERAL' },
          scale: parsedScale,
          rounding: block.rounding,
        };
      case 'ABS':
      case 'NEGATE':
      case 'IS_NULL':
      case 'TRIM':
        return { kind: block.opKind, value: ops[0] ?? { kind: 'NULL_LITERAL' } };
      case 'DATE_ADD_DAYS':
        return {
          kind: 'DATE_ADD_DAYS',
          date: ops[0] ?? { kind: 'NULL_LITERAL' },
          days: ops[1] ?? { kind: 'NULL_LITERAL' },
        };
      case 'DATE_DIFF_DAYS':
        return {
          kind: 'DATE_DIFF_DAYS',
          left: ops[0] ?? { kind: 'NULL_LITERAL' },
          right: ops[1] ?? { kind: 'NULL_LITERAL' },
        };
      case 'COMPARE':
        return {
          kind: 'COMPARE',
          operator: block.compareOp,
          left: ops[0] ?? { kind: 'NULL_LITERAL' },
          right: ops[1] ?? { kind: 'NULL_LITERAL' },
        };
      case 'IF':
        return {
          kind: 'IF',
          condition: ops[0] ?? { kind: 'NULL_LITERAL' },
          whenTrue: ops[1] ?? { kind: 'NULL_LITERAL' },
          whenFalse: ops[2] ?? { kind: 'NULL_LITERAL' },
        };
      case 'SUM_ROWS':
        return {
          kind: 'SUM_ROWS',
          sourcePath: block.sumRowsSourcePath,
          item: ops[0] ?? { kind: 'NULL_LITERAL' },
        };
    }
  }

  switch (block.valueType) {
    case 'FIELD':
      if (block.fieldKind === 'ROW_BINDING') {
        return { kind: 'ROW_BINDING', path: block.path };
      }
      if (block.fieldKind === 'ROOT_BINDING') {
        return { kind: 'ROOT_BINDING', path: block.path };
      }
      return {
        kind: 'BINDING',
        path: block.path,
        ...(block.currencyCodePath ? { currencyCodePath: block.currencyCodePath } : {}),
      };
    case 'NUMBER':
      return {
        kind: 'DECIMAL_LITERAL',
        value: block.decimalValue.trim(),
        dimension: block.dimension,
        ...(block.currencyCode ? { currencyCode: block.currencyCode } : {}),
        ...(block.unitCode ? { unitCode: block.unitCode } : {}),
      };
    case 'TEXT':
      return { kind: 'STRING_LITERAL', value: block.stringValue };
    case 'DATE':
      return { kind: 'DATE_LITERAL', value: block.dateValue };
    case 'BOOLEAN':
      return { kind: 'BOOLEAN_LITERAL', value: block.boolValue };
    case 'EMPTY':
      return { kind: 'NULL_LITERAL' };
    case 'FORMULA_REF':
      return { kind: 'FORMULA_REF', formulaId: block.formulaId };
    case 'PARAMETER':
      return { kind: 'PARAMETER', name: block.parameterName };
    case 'FUNCTION_CALL':
      return block.preservedAst ?? { kind: 'NULL_LITERAL' };
  }
}

function isBlockValid(
  block: EditableFormulaBlock,
  validFormulaIds: ReadonlySet<string>,
  validParamNames: ReadonlySet<string>,
): boolean {
  if (block.valueType === 'OPERATION') {
    if (block.opKind === 'DIVIDE' || block.opKind === 'ROUND') {
      const trimmed = block.scale.trim();
      if (!/^\d+$/.test(trimmed)) return false;
      const n = Number(trimmed);
      if (!Number.isInteger(n) || n < 0 || n > 18) return false;
    }
    if (block.opKind === 'DIVIDE' && block.operands[1]?.valueType === 'EMPTY') {
      return false;
    }
    if (block.opKind === 'SUM_ROWS' && !block.sumRowsSourcePath.trim()) {
      return false;
    }
    const { min } = slotCountForOp(block.opKind);
    if (block.operands.length < min) return false;
    return block.operands.every((child) => isBlockValid(child, validFormulaIds, validParamNames));
  }

  switch (block.valueType) {
    case 'FIELD':
      return block.path.trim().length > 0;
    case 'NUMBER':
      return DECIMAL_RE.test(block.decimalValue.trim());
    case 'TEXT':
      return true;
    case 'DATE':
      return /^\d{4}-\d{2}-\d{2}$/.test(block.dateValue.trim());
    case 'BOOLEAN':
    case 'EMPTY':
    case 'FUNCTION_CALL':
      return true;
    case 'FORMULA_REF':
      return block.formulaId.trim().length > 0 && validFormulaIds.has(block.formulaId);
    case 'PARAMETER':
      return (
        block.parameterName.trim().length > 0 &&
        (validParamNames.size === 0 || validParamNames.has(block.parameterName))
      );
  }
}

function updateBlockInTree(
  node: EditableFormulaBlock,
  targetUid: string,
  updater: (target: EditableFormulaBlock) => EditableFormulaBlock,
): EditableFormulaBlock {
  if (node.uid === targetUid) {
    return updater(node);
  }
  if (node.valueType !== 'OPERATION') return node;
  let changed = false;
  const nextOperands = node.operands.map((child) => {
    const updated = updateBlockInTree(child, targetUid, updater);
    if (updated !== child) changed = true;
    return updated;
  });
  return changed ? { ...node, operands: nextOperands } : node;
}

@Component({
  selector: 'app-tpl-formula-builder',
  imports: [
    NgTemplateOutlet,
    NgIcon,
    TranslocoPipe,
    Modal,
    Button,
    Dropdown,
    Field,
    Checkbox,
    DateField,
    Segmented,
    FieldPicker,
  ],
  providers: [
    provideTranslocoScope('templates', { scope: 'templates-designer-tables', alias: 'tplTables' }),
    provideIcons({ tablerMathFunction, tablerPlus, tablerTrash, tablerBraces, tablerLock, tablerCheck }),
  ],
  templateUrl: './formula-builder.html',
})
export class FormulaBuilder {
  private static nextId = 0;
  protected readonly uid = `formula-builder-${++FormulaBuilder.nextId}`;

  protected readonly state = inject(DesignerState, { optional: true });
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  private readonly modal = viewChild.required<Modal>('formulaModal');
  private readonly internalPicker = viewChild<FieldPicker>('internalPicker');

  readonly pickField = input<OpenFieldPickerFn | null>(null);

  protected readonly options = signal<FormulaBuildOptions>({ context: 'NODE' });
  protected readonly rootBlock = signal<EditableFormulaBlock>(
    makeDefaultOperationBlock('MULTIPLY', 'NODE'),
  );
  protected readonly formatKind = signal<'NONE' | 'NUMBER' | 'CURRENCY' | 'PERCENTAGE'>('NONE');
  protected readonly minDecimals = signal('2');
  protected readonly maxDecimals = signal('2');
  protected readonly useGrouping = signal(true);
  protected readonly currencyCodePath = signal('');
  protected readonly attemptedApply = signal(false);
  private readonly touchedFields = signal<ReadonlySet<string>>(new Set());

  private resolver: ((result: FormulaBuildResult | null) => void) | null = null;
  private isOpen = false;

  protected readonly context = computed(() => this.options().context);
  protected readonly readOnly = computed(() => Boolean(this.state?.readOnly()));
  protected readonly showFormatSection = computed(() => this.context() !== 'FUNCTION');
  protected readonly validFormulaIds = computed(
    () => new Set((this.options().otherFormulas ?? []).map((f) => f.formulaId)),
  );
  protected readonly validParamNames = computed(
    () => new Set((this.options().parameters ?? []).map((p) => p.name)),
  );

  protected readonly operationOptions = computed<DropdownOption<EditableOpKind>[]>(() => {
    this.i18n();
    const ctx = this.context();
    const ops: EditableOpKind[] = [
      'ADD',
      'SUBTRACT',
      'MULTIPLY',
      'DIVIDE',
      'ROUND',
      'MIN',
      'MAX',
      'COALESCE',
      'CONCAT',
      'ABS',
      'NEGATE',
      'IS_NULL',
      'TRIM',
      'DATE_ADD_DAYS',
      'DATE_DIFF_DAYS',
      'COMPARE',
      'IF',
    ];
    if (ctx === 'DYNAMIC_CELL') {
      ops.push('SUM_ROWS');
    }
    return [
      ...ops.map((op) => ({
        value: op,
        label: this.transloco.translate(`tplTables.formula.ops.${op}`),
      })),
      {
        value: 'DIRECT' as const,
        label: this.transloco.translate('tplTables.formula.ops.DIRECT'),
      },
    ];
  });

  protected readonly nestedOperationOptions = computed<DropdownOption<EditableOpKind>[]>(() =>
    this.operationOptions().filter((opt) => opt.value !== 'DIRECT'),
  );

  protected readonly valueTypeOptions = computed<DropdownOption<SlotValueType>[]>(() => {
    this.i18n();
    const ctx = this.context();
    const otherCount = this.options().otherFormulas?.length ?? 0;
    const paramCount = this.options().parameters?.length ?? 0;
    const list: DropdownOption<SlotValueType>[] = [];

    if (ctx !== 'FUNCTION') {
      list.push({ value: 'FIELD', label: this.transloco.translate('tplTables.formula.valueTypes.FIELD') });
    }
    list.push(
      { value: 'NUMBER', label: this.transloco.translate('tplTables.formula.valueTypes.NUMBER') },
      { value: 'TEXT', label: this.transloco.translate('tplTables.formula.valueTypes.TEXT') },
      { value: 'DATE', label: this.transloco.translate('tplTables.formula.valueTypes.DATE') },
      { value: 'BOOLEAN', label: this.transloco.translate('tplTables.formula.valueTypes.BOOLEAN') },
      { value: 'EMPTY', label: this.transloco.translate('tplTables.formula.valueTypes.EMPTY') },
    );
    if (ctx !== 'FUNCTION') {
      list.push({
        value: 'FORMULA_REF',
        label: this.transloco.translate('tplTables.formula.valueTypes.FORMULA_REF'),
        disabled: otherCount === 0,
      });
    } else {
      list.push({
        value: 'PARAMETER',
        label: this.transloco.translate('tplTables.formula.valueTypes.PARAMETER'),
        disabled: paramCount === 0,
      });
    }
    list.push({
      value: 'OPERATION',
      label: this.transloco.translate('tplTables.formula.valueTypes.OPERATION'),
    });
    return list;
  });

  protected readonly dimensionOptions = computed<DropdownOption<TemplateFormulaDimension>[]>(() => {
    this.i18n();
    const dims: TemplateFormulaDimension[] = ['SCALAR', 'MONEY', 'QUANTITY', 'UNIT_PRICE'];
    return dims.map((d) => ({
      value: d,
      label: this.transloco.translate(`tplTables.formula.dimensions.${d}`),
    }));
  });

  protected readonly roundingOptions = computed<DropdownOption<TemplateFormulaRounding>[]>(() => {
    this.i18n();
    const list: TemplateFormulaRounding[] = ['HALF_UP', 'HALF_EVEN', 'DOWN'];
    return list.map((r) => ({
      value: r,
      label: this.transloco.translate(`tplTables.formula.rounding.${r}`),
    }));
  });

  protected readonly compareOpOptions = computed<DropdownOption<TemplateCompareOperator>[]>(() => {
    this.i18n();
    const ops: TemplateCompareOperator[] = ['EQ', 'NE', 'LT', 'LTE', 'GT', 'GTE'];
    return ops.map((op) => ({
      value: op,
      label: this.transloco.translate(`tplTables.formula.compareOps.${op}`),
    }));
  });

  protected readonly boolOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    return [
      { value: 'true', label: this.transloco.translate('tplTables.formula.yes') },
      { value: 'false', label: this.transloco.translate('tplTables.formula.no') },
    ];
  });

  protected readonly otherFormulaOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const others = this.options().otherFormulas ?? [];
    if (others.length === 0) {
      return [
        {
          value: '',
          label: this.transloco.translate('tplTables.formula.noOtherFormulas'),
          disabled: true,
        },
      ];
    }
    return others.map((f) => ({ value: f.formulaId, label: f.name }));
  });

  protected readonly parameterOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const params = this.options().parameters ?? [];
    if (params.length === 0) {
      return [
        {
          value: '',
          label: this.transloco.translate('tplTables.formula.noParameters'),
          disabled: true,
        },
      ];
    }
    return params.map((p) => ({ value: p.name, label: p.name }));
  });

  protected readonly formatOptions = computed<DropdownOption<'NONE' | 'NUMBER' | 'CURRENCY' | 'PERCENTAGE'>[]>(
    () => {
      this.i18n();
      return [
        { value: 'NONE', label: this.transloco.translate('tplTables.formula.format.NONE') },
        { value: 'NUMBER', label: this.transloco.translate('tplTables.formula.format.NUMBER') },
        { value: 'CURRENCY', label: this.transloco.translate('tplTables.formula.format.CURRENCY') },
        { value: 'PERCENTAGE', label: this.transloco.translate('tplTables.formula.format.PERCENTAGE') },
      ];
    },
  );

  protected readonly arrayOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const fields = this.state?.schema()?.fields.filter((f) => f.dataType === 'ARRAY') ?? [];
    return fields.map((f) => ({
      value: f.path,
      label: this.resolveFieldLabel(f.path),
    }));
  });

  protected readonly astExpression = computed(() => editableBlockToAst(this.rootBlock()));
  protected readonly stepCount = computed(() => countFormulaAstNodes(this.astExpression()));
  protected readonly stepsExceeded = computed(() => this.stepCount() > MAX_FORMULA_STEPS);

  protected readonly decimalsOrderError = computed(() => {
    this.i18n();
    if (this.formatKind() === 'NONE') return null;
    const min = Number(this.minDecimals());
    const max = Number(this.maxDecimals());
    if (!Number.isInteger(min) || min < 0 || min > 8 || !Number.isInteger(max) || max < 0 || max > 8) {
      return this.transloco.translate('tplTables.formula.format.decimalsOrderError');
    }
    if (min > max) {
      return this.transloco.translate('tplTables.formula.format.decimalsOrderError');
    }
    return null;
  });

  protected readonly canApply = computed(() => {
    if (this.readOnly() || this.stepsExceeded()) return false;
    if (this.showFormatSection() && this.decimalsOrderError()) return false;
    return isBlockValid(this.rootBlock(), this.validFormulaIds(), this.validParamNames());
  });

  protected readonly readableExpression = computed(() => {
    this.i18n();
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
      this.astExpression(),
      (path) => this.resolveFieldLabel(path),
      (id) => this.resolveFormulaName(id),
      labels,
    );
  });

  open(options: FormulaBuildOptions): Promise<FormulaBuildResult | null> {
    this.settle(null);
    this.options.set(options);
    this.attemptedApply.set(false);
    this.touchedFields.set(new Set());

    if (options.expression) {
      this.rootBlock.set(
        astToEditableBlock(options.expression, options.context, options.rowArrayPath, true),
      );
    } else {
      const defaultParam = options.parameters?.[0]?.name;
      this.rootBlock.set(
        makeDefaultOperationBlock('MULTIPLY', options.context, options.rowArrayPath, defaultParam),
      );
    }

    const fmt = options.format;
    if (fmt && (fmt.kind === 'NUMBER' || fmt.kind === 'CURRENCY' || fmt.kind === 'PERCENTAGE')) {
      this.formatKind.set(fmt.kind);
      this.minDecimals.set(String(fmt.minFractionDigits ?? 2));
      this.maxDecimals.set(String(fmt.maxFractionDigits ?? 2));
      this.useGrouping.set(fmt.useGrouping ?? true);
      this.currencyCodePath.set(fmt.kind === 'CURRENCY' ? (fmt.currencyCodePath ?? '') : '');
    } else {
      this.formatKind.set('NONE');
      this.minDecimals.set('2');
      this.maxDecimals.set('2');
      this.useGrouping.set(true);
      this.currencyCodePath.set('');
    }

    this.isOpen = true;
    this.modal().open();

    return new Promise<FormulaBuildResult | null>((resolve) => {
      this.resolver = resolve;
    });
  }

  protected apply(): void {
    this.attemptedApply.set(true);
    if (!this.canApply()) return;
    const expression = editableBlockToAst(this.rootBlock());
    const format = this.buildFormat();
    const result: FormulaBuildResult = format ? { expression, format } : { expression };
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
    if (this.isOpen) {
      this.isOpen = false;
      this.settle(null);
    }
  }

  protected onOperationChange(uid: string, nextOp: EditableOpKind): void {
    if (this.readOnly()) return;
    const ctx = this.context();
    const defaultSlotType: SlotValueType = ctx === 'FUNCTION' ? 'PARAMETER' : 'FIELD';
    const defaultParam = this.options().parameters?.[0]?.name;
    const rowPath = this.options().rowArrayPath;
    const defaultArrayPath =
      rowPath ?? this.state?.schema()?.fields.find((f) => f.dataType === 'ARRAY')?.path ?? '';

    this.rootBlock.update((root) =>
      updateBlockInTree(root, uid, (target) => {
        const nextSumSourcePath =
          nextOp === 'SUM_ROWS' ? (target.sumRowsSourcePath || defaultArrayPath) : target.sumRowsSourcePath;
        const nextRowPath = nextOp === 'SUM_ROWS' ? nextSumSourcePath : rowPath;
        const nextOperands = createSlotsForOp(
          nextOp,
          target.operands,
          defaultSlotType,
          nextOp === 'SUM_ROWS' ? 'DYNAMIC_CELL' : ctx,
          nextRowPath,
          defaultParam,
        );
        return {
          ...target,
          opKind: nextOp,
          sumRowsSourcePath: nextSumSourcePath,
          operands: nextOperands,
        };
      }),
    );
  }

  protected onCompareOpChange(uid: string, operator: TemplateCompareOperator): void {
    if (this.readOnly()) return;
    this.rootBlock.update((root) =>
      updateBlockInTree(root, uid, (target) => ({ ...target, compareOp: operator })),
    );
  }

  protected onScaleInput(uid: string, event: Event): void {
    if (this.readOnly()) return;
    const value = (event.target as HTMLInputElement).value;
    this.rootBlock.update((root) =>
      updateBlockInTree(root, uid, (target) => ({ ...target, scale: value })),
    );
  }

  protected onRoundingChange(uid: string, rounding: TemplateFormulaRounding): void {
    if (this.readOnly()) return;
    this.rootBlock.update((root) =>
      updateBlockInTree(root, uid, (target) => ({ ...target, rounding })),
    );
  }

  protected onSumSourceChange(uid: string, sourcePath: string): void {
    if (this.readOnly()) return;
    this.markTouched(`${uid}-sum-src`);
    this.rootBlock.update((root) =>
      updateBlockInTree(root, uid, (target) => ({
        ...target,
        sumRowsSourcePath: sourcePath,
        operands: [makeEmptyLeaf('FIELD', 'DYNAMIC_CELL', sourcePath)],
      })),
    );
  }

  protected async pickSumSourcePath(uid: string, currentPath: string): Promise<void> {
    if (this.readOnly()) return;
    try {
      const pick = await this.invokePicker({
        purpose: 'PATH',
        accept: 'ARRAY',
        initial: currentPath ? { path: currentPath } : undefined,
        titleKey: 'source.title',
      });
      if (!pick) return;
      this.onSumSourceChange(uid, pick.path);
    } finally {
      this.markTouched(`${uid}-sum-src`);
    }
  }

  protected onValueTypeChange(uid: string, nextType: SlotValueType, rowContextPath: string): void {
    if (this.readOnly()) return;
    const ctx = this.context();
    const defaultParam = this.options().parameters?.[0]?.name ?? '';
    const defaultFormula = this.options().otherFormulas?.[0]?.formulaId ?? '';

    this.rootBlock.update((root) =>
      updateBlockInTree(root, uid, (target) => {
        if (nextType === 'OPERATION') {
          const opCtx = rowContextPath ? 'DYNAMIC_CELL' : ctx;
          const child = makeDefaultOperationBlock('ADD', opCtx, rowContextPath || undefined, defaultParam);
          child.uid = target.uid;
          return child;
        }
        return {
          ...target,
          valueType: nextType,
          fieldKind: rowContextPath ? 'ROW_BINDING' : 'BINDING',
          formulaId: target.formulaId || defaultFormula,
          parameterName: target.parameterName || defaultParam,
        };
      }),
    );
  }

  protected onDecimalInput(uid: string, event: Event): void {
    if (this.readOnly()) return;
    const decimalValue = (event.target as HTMLInputElement).value;
    this.rootBlock.update((root) =>
      updateBlockInTree(root, uid, (target) => ({ ...target, decimalValue })),
    );
  }

  protected onDimensionChange(uid: string, dimension: TemplateFormulaDimension): void {
    if (this.readOnly()) return;
    this.rootBlock.update((root) =>
      updateBlockInTree(root, uid, (target) => ({ ...target, dimension })),
    );
  }

  protected onTextInput(uid: string, event: Event): void {
    if (this.readOnly()) return;
    const stringValue = (event.target as HTMLInputElement).value;
    this.rootBlock.update((root) =>
      updateBlockInTree(root, uid, (target) => ({ ...target, stringValue })),
    );
  }

  protected onDateChange(uid: string, dateValue: string | null): void {
    if (this.readOnly()) return;
    this.markTouched(`${uid}-date`);
    this.rootBlock.update((root) =>
      updateBlockInTree(root, uid, (target) => ({ ...target, dateValue: dateValue ?? '' })),
    );
  }

  protected onBoolChange(uid: string, val: string | null): void {
    if (this.readOnly()) return;
    this.rootBlock.update((root) =>
      updateBlockInTree(root, uid, (target) => ({ ...target, boolValue: val === 'true' })),
    );
  }

  protected onFormulaRefChange(uid: string, formulaId: string): void {
    if (this.readOnly()) return;
    this.markTouched(`${uid}-fref`);
    this.rootBlock.update((root) =>
      updateBlockInTree(root, uid, (target) => ({ ...target, formulaId })),
    );
  }

  protected onParameterChange(uid: string, parameterName: string): void {
    if (this.readOnly()) return;
    this.markTouched(`${uid}-param`);
    this.rootBlock.update((root) =>
      updateBlockInTree(root, uid, (target) => ({ ...target, parameterName })),
    );
  }

  protected addOperand(uid: string, rowContextPath: string): void {
    if (this.readOnly()) return;
    const ctx = this.context();
    const defaultSlotType: SlotValueType = ctx === 'FUNCTION' ? 'PARAMETER' : 'FIELD';
    const defaultParam = this.options().parameters?.[0]?.name;
    this.rootBlock.update((root) =>
      updateBlockInTree(root, uid, (target) => {
        if (target.operands.length >= 32) return target;
        return {
          ...target,
          operands: [
            ...target.operands,
            makeEmptyLeaf(defaultSlotType, rowContextPath ? 'DYNAMIC_CELL' : ctx, rowContextPath || undefined, defaultParam),
          ],
        };
      }),
    );
  }

  protected removeOperand(parentUid: string, childIndex: number): void {
    if (this.readOnly()) return;
    this.rootBlock.update((root) =>
      updateBlockInTree(root, parentUid, (target) => {
        const { min } = slotCountForOp(target.opKind);
        if (target.operands.length <= min) return target;
        return {
          ...target,
          operands: target.operands.filter((_, idx) => idx !== childIndex),
        };
      }),
    );
  }

  protected async pickSlotField(
    slot: EditableFormulaBlock,
    parentOp: EditableOpKind,
    slotIndex: number,
    rowContextPath: string,
    useRootField = false,
  ): Promise<void> {
    if (this.readOnly()) return;
    const isRow = Boolean(rowContextPath) && !useRootField;
    const dataTypes = this.expectedDataTypesForSlot(parentOp, slotIndex);
    try {
      const pick = await this.invokePicker({
        purpose: 'PATH',
        accept: isRow ? 'ROW_SCALAR' : 'SCALAR',
        rowArrayPath: isRow ? rowContextPath : undefined,
        dataTypes,
        initial: slot.path ? { path: slot.path } : undefined,
      });
      if (!pick) return;

      const fieldKind: EditableFormulaBlock['fieldKind'] = isRow
        ? 'ROW_BINDING'
        : this.context() === 'DYNAMIC_CELL'
          ? 'ROOT_BINDING'
          : 'BINDING';

      this.rootBlock.update((root) =>
        updateBlockInTree(root, slot.uid, (target) => ({
          ...target,
          valueType: 'FIELD',
          fieldKind,
          path: pick.path,
        })),
      );
    } finally {
      this.markTouched(`${slot.uid}-field`);
    }
  }

  protected async pickCurrencyPath(): Promise<void> {
    if (this.readOnly()) return;
    const pick = await this.invokePicker({
      purpose: 'PATH',
      accept: 'SCALAR',
      dataTypes: TEXT_DATA_TYPES,
      initial: this.currencyCodePath() ? { path: this.currencyCodePath() } : undefined,
    });
    if (!pick) return;
    this.currencyCodePath.set(pick.path);
  }

  protected clearCurrencyPath(): void {
    if (this.readOnly()) return;
    this.currencyCodePath.set('');
  }

  protected onMinDecimalsInput(event: Event): void {
    this.minDecimals.set((event.target as HTMLInputElement).value);
  }

  protected onMaxDecimalsInput(event: Event): void {
    this.maxDecimals.set((event.target as HTMLInputElement).value);
  }

  protected onUseGroupingChange(checked: boolean): void {
    if (this.readOnly()) return;
    this.useGrouping.set(checked);
  }

  protected canAddOperand(opKind: EditableOpKind, count: number): boolean {
    return (
      (opKind === 'ADD' ||
        opKind === 'MULTIPLY' ||
        opKind === 'SUM' ||
        opKind === 'MIN' ||
        opKind === 'MAX' ||
        opKind === 'COALESCE' ||
        opKind === 'CONCAT') &&
      count < 32
    );
  }

  protected canRemoveOperand(opKind: EditableOpKind, count: number): boolean {
    const { min } = slotCountForOp(opKind);
    return this.canAddOperand(opKind, count) && count > min;
  }

  protected slotTitle(opKind: EditableOpKind, index: number): string {
    this.i18n();
    switch (opKind) {
      case 'DIVIDE':
        return this.transloco.translate(
          index === 0 ? 'tplTables.formula.dividendLabel' : 'tplTables.formula.divisorLabel',
        );
      case 'ROUND':
      case 'ABS':
      case 'NEGATE':
      case 'IS_NULL':
      case 'TRIM':
        return this.transloco.translate('tplTables.formula.valueLabel');
      case 'DATE_ADD_DAYS':
        return this.transloco.translate(
          index === 0 ? 'tplTables.formula.dateLabel' : 'tplTables.formula.daysLabel',
        );
      case 'DATE_DIFF_DAYS':
      case 'COMPARE':
        return this.transloco.translate(
          index === 0 ? 'tplTables.formula.leftLabel' : 'tplTables.formula.rightLabel',
        );
      case 'IF':
        return this.transloco.translate(
          index === 0
            ? 'tplTables.formula.conditionLabel'
            : index === 1
              ? 'tplTables.formula.whenTrueLabel'
              : 'tplTables.formula.whenFalseLabel',
        );
      case 'SUM_ROWS':
        return this.transloco.translate('tplTables.formula.sumItemLabel');
      default:
        return this.transloco.translate('tplTables.formula.slotLabel', { n: index + 1 });
    }
  }

  protected resolveFieldLabel(path: string): string {
    if (!path) return '';
    if (this.state) return this.state.fieldLabel(path);
    const key = `tplFields.labels.${path}`;
    const translated = this.transloco.translate(key);
    return translated && translated !== key ? translated : path;
  }

  protected markTouched(key: string): void {
    this.touchedFields.update((set) => {
      if (set.has(key)) return set;
      const next = new Set(set);
      next.add(key);
      return next;
    });
  }

  protected sumSourceError(block: EditableFormulaBlock): string | null {
    this.i18n();
    if (block.opKind !== 'SUM_ROWS') return null;
    if (!this.attemptedApply() && !this.touchedFields().has(`${block.uid}-sum-src`)) return null;
    return block.sumRowsSourcePath.trim()
      ? null
      : this.transloco.translate('tplTables.formula.sumSourceRequired');
  }

  protected slotValueTypeError(
    parent: EditableFormulaBlock,
    index: number,
    slot: EditableFormulaBlock,
  ): string | null {
    this.i18n();
    if (parent.opKind === 'DIVIDE' && index === 1 && slot.valueType === 'EMPTY') {
      return this.transloco.translate('tplTables.formula.divisorEmptyError');
    }
    return null;
  }

  protected fieldSlotError(slot: EditableFormulaBlock): string | null {
    this.i18n();
    if (!this.attemptedApply() && !this.touchedFields().has(`${slot.uid}-field`)) return null;
    return slot.path.trim() ? null : this.transloco.translate('tplTables.formula.fieldRequired');
  }

  protected numberError(value: string, slotUid: string): string | null {
    this.i18n();
    if (!this.attemptedApply() && !this.touchedFields().has(`${slotUid}-num`) && value === '0') {
      return null;
    }
    return DECIMAL_RE.test(value.trim()) ? null : this.transloco.translate('tplTables.formula.numberInvalid');
  }

  protected dateSlotError(slot: EditableFormulaBlock): string | null {
    this.i18n();
    if (!this.attemptedApply() && !this.touchedFields().has(`${slot.uid}-date`)) return null;
    return /^\d{4}-\d{2}-\d{2}$/.test(slot.dateValue.trim())
      ? null
      : this.transloco.translate('tplTables.formula.dateRequired');
  }

  protected formulaRefError(slot: EditableFormulaBlock): string | null {
    this.i18n();
    const id = slot.formulaId.trim();
    if (id && !this.validFormulaIds().has(id)) {
      return this.transloco.translate('tplTables.formula.formulaRefInvalid');
    }
    if (!this.attemptedApply() && !this.touchedFields().has(`${slot.uid}-fref`)) return null;
    return id ? null : this.transloco.translate('tplTables.formula.formulaRefInvalid');
  }

  protected parameterError(slot: EditableFormulaBlock): string | null {
    this.i18n();
    if (!this.attemptedApply() && !this.touchedFields().has(`${slot.uid}-param`)) return null;
    const name = slot.parameterName.trim();
    if (!name || (this.validParamNames().size > 0 && !this.validParamNames().has(name))) {
      return this.transloco.translate('tplTables.formula.parameterRequired');
    }
    return null;
  }

  protected scaleError(scale: string): string | null {
    this.i18n();
    const trimmed = scale.trim();
    if (/^\d+$/.test(trimmed)) {
      const n = Number(trimmed);
      if (Number.isInteger(n) && n >= 0 && n <= 18) return null;
    }
    return this.transloco.translate('tplTables.formula.scaleHint');
  }

  protected operationOptionsFor(
    block: EditableFormulaBlock,
    isRoot: boolean,
    insideSumRows: boolean,
  ): DropdownOption<EditableOpKind>[] {
    let opts = isRoot ? this.operationOptions() : this.nestedOperationOptions();
    if (insideSumRows && block.opKind !== 'SUM_ROWS') {
      opts = opts.filter((o) => o.value !== 'SUM_ROWS');
    }
    if (block.opKind === 'SUM') {
      opts = [
        ...opts,
        { value: 'SUM', label: this.transloco.translate('tplTables.formula.ops.SUM') },
      ];
    }
    return opts;
  }

  protected slotValueTypeOptionsFor(slot: EditableFormulaBlock): DropdownOption<SlotValueType>[] {
    if (slot.valueType === 'FUNCTION_CALL') {
      return [
        ...this.valueTypeOptions(),
        {
          value: 'FUNCTION_CALL',
          label: this.transloco.translate('tplTables.formula.functionGated'),
          disabled: true,
        },
      ];
    }
    return this.valueTypeOptions();
  }

  private expectedDataTypesForSlot(
    op: EditableOpKind,
    index: number,
  ): readonly TemplateFieldDataType[] | undefined {
    switch (op) {
      case 'ADD':
      case 'SUBTRACT':
      case 'MULTIPLY':
      case 'SUM':
      case 'DIVIDE':
      case 'ROUND':
      case 'ABS':
      case 'NEGATE':
        return NUMERIC_DATA_TYPES;
      case 'DATE_ADD_DAYS':
        return index === 0 ? DATE_DATA_TYPES : NUMERIC_DATA_TYPES;
      case 'DATE_DIFF_DAYS':
        return DATE_DATA_TYPES;
      case 'TRIM':
        return TEXT_DATA_TYPES;
      default:
        return undefined;
    }
  }

  private resolveFormulaName(id: string): string {
    const found = this.options().otherFormulas?.find((f) => f.formulaId === id);
    return found?.name || id;
  }

  private buildFormat(): BindingFormat | undefined {
    if (!this.showFormatSection()) return undefined;
    const kind = this.formatKind();
    if (kind === 'NONE') return undefined;
    const minFractionDigits = Math.min(8, Math.max(0, Math.trunc(Number(this.minDecimals()) || 0)));
    const maxFractionDigits = Math.min(
      8,
      Math.max(minFractionDigits, Math.trunc(Number(this.maxDecimals()) || 0)),
    );
    const useGrouping = this.useGrouping();

    if (kind === 'CURRENCY') {
      const currencyCodePath = this.currencyCodePath().trim();
      return {
        kind: 'CURRENCY',
        minFractionDigits,
        maxFractionDigits,
        useGrouping,
        ...(currencyCodePath ? { currencyCodePath } : {}),
      };
    }

    return {
      kind,
      minFractionDigits,
      maxFractionDigits,
      useGrouping,
    };
  }

  private async invokePicker(options: Parameters<OpenFieldPickerFn>[0]) {
    const injectedPicker = this.pickField();
    if (injectedPicker) {
      return injectedPicker(options);
    }
    const internal = this.internalPicker();
    if (internal) {
      return internal.open(options);
    }
    return null;
  }

  private settle(result: FormulaBuildResult | null): void {
    const res = this.resolver;
    this.resolver = null;
    res?.(result);
  }
}
