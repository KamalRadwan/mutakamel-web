import { Component, effect, inject, untracked, viewChild } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import type {
  TemplateDynamicTableColumn,
  TemplateFormulaNode,
  TemplateTableCellValue,
} from '../../templates.model';
import { DesignerCommand, DesignerState } from '../designer-state';
import { newDesignerUuid } from '../document-ops';
import { FieldPicker } from '../fields/field-picker/field-picker';
import { CellEditRequest, CellEditorModal } from './cell-editor-modal/cell-editor-modal';
import { FormulaBuildOptions, FormulaBuilder } from './formula-builder/formula-builder';
import {
  OpenFieldPickerFn,
  buildNewDynamicTableNode,
  buildNewStaticTableNode,
  collectOtherFormulas,
} from './table-ops';
import { TableSettingsModal } from './table-settings-modal/table-settings-modal';
import { TotalsModal } from './totals-modal/totals-modal';

@Component({
  selector: 'app-tpl-tables-host',
  imports: [FieldPicker, TableSettingsModal, CellEditorModal, FormulaBuilder, TotalsModal],
  templateUrl: './tables-host.html',
})
export class TablesHost {
  protected readonly state = inject(DesignerState);
  private readonly transloco = inject(TranslocoService);

  private readonly picker = viewChild.required<FieldPicker>('picker');
  private readonly tableSettings = viewChild.required<TableSettingsModal>('tableSettings');
  private readonly cellEditor = viewChild.required<CellEditorModal>('cellEditor');
  private readonly formula = viewChild.required<FormulaBuilder>('formula');
  private readonly totals = viewChild.required<TotalsModal>('totals');

  private lastSeq = 0;

  protected readonly openPicker: OpenFieldPickerFn = (options) => this.picker().open(options);
  protected readonly openCellEditor = (req: CellEditRequest) => this.cellEditor().open(req);
  protected readonly openFormulaBuilder = (options: FormulaBuildOptions) =>
    this.formula().open(options);

  constructor() {
    effect(() => {
      const entry = this.state.command();
      if (!entry || entry.seq === this.lastSeq) return;
      if (!this.isHandledCommand(entry.cmd)) return;
      this.lastSeq = entry.seq;
      untracked(() => {
        void this.handleCommand(entry.cmd);
      });
    });
  }

  private isHandledCommand(cmd: DesignerCommand): boolean {
    switch (cmd.kind) {
      case 'insertTable':
      case 'openTableSettings':
      case 'editCell':
      case 'insertFormula':
      case 'editFormula':
      case 'insertTotals':
      case 'openTotals':
        return true;
      default:
        return false;
    }
  }

  private async handleCommand(cmd: DesignerCommand): Promise<void> {
    const doc = this.state.document();
    if (!doc) return;

    switch (cmd.kind) {
      case 'insertTable': {
        if (this.state.readOnly()) return;
        if (cmd.tableKind === 'STATIC') {
          if (this.state.toolState('TABLE_STATIC').state !== 'ENABLED') return;
          const newId = this.state.insertNode(buildNewStaticTableNode(doc));
          if (newId) this.tableSettings().open(newId);
          return;
        }
        if (this.state.toolState('TABLE_DYNAMIC').state !== 'ENABLED') return;
        const picked = await this.openPicker({
          purpose: 'PATH',
          accept: 'ARRAY',
          titleKey: 'source.title',
        });
        if (!picked) return;
        const latestDoc = this.state.document();
        if (!latestDoc) return;
        const newId = this.state.insertNode(
          buildNewDynamicTableNode(
            latestDoc,
            this.state.currentPage(),
            this.state.schema(),
            picked.path,
          ),
        );
        if (newId) this.tableSettings().open(newId);
        return;
      }

      case 'openTableSettings': {
        this.tableSettings().open(cmd.nodeId);
        return;
      }

      case 'editCell': {
        await this.handleEditCell(cmd.nodeId, cmd.cellId);
        return;
      }

      case 'insertFormula': {
        if (this.state.readOnly() || this.state.toolState('FORMULA').state !== 'ENABLED') return;
        const otherFormulas = collectOtherFormulas(doc, undefined, (n) =>
          this.transloco.translate('tplTables.formula.defaultName', { n }),
        );
        const res = await this.openFormulaBuilder({
          context: 'NODE',
          otherFormulas,
        });
        if (!res) return;
        this.state.insertNode({
          type: 'formula',
          props: {
            formulaId: newDesignerUuid(),
            expression: res.expression,
            ...(res.format ? { format: res.format } : {}),
          },
        });
        return;
      }

      case 'editFormula': {
        await this.handleEditFormula(cmd.nodeId, cmd.cellId);
        return;
      }

      case 'insertTotals': {
        if (this.state.readOnly() || this.state.toolState('TOTALS').state !== 'ENABLED') return;
        this.totals().openInsert();
        return;
      }

      case 'openTotals': {
        this.totals().openEdit(cmd.nodeId);
        return;
      }
    }
  }

