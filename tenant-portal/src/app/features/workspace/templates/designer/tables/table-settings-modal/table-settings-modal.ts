import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, input, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerArrowDown,
  tablerArrowUp,
  tablerBraces,
  tablerCheck,
  tablerLock,
  tablerMinus,
  tablerPhoto,
  tablerPlus,
  tablerTable,
  tablerTrash,
  tablerX,
} from '@ng-icons/tabler-icons';
import { Button } from '../../../../../../shared/ui/button/button';
import { Checkbox } from '../../../../../../shared/ui/checkbox/checkbox';
import { ConfirmDialog } from '../../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Dropdown, DropdownOption } from '../../../../../../shared/ui/dropdown/dropdown';
import { ColorPicker } from '../../../../../../shared/ui/color-picker/color-picker';
import { designerColorSwatches } from '../../designer-color-swatches';
import { Field } from '../../../../../../shared/ui/field/field';
import { Modal } from '../../../../../../shared/ui/modal/modal';
import type {
  TemplateDynamicTableColumn,
  TemplateDynamicTableEmptyBehavior,
  TemplateDynamicTableNode,
  TemplateFontWeight,
  TemplateObjectFit,
  TemplateProductImageColumnSpec,
  TemplateStaticTableColumn,
  TemplateStaticTableNode,
  TemplateTableAlign,
  TemplateTableBand,
  TemplateTableCell,
  TemplateTableCellBorderStyle,
  TemplateTableCellStyle,
  TemplateTableCellValue,
  TemplateTableRepeatHeader,
  TemplateTableRow,
  TemplateTableRowSplit,
} from '../../../templates.model';
import { DesignerState } from '../../designer-state';
import { newDesignerUuid } from '../../document-ops';
import type { CellEditRequest, CellEditResult } from '../cell-editor-modal/cell-editor-modal';
import {
  DEFAULT_STATIC_TABLE_HEIGHT_MM,
  DEFAULT_STATIC_TABLE_WIDTH_MM,
  MAX_DYNAMIC_EMPTY_ROWS,
  MAX_DYNAMIC_ROW_BUDGET,
  MAX_STATIC_TABLE_ROWS,
  MAX_TABLE_COLUMNS,
  OpenFieldPickerFn,
  OtherFormulaOption,
  WIDTH_FIT_TOLERANCE,
  canMoveStaticColumn,
  cleanTableCellStyle,
  collectOtherFormulas,
  computeStaticTableCoverage,
  createEmptyTextCell,
  defaultDocumentHeaderText,
  formulaReferencesList,
  hasSourceProductImage,
  isValidSafeColor,
  normalizeSafeColor,
  removeStaticColumnFromRows,
  roundToDecimals,
  scaleNumbersToTarget,
} from '../table-ops';

export type EditCellFn = (req: CellEditRequest) => Promise<CellEditResult | null>;

interface EditableColumnDraft {
  id: string;
  widthValue: string;
  align: TemplateTableAlign;
  verticalAlign: 'TOP' | 'MIDDLE' | 'BOTTOM';
  wrap: boolean;
  visible: boolean;
  headerStyle?: TemplateTableCellStyle;
  cellStyle?: TemplateTableCellStyle;
  // Dynamic only:
  header: TemplateTableCellValue;
  dynamicKind: 'VALUE' | 'PRODUCT_IMAGE';
  value: TemplateTableCellValue;
  productImage: TemplateProductImageColumnSpec;
}

interface EditableCellStyleDraft {
  fontSizePx: string;
  fontWeight: '' | TemplateFontWeight;
  color: string;
  backgroundColor: string;
  padTop: string;
  padEnd: string;
  padBottom: string;
  padStart: string;
  borderWidthPx: string;
  borderStyle: TemplateTableCellBorderStyle;
  borderColor: string;
}

function toStyleDraft(style?: TemplateTableCellStyle): EditableCellStyleDraft {
  return {
    fontSizePx: style?.fontSizePx !== undefined ? String(style.fontSizePx) : '',
    fontWeight: style?.fontWeight ?? '',
    color: style?.color ?? '',
    backgroundColor: style?.backgroundColor ?? '',
    padTop: style?.paddingPx ? String(style.paddingPx.top) : '',
    padEnd: style?.paddingPx ? String(style.paddingPx.end) : '',
    padBottom: style?.paddingPx ? String(style.paddingPx.bottom) : '',
    padStart: style?.paddingPx ? String(style.paddingPx.start) : '',
    borderWidthPx: style?.border ? String(style.border.widthPx) : '',
    borderStyle: style?.border?.style ?? 'SOLID',
    borderColor: style?.border?.color ?? '',
  };
}

function emptyStyleDraft(): EditableCellStyleDraft {
  return toStyleDraft(undefined);
}

function isOptionalSafeColor(value: string): boolean {
  return !value.trim() || isValidSafeColor(value);
}

function isStyleDraftValid(draft: EditableCellStyleDraft): boolean {
  if (draft.fontSizePx.trim()) {
    const n = Number(draft.fontSizePx);
    if (!Number.isFinite(n) || n < 8 || n > 48) return false;
  }
  if (!isOptionalSafeColor(draft.color) || !isOptionalSafeColor(draft.backgroundColor)) return false;
  for (const pad of [draft.padTop, draft.padEnd, draft.padBottom, draft.padStart]) {
    if (pad.trim()) {
      const n = Number(pad);
      if (!Number.isFinite(n) || n < 0 || n > 50) return false;
    }
  }
  if (draft.borderWidthPx.trim()) {
    const bw = Number(draft.borderWidthPx);
    if (!Number.isFinite(bw) || bw < 0 || bw > 12) return false;
    if (bw > 0 && (!draft.borderColor.trim() || !isValidSafeColor(draft.borderColor))) return false;
  } else if (!isOptionalSafeColor(draft.borderColor)) {
    return false;
  }
  return true;
}

