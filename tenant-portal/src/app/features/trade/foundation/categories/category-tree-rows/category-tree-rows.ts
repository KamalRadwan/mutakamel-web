import {
  Component,
  DestroyRef,
  Directive,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChildren,
} from '@angular/core';
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/adapter/element-adapter';
import { preserveOffsetOnSource } from '@atlaskit/pragmatic-drag-and-drop/utils/preserve-offset-on-source';
import { setCustomNativeDragPreview } from '@atlaskit/pragmatic-drag-and-drop/utils/set-custom-native-drag-preview';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerArrowDown,
  tablerArrowsMove,
  tablerArrowUp,
  tablerCategory,
  tablerChevronDown,
  tablerChevronRight,
  tablerEye,
  tablerFolderPlus,
  tablerGripVertical,
  tablerLoader2,
  tablerToggleRight,
  tablerTrash,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { ActionItem, ActionSelection, ActionsMenu } from '../../../../../shared/ui/actions-menu/actions-menu';
import { levelKey } from '../categories.service';
import {
  type CategoryActionEvent,
  type CategoryReorderEvent,
  type CategorySummary,
  categoryNodeTile,
  inactiveAncestorName,
  isMutedByAncestor,
} from '../categories.model';

interface DraggedCategory {
  categoryId: string;
  parentId: string | null;
}

function isDraggedCategory(
  data: Record<string | symbol, unknown>,
): data is Record<string | symbol, unknown> & DraggedCategory {
  return typeof data['categoryId'] === 'string' && 'parentId' in data;
}

export interface TailDropTarget {
  parentId: string | null;
  depth: number;
  lastSiblingId: string;
}

export interface FlatCategoryRow {
  node: CategorySummary;
  tailDrops: TailDropTarget[];
}

@Directive({
  selector: '[categoryRowDrag]',
  host: { '[class.opacity-drag-source]': 'dragging()' },
})
export class CategoryRowDrag {
  readonly categoryRowDrag = input.required<string>();
  readonly parentId = input<string | null>(null);
  readonly dragDisabled = input(false);
  readonly dragState = output<DraggedCategory | null>();

  protected readonly dragging = signal(false);

  constructor() {
    const element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      let pressed: Element | null = null;
      const restore = () => {
        document.removeEventListener('pointerup', restore);
        document.removeEventListener('pointercancel', restore);
        element.draggable = false;
      };
      const onPointerDown = (event: PointerEvent) => {
        pressed =
          event.target instanceof Element
            ? event.target
            : event.target instanceof Node
              ? event.target.parentElement
              : null;
        if (this.dragDisabled() || !pressed?.closest('[data-drag-handle]')) {
          element.draggable = false;
          return;
        }
        element.draggable = true;
        document.addEventListener('pointerup', restore, { once: true });
        document.addEventListener('pointercancel', restore, { once: true });
      };
      element.addEventListener('pointerdown', onPointerDown, true);

      const cleanup = draggable({
        element,
        canDrag: () => !this.dragDisabled() && Boolean(pressed?.closest('[data-drag-handle]')),
        getInitialData: () => ({ categoryId: this.categoryRowDrag(), parentId: this.parentId() }),
        onGenerateDragPreview: ({ location, source, nativeSetDragImage }) => {
          const offset = preserveOffsetOnSource({ element: source.element, input: location.current.input });
          setCustomNativeDragPreview({
            nativeSetDragImage,
            getOffset: offset,
            render: ({ container }) => {
              const copy = element.cloneNode(true) as HTMLElement;
              copy.style.width = `${element.offsetWidth}px`;
              copy.classList.add('shadow-drag');
              container.append(copy);
            },
          });
        },
        onDragStart: () => {
          this.dragging.set(true);
          this.dragState.emit({ categoryId: this.categoryRowDrag(), parentId: this.parentId() });
        },
        onDrop: () => {
          this.dragging.set(false);
          element.draggable = false;
          this.dragState.emit(null);
        },
      });

      destroyRef.onDestroy(() => {
        element.removeEventListener('pointerdown', onPointerDown, true);
        document.removeEventListener('pointerup', restore);
        document.removeEventListener('pointercancel', restore);
        cleanup();
      });
    });
  }
}

@Directive({
  selector: '[categoryRowDrop]',
  exportAs: 'categoryRowDrop',
})
export class CategoryRowDrop {
  readonly categoryRowDrop = input.required<string>();
  readonly targetParentId = input<string | null>(null);
  readonly dropDisabled = input(false);
  readonly dropped = output<string>();