  private async handleEditCell(nodeId: string, cellId: string): Promise<void> {
    const doc = this.state.document();
    const node = doc?.nodes[nodeId];
    if (!doc || !node) return;

    const otherFormulas = collectOtherFormulas(doc, undefined, (n) =>
      this.transloco.translate('tplTables.formula.defaultName', { n }),
    );

    if (node.type === 'staticTable') {
      const colIndexById = new Map(node.props.columns.map((c, idx) => [c.id, idx]));
      let rowIndex = -1;
      let colIndex = -1;
      let targetCell = null as (typeof node.props.rows)[number]['cells'][number] | null;

      for (let r = 0; r < node.props.rows.length; r++) {
        const found = node.props.rows[r].cells.find((c) => c.id === cellId);
        if (found) {
          rowIndex = r;
          colIndex = colIndexById.get(found.columnId) ?? -1;
          targetCell = found;
          break;
        }
      }
      if (!targetCell || rowIndex < 0 || colIndex < 0) return;

      const res = await this.openCellEditor({
        context: 'STATIC_CELL',
        value: structuredClone(targetCell.value),
        otherFormulas,
        staticGrid: {
          rows: node.props.rows,
          columns: node.props.columns,
          rowIndex,
          colIndex,
          rowSpan: targetCell.rowSpan ?? 1,
          colSpan: targetCell.colSpan ?? 1,
        },
      });
      if (!res || this.state.readOnly()) return;

      const coveredSet = new Set(
        (res.clearCoveredCoords ?? []).map((coord) => `${coord.rowIndex}:${coord.colIndex}`),
      );
      const nextRows = node.props.rows.map((r, rIdx) => ({
        ...r,
        cells: r.cells.map((c) => {
          const cIdx = colIndexById.get(c.columnId);
          if (c.id === cellId) {
            return {
              ...c,
              value: res.value,
              rowSpan: res.rowSpan && res.rowSpan > 1 ? res.rowSpan : undefined,
              colSpan: res.colSpan && res.colSpan > 1 ? res.colSpan : undefined,
            };
          }
          if (cIdx !== undefined && coveredSet.has(`${rIdx}:${cIdx}`)) {
            return {
              ...c,
              value: { kind: 'TEXT' as const, value: '' },
              rowSpan: undefined,
              colSpan: undefined,
            };
          }
          return c;
        }),
      }));

      this.state.updateNode(node.id, { props: { ...node.props, rows: nextRows } }, 'editCell');
      return;
    }

    if (node.type === 'dynamicTable') {
      const colIdx = node.props.columns.findIndex((c) => c.id === cellId);
      if (colIdx < 0) return;
      const col = node.props.columns[colIdx];
      if (!('value' in col)) return;

      const res = await this.openCellEditor({
        context: 'DYNAMIC_CELL',
        value: structuredClone(col.value),
        rowArrayPath: node.props.sourcePath,
        otherFormulas,
      });
      if (!res || this.state.readOnly()) return;

      const nextCols: TemplateDynamicTableColumn[] = node.props.columns.map((c, idx) =>
        idx === colIdx && 'value' in c ? { ...c, value: res.value } : c,
      );
      this.state.updateNode(node.id, { props: { ...node.props, columns: nextCols } }, 'editCell');
    }
  }