function fromStyleDraft(draft: EditableCellStyleDraft): TemplateTableCellStyle | undefined {
  const fontSizeNum = draft.fontSizePx.trim() ? Number(draft.fontSizePx) : undefined;
  const hasAnyPad = [draft.padTop, draft.padEnd, draft.padBottom, draft.padStart].some(
    (v) => v.trim().length > 0,
  );
  const bw = draft.borderWidthPx.trim() ? Number(draft.borderWidthPx) : 0;
  const borderColor = normalizeSafeColor(draft.borderColor);

  return cleanTableCellStyle({
    fontSizePx: fontSizeNum,
    fontWeight: draft.fontWeight || undefined,
    color: normalizeSafeColor(draft.color),
    backgroundColor: normalizeSafeColor(draft.backgroundColor),
    paddingPx: hasAnyPad
      ? {
          top: draft.padTop.trim() ? Number(draft.padTop) : 0,
          end: draft.padEnd.trim() ? Number(draft.padEnd) : 0,
          bottom: draft.padBottom.trim() ? Number(draft.padBottom) : 0,
          start: draft.padStart.trim() ? Number(draft.padStart) : 0,
        }
      : undefined,
    border:
      bw > 0 && borderColor
        ? {
            widthPx: bw,
            style: draft.borderStyle,
            color: borderColor,
          }
        : undefined,
  });
}

@Component({
  selector: 'app-tpl-table-settings-modal',
  imports: [
    ColorPicker,
    NgTemplateOutlet,
    NgIcon,
    TranslocoPipe,
    Modal,
    Button,
    Dropdown,
    Field,
    Checkbox,
    ConfirmDialog,
  ],
  providers: [
    provideIcons({
      tablerTable,
      tablerPlus,
      tablerMinus,
      tablerArrowUp,
      tablerArrowDown,
      tablerTrash,
      tablerBraces,
      tablerCheck,
      tablerLock,
      tablerPhoto,
      tablerX,
    }),
  ],
  templateUrl: './table-settings-modal.html',
})
export class TableSettingsModal {
  private static nextId = 0;
  protected readonly uid = `table-settings-${++TableSettingsModal.nextId}`;

  protected readonly state = inject(DesignerState);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  private readonly modal = viewChild.required<Modal>('tableModal');
  private readonly listChangeConfirm = viewChild.required<ConfirmDialog>('listChangeConfirm');

  readonly pickField = input.required<OpenFieldPickerFn>();
  readonly editCellFn = input.required<EditCellFn>();

  protected readonly tableNodeId = signal('');
  protected readonly tableKind = signal<'STATIC' | 'DYNAMIC'>('STATIC');
  protected readonly activeTab = signal<'columns' | 'rows' | 'source' | 'options'>('columns');

  protected readonly isFixedCanvas = computed(() => this.state.layoutMode() === 'FIXED_CANVAS');
  protected readonly readOnly = computed(() => this.state.readOnly());

  protected readonly frameWidthMm = signal(DEFAULT_STATIC_TABLE_WIDTH_MM);
  protected readonly frameHeightMm = signal(DEFAULT_STATIC_TABLE_HEIGHT_MM);
  protected readonly widthUnit = signal<'MM' | 'PERCENT'>('MM');

  protected readonly columns = signal<EditableColumnDraft[]>([]);
  protected readonly rows = signal<TemplateTableRow[]>([]);
  protected readonly rowHeightsMm = signal<string[]>([]);

  // Dynamic source
  protected readonly sourcePath = signal('');
  protected readonly rowKeyPath = signal('');
  protected readonly emptyBehavior = signal<TemplateDynamicTableEmptyBehavior>('HEADER_ONLY');
  protected readonly emptyMessage = signal('');
  protected readonly minimumEmptyRows = signal('0');
  protected readonly maxRenderedRows = signal('20');
  protected readonly preservedHeaderBands = signal<TemplateTableBand[] | undefined>(undefined);
  protected readonly preservedFooterBands = signal<TemplateTableBand[] | undefined>(undefined);

  // Options
  protected readonly repeatHeader = signal<TemplateTableRepeatHeader>('EVERY_PAGE');
  protected readonly keepRowsTogether = signal(false);
  protected readonly rowSplit = signal<TemplateTableRowSplit>('ALLOW');
  protected readonly stripedRows = signal(false);
  protected readonly wrapCells = signal(true);

  protected readonly headerStyleDraft = signal<EditableCellStyleDraft>(emptyStyleDraft());
  protected readonly cellStyleDraft = signal<EditableCellStyleDraft>(emptyStyleDraft());
  protected readonly headerStyleTouched = signal(false);
  protected readonly cellStyleTouched = signal(false);
  // Mirrors apply(): the first row is a header row when any column will carry a header style.
  protected readonly gridHasHeader = computed(() =>
    this.headerStyleTouched()
      ? !!fromStyleDraft(this.headerStyleDraft())
      : this.columns().some((c) => !!c.headerStyle),
  );

  private confirmingSourceChange = false;
  private otherFormulasCache: OtherFormulaOption[] = [];

  protected readonly tabs = computed(() => {
    this.i18n();
    return [
      { id: 'columns' as const, label: this.transloco.translate('tplTables.tabs.columns') },
      this.tableKind() === 'STATIC'
        ? { id: 'rows' as const, label: this.transloco.translate('tplTables.tabs.rows') }
        : { id: 'source' as const, label: this.transloco.translate('tplTables.tabs.source') },
      { id: 'options' as const, label: this.transloco.translate('tplTables.tabs.options') },
    ];
  });

  protected readonly unitOptions = computed<DropdownOption<'MM' | 'PERCENT'>[]>(() => {
    this.i18n();
    return [
      { value: 'PERCENT', label: this.transloco.translate('tplTables.columns.unitPERCENT') },
      { value: 'MM', label: this.transloco.translate('tplTables.columns.unitMM') },
    ];
  });

  protected readonly alignOptions = computed<DropdownOption<TemplateTableAlign>[]>(() => {
    this.i18n();
    return [
      { value: 'START', label: this.transloco.translate('tplTables.align.START') },
      { value: 'CENTER', label: this.transloco.translate('tplTables.align.CENTER') },
      { value: 'END', label: this.transloco.translate('tplTables.align.END') },
    ];
  });

  protected readonly fitOptions = computed<DropdownOption<TemplateObjectFit>[]>(() => {
    this.i18n();
    return [
      { value: 'CONTAIN', label: this.transloco.translate('tplTables.fit.CONTAIN') },
      { value: 'COVER', label: this.transloco.translate('tplTables.fit.COVER') },
      { value: 'FILL', label: this.transloco.translate('tplTables.fit.FILL') },
    ];
  });

  protected readonly emptyBehaviorOptions = computed<DropdownOption<TemplateDynamicTableEmptyBehavior>[]>(() => {
    this.i18n();
    return [
      { value: 'MESSAGE', label: this.transloco.translate('tplTables.empty.MESSAGE') },
      { value: 'HEADER_ONLY', label: this.transloco.translate('tplTables.empty.HEADER_ONLY') },
      { value: 'MIN_ROWS', label: this.transloco.translate('tplTables.empty.MIN_ROWS') },
    ];
  });

