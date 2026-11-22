import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, effect, inject, input, output } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerEyeOff, tablerLock, tablerPhoto, tablerPhotoOff } from '@ng-icons/tabler-icons';
import type {
  TemplateBoxSpacing,
  TemplateDocumentV1,
  TemplateDynamicTableColumn,
  TemplateFontFamilyToken,
  TemplateFontWeight,
  TemplateFormulaExpression,
  TemplateNode,
  TemplatePageConfig,
  TemplateStaticTableColumn,
  TemplateTableCell,
  TemplateTableCellStyle,
  TemplateTableCellValue,
  TemplateTableRow,
  TemplateTextAlign,
  TemplateTextTemplate,
  TemplateVerticalAlign,
} from '../../../templates.model';
import { DesignerState } from '../../designer-state';
import { frameToPx, mmToPx } from '../../geometry';

interface StaticTableCellSlot {
  id: string;
  colSpan: number;
  rowSpan: number;
  value: TemplateTableCellValue;
  style?: TemplateTableCellStyle;
  column: TemplateStaticTableColumn;
}

interface StaticTableRenderRow {
  id: string;
  heightPx: number | null;
  cells: StaticTableCellSlot[];
}

const FONT_WEIGHTS: Record<TemplateFontWeight, number> = {
  NORMAL: 400,
  MEDIUM: 500,
  SEMIBOLD: 600,
  BOLD: 700,
};

const FONT_STACKS: Record<TemplateFontFamilyToken, string> = {
  SYSTEM_SANS: 'var(--font-en)',
  ARABIC_SANS: 'var(--font-ar)',
  SYSTEM_SERIF: 'Georgia, "Times New Roman", serif',
};

const TEXT_ALIGNS: Record<TemplateTextAlign, string> = {
  START: 'start',
  CENTER: 'center',
  END: 'end',
  JUSTIFY: 'justify',
};

const VERTICAL_ALIGNS: Record<TemplateVerticalAlign, string> = {
  TOP: 'top',
  MIDDLE: 'middle',
  BOTTOM: 'bottom',
};

const FLEX_VERTICAL_ALIGNS: Record<TemplateVerticalAlign, string> = {
  TOP: 'flex-start',
  MIDDLE: 'center',
  BOTTOM: 'flex-end',
};

@Component({
  selector: 'app-tpl-node-view',
  imports: [NgIcon, NgTemplateOutlet, TranslocoPipe],
  providers: [provideIcons({ tablerEyeOff, tablerLock, tablerPhoto, tablerPhotoOff })],
  templateUrl: './node-view.html',
  host: { class: 'contents' },
})
export class NodeView {
  protected readonly state = inject(DesignerState);
  private readonly transloco = inject(TranslocoService);

  readonly nodeId = input.required<string>();
  readonly doc = input.required<TemplateDocumentV1>();
  readonly page = input<TemplatePageConfig | null>(null);
  readonly zoom = input.required<number>();
  readonly movingIds = input<ReadonlySet<string>>(new Set());
  readonly dragOffsetPx = input<{ dx: number; dy: number } | null>(null);
  readonly resizeOverrideMm = input<{ nodeId: string; x: number; y: number; width: number; height: number } | null>(null);

  readonly nodePointerDown = output<{ event: PointerEvent; nodeId: string }>();
  readonly nodeDoubleClick = output<string>();

  protected readonly node = computed<TemplateNode | null>(() => this.doc().nodes[this.nodeId()] ?? null);

  protected readonly isSelfMoving = computed(() => this.movingIds().has(this.nodeId()));

  protected readonly docDir = computed<'ltr' | 'rtl'>(() => {
    const doc = this.doc();
    if (doc.direction === 'RTL') return 'rtl';
    if (doc.direction === 'LTR') return 'ltr';
    return doc.locale.startsWith('ar') ? 'rtl' : 'ltr';
  });

  protected readonly isSelected = computed(() => this.state.selectedIds().includes(this.nodeId()));

  protected readonly isAbsolute = computed(() => this.node()?.layout.kind === 'ABSOLUTE');

  protected readonly paperColors = computed(() => {
    const theme = this.doc().theme;
    const surface = theme.surfaceColor ?? 'var(--template-paper)';
    const ink = theme.textColor;
    const accent = theme.accentColor ?? ink;
    return {
      surface,
      ink,
      accent,
      muted: `color-mix(in srgb, ${ink} 6%, ${surface})`,
      line: `color-mix(in srgb, ${ink} 16%, ${surface})`,
      mutedText: `color-mix(in srgb, ${ink} 65%, ${surface})`,
    };
  });

