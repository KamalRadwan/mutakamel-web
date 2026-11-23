import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { rootZoom, rectInPage } from '../../../../../shared/ui/overlay/zoom';
import type { TemplateDocumentV1, TemplateNode, TemplatePageConfig } from '../../templates.model';
import { DesignerState } from '../designer-state';
import {
  type RectMm,
  type ResizeHandle,
  type SnapGuide,
  type SnapTarget,
  buildSnapTargets,
  clamp,
  mmToPx,
  pxToMm,
  rectsIntersect,
  roundMm,
  snapMoveMm,
  snapResizeMm,
} from '../geometry';
import { currentPageRootNodeIds, collectPageNodes } from '../document-ops';
import {
  absoluteBounds,
  canResizeFlow,
  clampAbsoluteFrame,
  hybridZone,
  moveNodeToPosition,
  printableBox,
  reorderFlow,
  resizeFlow,
  zoneBox,
  type PositionMode,
} from '../hybrid-ops';
import { Ruler } from '../ruler/ruler';
import { NodeView } from './node-view/node-view';

interface HandleDescriptor {
  id: ResizeHandle;
  leftPct: string;
  topPct: string;
  cursorClass: string;
}

const RESIZE_HANDLES: readonly HandleDescriptor[] = [
  { id: 'NW', leftPct: '0%', topPct: '0%', cursorClass: 'cursor-nwse-resize' },
  { id: 'N', leftPct: '50%', topPct: '0%', cursorClass: 'cursor-ns-resize' },
  { id: 'NE', leftPct: '100%', topPct: '0%', cursorClass: 'cursor-nesw-resize' },
  { id: 'E', leftPct: '100%', topPct: '50%', cursorClass: 'cursor-ew-resize' },
  { id: 'SE', leftPct: '100%', topPct: '100%', cursorClass: 'cursor-nwse-resize' },
  { id: 'S', leftPct: '50%', topPct: '100%', cursorClass: 'cursor-ns-resize' },
  { id: 'SW', leftPct: '0%', topPct: '100%', cursorClass: 'cursor-nesw-resize' },
  { id: 'W', leftPct: '0%', topPct: '50%', cursorClass: 'cursor-ew-resize' },
];

type DragSession =
  | {
      kind: 'flowMove';
      pointerId: number;
      nodeId: string;
      startClientX: number;
      startClientY: number;
      moved: boolean;
    }
  | {
      kind: 'flowResize';
      pointerId: number;
      nodeId: string;
      handle: ResizeHandle;
      startClientX: number;
      startClientY: number;
      startRect: RectMm;
      availableWidth: number;
      moved: boolean;
    }
  | {
      kind: 'move';
      pointerId: number;
      startClientX: number;
      startClientY: number;
      moved: boolean;
      movingIds: string[];
      startFrames: Map<string, RectMm>;
      primaryId: string;
      primaryAncestor: { x: number; y: number };
      targets: SnapTarget[];
    }
  | {
      kind: 'resize';
      rotationDeg: number;
      pointerId: number;
      nodeId: string;
      handle: ResizeHandle;
      startClientX: number;
      startClientY: number;
      startRect: RectMm;
      primaryAncestor: { x: number; y: number };
      moved: boolean;
      targets: SnapTarget[];
    }
  | {
      kind: 'marquee';
      pointerId: number;
      startPaperX: number;
      startPaperY: number;
      moved: boolean;
      additive: boolean;
    };

@Component({
  selector: 'app-tpl-canvas',
  imports: [TranslocoPipe, Ruler, NodeView],
  templateUrl: './template-canvas.html',
  host: {
    class: 'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface-muted',
    dir: 'ltr',
  },
})
export class TemplateCanvas implements AfterViewInit {
  protected readonly state = inject(DesignerState);
  private readonly injector = inject(Injector);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly scrollAreaRef = viewChild<ElementRef<HTMLElement>>('scrollArea');
  private readonly paperRef = viewChild<ElementRef<HTMLElement>>('paperEl');
  private readonly canvasRootRef = viewChild<ElementRef<HTMLElement>>('canvasRoot');