  protected readonly repeatHeaderOptions = computed<DropdownOption<TemplateTableRepeatHeader>[]>(() => {
    this.i18n();
    return [
      { value: 'EVERY_PAGE', label: this.transloco.translate('tplTables.options.EVERY_PAGE') },
      { value: 'FIRST_PAGE_ONLY', label: this.transloco.translate('tplTables.options.FIRST_PAGE_ONLY') },
    ];
  });

  protected readonly rowSplitOptions = computed<DropdownOption<TemplateTableRowSplit>[]>(() => {
    this.i18n();
    return [
      { value: 'ALLOW', label: this.transloco.translate('tplTables.options.ALLOW') },
      { value: 'AVOID', label: this.transloco.translate('tplTables.options.AVOID') },
    ];
  });

  protected readonly fontWeightOptions = computed<DropdownOption<'' | TemplateFontWeight>[]>(() => {
    this.i18n();
    return [
      { value: '', label: '—' },
      { value: 'NORMAL', label: this.transloco.translate('tplTables.weights.NORMAL') },
      { value: 'MEDIUM', label: this.transloco.translate('tplTables.weights.MEDIUM') },
      { value: 'SEMIBOLD', label: this.transloco.translate('tplTables.weights.SEMIBOLD') },
      { value: 'BOLD', label: this.transloco.translate('tplTables.weights.BOLD') },
    ];
  });

  protected readonly borderStyleOptions = computed<DropdownOption<TemplateTableCellBorderStyle>[]>(() => {
    this.i18n();
    return [
      { value: 'SOLID', label: this.transloco.translate('tplTables.borderStyles.SOLID') },
      { value: 'DASHED', label: this.transloco.translate('tplTables.borderStyles.DASHED') },
      { value: 'DOTTED', label: this.transloco.translate('tplTables.borderStyles.DOTTED') },
    ];
  });

  protected readonly visibleColumnCount = computed(
    () => this.columns().filter((c) => c.visible).length,
  );

  protected readonly visibleWidthSum = computed(() => {
    const sum = this.columns()
      .filter((c) => c.visible)
      .reduce((acc, c) => {
        const n = Number(c.widthValue);
        return acc + (Number.isFinite(n) && n > 0 ? n : 0);
      }, 0);
    return roundToDecimals(sum, 3);
  });

  protected readonly widthTargetMatches = computed(() => {
    const sum = this.visibleWidthSum();
    if (this.isFixedCanvas()) {
      return Math.abs(sum - this.frameWidthMm()) <= WIDTH_FIT_TOLERANCE;
    }
    if (this.widthUnit() === 'PERCENT') {
      return Math.abs(sum - 100) <= WIDTH_FIT_TOLERANCE;
    }
    return true;
  });

  protected readonly rowHeightsSum = computed(() => {
    const sum = this.rowHeightsMm().reduce((acc, val) => {
      const n = Number(val);
      return acc + (Number.isFinite(n) && n > 0 ? n : 0);
    }, 0);
    return roundToDecimals(sum, 3);
  });

  protected readonly rowHeightsFitFrame = computed(
    () => Math.abs(this.rowHeightsSum() - this.frameHeightMm()) <= WIDTH_FIT_TOLERANCE,
  );

  protected readonly sourceSupportsProductImage = computed(() =>
    hasSourceProductImage(this.state.schema(), this.sourcePath()),
  );

  protected readonly hasVisibleProductImage = computed(() =>
    this.columns().some((c) => c.visible && c.dynamicKind === 'PRODUCT_IMAGE'),
  );

  protected readonly productImageDisabledReason = computed(() => {
    this.i18n();
    if (this.columns().length >= MAX_TABLE_COLUMNS) {
      return this.transloco.translate('tplTables.columns.maxColumns');
    }
    if (!this.sourceSupportsProductImage()) {
      return this.transloco.translate('tplTables.noProductImage');
    }
    if (this.hasVisibleProductImage()) {
      return this.transloco.translate('tplTables.columns.productImageExists');
    }
    return null;
  });

  protected readonly gridColumnsForView = computed<TemplateStaticTableColumn[]>(() =>
    this.columns().map((c) => ({
      id: c.id,
      width: { value: Number(c.widthValue) || 1, unit: this.widthUnit() },
      align: c.align,
      verticalAlign: c.verticalAlign,
      wrap: c.wrap,
      visible: c.visible,
    })),
  );

  protected readonly staticGridCoverage = computed(() =>
    computeStaticTableCoverage(this.gridColumnsForView(), this.rows()),
  );

  protected readonly emptyMessageError = computed(() => {
    this.i18n();
    if (this.tableKind() !== 'DYNAMIC' || this.emptyBehavior() !== 'MESSAGE') return null;
    const msg = this.emptyMessage().trim();
    if (!msg || msg.length > 500) {
      return this.transloco.translate('tplTables.empty.messageRequired');
    }
    return null;
  });

  protected readonly minEmptyRowsError = computed(() => {
    this.i18n();
    if (this.tableKind() !== 'DYNAMIC' || this.emptyBehavior() !== 'MIN_ROWS') return null;
    const raw = this.minimumEmptyRows().trim();
    const n = Number(raw);
    if (!/^\d+$/.test(raw) || n < 0 || n > MAX_DYNAMIC_EMPTY_ROWS) {
      return this.transloco.translate('tplTables.empty.minRowsError');
    }
    return null;
  });

  protected readonly rowBudgetError = computed(() => {
    this.i18n();
    if (this.tableKind() !== 'DYNAMIC' || !this.isFixedCanvas()) return null;
    const raw = this.maxRenderedRows().trim();
    const n = Number(raw);
    if (!/^\d+$/.test(raw) || n < 1 || n > MAX_DYNAMIC_ROW_BUDGET) {
      return this.transloco.translate('tplTables.budget.error');
    }
    return null;
  });

  protected readonly headerBandsCount = computed(() => this.preservedHeaderBands()?.length ?? 0);
  protected readonly footerBandsCount = computed(() => this.preservedFooterBands()?.length ?? 0);