  protected readonly frameStyle = computed(() => {
    const node = this.node();
    if (!node) return null;
    const zoom = this.zoom();

    if (node.layout.kind === 'ABSOLUTE') {
      const override = this.resizeOverrideMm();
      const frame =
        override && override.nodeId === node.id
          ? override
          : {
              x: node.layout.x,
              y: node.layout.y,
              width: node.layout.width,
              height: node.layout.height,
            };
      const px = frameToPx(frame, this.page(), zoom);
      const drag = this.isSelfMoving() ? this.dragOffsetPx() : null;
      const dx = drag ? drag.dx : 0;
      const dy = drag ? drag.dy : 0;
      const rot = node.layout.rotationDeg;

      const transforms: string[] = [];
      if (dx !== 0 || dy !== 0) transforms.push(`translate(${dx}px, ${dy}px)`);
      if (rot !== 0) transforms.push(`rotate(${rot}deg)`);

      return {
        position: 'absolute',
        left: `${px.left}px`,
        top: `${px.top}px`,
        width: `${px.width}px`,
        height: `${px.height}px`,
        zIndex: node.layout.zIndex,
        transform: transforms.length > 0 ? transforms.join(' ') : null,
      };
    }

    const flow = node.layout;
    let widthCss: string | null = null;
    if (node.type === 'column') {
      widthCss = `${node.props.widthPercent}%`;
    } else if (flow.width) {
      if (flow.width.unit === 'PERCENT') widthCss = `${flow.width.value}%`;
      else if (flow.width.unit === 'MM') widthCss = `${mmToPx(flow.width.value, zoom)}px`;
      else widthCss = `${flow.width.value * zoom}px`;
    }

    let minHeightCss: string | null = null;
    if (flow.minHeight) {
      minHeightCss =
        flow.minHeight.unit === 'MM'
          ? `${mmToPx(flow.minHeight.value, zoom)}px`
          : `${flow.minHeight.value * zoom}px`;
    } else if (node.type === 'header' || node.type === 'footer') {
      minHeightCss = `${mmToPx(node.props.heightMm, zoom)}px`;
    }

    return {
      position: 'relative',
      left: null,
      top: null,
      width: widthCss,
      height: null,
      minHeight: minHeightCss,
      zIndex: null,
      transform: null,
    };
  });

  protected readonly boxStyle = computed(() => {
    const node = this.node();
    const doc = this.doc();
    if (!node) return {};
    const zoom = this.zoom();
    const s = node.style;
    const theme = doc.theme;

    const fontFamily = FONT_STACKS[s.fontFamilyToken ?? theme.fontFamilyToken];
    const fontSize = `${(s.fontSizePx ?? theme.baseFontSizePx) * zoom}px`;
    const fontWeight = s.fontWeight ? FONT_WEIGHTS[s.fontWeight] : null;
    const fontStyle = s.fontStyle === 'ITALIC' ? 'italic' : null;
    const textDecoration = s.textDecoration === 'UNDERLINE' ? 'underline' : null;
    const lineHeight = String(s.lineHeight ?? theme.lineHeight);
    const letterSpacing = s.letterSpacingPx !== undefined ? `${s.letterSpacingPx * zoom}px` : null;
    const color = s.color ?? theme.textColor;
    const backgroundColor = s.backgroundColor ?? null;
    const textAlign = s.textAlign ? TEXT_ALIGNS[s.textAlign] : null;
    const padding = this.formatLogicalSpacing(s.padding, zoom);
    const margin = this.formatLogicalSpacing(s.margin, zoom);
    const gap = s.gapPx !== undefined ? `${s.gapPx * zoom}px` : null;
    const borderRadius = s.borderRadiusPx !== undefined ? `${s.borderRadiusPx * zoom}px` : null;
    const border =
      s.border && s.border.style !== 'NONE' && s.border.widthPx > 0
        ? `${Math.max(1, s.border.widthPx * zoom)}px ${s.border.style.toLowerCase()} ${s.border.color}`
        : null;

    const baseOpacity = s.opacity ?? 1;
    const opacity = node.hidden ? Math.min(baseOpacity, 0.35) : baseOpacity < 1 ? baseOpacity : null;

    const overflow =
      s.overflow === 'HIDDEN' ? 'hidden' : s.overflow === 'VISIBLE' ? 'visible' : null;

    return {
      fontFamily,
      fontSize,
      fontWeight,
      fontStyle,
      textDecoration,
      lineHeight,
      letterSpacing,
      color,
      backgroundColor,
      textAlign,
      paddingBlockStart: padding?.blockStart ?? null,
      paddingBlockEnd: padding?.blockEnd ?? null,
      paddingInlineStart: padding?.inlineStart ?? null,
      paddingInlineEnd: padding?.inlineEnd ?? null,
      marginBlockStart: margin?.blockStart ?? null,
      marginBlockEnd: margin?.blockEnd ?? null,
      marginInlineStart: margin?.inlineStart ?? null,
      marginInlineEnd: margin?.inlineEnd ?? null,
      gap,
      borderRadius,
      border,
      opacity,
      overflow,
      justifyContent: s.verticalAlign ? FLEX_VERTICAL_ALIGNS[s.verticalAlign] : null,
    };
  });