  private async handleEditFormula(nodeId: string, cellId?: string): Promise<void> {
    const doc = this.state.document();
    const node = doc?.nodes[nodeId];
    if (!doc || !node) return;

    if (!cellId && node.type === 'formula') {
      const otherFormulas = collectOtherFormulas(doc, node.props.formulaId, (n) =>
        this.transloco.translate('tplTables.formula.defaultName', { n }),
      );
      const res = await this.openFormulaBuilder({
        context: 'NODE',
        expression: structuredClone(node.props.expression),
        format: node.props.format ? structuredClone(node.props.format) : undefined,
        otherFormulas,
      });
      if (!res || this.state.readOnly()) return;

      const nextProps: TemplateFormulaNode['props'] = {
        formulaId: node.props.formulaId,
        expression: res.expression,
        ...(res.format ? { format: res.format } : {}),
      };
      this.state.updateNode(node.id, { props: nextProps }, 'editFormula');
      return;
    }

    if (!cellId) return;
    const otherFormulas = collectOtherFormulas(doc, undefined, (n) =>
      this.transloco.translate('tplTables.formula.defaultName', { n }),
    );

    if (node.type === 'staticTable') {
      let existingValue: TemplateTableCellValue | null = null;
      for (const r of node.props.rows) {
        const cell = r.cells.find((c) => c.id === cellId);
        if (cell) {
          existingValue = cell.value;
          break;
        }
      }
      if (!existingValue) return;

      const res = await this.openFormulaBuilder({
        context: 'STATIC_CELL',
        expression: existingValue.kind === 'FORMULA' ? structuredClone(existingValue.expression) : undefined,
        format: existingValue.kind === 'FORMULA' && existingValue.format ? structuredClone(existingValue.format) : undefined,
        otherFormulas,
      });
      if (!res || this.state.readOnly()) return;

      const nextValue: TemplateTableCellValue = {
        kind: 'FORMULA',
        expression: res.expression,
        ...(res.format ? { format: res.format } : {}),
      };
      const nextRows = node.props.rows.map((r) => ({
        ...r,
        cells: r.cells.map((c) => (c.id === cellId ? { ...c, value: nextValue } : c)),
      }));
      this.state.updateNode(node.id, { props: { ...node.props, rows: nextRows } }, 'editFormula');
      return;
    }

    if (node.type === 'dynamicTable') {
      const colIdx = node.props.columns.findIndex((c) => c.id === cellId);
      if (colIdx < 0) return;
      const col = node.props.columns[colIdx];
      if (!('value' in col)) return;

      const res = await this.openFormulaBuilder({
        context: 'DYNAMIC_CELL',
        expression: col.value.kind === 'FORMULA' ? structuredClone(col.value.expression) : undefined,
        format: col.value.kind === 'FORMULA' && col.value.format ? structuredClone(col.value.format) : undefined,
        rowArrayPath: node.props.sourcePath,
        otherFormulas,
      });
      if (!res || this.state.readOnly()) return;

      const nextValue: TemplateTableCellValue = {
        kind: 'FORMULA',
        expression: res.expression,
        ...(res.format ? { format: res.format } : {}),
      };
      const nextCols: TemplateDynamicTableColumn[] = node.props.columns.map((c, idx) =>
        idx === colIdx && 'value' in c ? { ...c, value: nextValue } : c,
      );
      this.state.updateNode(node.id, { props: { ...node.props, columns: nextCols } }, 'editFormula');
    }
  }
}