  protected readonly canApply = computed(() => {
    if (this.readOnly()) return false;
    if (this.columns().length === 0 || this.visibleColumnCount() === 0) return false;
    if (!this.widthTargetMatches()) return false;
    for (const col of this.columns()) {
      const w = Number(col.widthValue);
      if (!Number.isFinite(w) || w <= 0 || w > 500) return false;
      if (this.tableKind() === 'DYNAMIC' && col.dynamicKind === 'PRODUCT_IMAGE') {
        const h = col.productImage.props.heightMm;
        if (!Number.isFinite(h) || h < 4 || h > 40) return false;
      }
    }
    if (this.tableKind() === 'STATIC') {
      if (this.rows().length === 0 || this.rows().length > MAX_STATIC_TABLE_ROWS) return false;
      if (this.isFixedCanvas()) {
        if (this.rowHeightsMm().length !== this.rows().length) return false;
        for (const hStr of this.rowHeightsMm()) {
          const h = Number(hStr);
          if (!Number.isFinite(h) || h <= 0 || h > 1000) return false;
        }
        if (!this.rowHeightsFitFrame()) return false;
      }
    } else {
      if (!this.sourcePath().trim()) return false;
      if (this.emptyMessageError() || this.minEmptyRowsError() || this.rowBudgetError()) return false;
    }
    if (!isStyleDraftValid(this.headerStyleDraft()) || !isStyleDraftValid(this.cellStyleDraft())) {
      return false;
    }
    return true;
  });

  protected readonly colorSwatches = signal<readonly string[] | null>(null);

  open(nodeId: string): void {
    this.colorSwatches.set(designerColorSwatches(this.state.document()));
    const doc = this.state.document();
    const node = doc?.nodes[nodeId];
    if (!doc || !node || (node.type !== 'staticTable' && node.type !== 'dynamicTable')) return;

    this.tableNodeId.set(nodeId);
    this.activeTab.set('columns');
    this.headerStyleTouched.set(false);
    this.cellStyleTouched.set(false);

    this.otherFormulasCache = collectOtherFormulas(doc, undefined, (n) =>
      this.transloco.translate('tplTables.formula.defaultName', { n }),
    );

    if (node.layout.kind === 'ABSOLUTE') {
      this.frameWidthMm.set(roundToDecimals(node.layout.width, 3));
      this.frameHeightMm.set(roundToDecimals(node.layout.height, 3));
    } else {
      this.frameWidthMm.set(DEFAULT_STATIC_TABLE_WIDTH_MM);
      this.frameHeightMm.set(DEFAULT_STATIC_TABLE_HEIGHT_MM);
    }

    if (node.type === 'staticTable') {
      this.loadStaticNode(node);
    } else {
      this.loadDynamicNode(node);
    }

    this.modal().open();
  }

  private loadStaticNode(node: TemplateStaticTableNode): void {
    this.tableKind.set('STATIC');
    const firstUnit = this.isFixedCanvas()
      ? 'MM'
      : (node.props.columns[0]?.width.unit ?? 'PERCENT');
    this.widthUnit.set(firstUnit);

    this.columns.set(
      node.props.columns.map((c) => ({
        id: c.id,
        widthValue: String(c.width.value),
        align: c.align,
        verticalAlign: c.verticalAlign ?? 'MIDDLE',
        wrap: c.wrap ?? true,
        visible: c.visible,
        headerStyle: c.headerStyle ? structuredClone(c.headerStyle) : undefined,
        cellStyle: c.cellStyle ? structuredClone(c.cellStyle) : undefined,
        header: { kind: 'TEXT', value: '' },
        dynamicKind: 'VALUE',
        value: { kind: 'TEXT', value: '' },
        productImage: { type: 'productImage', props: { heightMm: 12, objectFit: 'CONTAIN' } },
      })),
    );

    const clonedRows = structuredClone(node.props.rows);
    this.rows.set(clonedRows);
    const heights =
      node.props.fixedCanvas?.rowHeightsMm && node.props.fixedCanvas.rowHeightsMm.length === clonedRows.length
        ? node.props.fixedCanvas.rowHeightsMm.map((h) => String(h))
        : clonedRows.map(() => '8');
    this.rowHeightsMm.set(heights);

    this.repeatHeader.set(node.props.repeatHeader);
    this.keepRowsTogether.set(node.props.keepRowsTogether);
    this.rowSplit.set(node.props.rowSplit);
    this.stripedRows.set(node.props.stripedRows);
    this.wrapCells.set(node.props.fixedCanvas?.wrapCells ?? true);

    const firstHeader = node.props.columns.find((c) => c.headerStyle)?.headerStyle;
    const firstCell = node.props.columns.find((c) => c.cellStyle)?.cellStyle;
    this.headerStyleDraft.set(toStyleDraft(firstHeader));
    this.cellStyleDraft.set(toStyleDraft(firstCell));
  }

  private loadDynamicNode(node: TemplateDynamicTableNode): void {
    this.tableKind.set('DYNAMIC');
    const firstUnit = this.isFixedCanvas()
      ? 'MM'
      : (node.props.columns[0]?.width.unit ?? 'PERCENT');
    this.widthUnit.set(firstUnit);

    this.columns.set(
      node.props.columns.map((c) => {
        const isImg = 'productImage' in c;
        return {
          id: c.id,
          widthValue: String(c.width.value),
          align: c.align,
          verticalAlign: c.verticalAlign ?? 'MIDDLE',
          wrap: c.wrap ?? true,
          visible: c.visible,
          headerStyle: c.headerStyle ? structuredClone(c.headerStyle) : undefined,
          cellStyle: c.cellStyle ? structuredClone(c.cellStyle) : undefined,
          header: structuredClone(c.header),
          dynamicKind: isImg ? 'PRODUCT_IMAGE' : 'VALUE',
          value: 'value' in c ? structuredClone(c.value) : { kind: 'TEXT', value: '' },
          productImage:
            'productImage' in c
              ? structuredClone(c.productImage)
              : { type: 'productImage', props: { heightMm: 12, objectFit: 'CONTAIN' } },
        };
      }),
    );

    this.sourcePath.set(node.props.sourcePath);
    this.rowKeyPath.set(node.props.rowKeyPath ?? '');
    this.emptyBehavior.set(node.props.emptyBehavior);
    this.emptyMessage.set(node.props.emptyMessage ?? '');
    this.minimumEmptyRows.set(String(node.props.minimumEmptyRows ?? 0));
    this.maxRenderedRows.set(String(node.props.fixedCanvas?.maxRenderedRows ?? 20));
    this.preservedHeaderBands.set(
      node.props.headerBands ? structuredClone(node.props.headerBands) : undefined,
    );
    this.preservedFooterBands.set(
      node.props.footerBands ? structuredClone(node.props.footerBands) : undefined,
    );

    this.repeatHeader.set(node.props.repeatHeader);
    this.keepRowsTogether.set(node.props.keepRowsTogether);
    this.rowSplit.set(node.props.rowSplit);
    this.stripedRows.set(node.props.stripedRows);

    const firstHeader = node.props.columns.find((c) => c.headerStyle)?.headerStyle;
    const firstCell = node.props.columns.find((c) => c.cellStyle)?.cellStyle;
    this.headerStyleDraft.set(toStyleDraft(firstHeader));
    this.cellStyleDraft.set(toStyleDraft(firstCell));
  }