  protected readonly assetEntry = computed(() => {
    const node = this.node();
    if (!node || node.type !== 'image') return null;
    return this.state.assetEntry(node.props.assetId);
  });

  protected readonly dividerStyle = computed(() => {
    const node = this.node();
    if (!node || node.type !== 'divider') return {};
    const zoom = this.zoom();
    const thickness = Math.max(1, node.props.thicknessPx * zoom);
    return {
      borderTopWidth: `${thickness}px`,
      borderTopStyle: node.props.style.toLowerCase(),
      borderTopColor: node.props.color,
    };
  });

  protected readonly spacerHeightPx = computed(() => {
    const node = this.node();
    if (!node || node.type !== 'spacer') return 0;
    return node.props.heightPx * this.zoom();
  });

  protected readonly staticTableData = computed<{
    columns: TemplateStaticTableColumn[];
    rows: StaticTableRenderRow[];
    hasHeader: boolean;
  } | null>(() => {
    const node = this.node();
    if (!node || node.type !== 'staticTable') return null;
    const visibleCols = node.props.columns.filter((c) => c.visible);
    const colIndexMap = new Map(visibleCols.map((c, idx) => [c.id, idx]));
    const covered = new Set<string>();
    const zoom = this.zoom();

    const rows: StaticTableRenderRow[] = node.props.rows.map((row, rIdx) => {
      const cellByCol = new Map<string, TemplateTableCell>();
      for (const c of row.cells) cellByCol.set(c.columnId, c);

      const slots: StaticTableCellSlot[] = [];
      for (let cIdx = 0; cIdx < visibleCols.length; cIdx++) {
        if (covered.has(`${rIdx}:${cIdx}`)) continue;
        const col = visibleCols[cIdx];
        const cell = cellByCol.get(col.id);
        const rowSpan = Math.max(1, cell?.rowSpan ?? 1);
        const colSpan = Math.max(1, cell?.colSpan ?? 1);
        for (let dr = 0; dr < rowSpan; dr++) {
          for (let dc = 0; dc < colSpan; dc++) {
            if (dr !== 0 || dc !== 0) {
              covered.add(`${rIdx + dr}:${cIdx + dc}`);
            }
          }
        }
        const rawColIdx = colIndexMap.get(col.id);
        if (rawColIdx === undefined) continue;
        slots.push({
          id: cell?.id ?? `${row.id}-${col.id}`,
          colSpan,
          rowSpan,
          value: cell?.value ?? { kind: 'TEXT', value: '' },
          style: cell?.style,
          column: col,
        });
      }

      const rowHeightMm = node.props.fixedCanvas?.rowHeightsMm?.[rIdx];
      return {
        id: row.id,
        heightPx: rowHeightMm !== undefined ? mmToPx(rowHeightMm, zoom) : null,
        cells: slots,
      };
    });

    const hasHeader = rows[0]?.cells.some((slot) => !!slot.column.headerStyle) ?? false;
    return { columns: visibleCols, rows, hasHeader };
  });

  protected readonly dynamicColumns = computed<TemplateDynamicTableColumn[]>(() => {
    const node = this.node();
    if (!node || node.type !== 'dynamicTable') return [];
    return node.props.columns.filter((c) => c.visible);
  });

  protected readonly buttonStyle = computed(() => {
    const node = this.node();
    if (!node || node.type !== 'button') return {};
    const colors = this.paperColors();
    const zoom = this.zoom();
    const pad = this.formatLogicalSpacing(node.style.padding, zoom);
    return {
      backgroundColor: node.style.backgroundColor ?? colors.accent,
      color: node.style.color ?? colors.surface,
      borderRadius:
        node.style.borderRadiusPx !== undefined
          ? `${node.style.borderRadiusPx * zoom}px`
          : `calc(var(--radius-6) * ${zoom})`,
      paddingBlockStart: pad?.blockStart ?? `calc(var(--space-8) * ${zoom})`,
      paddingBlockEnd: pad?.blockEnd ?? `calc(var(--space-8) * ${zoom})`,
      paddingInlineStart: pad?.inlineStart ?? `calc(var(--space-16) * ${zoom})`,
      paddingInlineEnd: pad?.inlineEnd ?? `calc(var(--space-16) * ${zoom})`,
      width: node.props.fullWidthOnMobile ? '100%' : null,
    };
  });

  constructor() {
    effect(() => {
      const node = this.node();
      if (node?.type === 'image' && node.props.assetId) {
        this.state.requestAsset(node.props.assetId);
      }
    });
  }