  protected readonly handles = computed(() =>
    this.state.primary()?.layout.kind === 'FLOW'
      ? RESIZE_HANDLES.filter((handle) => (this.state.primary()?.type === 'column' ? ['S'] : ['E', 'W', 'S']).includes(handle.id))
      : RESIZE_HANDLES,
  );
  private readonly measuredFlow = signal<{
    nodeId: string;
    left: number;
    top: number;
    width: number;
    height: number;
    rotationDeg: number;
  } | null>(null);
  protected readonly dropIndicator = signal<{ top: number; left: number; width: number } | null>(
    null,
  );
  private flowBeforeId: string | null = null;
  protected readonly scrollLeft = signal(0);
  protected readonly scrollTop = signal(0);
  protected readonly paperOffsetX = signal(16);
  protected readonly paperOffsetY = signal(16);
  protected readonly dragOffsetMm = signal<{ dx: number; dy: number } | null>(null);
  protected readonly resizePreview = signal<{
    nodeId: string;
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  protected readonly snapGuides = signal<SnapGuide[]>([]);
  protected readonly marqueePx = signal<{ left: number; top: number; width: number; height: number;
  } | null>(null);
  protected readonly liveAnnouncement = signal('');

  private dragSession: DragSession | null = null;
  private lastHandledNodeParam: string | null = null;
  private readonly queryParams = toSignal(this.route.queryParamMap);

  protected readonly isEmail = computed(
    () => this.state.channel() === 'EMAIL' || this.state.layoutMode() === 'EMAIL_FLOW',
  );
  protected readonly isFixedCanvas = computed(() => this.state.layoutMode() === 'FIXED_CANVAS');
  protected readonly zoneOverflow = computed(() => {
    const doc = this.state.document();
    if (!doc || doc.layoutMode !== 'HYBRID_DOCUMENT') return false;
    return Object.values(doc.nodes).some((node) => {
      if (node.layout.kind !== 'ABSOLUTE') return false;
      const bounds = absoluteBounds(doc, node);
      if (!bounds) return false;
      const frame = node.layout,
        radians = (frame.rotationDeg * Math.PI) / 180;
      const width =
        Math.abs(frame.width * Math.cos(radians)) + Math.abs(frame.height * Math.sin(radians));
      const height =
        Math.abs(frame.width * Math.sin(radians)) + Math.abs(frame.height * Math.cos(radians));
      return (
        frame.x + frame.width / 2 - width / 2 < -0.001 ||
        frame.y + frame.height / 2 - height / 2 < -0.001 ||
        frame.x + frame.width / 2 + width / 2 > bounds.width + 0.001 ||
        frame.y + frame.height / 2 + height / 2 > bounds.height + 0.001
      );
    });
  });
  protected readonly docDir = computed<'ltr' | 'rtl'>(() => {
    const doc = this.state.document();
    if (!doc) return 'ltr';
    if (doc.direction === 'RTL') return 'rtl';
    if (doc.direction === 'LTR') return 'ltr';
    return doc.locale.startsWith('ar') ? 'rtl' : 'ltr';
  });

  protected readonly rootNodeIds = computed<string[]>(() => {
    const doc = this.state.document();
    if (!doc) return [];
    return currentPageRootNodeIds(doc, this.state.pageIndex());
  });

  protected readonly paperSizePx = computed<{ width: number; height: number }>(() => {
    const page = this.state.currentPage();
    const zoom = this.state.zoom();
    if (this.isEmail()) {
      return { width: this.state.emailWidthPx() * zoom, height: 0 };
    }
    if (!page) return { width: mmToPx(210, zoom), height: mmToPx(297, zoom) };
    return {
      width: mmToPx(page.widthMm, zoom),
      height: mmToPx(page.heightMm, zoom),
    };
  });

  protected readonly printableBoxPx = computed(() => {
    const page = this.state.currentPage();
    const zoom = this.state.zoom();
    if (!page || this.isEmail()) return null;
    const leftMm = this.docDir() === 'rtl' ? page.marginMm.end : page.marginMm.start;
    const widthMm = Math.max(0, page.widthMm - page.marginMm.start - page.marginMm.end);
    const heightMm = Math.max(0, page.heightMm - page.marginMm.top - page.marginMm.bottom);
    return {
      left: mmToPx(leftMm, zoom),
      top: mmToPx(page.marginMm.top, zoom),
      width: mmToPx(widthMm, zoom),
      height: mmToPx(heightMm, zoom),
    };
  });

  protected readonly flowMarginsPx = computed(() => {
    const page = this.state.currentPage();
    const doc = this.state.document();
    const zoom = this.state.zoom();
    if (!page) return null;
    const rtl = this.docDir() === 'rtl';
    return {
      paddingTop: `${mmToPx(page.marginMm.top + (doc?.layoutMode === 'HYBRID_DOCUMENT' ? (hybridZone(doc, 'header')?.props.heightMm ?? 0) : 0), zoom)}px`,
      paddingRight: `${mmToPx(rtl ? page.marginMm.start : page.marginMm.end, zoom)}px`,
      paddingBottom: `${mmToPx(page.marginMm.bottom + (doc?.layoutMode === 'HYBRID_DOCUMENT' ? (hybridZone(doc, 'footer')?.props.heightMm ?? 0) : 0), zoom)}px`,
      paddingLeft: `${mmToPx(rtl ? page.marginMm.end : page.marginMm.start, zoom)}px`,
    };
  });

  protected readonly pageBgColor = computed(() => {
    const bg = this.state.currentPage()?.background;
    return bg?.kind === 'SOLID' ? bg.color : null;
  });

  protected readonly pageBgAsset = computed(() => {
    const bg = this.state.currentPage()?.background;
    if (bg?.kind !== 'ASSET') return null;
    return {
      entry: this.state.assetEntry(bg.assetId),
      fit: bg.fit,
      opacity: bg.opacity,
      assetId: bg.assetId,
    };
  });

  protected readonly dragOffsetPx = computed<{ dx: number; dy: number } | null>(() => {
    const off = this.dragOffsetMm();
    if (!off) return null;
    const zoom = this.state.zoom();
    return { dx: mmToPx(off.dx, zoom), dy: mmToPx(off.dy, zoom) };
  });

  protected readonly singleResizeTarget = computed(() => {
    if (this.state.readOnly()) return null;
    const sel = this.state.selectedNodes();
    if (sel.length !== 1) return null;
    const node = sel[0];
    if (node.locked) return null;
    if (node.layout.kind === 'FLOW') {
      const measured = this.measuredFlow();
      return canResizeFlow(node) && measured?.nodeId === node.id ? measured : null;
    }
    const preview = this.resizePreview();
    const rect =
      preview && preview.nodeId === node.id
        ? preview
        : {
            x: node.layout.x,
            y: node.layout.y,
            width: node.layout.width,
            height: node.layout.height,
          };
    const zoom = this.state.zoom();
    const drag = this.dragOffsetPx();
    const doc = this.state.document();
    const anc = doc ? this.ancestorOffsetMm(doc, node) : { x: 0, y: 0 };

    return {
      nodeId: node.id,
      rotationDeg: node.layout.rotationDeg,
      left: mmToPx(rect.x + anc.x, zoom) + (drag?.dx ?? 0),
      top: mmToPx(rect.y + anc.y, zoom) + (drag?.dy ?? 0),
      width: mmToPx(rect.width, zoom),
      height: mmToPx(rect.height, zoom),
    };
  });

  protected readonly movingNodeSet = computed(() => {
    const off = this.dragOffsetMm();
    if (!off) return new Set<string>();
    const ids = new Set<string>();
    for (const n of this.state.selectedNodes()) {
      if (!n.locked && n.layout.kind === 'ABSOLUTE') {
        ids.add(n.id);
      }
    }
    return ids;
  });

  constructor() {
    effect(() => {
      this.state.document();
      this.state.selectedIds();
      this.state.zoom();
      afterNextRender(() => this.measureFlowSelection(), { injector: this.injector });
    });
    // Request background asset when page uses an image background
    effect(() => {
      const bg = this.state.currentPage()?.background;
      if (bg?.kind === 'ASSET' && bg.assetId) {
        this.state.requestAsset(bg.assetId);
      }
    });

    // Recompute fit zoom and ruler offsets when zoom, mode, page, email width, or fullscreen changes
    effect(() => {
      this.state.zoom();
      this.state.zoomMode();
      this.state.currentPage();
      this.state.emailWidthPx();
      this.state.fullscreen();
      queueMicrotask(() => {
        this.recomputeFitZoom();
        this.measureOffsets();
      });
    });

    // Announce selected node name
    effect(() => {
      const primary = this.state.primary();
      if (!primary) return;
      const name = this.state.nodeDisplayName(primary);
      this.liveAnnouncement.set(this.transloco.translate('tplDesigner.canvas.selected', { name }));
    });

    // Handle ?node=<id> navigation from Validation tab
    effect(() => {
      const doc = this.state.document();
      const targetId = this.queryParams()?.get('node') ?? null;
      if (!doc || !targetId || targetId === this.lastHandledNodeParam) return;
      if (!doc.nodes[targetId]) return;

      this.lastHandledNodeParam = targetId;
      const pageIdx = this.state.findNodePageIndex(targetId);
      if (pageIdx !== null) {
        this.state.pageIndex.set(pageIdx);
      }
      this.state.select([targetId], 'replace');

      requestAnimationFrame(() => {
        const el = this.paperRef()?.nativeElement.querySelector(
          `[data-node-id="${CSS.escape(targetId)}"]`,
        );
        if (el instanceof HTMLElement) {
          el.scrollIntoView({ block: 'center', inline: 'center' });
        }
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { node: null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      });
    });
  }

  ngAfterViewInit(): void {
    const scrollArea = this.scrollAreaRef()?.nativeElement;
    if (!scrollArea) return;

    const observer = new ResizeObserver(() => {
      this.recomputeFitZoom();
      this.measureOffsets();
    });
    observer.observe(scrollArea);
    this.destroyRef.onDestroy(() => observer.disconnect());
  }

  protected onScroll(): void {
    const scrollArea = this.scrollAreaRef()?.nativeElement;
    if (!scrollArea) return;
    this.scrollLeft.set(scrollArea.scrollLeft);
    this.scrollTop.set(scrollArea.scrollTop);
    this.measureOffsets();
  }

  protected onWheel(event: WheelEvent): void {
    if (!(event.ctrlKey || event.metaKey)) return;
    event.preventDefault();
    const prevZoom = this.state.zoom();
    const factor = event.deltaY < 0 ? 1.1 : 0.9;
    const nextZoom = clamp(Math.round(prevZoom * factor * 100) / 100, 0.25, 4);
    if (nextZoom === prevZoom) return;

    const scrollArea = this.scrollAreaRef()?.nativeElement;
    const paper = this.paperRef()?.nativeElement;
    if (!scrollArea || !paper) {
      this.state.zoomMode.set('MANUAL');
      this.state.zoom.set(nextZoom);
      return;
    }

    const z = rootZoom();
    const sRect = rectInPage(scrollArea);
    const pRect = rectInPage(paper);
    const cursorInViewportX = event.clientX / z - sRect.left;
    const cursorInViewportY = event.clientY / z - sRect.top;
    const paperPointX = (event.clientX / z - pRect.left) / prevZoom;
    const paperPointY = (event.clientY / z - pRect.top) / prevZoom;

    this.state.zoomMode.set('MANUAL');
    this.state.zoom.set(nextZoom);

    afterNextRender(
      () => {
        const pRectAfter = rectInPage(paper);
        const sRectAfter = rectInPage(scrollArea);
        const newPaperOffsetX = pRectAfter.left - sRectAfter.left + scrollArea.scrollLeft;
        const newPaperOffsetY = pRectAfter.top - sRectAfter.top + scrollArea.scrollTop;
        scrollArea.scrollLeft = Math.max(
          0,
          newPaperOffsetX + paperPointX * nextZoom - cursorInViewportX,
        );
        scrollArea.scrollTop = Math.max(
          0,
          newPaperOffsetY + paperPointY * nextZoom - cursorInViewportY,
        );
        this.scrollLeft.set(scrollArea.scrollLeft);
        this.scrollTop.set(scrollArea.scrollTop);
        this.measureOffsets();
      },
      { injector: this.injector },
    );
  }

  protected onPaperPointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    this.canvasRootRef()?.nativeElement.focus({ preventScroll: true });

    const paper = this.paperRef()?.nativeElement;
    const scrollArea = this.scrollAreaRef()?.nativeElement;
    if (!paper || !scrollArea) return;
    const rect = rectInPage(paper);
    const z = rootZoom();
    const paperX = event.clientX / z - rect.left;
    const paperY = event.clientY / z - rect.top;

    if (this.placePending(event)) return;

    scrollArea.setPointerCapture(event.pointerId);
    this.dragSession = {
      kind: 'marquee',
      pointerId: event.pointerId,
      startPaperX: paperX,
      startPaperY: paperY,
      moved: false,
      additive: event.shiftKey,
    };
  }

  protected onNodePointerDown(payload: { event: PointerEvent; nodeId: string }): void {
    const { event, nodeId } = payload;
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    this.canvasRootRef()?.nativeElement.focus({ preventScroll: true });

    const doc = this.state.document();
    const node = doc?.nodes[nodeId];
    if (!doc || !node) return;

    if (['header', 'footer', 'container'].includes(node.type) && this.placePending(event)) return;
    this.state.pendingPlacement.set(null);

    if (event.shiftKey) {
      this.state.select([nodeId], 'toggle');
    } else if (!this.state.selectedIds().includes(nodeId)) {
      this.state.select([nodeId], 'replace');
    }

    if (this.state.readOnly() || node.locked) {
      return;
    }
    if (node.layout.kind === 'FLOW') {
      if (
        !node.parentId ||
        ['column', 'header', 'footer'].includes(node.type) ||
        doc.nodes[node.parentId]?.type === 'row'
      )
        return;
      this.scrollAreaRef()?.nativeElement.setPointerCapture(event.pointerId);
      this.dragSession = {
        kind: 'flowMove',
        pointerId: event.pointerId,
        nodeId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        moved: false,
      };
      return;
    }

    const movingNodes = this.state
      .selectedNodes()
      .filter((n) => !n.locked && n.layout.kind === 'ABSOLUTE');
    if (movingNodes.length === 0) return;

    const startFrames = new Map<string, RectMm>();
    const movingIds: string[] = [];
    for (const m of movingNodes) {
      if (m.layout.kind === 'ABSOLUTE') {
        movingIds.push(m.id);
        startFrames.set(m.id, {
          x: m.layout.x,
          y: m.layout.y,
          width: m.layout.width,
          height: m.layout.height,
        });
      }
    }

    const page = this.state.currentPage();
    const targets = page ? this.buildPaperSnapTargets(doc, page, new Set(movingIds)) : [];

    this.scrollAreaRef()?.nativeElement.setPointerCapture(event.pointerId);

    this.dragSession = {
      kind: 'move',
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      moved: false,
      movingIds,
      startFrames,
      primaryId: nodeId,
      primaryAncestor: this.ancestorOffsetMm(doc, node),
      targets,
    };
  }

  protected onHandlePointerDown(event: PointerEvent, handle: ResizeHandle): void {
    const target = this.singleResizeTarget();
    const doc = this.state.document();
    const page = this.state.currentPage();
    if (event.button !== 0 || !target || !doc) return;
    event.stopPropagation();
    event.preventDefault();
    this.state.pendingPlacement.set(null);

    const node = doc.nodes[target.nodeId];
    if (!node || node.locked) return;
    if (node.layout.kind === 'FLOW') {
      if (!canResizeFlow(node) || !['E', 'W', 'S'].includes(handle)) return;
      const el = this.nodeElement(node.id);
      const parent = node.parentId ? this.nodeElement(node.parentId) : null;
      const zoom = this.state.zoom();
      const availableWidth = parent
        ? pxToMm(parent.getBoundingClientRect().width / rootZoom(), zoom)
        : printableBox(doc).width;
      if (!el) return;
      this.scrollAreaRef()?.nativeElement.setPointerCapture(event.pointerId);
      this.dragSession = {
        kind: 'flowResize',
        pointerId: event.pointerId,
        nodeId: node.id,
        handle,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startRect: {
          x: 0,
          y: 0,
          width: pxToMm(target.width, zoom),
          height: pxToMm(target.height, zoom),
        },
        availableWidth,
        moved: false,
      };
      return;
    }

    const targets = page ? this.buildPaperSnapTargets(doc, page, new Set([node.id])) : [];

    this.scrollAreaRef()?.nativeElement.setPointerCapture(event.pointerId);
    this.dragSession = {
      kind: 'resize',
      rotationDeg: node.layout.rotationDeg,
      pointerId: event.pointerId,
      nodeId: node.id,
      handle,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startRect: {
        x: node.layout.x,
        y: node.layout.y,
        width: node.layout.width,
        height: node.layout.height,
      },
      primaryAncestor: this.ancestorOffsetMm(doc, node),
      moved: false,
      targets,
    };
  }

  protected onPointerMove(event: PointerEvent): void {
    const session = this.dragSession;
    if (!session || event.pointerId !== session.pointerId) return;

    const z = rootZoom();
    const zoom = this.state.zoom();

    if (session.kind === 'flowMove') {
      if (
        Math.hypot(event.clientX - session.startClientX, event.clientY - session.startClientY) / z <
        3
      )
        return;
      session.moved = true;
      const doc = this.state.document();
      const node = doc?.nodes[session.nodeId];
      const parent = node?.parentId ? doc?.nodes[node.parentId] : undefined;
      const paper = this.paperRef()?.nativeElement;
      if (!doc || !node || !parent || !paper) return;
      const siblings = parent.childIds
        .filter((id) => id !== node.id)
        .map((id) => ({ id, el: this.nodeElement(id) }))
        .filter((entry) => entry.el !== null);
      const before = siblings.find((entry) => {
        const rect = entry.el?.getBoundingClientRect();
        return rect ? event.clientY < rect.top + rect.height / 2 : false;
      });
      this.flowBeforeId = before?.id ?? null;
      const anchor = before?.el ?? siblings[siblings.length - 1]?.el ?? this.nodeElement(node.id);
      if (anchor) {
        const rect = rectInPage(anchor),
          paperRect = rectInPage(paper);
        this.dropIndicator.set({
          top: (before ? rect.top : rect.bottom) - paperRect.top,
          left: rect.left - paperRect.left,
          width: rect.width,
        });
      }
      return;
    }
    if (session.kind === 'flowResize') {
      const dx = pxToMm((event.clientX - session.startClientX) / z, zoom);
      const dy = pxToMm((event.clientY - session.startClientY) / z, zoom);
      if (Math.hypot(dx, dy) < 0.1) return;
      session.moved = true;
      const width = clamp(
        session.startRect.width + (session.handle === 'W' ? -dx : session.handle === 'E' ? dx : 0),
        0.001,
        session.availableWidth,
      );
      const height = clamp(
        session.startRect.height + (session.handle === 'S' ? dy : 0),
        0.001,
        1000,
      );
      this.resizePreview.set({ nodeId: session.nodeId, x: 0, y: 0, width, height });
      this.measuredFlow.update((frame) =>
        frame ? { ...frame, width: mmToPx(width, zoom), height: mmToPx(height, zoom) } : null,
      );
      return;
    }

    if (session.kind === 'move') {
      const dxPx = (event.clientX - session.startClientX) / z;
      const dyPx = (event.clientY - session.startClientY) / z;
      if (!session.moved && Math.hypot(dxPx, dyPx) < 3) return;
      session.moved = true;

      let dxMm = roundMm(pxToMm(dxPx, zoom));
      let dyMm = roundMm(pxToMm(dyPx, zoom));

      const primaryStart = session.startFrames.get(session.primaryId);
      if (primaryStart && !event.altKey && session.targets.length > 0) {
        const thresholdMm = pxToMm(4, zoom);
        const snap = snapMoveMm(
          {
            x: primaryStart.x + session.primaryAncestor.x + dxMm,
            y: primaryStart.y + session.primaryAncestor.y + dyMm,
            width: primaryStart.width,
            height: primaryStart.height,
          },
          session.targets,
          thresholdMm,
        );
        dxMm = roundMm(snap.x - (primaryStart.x + session.primaryAncestor.x));
        dyMm = roundMm(snap.y - (primaryStart.y + session.primaryAncestor.y));
        this.snapGuides.set(snap.guides);
      } else {
        this.snapGuides.set([]);
      }

      let minDx = -Infinity;
      let maxDx = Infinity;
      let minDy = -Infinity;
      let maxDy = Infinity;
      for (const [id, frame] of session.startFrames) {
        const doc = this.state.document();
        const node = doc?.nodes[id];
        const bounds = doc && node ? absoluteBounds(doc, node) : null;
        minDx = Math.max(minDx, -frame.x);
        maxDx = Math.min(maxDx, (bounds?.width ?? 500) - frame.x - (bounds ? frame.width : 0));
        minDy = Math.max(minDy, -frame.y);
        maxDy = Math.min(maxDy, (bounds?.height ?? 1000) - frame.y - (bounds ? frame.height : 0));
      }
      if (minDx <= maxDx) dxMm = roundMm(clamp(dxMm, minDx, maxDx));
      if (minDy <= maxDy) dyMm = roundMm(clamp(dyMm, minDy, maxDy));

      const doc = this.state.document();
      const primary = doc?.nodes[session.primaryId];
      const bounds = doc && primary ? absoluteBounds(doc, primary) : null;
      if (session.movingIds.length === 1 && primaryStart && primary?.layout.kind === 'ABSOLUTE' && bounds && primary.layout.rotationDeg !== 0) {
        const frame = clampAbsoluteFrame({ ...primaryStart, x: primaryStart.x + dxMm, y: primaryStart.y + dyMm }, bounds, primary.layout.rotationDeg);
        dxMm = frame.x - primaryStart.x;
        dyMm = frame.y - primaryStart.y;
      }

      this.dragOffsetMm.set({ dx: dxMm, dy: dyMm });
      return;
    }

    if (session.kind === 'resize') {
      const dxPx = (event.clientX - session.startClientX) / z;
      const dyPx = (event.clientY - session.startClientY) / z;
      if (!session.moved && Math.hypot(dxPx, dyPx) < 3) return;
      session.moved = true;

      const angle = (session.rotationDeg * Math.PI) / 180;
      const dx = pxToMm(dxPx, zoom),
        dy = pxToMm(dyPx, zoom);
      let rect = this.resizeFrameClampedMm(
        session.startRect,
        session.handle,
        dx * Math.cos(angle) + dy * Math.sin(angle),
        -dx * Math.sin(angle) + dy * Math.cos(angle),
        event.shiftKey,
        1,
      );

      if (session.rotationDeg !== 0) {
        const start = session.startRect;
        const cx = rect.x + rect.width / 2 - start.x - start.width / 2;
        const cy = rect.y + rect.height / 2 - start.y - start.height / 2;
        rect = {
          ...rect,
          x:
            start.x +
            start.width / 2 +
            cx * Math.cos(angle) -
            cy * Math.sin(angle) -
            rect.width / 2,
          y:
            start.y +
            start.height / 2 +
            cx * Math.sin(angle) +
            cy * Math.cos(angle) -
            rect.height / 2,
        };
      }
      if (
        session.rotationDeg === 0 &&
        !event.altKey && session.targets.length > 0 &&
        !event.shiftKey
      ) {
        const snap = snapResizeMm(
          {
            ...rect,
            x: rect.x + session.primaryAncestor.x,
            y: rect.y + session.primaryAncestor.y,
          },
          session.handle,
          session.targets,
          pxToMm(4, zoom),
          1,
        );
        const localX = clamp(roundMm(snap.rect.x - session.primaryAncestor.x), 0, 500 - 1);
        const localY = clamp(roundMm(snap.rect.y - session.primaryAncestor.y), 0, 1000 - 1);
        rect = {
          x: localX,
          y: localY,
          width: clamp(roundMm(snap.rect.width), 1, Math.max(1, 500 - localX)),
          height: clamp(roundMm(snap.rect.height), 1, Math.max(1, 1000 - localY)),
        };
        this.snapGuides.set(snap.guides);
      } else {
        this.snapGuides.set([]);
      }

      const doc = this.state.document();
      const node = doc?.nodes[session.nodeId];
      const bounds = doc && node ? absoluteBounds(doc, node) : null;
      if (bounds) rect = clampAbsoluteFrame(rect, bounds, session.rotationDeg);
      this.resizePreview.set({ nodeId: session.nodeId, ...rect });
      return;
    }

    if (session.kind === 'marquee') {
      const paper = this.paperRef()?.nativeElement;
      if (!paper) return;
      const rect = rectInPage(paper);
      const currX = event.clientX / z - rect.left;
      const currY = event.clientY / z - rect.top;
      if (
        !session.moved && Math.hypot(currX - session.startPaperX, currY - session.startPaperY) < 3
      )
        return;
      session.moved = true;

      const left = Math.min(session.startPaperX, currX);
      const top = Math.min(session.startPaperY, currY);
      const width = Math.abs(currX - session.startPaperX);
      const height = Math.abs(currY - session.startPaperY);
      this.marqueePx.set({ left, top, width, height });
    }
  }

  protected onPointerUp(event: PointerEvent): void {
    const session = this.dragSession;
    if (!session || event.pointerId !== session.pointerId) return;
    this.dragSession = null;
    const scrollArea = this.scrollAreaRef()?.nativeElement;
    if (scrollArea?.hasPointerCapture(event.pointerId))
      scrollArea.releasePointerCapture(event.pointerId);
    if (event.type === 'pointercancel') {
      this.dragOffsetMm.set(null);
      this.resizePreview.set(null);
      this.snapGuides.set([]);
      this.dropIndicator.set(null);
      this.marqueePx.set(null);
      this.measureFlowSelection();
      return;
    }
    if (session.kind === 'flowMove') {
      this.dropIndicator.set(null);
      if (!session.moved) return;
      const mode = this.positionAt(event);
      if (mode === 'header' || mode === 'footer') this.convertAt(session.nodeId, mode, event);
      else
        this.state.apply('reorderFlow', (doc) => {
          reorderFlow(doc, session.nodeId, this.flowBeforeId);
        });
      return;
    }
    if (session.kind === 'flowResize') {
      const preview = this.resizePreview();
      this.resizePreview.set(null);
      if (session.moved && preview)
        this.state.apply('resizeFlow', (doc) => {
          resizeFlow(doc, session.nodeId, preview.width, preview.height, session.availableWidth);
        });
      return;
    }

    if (session.kind === 'move') {
      const off = this.dragOffsetMm();
      this.dragOffsetMm.set(null);
      this.snapGuides.set([]);
      if (
        session.moved &&
        this.state.layoutMode() === 'HYBRID_DOCUMENT' &&
        session.movingIds.length === 1
      ) {
        const mode = this.positionAt(event);
        const node = this.state.document()?.nodes[session.primaryId];
        const parent = node?.parentId ? this.state.document()?.nodes[node.parentId] : undefined;
        if (mode && mode !== parent?.type) {
          this.convertAt(session.primaryId, mode, event);
          return;
        }
      }
      if (session.moved && off && (off.dx !== 0 || off.dy !== 0)) {
        this.state.updateFrame(session.movingIds, { dx: off.dx, dy: off.dy });
        const movedPrimary = this.state.document()?.nodes[session.primaryId];
        if (movedPrimary?.layout.kind === 'ABSOLUTE') {
          this.liveAnnouncement.set(
            this.transloco.translate('tplDesigner.canvas.moved', {
              x: movedPrimary.layout.x,
              y: movedPrimary.layout.y,
            }),
          );
        }
      }
      return;
    }

    if (session.kind === 'resize') {
      const preview = this.resizePreview();
      this.resizePreview.set(null);
      this.snapGuides.set([]);
      if (session.moved && preview) {
        this.state.updateFrame([session.nodeId], {
          x: preview.x,
          y: preview.y,
          width: preview.width,
          height: preview.height,
        });
      }
      return;
    }

    if (session.kind === 'marquee') {
      const box = this.marqueePx();
      this.marqueePx.set(null);
      if (!session.moved || !box) {
        if (!session.additive) {
          this.state.clearSelection();
        }
        return;
      }

      const doc = this.state.document();
      if (!doc) return;
      const zoom = this.state.zoom();
      const boxMm: RectMm = {
        x: pxToMm(box.left, zoom),
        y: pxToMm(box.top, zoom),
        width: pxToMm(box.width, zoom),
        height: pxToMm(box.height, zoom),
      };

      const hits = collectPageNodes(doc, this.state.pageIndex())
        .filter((n) => {
          if (n.layout.kind !== 'ABSOLUTE') return false;
          const anc = this.ancestorOffsetMm(doc, n);
          return rectsIntersect(boxMm, {
            x: n.layout.x + anc.x,
            y: n.layout.y + anc.y,
            width: n.layout.width,
            height: n.layout.height,
          });
        })
        .map((n) => n.id);
      this.state.select(hits, session.additive ? 'add' : 'replace');
    }
  }

  protected onNodeDoubleClick(nodeId: string): void {
    if (this.state.readOnly()) return;
    const node = this.state.document()?.nodes[nodeId];
    if (!node) return;
    this.runEditCommandForNode(node);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    if (
      target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
    ) {
      return;
    }

    const mod = event.ctrlKey || event.metaKey;
    const key = event.key;

    if (mod && key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) this.state.redo();
      else this.state.undo();
      return;
    }
    if (mod && key.toLowerCase() === 'y') {
      event.preventDefault();
      this.state.redo();
      return;
    }
    if (mod && key.toLowerCase() === 'd') {
      event.preventDefault();
      this.state.duplicateNodes(this.state.selectedIds());
      return;
    }
    if (mod && key.toLowerCase() === 'a') {
      event.preventDefault();
      const doc = this.state.document();
      if (!doc) return;
      const ids = collectPageNodes(doc, this.state.pageIndex()).map((n) => n.id);
      this.state.select(ids, 'replace');
      return;
    }
    if (key === 'Tab' && !mod && !event.altKey) {
      const doc = this.state.document();
      if (!doc) return;
      const pageNodes = collectPageNodes(doc, this.state.pageIndex());
      if (pageNodes.length === 0) return;
      const primary = this.state.primary();
      const currentIdx = primary ? pageNodes.findIndex((n) => n.id === primary.id) : -1;
      let nextIdx = -1;
      if (!event.shiftKey) {
        if (currentIdx === -1) nextIdx = 0;
        else if (currentIdx < pageNodes.length - 1) nextIdx = currentIdx + 1;
      } else {
        if (currentIdx > 0) nextIdx = currentIdx - 1;
      }
      if (nextIdx >= 0) {
        event.preventDefault();
        const targetNode = pageNodes[nextIdx];
        this.state.select([targetNode.id], 'replace');
        const el = this.paperRef()?.nativeElement.querySelector(
          `[data-node-id="${CSS.escape(targetNode.id)}"]`,
        );
        if (el instanceof HTMLElement) {
          el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
      }
      return;
    }
    if (key === 'Escape') {
      this.state.pendingPlacement.set(null);
      if (this.state.fullscreen()) {
        event.preventDefault();
        this.state.fullscreen.set(false);
        return;
      }
      if (this.state.selectedIds().length > 0) {
        event.preventDefault();
        this.state.clearSelection();
      }
      return;
    }

    if (this.state.readOnly()) return;

    if (key === 'Delete' || key === 'Backspace') {
      if (this.state.selectedIds().length > 0) {
        event.preventDefault();
        this.state.removeNodes(this.state.selectedIds());
      }
      return;
    }

    if (key === 'Enter') {
      const primary = this.state.primary();
      if (primary) {
        event.preventDefault();
        this.runEditCommandForNode(primary);
      }
      return;
    }

    const step = event.shiftKey ? 5 : 1;
    let dx = 0;
    let dy = 0;
    if (key === 'ArrowLeft') dx = -step;
    else if (key === 'ArrowRight') dx = step;
    else if (key === 'ArrowUp') dy = -step;
    else if (key === 'ArrowDown') dy = step;

    if (dx !== 0 || dy !== 0) {
      const absSelected = this.state
        .selectedNodes()
        .filter((n) => !n.locked && n.layout.kind === 'ABSOLUTE');
      if (absSelected.length === 0) return;
      event.preventDefault();
      this.state.updateFrame(
        absSelected.map((n) => n.id),
        { dx, dy },
      );
      const firstUpdated = this.state.document()?.nodes[absSelected[0].id];
      if (firstUpdated?.layout.kind === 'ABSOLUTE') {
        this.liveAnnouncement.set(
          this.transloco.translate('tplDesigner.canvas.moved', {
            x: firstUpdated.layout.x,
            y: firstUpdated.layout.y,
          }),
        );
      }
    }
  }

  protected guidePosPx(guide: SnapGuide): number {
    return mmToPx(guide.posMm, this.state.zoom());
  }

  protected guideLabel(guide: SnapGuide): string {
    if (guide.reason === 'pageCentre') {
      return this.transloco.translate('tplDesigner.guide.pageCentre');
    }
    if (guide.reason === 'margin') {
      return this.transloco.translate('tplDesigner.guide.margin');
    }
    const typeFallback = guide.nodeType
      ? this.transloco.translate(`tplDesigner.node.${guide.nodeType}`)
      : this.transloco.translate('tplDesigner.node.unsupported');
    const name = guide.nodeName?.trim() || typeFallback;
    return this.transloco.translate('tplDesigner.guide.alignedWith', { name });
  }

  private runEditCommandForNode(node: TemplateNode): void {
    switch (node.type) {
      case 'text':
      case 'richText':
        this.state.run({ kind: 'editTextContent', nodeId: node.id });
        break;
      case 'dataField':
        this.state.run({ kind: 'editBinding', nodeId: node.id });
        break;
      case 'staticTable':
      case 'dynamicTable':
        this.state.run({ kind: 'openTableSettings', nodeId: node.id });
        break;
      case 'image':
        this.state.run({ kind: 'replaceImage', nodeId: node.id });
        break;
      case 'formula':
        this.state.run({ kind: 'editFormula', nodeId: node.id });
        break;
      case 'totals':
        this.state.run({ kind: 'openTotals', nodeId: node.id });
        break;
      case 'link':
      case 'button':
        this.state.run({ kind: 'editLink', nodeId: node.id });
        break;
      default:
        this.state.run({ kind: 'openProperties', nodeId: node.id });
        break;
    }
  }

  private recomputeFitZoom(): void {
    const mode = this.state.zoomMode();
    if (mode === 'MANUAL') return;
    const scrollArea = this.scrollAreaRef()?.nativeElement;
    if (!scrollArea) return;

    const availW = scrollArea.clientWidth - 32;
    const availH = scrollArea.clientHeight - 32;
    if (availW <= 0) return;

    if (this.isEmail()) {
      const colW = this.state.emailWidthPx();
      const next = clamp(Math.min(1, availW / colW), 0.25, 4);
      this.state.zoom.set(Math.round(next * 100) / 100);
      return;
    }

    const page = this.state.currentPage();
    if (!page) return;
    const paperW = mmToPx(page.widthMm, 1);
    const paperH = mmToPx(page.heightMm, 1);
    if (paperW <= 0 || paperH <= 0) return;

    const fitW = availW / paperW;
    const raw = mode === 'FIT_PAGE' && availH > 0 ? Math.min(fitW, availH / paperH) : fitW;
    const clamped = clamp(Math.round(raw * 100) / 100, 0.25, 4);
    this.state.zoom.set(clamped);
  }

  private measureOffsets(): void {
    const scrollArea = this.scrollAreaRef()?.nativeElement;
    const paper = this.paperRef()?.nativeElement;
    if (!scrollArea || !paper) return;
    const sRect = rectInPage(scrollArea);
    const pRect = rectInPage(paper);
    this.paperOffsetX.set(pRect.left - sRect.left + scrollArea.scrollLeft);
    this.paperOffsetY.set(pRect.top - sRect.top + scrollArea.scrollTop);
  }

  private nodeElement(id: string): HTMLElement | null {
    return (
      this.paperRef()?.nativeElement.querySelector<HTMLElement>(
        `[data-node-id="${CSS.escape(id)}"]`,
      ) ?? null
    );
  }

  private measureFlowSelection(): void {
    const node = this.state.primary();
    const paper = this.paperRef()?.nativeElement;
    const el = node ? this.nodeElement(node.id) : null;
    if (!node || node.layout.kind !== 'FLOW' || !paper || !el) {
      this.measuredFlow.set(null);
      return;
    }
    const rect = rectInPage(el),
      paperRect = rectInPage(paper);
    this.measuredFlow.set({
      nodeId: node.id,
      left: rect.left - paperRect.left,
      top: rect.top - paperRect.top,
      width: rect.width,
      height: rect.height,
      rotationDeg: 0,
    });
  }

  private positionAt(event: PointerEvent): PositionMode | null {
    const doc = this.state.document();
    const paper = this.paperRef()?.nativeElement;
    if (!doc || doc.layoutMode !== 'HYBRID_DOCUMENT' || !paper) return null;
    const rect = rectInPage(paper),
      z = rootZoom(),
      zoom = this.state.zoom();
    const x = pxToMm(event.clientX / z - rect.left, zoom);
    const y = pxToMm(event.clientY / z - rect.top, zoom);
    const print = printableBox(doc);
    if (x < print.x || x > print.x + print.width || y < print.y || y > print.y + print.height)
      return null;
    for (const type of ['header', 'footer'] as const) {
      const zone = hybridZone(doc, type);
      if (!zone) continue;
      const box = zoneBox(doc, zone);
      if (y >= box.y && y <= box.y + box.height) return type;
    }
    return 'FLOW';
  }

  private convertAt(id: string, mode: PositionMode, event: PointerEvent): void {
    const paper = this.paperRef()?.nativeElement;
    const el = this.nodeElement(id);
    const current = this.state.document();
    if (!paper || !el || !current) return;
    const rect = rectInPage(el),
      paperRect = rectInPage(paper),
      zoom = this.state.zoom();
    const zone = mode === 'FLOW' ? undefined : hybridZone(current, mode);
    const origin = zone ? zoneBox(current, zone) : printableBox(current);
    const measured = {
      x: pxToMm(event.clientX / rootZoom() - paperRect.left, zoom) - origin.x,
      y: pxToMm(event.clientY / rootZoom() - paperRect.top, zoom) - origin.y,
      width: pxToMm(rect.width, zoom),
      height: pxToMm(rect.height, zoom),
    };
    this.state.apply('changePosition', (doc) => {
      moveNodeToPosition(doc, id, mode, measured);
    });
  }

  private placePending(event: PointerEvent): boolean {
    const id = this.state.pendingPlacement();
    const mode = this.positionAt(event);
    if (!id || !mode || this.state.readOnly()) return false;
    this.state.pendingPlacement.set(null);
    this.convertAt(id, mode, event);
    return true;
  }

  private ancestorOffsetMm(doc: TemplateDocumentV1, node: TemplateNode): { x: number; y: number } {
    let x = 0;
    let y = 0;
    let cursor = node.parentId ? doc.nodes[node.parentId] : undefined;
    while (cursor) {
      if (cursor.layout.kind === 'ABSOLUTE') {
        x += cursor.layout.x;
        y += cursor.layout.y;
      } else if (
        doc.layoutMode === 'HYBRID_DOCUMENT' &&
        (cursor.type === 'header' || cursor.type === 'footer')
      ) {
        const box = zoneBox(doc, cursor);
        x += box.x;
        y += box.y;
      }
      cursor = cursor.parentId ? doc.nodes[cursor.parentId] : undefined;
    }
    return { x, y };
  }

  private pageForPhysicalMargins(page: TemplatePageConfig): TemplatePageConfig {
    if (this.docDir() !== 'rtl') return page;
    return {
      ...page,
      marginMm: {
        ...page.marginMm,
        start: page.marginMm.end,
        end: page.marginMm.start,
      },
    };
  }

  private buildPaperSnapTargets(
    doc: TemplateDocumentV1,
    page: TemplatePageConfig,
    excludeIds: ReadonlySet<string>,
  ): SnapTarget[] {
    const paperNodes: TemplateNode[] = [];
    for (const node of collectPageNodes(doc, this.state.pageIndex())) {
      if (excludeIds.has(node.id) || node.layout.kind !== 'ABSOLUTE' || node.hidden) continue;
      const anc = this.ancestorOffsetMm(doc, node);
      if (anc.x === 0 && anc.y === 0) {
        paperNodes.push(node);
      } else {
        paperNodes.push({
          ...node,
          layout: {
            ...node.layout,
            x: node.layout.x + anc.x,
            y: node.layout.y + anc.y,
          },
        });
      }
    }
    const targets = buildSnapTargets(this.pageForPhysicalMargins(page), paperNodes);
    if (doc.layoutMode === 'HYBRID_DOCUMENT') {
      for (const type of ['header', 'footer'] as const) {
        const zone = hybridZone(doc, type);
        if (!zone) continue;
        const box = zoneBox(doc, zone);
        for (const y of [box.y, box.y + box.height / 2, box.y + box.height])
          targets.push({ axis: 'Y', posMm: y, reason: 'margin' });
      }
    }
    return targets;
  }

  private resizeFrameClampedMm(
    start: RectMm,
    handle: ResizeHandle,
    dxMm: number,
    dyMm: number,
    keepRatio: boolean,
    minSizeMm = 1,
  ): RectMm {
    const startRight = start.x + start.width;
    const startBottom = start.y + start.height;

    const hasW = handle.includes('W');
    const hasE = handle.includes('E');
    const hasN = handle.includes('N');
    const hasS = handle.includes('S');

    let left = hasW ? clamp(start.x + dxMm, 0, startRight - minSizeMm) : start.x;
    let right = hasE ? clamp(startRight + dxMm, start.x + minSizeMm, 500) : startRight;
    let top = hasN ? clamp(start.y + dyMm, 0, startBottom - minSizeMm) : start.y;
    let bottom = hasS ? clamp(startBottom + dyMm, start.y + minSizeMm, 1000) : startBottom;

    let width = right - left;
    let height = bottom - top;

    if (keepRatio && start.height > 0 && start.width > 0) {
      const ratio = start.width / start.height;
      const isCorner = (hasW || hasE) && (hasN || hasS);
      if (isCorner) {
        if (width / height > ratio) {
          height = Math.max(minSizeMm, width / ratio);
          width = height * ratio;
        } else {
          width = Math.max(minSizeMm, height * ratio);
          height = width / ratio;
        }
      } else if (hasW || hasE) {
        height = Math.max(minSizeMm, width / ratio);
        width = height * ratio;
      } else if (hasN || hasS) {
        width = Math.max(minSizeMm, height * ratio);
        height = width / ratio;
      }

      const maxAvailW = hasW ? startRight : hasE ? 500 - start.x : 500;
      const maxAvailH = hasN ? startBottom : hasS ? 1000 - start.y : 1000;
      const maxScale = Math.min(maxAvailW / width, maxAvailH / height, 1);
      if (maxScale < 1) {
        width *= maxScale;
        height *= maxScale;
      }

      if (hasW) {
        left = clamp(startRight - width, 0, startRight - minSizeMm);
      } else if (!hasE) {
        left = clamp(start.x + (start.width - width) / 2, 0, Math.max(0, 500 - width));
      }
      if (hasN) {
        top = clamp(startBottom - height, 0, startBottom - minSizeMm);
      } else if (!hasS) {
        top = clamp(start.y + (start.height - height) / 2, 0, Math.max(0, 1000 - height));
      }
    }

    const roundedX = clamp(roundMm(left), 0, 500 - minSizeMm);
    const roundedY = clamp(roundMm(top), 0, 1000 - minSizeMm);
    const rawW = hasW ? startRight - roundedX : width;
    const rawH = hasN ? startBottom - roundedY : height;

    return {
      x: roundedX,
      y: roundedY,
      width: clamp(roundMm(rawW), minSizeMm, Math.max(minSizeMm, 500 - roundedX)),
      height: clamp(roundMm(rawH), minSizeMm, Math.max(minSizeMm, 1000 - roundedY)),
    };
  }
}