  // --- Columns actions ---

  protected addColumn(): void {
    if (this.readOnly() || this.columns().length >= MAX_TABLE_COLUMNS) return;
    const newId = newDesignerUuid();
    const defaultWidth = this.widthUnit() === 'MM' ? '25' : '20';
    const nextCol: EditableColumnDraft = {
      id: newId,
      widthValue: defaultWidth,
      align: 'START',
      verticalAlign: 'MIDDLE',
      wrap: true,
      visible: true,
      header: { kind: 'TEXT', value: '' },
      dynamicKind: 'VALUE',
      value: { kind: 'TEXT', value: '' },
      productImage: { type: 'productImage', props: { heightMm: 12, objectFit: 'CONTAIN' } },
    };
    this.columns.update((list) => [...list, nextCol]);
    if (this.tableKind() === 'STATIC') {
      this.rows.update((list) =>
        list.map((r) => ({ ...r, cells: [...r.cells, createEmptyTextCell(newId, '')] })),
      );
    }
  }

  protected addProductImageColumn(): void {
    if (this.readOnly() || this.tableKind() !== 'DYNAMIC' || this.productImageDisabledReason()) {
      return;
    }
    const newId = newDesignerUuid();
    const docLocale = this.state.document()?.locale ?? 'en-US';
    const nextCol: EditableColumnDraft = {
      id: newId,
      widthValue: this.widthUnit() === 'MM' ? '20' : '12',
      align: 'CENTER',
      verticalAlign: 'MIDDLE',
      wrap: false,
      visible: true,
      header: {
        kind: 'TEXT',
        value: defaultDocumentHeaderText(docLocale, 'PRODUCT_IMAGE'),
      },
      dynamicKind: 'PRODUCT_IMAGE',
      value: { kind: 'TEXT', value: '' },
      productImage: { type: 'productImage', props: { heightMm: 12, objectFit: 'CONTAIN' } },
    };
    this.columns.update((list) => [...list, nextCol]);
  }

  protected isColumnMoveBlockedByMerge(index: number, delta: -1 | 1): boolean {
    if (this.readOnly() || this.tableKind() !== 'STATIC') return false;
    const target = index + delta;
    const cols = this.gridColumnsForView();
    if (target < 0 || target >= cols.length) return false;
    return !canMoveStaticColumn(cols, this.rows(), index, delta);
  }

  protected canMoveColumn(index: number, delta: -1 | 1): boolean {
    if (this.readOnly()) return false;
    const target = index + delta;
    const list = this.columns();
    if (target < 0 || target >= list.length) return false;
    if (this.tableKind() === 'STATIC') {
      return canMoveStaticColumn(this.gridColumnsForView(), this.rows(), index, delta);
    }
    return true;
  }

  protected moveColumn(index: number, delta: -1 | 1): void {
    if (!this.canMoveColumn(index, delta)) return;
    const target = index + delta;
    const next = [...this.columns()];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    this.columns.set(next);
  }

  protected removeColumn(index: number): void {
    if (this.readOnly() || this.columns().length <= 1) return;
    const gridColsBefore = this.tableKind() === 'STATIC' ? this.gridColumnsForView() : null;
    this.columns.update((list) => list.filter((_, i) => i !== index));
    if (gridColsBefore && this.tableKind() === 'STATIC') {
      this.rows.update((list) => removeStaticColumnFromRows(gridColsBefore, list, index));
    }
  }

  protected onWidthUnitChange(unit: 'MM' | 'PERCENT'): void {
    if (this.readOnly() || this.isFixedCanvas()) return;
    this.widthUnit.set(unit);
  }

  protected fitColumns(): void {
    if (this.readOnly()) return;
    const target = this.isFixedCanvas() ? this.frameWidthMm() : 100;
    const cols = this.columns();
    const visibleIndices: number[] = [];
    const visibleWidths: number[] = [];
    cols.forEach((col, idx) => {
      if (col.visible) {
        visibleIndices.push(idx);
        visibleWidths.push(Number(col.widthValue) || 1);
      }
    });
    if (visibleIndices.length === 0) return;

    const scaled = scaleNumbersToTarget(visibleWidths, target, 3);
    const next = [...cols];
    visibleIndices.forEach((colIdx, pos) => {
      next[colIdx] = { ...next[colIdx], widthValue: String(scaled[pos]) };
    });
    this.columns.set(next);
  }