  readonly over = signal(false);

  constructor() {
    const element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      const accepts = (sourceData: Record<string | symbol, unknown>): sourceData is Record<string | symbol, unknown> & DraggedCategory =>
        !this.dropDisabled() &&
        isDraggedCategory(sourceData) &&
        sourceData.parentId === this.targetParentId() &&
        sourceData.categoryId !== this.categoryRowDrop();

      const cleanup = dropTargetForElements({
        element,
        canDrop: ({ source }) => accepts(source.data),
        getData: () => ({ categoryId: this.categoryRowDrop(), parentId: this.targetParentId() }),
        onDragEnter: ({ source }) => {
          if (accepts(source.data)) {
            this.over.set(true);
          }
        },
        onDragLeave: () => this.over.set(false),
        onDrop: ({ source }) => {
          this.over.set(false);
          if (accepts(source.data)) {
            this.dropped.emit(source.data.categoryId);
          }
        },
      });
      destroyRef.onDestroy(cleanup);
    });
  }
}

@Directive({
  selector: '[categoryTailDrop]',
  exportAs: 'categoryTailDrop',
})
export class CategoryTailDrop {
  readonly categoryTailDrop = input<string | null>(null);
  readonly dropDisabled = input(false);
  readonly dropped = output<string>();

  readonly over = signal(false);

  constructor() {
    const element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      const accepts = (sourceData: Record<string | symbol, unknown>): sourceData is Record<string | symbol, unknown> & DraggedCategory =>
        !this.dropDisabled() &&
        isDraggedCategory(sourceData) &&
        sourceData.parentId === this.categoryTailDrop();

      const cleanup = dropTargetForElements({
        element,
        canDrop: ({ source }) => accepts(source.data),
        getData: () => ({ tailParentId: this.categoryTailDrop() }),
        onDragEnter: ({ source }) => {
          if (accepts(source.data)) {
            this.over.set(true);
          }
        },
        onDragLeave: () => this.over.set(false),
        onDrop: ({ source }) => {
          this.over.set(false);
          if (accepts(source.data)) {
            this.dropped.emit(source.data.categoryId);
          }
        },
      });
      destroyRef.onDestroy(cleanup);
    });
  }
}

@Component({
  selector: 'app-category-tree-rows',
  imports: [NgIcon, TranslocoPipe, ActionsMenu, CategoryRowDrag, CategoryRowDrop, CategoryTailDrop],
  providers: [
    provideIcons({
      tablerCategory,
      tablerGripVertical,
      tablerChevronDown,
      tablerChevronRight,
      tablerLoader2,
      tablerEye,
      tablerFolderPlus,
      tablerArrowsMove,
      tablerArrowUp,
      tablerArrowDown,
      tablerToggleRight,
      tablerTrash,
    }),
  ],
  templateUrl: './category-tree-rows.html',
  host: { class: 'flex min-h-0 flex-1 flex-col' },
})
export class CategoryTreeRows {
  private static nextId = 0;
  protected readonly uid = `cat-tree-rows-${++CategoryTreeRows.nextId}`;

  private readonly injector = inject(Injector);
  private readonly language = inject(LanguageState).current;
  private readonly rowElements = viewChildren<ElementRef<HTMLElement>>('rowEl');

  readonly levels = input.required<ReadonlyMap<string, CategorySummary[]>>();
  readonly expandedIds = input.required<ReadonlySet<string>>();
  readonly loadingLevels = input.required<ReadonlySet<string>>();
  readonly actionsFor = input.required<(node: CategorySummary) => ActionItem[]>();
  readonly canManage = input(true);

  readonly toggle = output<string>();
  readonly action = output<CategoryActionEvent>();
  readonly reorder = output<CategoryReorderEvent>();

  protected readonly focusedId = signal<string | null>(null);
  protected readonly draggingNode = signal<DraggedCategory | null>(null);

  protected readonly flatRows = computed<FlatCategoryRow[]>(() => {
    const levelsMap = this.levels();
    const expanded = this.expandedIds();
    const result: FlatCategoryRow[] = [];

    const walk = (parentId: string | null) => {
      const siblings = levelsMap.get(levelKey(parentId)) ?? [];
      for (let i = 0; i < siblings.length; i += 1) {
        const node = siblings[i];
        result.push({ node, tailDrops: [] });
        if (node.hasChildren && expanded.has(node.id)) {
          walk(node.id);
        }
        if (i === siblings.length - 1 && result.length > 0) {
          result[result.length - 1].tailDrops.push({
            parentId,
            depth: node.depth,
            lastSiblingId: node.id,
          });
        }
      }
    };

    walk(null);
    return result;
  });

