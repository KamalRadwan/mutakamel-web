import { Component, computed, input } from '@angular/core';

interface DiagramRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const VIEWBOX_WIDTH = 220;
const VIEWBOX_HEIGHT = 180;
const PADDING_X = 48;
const PADDING_Y = 22;

/** Proportional preview of paper dimensions and logical margins with RTL mirroring. */
@Component({
  selector: 'app-template-page-diagram, app-page-diagram',
  templateUrl: './page-diagram.html',
  host: { class: 'block min-w-0' },
})
export class TemplatePageDiagram {
  readonly widthMm = input(210);
  readonly heightMm = input(297);
  readonly marginTopMm = input(12);
  readonly marginEndMm = input(12);
  readonly marginBottomMm = input(12);
  readonly marginStartMm = input(12);
  readonly rtl = input(false);

  readonly paperLabel = input('');
  readonly ariaLabel = input('');
  readonly printableLabel = input('');
  readonly topLabel = input('');
  readonly bottomLabel = input('');
  readonly startLabel = input('');
  readonly endLabel = input('');

  protected readonly safeWidthMm = computed(() => sanitizePositive(this.widthMm(), 210));
  protected readonly safeHeightMm = computed(() => sanitizePositive(this.heightMm(), 297));
  protected readonly safeTopMm = computed(() => clampNonNegative(this.marginTopMm()));
  protected readonly safeBottomMm = computed(() => clampNonNegative(this.marginBottomMm()));
  protected readonly safeStartMm = computed(() => clampNonNegative(this.marginStartMm()));
  protected readonly safeEndMm = computed(() => clampNonNegative(this.marginEndMm()));

  protected readonly printableWidthMm = computed(() =>
    roundMm(this.safeWidthMm() - this.safeStartMm() - this.safeEndMm()),
  );
  protected readonly printableHeightMm = computed(() =>
    roundMm(this.safeHeightMm() - this.safeTopMm() - this.safeBottomMm()),
  );
  protected readonly printableValid = computed(
    () => this.printableWidthMm() > 0 && this.printableHeightMm() > 0,
  );

  private readonly scale = computed(() => {
    const maxDrawW = VIEWBOX_WIDTH - PADDING_X * 2;
    const maxDrawH = VIEWBOX_HEIGHT - PADDING_Y * 2;
    return Math.min(maxDrawW / this.safeWidthMm(), maxDrawH / this.safeHeightMm());
  });

  protected readonly paperRect = computed<DiagramRect>(() => {
    const s = this.scale();
    const width = this.safeWidthMm() * s;
    const height = this.safeHeightMm() * s;
    return {
      x: (VIEWBOX_WIDTH - width) / 2,
      y: (VIEWBOX_HEIGHT - height) / 2,
      width,
      height,
    };
  });

  protected readonly leftMarginMm = computed(() => (this.rtl() ? this.safeEndMm() : this.safeStartMm()));
  protected readonly rightMarginMm = computed(() => (this.rtl() ? this.safeStartMm() : this.safeEndMm()));
  protected readonly leftEdgeLabel = computed(() => (this.rtl() ? this.endLabel() : this.startLabel()));
  protected readonly rightEdgeLabel = computed(() => (this.rtl() ? this.startLabel() : this.endLabel()));

  protected readonly printableRect = computed<DiagramRect>(() => {
    const paper = this.paperRect();
    const s = this.scale();
    const leftPx = this.leftMarginMm() * s;
    const rightPx = this.rightMarginMm() * s;
    const topPx = this.safeTopMm() * s;
    const bottomPx = this.safeBottomMm() * s;
    return {
      x: paper.x + leftPx,
      y: paper.y + topPx,
      width: Math.max(0, paper.width - leftPx - rightPx),
      height: Math.max(0, paper.height - topPx - bottomPx),
    };
  });

  protected readonly topEdgeCenter = computed(() => {
    const paper = this.paperRect();
    return { x: paper.x + paper.width / 2, y: paper.y - 6 };
  });

  protected readonly bottomEdgeCenter = computed(() => {
    const paper = this.paperRect();
    return { x: paper.x + paper.width / 2, y: paper.y + paper.height + 12 };
  });

  protected readonly leftEdgeCenter = computed(() => {
    const paper = this.paperRect();
    return { x: paper.x - 4, y: paper.y + paper.height / 2 + 3 };
  });

  protected readonly rightEdgeCenter = computed(() => {
    const paper = this.paperRect();
    return { x: paper.x + paper.width + 4, y: paper.y + paper.height / 2 + 3 };
  });
}

export { TemplatePageDiagram as PageDiagram };

function sanitizePositive(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function clampNonNegative(value: number): number {
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function roundMm(value: number): number {
  return Math.round(value * 10) / 10;
}
