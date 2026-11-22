import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, output, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerArrowDown,
  tablerArrowsMove,
  tablerArrowUp,
  tablerCategory,
  tablerChevronDown,
  tablerEye,
  tablerFolderPlus,
  tablerLoader2,
  tablerToggleRight,
  tablerTrash,
} from '@ng-icons/tabler-icons';
import { ActionItem, ActionSelection, ActionsMenu } from '../../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../../shared/ui/button/button';
import { ROOT_LEVEL_KEY } from '../categories.service';
import {
  type CategoryActionEvent,
  type CategorySummary,
  categoryNodeTile,
  inactiveAncestorName,
  isMutedByAncestor,
} from '../categories.model';

@Component({
  selector: 'app-category-chart',
  imports: [NgTemplateOutlet, NgIcon, TranslocoPipe, ActionsMenu, Button],
  providers: [
    provideIcons({
      tablerCategory,
      tablerChevronDown,
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
  templateUrl: './category-chart.html',
  host: { class: 'flex min-h-0 flex-1 flex-col' },
})
export class CategoryChart {
  private static nextId = 0;
  protected readonly uid = `cat-chart-${++CategoryChart.nextId}`;

  readonly levels = input.required<ReadonlyMap<string, CategorySummary[]>>();
  readonly expandedIds = input.required<ReadonlySet<string>>();
  readonly loadingLevels = input.required<ReadonlySet<string>>();
  readonly actionsFor = input.required<(node: CategorySummary) => ActionItem[]>();

  readonly toggle = output<string>();
  readonly action = output<CategoryActionEvent>();

  protected readonly selectedId = signal<string | null>(null);
  protected readonly roots = computed(() => this.levels().get(ROOT_LEVEL_KEY) ?? []);

  protected childrenOf(id: string): CategorySummary[] {
    return this.levels().get(id) ?? [];
  }

  protected isExpanded(id: string): boolean {
    return this.expandedIds().has(id);
  }

  protected isLevelLoaded(id: string): boolean {
    return this.levels().has(id);
  }

  protected isLoading(id: string): boolean {
    return this.loadingLevels().has(id);
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

  protected selectCard(node: CategorySummary): void {
    this.selectedId.set(node.id);
  }

  protected onExpandToggle(id: string, event: Event): void {
    event.stopPropagation();
    this.toggle.emit(id);
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