  protected readonly activeRowId = computed(() => {
    const rows = this.flatRows();
    const current = this.focusedId();
    if (current && rows.some((row) => row.node.id === current)) {
      return current;
    }
    return rows[0]?.node.id ?? null;
  });

  focusNode(id: string): void {
    this.focusedId.set(id);
    afterNextRender(
      () => {
        const ref = this.rowElements().find((el) => el.nativeElement.dataset['nodeId'] === id);
        if (ref) {
          ref.nativeElement.focus();
          ref.nativeElement.scrollIntoView({ block: 'nearest' });
        }
      },
      { injector: this.injector },
    );
  }

  protected isExpanded(id: string): boolean {
    return this.expandedIds().has(id);
  }

  protected isLoading(id: string): boolean {
    return this.loadingLevels().has(id);
  }

  protected indentStyle(depth: number): string {
    return depth > 1 ? `calc(${depth - 1} * var(--tree-indent))` : '0px';
  }

  protected tileClass(node: CategorySummary): string {
    return categoryNodeTile(node);
  }

  protected isMuted(node: CategorySummary): boolean {
    return isMutedByAncestor(node);
  }

  protected ancestorName(node: CategorySummary): string {
    return inactiveAncestorName(node);
  }

  protected onToggle(id: string, event: Event): void {
    event.stopPropagation();
    this.toggle.emit(id);
  }

  protected onRowClick(node: CategorySummary, event: Event): void {
    const target = event.target as HTMLElement | null;
    if (target?.closest('[data-chevron], [data-row-action], [data-drag-handle]')) return;
    this.focusedId.set(node.id);
    this.action.emit({ node, action: 'open' });
  }

  protected onActionSelected(node: CategorySummary, selection: ActionSelection): void {
    switch (selection.id) {
      case 'open':
      case 'addChild':
      case 'move':
      case 'moveUp':
      case 'moveDown':
      case 'activate':
      case 'deactivate':
      case 'delete':
        this.action.emit({ node, action: selection.id });
        break;
    }
  }

  protected onRowDropped(draggedId: string, target: CategorySummary): void {
    this.reorder.emit({
      id: draggedId,
      parentId: target.parentId,
      beforeId: target.id,
    });
  }

  protected onTailDropped(draggedId: string, parentId: string | null): void {
    this.reorder.emit({
      id: draggedId,
      parentId,
      beforeId: null,
    });
  }

  protected onTreeKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target || target.closest('[data-row-action]')) return;

    const rows = this.flatRows();
    if (!rows.length) return;

    const currentId = target.dataset['nodeId'] ?? this.activeRowId();
    const index = rows.findIndex((row) => row.node.id === currentId);
    if (index < 0) return;
    const current = rows[index].node;

    const rtl = this.language() === 'ar';
    const expandKey = rtl ? 'ArrowLeft' : 'ArrowRight';
    const collapseKey = rtl ? 'ArrowRight' : 'ArrowLeft';

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.focusRow(rows[Math.min(rows.length - 1, index + 1)]?.node.id);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.focusRow(rows[Math.max(0, index - 1)]?.node.id);
    } else if (event.key === 'Home') {
      event.preventDefault();
      this.focusRow(rows[0]?.node.id);
    } else if (event.key === 'End') {
      event.preventDefault();
      this.focusRow(rows[rows.length - 1]?.node.id);
    } else if (event.key === expandKey) {
      event.preventDefault();
      if (current.hasChildren) {
        if (!this.isExpanded(current.id)) {
          this.toggle.emit(current.id);
        } else if (index + 1 < rows.length) {
          this.focusRow(rows[index + 1]?.node.id);
        }
      }
    } else if (event.key === collapseKey) {
      event.preventDefault();
      if (current.hasChildren && this.isExpanded(current.id)) {
        this.toggle.emit(current.id);
      } else if (current.parentId) {
        this.focusRow(current.parentId);
      }
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.action.emit({ node: current, action: 'open' });
    }
  }

  private focusRow(id: string | undefined): void {
    if (!id) return;
    this.focusedId.set(id);
    this.rowElements()
      .find((ref) => ref.nativeElement.dataset['nodeId'] === id)
      ?.nativeElement.focus();
  }
}