  protected updateColumn(index: number, patch: Partial<EditableColumnDraft>): void {
    if (this.readOnly()) return;
    this.columns.update((list) => list.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  protected onColumnWidthInput(index: number, event: Event): void {
    this.updateColumn(index, { widthValue: (event.target as HTMLInputElement).value });
  }

  protected staticHeaderCell(colId: string): TemplateTableCell | undefined {
    return this.rows()[0]?.cells.find((c) => c.columnId === colId);
  }

  protected staticHeaderText(colId: string): string {
    const cell = this.staticHeaderCell(colId);
    if (!cell) return '';
    return cell.value.kind === 'TEXT' ? cell.value.value : this.cellSummary(cell.value);
  }

  protected staticHeaderIsText(colId: string): boolean {
    const cell = this.staticHeaderCell(colId);
    return !cell || cell.value.kind === 'TEXT';
  }

  protected onStaticHeaderInput(colId: string, event: Event): void {
    if (this.readOnly()) return;
    const text = (event.target as HTMLInputElement).value;
    this.rows.update((list) => {
      if (list.length === 0) return list;
      const first = list[0];
      const exists = first.cells.some((c) => c.columnId === colId);
      const nextCells = exists
        ? first.cells.map((c) =>
            c.columnId === colId ? { ...c, value: { kind: 'TEXT' as const, value: text } } : c,
          )
        : [...first.cells, createEmptyTextCell(colId, text)];
      return [{ ...first, cells: nextCells }, ...list.slice(1)];
    });
  }

  protected onDynamicHeaderInput(index: number, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.updateColumn(index, { header: { kind: 'TEXT', value } });
  }

  protected async pickDynamicHeaderField(index: number): Promise<void> {
    if (this.readOnly()) return;
    const col = this.columns()[index];
    if (!col) return;
    const current = col.header.kind === 'BINDING' ? col.header.binding : undefined;
    const picked = await this.pickField()({
      purpose: 'BINDING',
      accept: 'SCALAR',
      initial: current,
    });
    if (!picked) return;
    this.updateColumn(index, {
      header: {
        kind: 'BINDING',
        binding: picked.binding ? structuredClone(picked.binding) : { path: picked.path, nullBehavior: 'EMPTY' },
      },
    });
  }

  protected resetDynamicHeaderToText(index: number): void {
    if (this.readOnly()) return;
    const col = this.columns()[index];
    if (!col) return;
    const fallback = col.header.kind === 'BINDING' ? this.state.fieldLabel(col.header.binding.path) : '';
    this.updateColumn(index, { header: { kind: 'TEXT', value: fallback } });
  }

  protected async editDynamicColumnValue(index: number): Promise<void> {
    if (this.readOnly()) return;
    const col = this.columns()[index];
    if (!col || col.dynamicKind === 'PRODUCT_IMAGE') return;
    const res = await this.editCellFn()({
      context: 'DYNAMIC_CELL',
      value: structuredClone(col.value),
      rowArrayPath: this.sourcePath(),
      otherFormulas: this.otherFormulasCache,
    });
    if (!res) return;
    this.updateColumn(index, { value: res.value });
  }

  protected onProductImageHeightInput(index: number, event: Event): void {
    const col = this.columns()[index];
    if (!col) return;
    const heightMm = Number((event.target as HTMLInputElement).value);
    this.updateColumn(index, {
      productImage: {
        ...col.productImage,
        props: {
          ...col.productImage.props,
          heightMm: Number.isFinite(heightMm) ? heightMm : 4,
        },
      },
    });
  }

  protected onProductImageFitChange(index: number, objectFit: TemplateObjectFit): void {
    const col = this.columns()[index];
    if (!col) return;
    this.updateColumn(index, {
      productImage: {
        ...col.productImage,
        props: { ...col.productImage.props, objectFit },
      },
    });
  }

  protected productImageHeightError(col: EditableColumnDraft): string | null {
    this.i18n();
    const h = col.productImage.props.heightMm;
    return Number.isFinite(h) && h >= 4 && h <= 40
      ? null
      : this.transloco.translate('tplTables.columns.imageHeightError');
  }

  protected colWidthError(col: EditableColumnDraft): string | null {
    this.i18n();
    const w = Number(col.widthValue);
    return Number.isFinite(w) && w > 0 && w <= 500
      ? null
      : this.transloco.translate('tplTables.columns.widthRequired');
  }

  // --- Rows tab (static) ---

  protected changeRowCount(delta: -1 | 1): void {
    if (this.readOnly() || this.tableKind() !== 'STATIC') return;
    const current = this.rows();
    const nextCount = current.length + delta;
    if (nextCount < 1 || nextCount > MAX_STATIC_TABLE_ROWS) return;

    if (delta > 0) {
      const cols = this.columns();
      const newRow: TemplateTableRow = {
        id: newDesignerUuid(),
        cells: cols.map((col) => createEmptyTextCell(col.id, '')),
      };
      this.rows.set([...current, newRow]);
      this.rowHeightsMm.update((h) => [...h, '8']);
    } else {
      const trimmed = current.slice(0, nextCount).map((row, rIdx) => ({
        ...row,
        cells: row.cells.map((cell) => {
          const maxSpan = nextCount - rIdx;
          if (cell.rowSpan && cell.rowSpan > maxSpan) {
            return { ...cell, rowSpan: maxSpan };
          }
          return cell;
        }),
      }));
      this.rows.set(trimmed);
      this.rowHeightsMm.update((h) => h.slice(0, nextCount));
    }
  }

  protected isCellCovered(rowIdx: number, colIdx: number): boolean {
    return this.staticGridCoverage().coveredBy.has(`${rowIdx}:${colIdx}`);
  }

  protected getStaticCell(rowIdx: number, colId: string): TemplateTableCell | undefined {
    return this.rows()[rowIdx]?.cells.find((c) => c.columnId === colId);
  }

  protected async editStaticGridCell(rowIdx: number, colIdx: number): Promise<void> {
    if (this.readOnly() || this.isCellCovered(rowIdx, colIdx)) return;
    const cols = this.gridColumnsForView();
    const col = cols[colIdx];
    const row = this.rows()[rowIdx];
    if (!col || !row) return;
    const existing = row.cells.find((c) => c.columnId === col.id) ?? createEmptyTextCell(col.id, '');

    const res = await this.editCellFn()({
      context: 'STATIC_CELL',
      value: structuredClone(existing.value),
      otherFormulas: this.otherFormulasCache,
      staticGrid: {
        rows: this.rows(),
        columns: cols,
        rowIndex: rowIdx,
        colIndex: colIdx,
        rowSpan: existing.rowSpan ?? 1,
        colSpan: existing.colSpan ?? 1,
      },
    });
    if (!res) return;

    const coveredSet = new Set(
      (res.clearCoveredCoords ?? []).map((coord) => `${coord.rowIndex}:${coord.colIndex}`),
    );
    const colIdxById = new Map(cols.map((c, idx) => [c.id, idx]));

    this.rows.update((allRows) =>
      allRows.map((r, rI) => {
        const nextCells = r.cells.map((c) => {
          const cI = colIdxById.get(c.columnId);
          if (rI === rowIdx && c.columnId === col.id) {
            return {
              ...c,
              value: res.value,
              rowSpan: res.rowSpan && res.rowSpan > 1 ? res.rowSpan : undefined,
              colSpan: res.colSpan && res.colSpan > 1 ? res.colSpan : undefined,
            };
          }
          if (cI !== undefined && coveredSet.has(`${rI}:${cI}`)) {
            return {
              ...c,
              value: { kind: 'TEXT' as const, value: '' },
              rowSpan: undefined,
              colSpan: undefined,
            };
          }
          return c;
        });

        if (rI === rowIdx && !nextCells.some((c) => c.columnId === col.id)) {
          nextCells.push({
            id: existing.id,
            columnId: col.id,
            value: res.value,
            rowSpan: res.rowSpan && res.rowSpan > 1 ? res.rowSpan : undefined,
            colSpan: res.colSpan && res.colSpan > 1 ? res.colSpan : undefined,
          });
        }
        return { ...r, cells: nextCells };
      }),
    );
  }

  protected onRowHeightInput(index: number, event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.rowHeightsMm.update((list) => list.map((h, i) => (i === index ? val : h)));
  }

  protected fitRowHeights(): void {
    if (this.readOnly()) return;
    const current = this.rowHeightsMm().map((h) => Number(h) || 1);
    const scaled = scaleNumbersToTarget(current, this.frameHeightMm(), 3);
    this.rowHeightsMm.set(scaled.map((v) => String(v)));
  }

  protected rowHeightError(val: string): string | null {
    this.i18n();
    const n = Number(val);
    return Number.isFinite(n) && n > 0 && n <= 1000
      ? null
      : this.transloco.translate('tplTables.rows.rowHeightError');
  }

  // --- Source tab (dynamic) ---

  protected async changeSourceList(): Promise<void> {
    if (this.readOnly()) return;
    const oldSource = this.sourcePath();
    const picked = await this.pickField()({
      purpose: 'PATH',
      accept: 'ARRAY',
      initial: oldSource ? { path: oldSource } : undefined,
      titleKey: 'source.title',
    });
    if (!picked || picked.path === oldSource) return;

    this.confirmingSourceChange = true;
    const confirmed = await this.listChangeConfirm().open();
    this.confirmingSourceChange = false;
    if (!confirmed) return;

    const nextSource = picked.path;
    const oldPrefix = `${oldSource}[]`;
    const newSupportsImg = hasSourceProductImage(this.state.schema(), nextSource);

    this.sourcePath.set(nextSource);
    this.rowKeyPath.set('');
    this.columns.update((cols) =>
      cols.map((c) => {
        if (c.dynamicKind === 'PRODUCT_IMAGE' && !newSupportsImg) {
          return {
            ...c,
            dynamicKind: 'VALUE',
            value: { kind: 'TEXT', value: '' },
          };
        }
        if (
          c.value.kind === 'BINDING' &&
          oldSource &&
          (c.value.binding.path.startsWith(oldPrefix) ||
            (c.value.binding.format?.kind === 'CURRENCY' &&
              Boolean(c.value.binding.format.currencyCodePath?.startsWith(oldPrefix))))
        ) {
          return {
            ...c,
            value: { kind: 'TEXT', value: '' },
          };
        }
        if (
          c.value.kind === 'FORMULA' &&
          oldSource &&
          (formulaReferencesList(c.value.expression, oldSource) ||
            (c.value.format?.kind === 'CURRENCY' &&
              Boolean(c.value.format.currencyCodePath?.startsWith(oldPrefix))))
        ) {
          return {
            ...c,
            value: { kind: 'TEXT', value: '' },
          };
        }
        return c;
      }),
    );
  }

  protected async pickRowKey(): Promise<void> {
    if (this.readOnly()) return;
    const source = this.sourcePath();
    if (!source) return;
    const picked = await this.pickField()({
      purpose: 'PATH',
      accept: 'ROW_SCALAR',
      rowArrayPath: source,
      initial: this.rowKeyPath() ? { path: this.rowKeyPath() } : undefined,
    });
    if (!picked) return;
    this.rowKeyPath.set(picked.path);
  }

  protected clearRowKey(): void {
    if (this.readOnly()) return;
    this.rowKeyPath.set('');
  }

  protected onEmptyMessageInput(event: Event): void {
    this.emptyMessage.set((event.target as HTMLInputElement).value);
  }

  protected onMinEmptyRowsInput(event: Event): void {
    this.minimumEmptyRows.set((event.target as HTMLInputElement).value);
  }

  protected onRowBudgetInput(event: Event): void {
    this.maxRenderedRows.set((event.target as HTMLInputElement).value);
  }

  // --- Options & Styles ---

  protected updateHeaderStyle<K extends keyof EditableCellStyleDraft>(
    key: K,
    value: EditableCellStyleDraft[K],
  ): void {
    if (this.readOnly()) return;
    this.headerStyleTouched.set(true);
    this.headerStyleDraft.update((s) => ({ ...s, [key]: value }));
  }

  protected updateCellStyle<K extends keyof EditableCellStyleDraft>(
    key: K,
    value: EditableCellStyleDraft[K],
  ): void {
    if (this.readOnly()) return;
    this.cellStyleTouched.set(true);
    this.cellStyleDraft.update((s) => ({ ...s, [key]: value }));
  }

  protected onStyleInput(
    target: 'header' | 'cell',
    key: keyof EditableCellStyleDraft,
    event: Event,
  ): void {
    const val = (event.target as HTMLInputElement).value;
    if (target === 'header') {
      this.updateHeaderStyle(key, val as never);
    } else {
      this.updateCellStyle(key, val as never);
    }
  }

  protected onStyleDropdown(
    target: 'header' | 'cell',
    key: 'fontWeight' | 'borderStyle',
    value: '' | TemplateFontWeight | TemplateTableCellBorderStyle,
  ): void {
    if (target === 'header') {
      this.updateHeaderStyle(key, value as never);
    } else {
      this.updateCellStyle(key, value as never);
    }
  }

  protected onOptionFlagChange(
    flag: 'keepRowsTogether' | 'stripedRows' | 'wrapCells',
    checked: boolean,
  ): void {
    if (this.readOnly()) return;
    if (flag === 'keepRowsTogether') this.keepRowsTogether.set(checked);
    else if (flag === 'stripedRows') this.stripedRows.set(checked);
    else this.wrapCells.set(checked);
  }

  protected normalizeColorField(
    target: 'header' | 'cell',
    key: 'color' | 'backgroundColor' | 'borderColor',
  ): void {
    const draft = target === 'header' ? this.headerStyleDraft() : this.cellStyleDraft();
    if (this.readOnly()) return;
    if (key === 'borderColor' && draft.borderColor.trim() === '') {
      if (target === 'header') this.updateHeaderStyle('borderWidthPx', '');
      else this.updateCellStyle('borderWidthPx', '');
    }
    const norm = normalizeSafeColor(draft[key]);
    if (norm && norm !== draft[key]) {
      if (target === 'header') this.updateHeaderStyle(key, norm);
      else this.updateCellStyle(key, norm);
    }
  }

  protected colorError(val: string): string | null {
    this.i18n();
    return isOptionalSafeColor(val) ? null : this.transloco.translate('tplTables.options.colorError');
  }

  protected paddingError(draft: EditableCellStyleDraft): string | null {
    this.i18n();
    for (const pad of [draft.padTop, draft.padEnd, draft.padBottom, draft.padStart]) {
      if (pad.trim()) {
        const n = Number(pad);
        if (!Number.isFinite(n) || n < 0 || n > 50) {
          return this.transloco.translate('tplTables.options.paddingError');
        }
      }
    }
    return null;
  }

  protected borderWidthError(val: string): string | null {
    this.i18n();
    if (!val.trim()) return null;
    const bw = Number(val);
    return Number.isFinite(bw) && bw >= 0 && bw <= 12
      ? null
      : this.transloco.translate('tplTables.options.borderWidthError');
  }

  protected borderColorError(draft: EditableCellStyleDraft): string | null {
    this.i18n();
    if (!isOptionalSafeColor(draft.borderColor)) {
      return this.transloco.translate('tplTables.options.colorError');
    }
    if (draft.borderWidthPx.trim()) {
      const bw = Number(draft.borderWidthPx);
      if (Number.isFinite(bw) && bw > 0 && !draft.borderColor.trim()) {
        return this.transloco.translate('tplTables.options.borderColorRequired');
      }
    }
    return null;
  }

  protected fontSizeError(val: string): string | null {
    this.i18n();
    if (!val.trim()) return null;
    const n = Number(val);
    return Number.isFinite(n) && n >= 8 && n <= 48
      ? null
      : this.transloco.translate('tplTables.options.fontSizeError');
  }

  protected onStyleColorInput(
    target: 'header' | 'cell',
    key: 'color' | 'backgroundColor' | 'borderColor',
    value: string | null,
  ): void {
    if (target === 'header') this.updateHeaderStyle(key, value ?? '');
    else this.updateCellStyle(key, value ?? '');
  }

  protected cellSummary(val: TemplateTableCellValue): string {
    this.i18n();
    if (val.kind === 'TEXT') return val.value;
    if (val.kind === 'BINDING') {
      return val.binding.path ? `«${this.state.fieldLabel(val.binding.path)}»` : '«…»';
    }
    return `ƒ ${this.transloco.translate('tplTables.cell.formula')}`;
  }

  // --- Commit & Close ---

  protected apply(): void {
    if (!this.canApply()) return;
    const nodeId = this.tableNodeId();
    const doc = this.state.document();
    const existing = doc?.nodes[nodeId];
    if (!existing) return;

    const unit: 'MM' | 'PERCENT' = this.isFixedCanvas() ? 'MM' : this.widthUnit();
    const sharedHeaderStyle = this.headerStyleTouched()
      ? fromStyleDraft(this.headerStyleDraft())
      : undefined;
    const sharedCellStyle = this.cellStyleTouched()
      ? fromStyleDraft(this.cellStyleDraft())
      : undefined;

    if (this.tableKind() === 'STATIC' && existing.type === 'staticTable') {
      const nextCols: TemplateStaticTableColumn[] = this.columns().map((c) => {
        const headerStyle = this.headerStyleTouched() ? sharedHeaderStyle : c.headerStyle;
        const cellStyle = this.cellStyleTouched() ? sharedCellStyle : c.cellStyle;
        return {
          id: c.id,
          width: { value: roundToDecimals(Number(c.widthValue), 3), unit },
          align: c.align,
          verticalAlign: c.verticalAlign,
          wrap: c.wrap,
          visible: c.visible,
          ...(headerStyle ? { headerStyle: structuredClone(headerStyle) } : {}),
          ...(cellStyle ? { cellStyle: structuredClone(cellStyle) } : {}),
        };
      });

      const props: TemplateStaticTableNode['props'] = {
        columns: nextCols,
        rows: structuredClone(this.rows()),
        repeatHeader: this.repeatHeader(),
        keepRowsTogether: this.keepRowsTogether(),
        rowSplit: this.rowSplit(),
        stripedRows: this.stripedRows(),
        ...(this.isFixedCanvas()
          ? {
              fixedCanvas: {
                rowHeightsMm: this.rowHeightsMm().map((h) => roundToDecimals(Number(h), 3)),
                overflow: 'REJECT' as const,
                wrapCells: this.wrapCells(),
              },
            }
          : {}),
      };

      this.state.updateNode(nodeId, { props }, 'updateTable');
    } else if (this.tableKind() === 'DYNAMIC' && existing.type === 'dynamicTable') {
      const nextCols: TemplateDynamicTableColumn[] = this.columns().map((c) => {
        const headerStyle = this.headerStyleTouched() ? sharedHeaderStyle : c.headerStyle;
        const cellStyle = this.cellStyleTouched() ? sharedCellStyle : c.cellStyle;
        const base = {
          id: c.id,
          width: { value: roundToDecimals(Number(c.widthValue), 3), unit },
          align: c.align,
          verticalAlign: c.verticalAlign,
          wrap: c.wrap,
          visible: c.visible,
          header: structuredClone(c.header),
          ...(headerStyle ? { headerStyle: structuredClone(headerStyle) } : {}),
          ...(cellStyle ? { cellStyle: structuredClone(cellStyle) } : {}),
        };
        if (c.dynamicKind === 'PRODUCT_IMAGE') {
          return { ...base, productImage: structuredClone(c.productImage) };
        }
        return { ...base, value: structuredClone(c.value) };
      });

      const emptyBeh = this.emptyBehavior();
      const props: TemplateDynamicTableNode['props'] = {
        sourcePath: this.sourcePath(),
        ...(this.rowKeyPath().trim() ? { rowKeyPath: this.rowKeyPath().trim() } : {}),
        columns: nextCols,
        ...(this.preservedHeaderBands()
          ? { headerBands: structuredClone(this.preservedHeaderBands()) }
          : {}),
        ...(this.preservedFooterBands()
          ? { footerBands: structuredClone(this.preservedFooterBands()) }
          : {}),
        repeatHeader: this.repeatHeader(),
        keepRowsTogether: this.keepRowsTogether(),
        rowSplit: this.rowSplit(),
        minimumEmptyRows: emptyBeh === 'MIN_ROWS' ? Number(this.minimumEmptyRows()) : 0,
        emptyBehavior: emptyBeh,
        ...(emptyBeh === 'MESSAGE' ? { emptyMessage: this.emptyMessage().trim() } : {}),
        stripedRows: this.stripedRows(),
        ...(this.isFixedCanvas()
          ? {
              fixedCanvas: {
                maxRenderedRows: Number(this.maxRenderedRows()),
                overflow: 'REJECT' as const,
              },
            }
          : {}),
      };

      this.state.updateNode(nodeId, { props }, 'updateTable');
    }

    this.modal().close();
  }

  protected cancel(): void {
    this.modal().close();
  }

  protected onModalClosed(): void {
    if (this.confirmingSourceChange) {
      this.modal().open();
    }
  }
}
