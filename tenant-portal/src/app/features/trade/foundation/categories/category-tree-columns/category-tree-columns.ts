import { Component, computed, input, output, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerArrowDown,
  tablerArrowsMove,
  tablerArrowUp,
  tablerCategory,
  tablerChevronRight,
  tablerEye,
  tablerFolderPlus,
  tablerToggleRight,
  tablerTrash,
} from '@ng-icons/tabler-icons';
import { ActionItem, ActionSelection, ActionsMenu } from '../../../../../shared/ui/actions-menu/actions-menu';
import { levelKey } from '../categories.service';
import {
  type CategoryActionEvent,
  type CategorySummary,
  categoryNodeTile,
  inactiveAncestorName,
  isMutedByAncestor,
} from '../categories.model';

interface CategoryColumnView {
  key: string;
  parentId: string | null;
  title: string;
  isRootTitle: boolean;
  items: CategorySummary[];
  selectedId: string | null;
  loading: boolean;
}

@Component({
  selector: 'app-category-tree-columns',
  imports: [NgIcon, TranslocoPipe, ActionsMenu],
  providers: [
    provideIcons({
      tablerCategory,
      tablerChevronRight,
      tablerEye,
      tablerFolderPlus,
      tablerArrowsMove,
      tablerArrowUp,
      tablerArrowDown,
      tablerToggleRight,
      tablerTrash,
    }),
  ],
  templateUrl: './category-tree-columns.html',
  host: { class: 'flex min-h-0 flex-1 flex-col' },
})
export class CategoryTreeColumns {
  private static nextId = 0;
  protected readonly uid = `cat-tree-cols-${++CategoryTreeColumns.nextId}`;

  readonly levels = input.required<ReadonlyMap<string, CategorySummary[]>>();
  readonly loadingLevels = input.required<ReadonlySet<string>>();
  readonly actionsFor = input.required<(node: CategorySummary) => ActionItem[]>();

  readonly toggle = output<string>();
  readonly action = output<CategoryActionEvent>();

  protected readonly selectedIds = signal<string[]>([]);
  protected readonly skeletonRows = [1, 2, 3, 4];

  protected readonly columns = computed<CategoryColumnView[]>(() => {
    const levelsMap = this.levels();
    const loadingSet = this.loadingLevels();
    const rawSelected = this.selectedIds();
    const result: CategoryColumnView[] = [];

    let parentId: string | null = null;
    for (let depthIdx = 0; depthIdx < 8; depthIdx += 1) {
      const key = levelKey(parentId);
      const items = levelsMap.get(key) ?? [];
      const wantedId = rawSelected[depthIdx] ?? null;
      const chosen = wantedId ? items.find((item) => item.id === wantedId) ?? null : null;

      if (depthIdx === 0) {
        result.push({
          key,
          parentId: null,
          title: '',
          isRootTitle: true,
          items,
          selectedId: chosen?.id ?? null,
          loading: loadingSet.has(key),
        });
      }

      if (!chosen || !chosen.hasChildren) break;

      const childKey = levelKey(chosen.id);
      const childItems = levelsMap.get(childKey) ?? [];
      const nextWantedId = rawSelected[depthIdx + 1] ?? null;
      const nextChosen = nextWantedId ? childItems.find((item) => item.id === nextWantedId) ?? null : null;

      result.push({
        key: childKey,
        parentId: chosen.id,
        title: chosen.name,
        isRootTitle: false,
        items: childItems,
        selectedId: nextChosen?.id ?? null,
        loading: loadingSet.has(childKey),
      });

      parentId = chosen.id;
      if (!nextChosen) break;
    }

    return result;
  });

  protected tileClass(node: CategorySummary): string {
    return categoryNodeTile(node);
  }

  protected isMuted(node: CategorySummary): boolean {
    return isMutedByAncestor(node);
  }

  protected ancestorName(node: CategorySummary): string {
    return inactiveAncestorName(node);
  }

  protected selectNode(columnIndex: number, node: CategorySummary): void {
    this.selectedIds.update((prev) => [...prev.slice(0, columnIndex), node.id]);
    if (node.hasChildren && !this.levels().has(node.id) && !this.loadingLevels().has(node.id)) {
      this.toggle.emit(node.id);
    }
  }

  protected openNode(node: CategorySummary): void {
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
}
