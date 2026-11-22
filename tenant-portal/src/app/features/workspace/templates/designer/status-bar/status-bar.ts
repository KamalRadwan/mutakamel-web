import { Component, computed, inject } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerChevronLeft,
  tablerChevronRight,
  tablerCircleCheck,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { templateLayoutMeta } from '../../shared/template-family';
import type { TemplateDocumentV1, TemplateNode, TemplatePageConfig } from '../../templates.model';
import { DesignerState } from '../designer-state';
import { collectPageNodes, isInHeaderOrFooterZone } from '../document-ops';
import { type RectMm, isInsidePrintableArea } from '../geometry';

function isStructuralContainer(node: TemplateNode): boolean {
  if (
    node.type === 'header' ||
    node.type === 'footer' ||
    node.type === 'row' ||
    node.type === 'column' ||
    node.type === 'group'
  ) {
    return true;
  }
  if (node.type === 'container') {
    return node.props.semanticRole === 'BODY' || node.layout.kind === 'FLOW';
  }
  return false;
}

function rotatedNodeBoundsMm(doc: TemplateDocumentV1, node: TemplateNode): RectMm | null {
  if (node.layout.kind !== 'ABSOLUTE') return null;
  const { width, height } = node.layout;
  let corners = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];

  let cursor: TemplateNode | undefined = node;
  while (cursor) {
    if (cursor.layout.kind === 'ABSOLUTE') {
      const { x, y, width: w, height: h, rotationDeg } = cursor.layout;
      if (rotationDeg !== 0) {
        const rad = (rotationDeg * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const cx = w / 2;
        const cy = h / 2;
        corners = corners.map((p) => {
          const dx = p.x - cx;
          const dy = p.y - cy;
          return {
            x: dx * cos - dy * sin + cx,
            y: dx * sin + dy * cos + cy,
          };
        });
      }
      corners = corners.map((p) => ({ x: p.x + x, y: p.y + y }));
    }
    cursor = cursor.parentId ? doc.nodes[cursor.parentId] : undefined;
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const c of corners) {
    minX = Math.min(minX, c.x);
    minY = Math.min(minY, c.y);
    maxX = Math.max(maxX, c.x);
    maxY = Math.max(maxY, c.y);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

@Component({
  selector: 'app-tpl-status-bar',
  imports: [NgIcon, TranslocoPipe],
  providers: [
    provideIcons({
      tablerCircleCheck,
      tablerAlertTriangle,
      tablerChevronLeft,
      tablerChevronRight,
    }),
  ],
  templateUrl: './status-bar.html',
})
export class StatusBar {
  protected readonly state = inject(DesignerState);
  private readonly transloco = inject(TranslocoService);
  private readonly language = inject(LanguageState).current;
  private readonly i18n = translationEvents(this.transloco);

  protected readonly isEmail = computed(
    () => this.state.channel() === 'EMAIL' || this.state.layoutMode() === 'EMAIL_FLOW',
  );

  protected readonly isFixedCanvas = computed(() => this.state.layoutMode() === 'FIXED_CANVAS');

  protected readonly pageNodes = computed(() => {
    const doc = this.state.document();
    if (!doc) return [];
    return collectPageNodes(doc, this.state.pageIndex());
  });

  protected readonly objectCount = computed(
    () => this.pageNodes().filter((node) => !isStructuralContainer(node)).length,
  );

  protected readonly layoutFacts = computed(() => {
    this.language();
    this.i18n();
    const mode = this.state.layoutMode();
    if (!mode) return '';

    if (this.isEmail()) {
      return this.transloco.translate('tplTools.status.email', { w: this.state.emailWidthPx() });
    }

    const page = this.state.currentPage();
    if (!page) {
      return this.transloco.translate(templateLayoutMeta(mode).labelKey);
    }

    const preset =
      page.preset === 'CUSTOM'
        ? this.transloco.translate('tplTools.status.custom', { w: page.widthMm, h: page.heightMm })
        : page.preset === 'LETTER'
          ? this.transloco.translate('tplTools.ribbon.paperLetter')
          : page.preset;
    const orientation = this.transloco.translate(
      page.orientation === 'LANDSCAPE' ? 'tplTools.status.landscape' : 'tplTools.status.portrait',
    );
    const paperPart = `${preset} ${orientation}`;

    if (mode === 'FIXED_CANVAS') {
      return [
        this.transloco.translate('tplTools.status.fixed'),
        paperPart,
        this.transloco.translate('tplTools.status.overflowReject'),
      ].join(' · ');
    }

    return [this.transloco.translate(templateLayoutMeta(mode).labelKey), paperPart].join(' · ');
  });

  private readonly absolutePrintNodes = computed(() => {
    const doc = this.state.document();
    if (!doc || this.isEmail()) return [];
    return this.pageNodes().filter(
      (node) => node.layout.kind === 'ABSOLUTE' && !isInHeaderOrFooterZone(doc, node.id),
    );
  });

  protected readonly showPrintableCheck = computed(
    () =>
      !this.isEmail() &&
      !!this.state.currentPage() &&
      (this.isFixedCanvas() || this.absolutePrintNodes().length > 0),
  );

  protected readonly outsideNodeIds = computed<string[]>(() => {
    const doc = this.state.document();
    const page = this.state.currentPage();
    if (!doc || !page || this.isEmail()) return [];

    const isRtl = doc.direction === 'RTL' || (doc.direction === 'AUTO' && doc.locale.startsWith('ar'));
    const physicalPage: TemplatePageConfig = isRtl
      ? {
          ...page,
          marginMm: {
            ...page.marginMm,
            start: page.marginMm.end,
            end: page.marginMm.start,
          },
        }
      : page;

    const outside: string[] = [];
    for (const node of this.absolutePrintNodes()) {
      if (node.hidden) continue;
      const bounds = rotatedNodeBoundsMm(doc, node);
      if (bounds && !isInsidePrintableArea(bounds, physicalPage)) {
        outside.push(node.id);
      }
    }
    return outside;
  });

  protected selectOutsideNodes(): void {
    const ids = this.outsideNodeIds();
    if (ids.length > 0) {
      this.state.select(ids, 'replace');
    }
  }

  protected goPrevPage(): void {
    const idx = this.state.pageIndex();
    if (idx <= 0) return;
    this.state.pageIndex.set(idx - 1);
    this.state.clearSelection();
  }

  protected goNextPage(): void {
    const idx = this.state.pageIndex();
    if (idx >= this.state.pageCount() - 1) return;
    this.state.pageIndex.set(idx + 1);
    this.state.clearSelection();
  }
}