  protected onPointerDown(event: PointerEvent): void {
    this.nodePointerDown.emit({ event, nodeId: this.nodeId() });
  }

  protected onDoubleClick(event: MouseEvent): void {
    event.stopPropagation();
    this.nodeDoubleClick.emit(this.nodeId());
  }

  protected colWidthCss(col: TemplateStaticTableColumn): string {
    if (col.width.unit === 'MM') {
      return `${mmToPx(col.width.value, this.zoom())}px`;
    }
    return `${col.width.value}%`;
  }

  protected cellStyleCss(
    col: TemplateStaticTableColumn,
    cellStyle: TemplateTableCellStyle | undefined,
    isHeaderRow: boolean,
    stripedRow: boolean,
  ): Record<string, string | null> {
    const merged: TemplateTableCellStyle = {
      ...(isHeaderRow ? col.headerStyle : col.cellStyle),
      ...cellStyle,
    };
    const zoom = this.zoom();
    const pad = merged.paddingPx;
    const colors = this.paperColors();

    return {
      textAlign: TEXT_ALIGNS[col.align],
      verticalAlign: col.verticalAlign ? VERTICAL_ALIGNS[col.verticalAlign] : 'middle',
      fontSize: merged.fontSizePx ? `${merged.fontSizePx * zoom}px` : null,
      fontWeight: merged.fontWeight ? String(FONT_WEIGHTS[merged.fontWeight]) : null,
      color: merged.color ?? null,
      backgroundColor: merged.backgroundColor ?? (stripedRow ? colors.muted : null),
      paddingBlockStart: pad ? `${pad.top * zoom}px` : `calc(var(--space-2) * ${zoom})`,
      paddingBlockEnd: pad ? `${pad.bottom * zoom}px` : `calc(var(--space-2) * ${zoom})`,
      paddingInlineStart: pad ? `${pad.start * zoom}px` : `calc(var(--space-4) * ${zoom})`,
      paddingInlineEnd: pad ? `${pad.end * zoom}px` : `calc(var(--space-4) * ${zoom})`,
      border:
        merged.border && merged.border.widthPx > 0
          ? `${Math.max(1, merged.border.widthPx * zoom)}px ${merged.border.style.toLowerCase()} ${merged.border.color}`
          : `var(--border-w) solid ${colors.line}`,
    };
  }

  protected formulaLabel(expr: TemplateFormulaExpression): string {
    if (expr.kind === 'FORMULA_REF') {
      const target = Object.values(this.doc().nodes).find(
        (n) => n.type === 'formula' && n.props.formulaId === expr.formulaId,
      );
      if (target?.name?.trim()) return target.name.trim();
    }
    return this.transloco.translate('tplDesigner.canvas.formula');
  }

  protected isProductImageCol(col: TemplateDynamicTableColumn): boolean {
    return 'productImage' in col;
  }

  protected dynamicColValue(col: TemplateDynamicTableColumn): TemplateTableCellValue | null {
    return 'value' in col ? col.value : null;
  }

  protected bandRows(node: TemplateNode): TemplateTableRow[] {
    if (node.type !== 'dynamicTable') return [];
    return (node.props.headerBands ?? []).flatMap((b) => b.rows);
  }

  protected footerBandRows(node: TemplateNode): TemplateTableRow[] {
    if (node.type !== 'dynamicTable') return [];
    return (node.props.footerBands ?? []).flatMap((b) => b.rows);
  }

  protected textTemplateSegments(tpl: TemplateTextTemplate) {
    return tpl.segments;
  }

  protected markClasses(marks?: readonly { type: string }[]): string {
    if (!marks || marks.length === 0) return '';
    const classes: string[] = [];
    for (const m of marks) {
      if (m.type === 'bold') classes.push('font-medium');
      if (m.type === 'italic') classes.push('italic');
      if (m.type === 'underline' || m.type === 'link') classes.push('underline');
    }
    return classes.join(' ');
  }

  protected markFontWeight(marks?: readonly { type: string }[]): number | null {
    return marks?.some((m) => m.type === 'bold') ? 700 : null;
  }

  private formatLogicalSpacing(
    spacing: TemplateBoxSpacing | undefined,
    zoom: number,
  ): { blockStart: string; blockEnd: string; inlineStart: string; inlineEnd: string } | null {
    if (!spacing) return null;
    const toPx = (v: number) => (spacing.unit === 'MM' ? `${mmToPx(v, zoom)}px` : `${v * zoom}px`);
    return {
      blockStart: toPx(spacing.blockStart),
      blockEnd: toPx(spacing.blockEnd),
      inlineStart: toPx(spacing.inlineStart),
      inlineEnd: toPx(spacing.inlineEnd),
    };
  }
}
