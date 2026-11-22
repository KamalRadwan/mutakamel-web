import { Component, ElementRef, computed, inject, input, output, signal, viewChildren } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerBuildingSkyscraper,
  tablerBuildingStore,
  tablerChevronDown,
  tablerChevronRight,
  tablerEdit,
  tablerEye,
  tablerLock,
  tablerPlus,
  tablerSitemap,
  tablerUsers,
  tablerUsersGroup,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { ActionItem, ActionSelection, ActionsMenu } from '../../../../../shared/ui/actions-menu/actions-menu';
import { StatusBadge } from '../../shared/status-badge/status-badge';
import { ORG_LEVEL_META, OrgActionEvent, OrgLevel, OrgLevelMeta, OrgViewNode } from '../organization.model';

@Component({
  selector: 'app-org-tree-rows',
  imports: [NgIcon, TranslocoPipe, ActionsMenu, StatusBadge],
  providers: [
    provideIcons({
      tablerBuildingSkyscraper,
      tablerBuildingStore,
      tablerSitemap,
      tablerUsersGroup,
      tablerUsers,
      tablerEye,
      tablerEdit,
      tablerPlus,
      tablerChevronDown,
      tablerChevronRight,
      tablerLock,
    }),
  ],
  templateUrl: './tree-rows.html',
  host: { class: 'flex min-h-0 flex-1 flex-col' },
})
export class TreeRows {
  private readonly language = inject(LanguageState).current;
  private readonly rowElements = viewChildren<ElementRef<HTMLElement>>('rowEl');

  readonly tree = input.required<OrgViewNode[]>();
  readonly expandedIds = input.required<ReadonlySet<string>>();
  readonly actionsFor = input.required<(node: OrgViewNode) => ActionItem[]>();

  readonly toggleExpand = output<string>();
  readonly action = output<OrgActionEvent>();

  protected readonly focusedId = signal<string | null>(null);

  protected readonly flatRows = computed<OrgViewNode[]>(() => {
    const expanded = this.expandedIds();
    const result: OrgViewNode[] = [];

    const walk = (nodes: readonly OrgViewNode[]) => {
      for (const node of nodes) {
        result.push(node);
        if (node.children.length > 0 && expanded.has(node.id)) {
          walk(node.children);
        }
      }
    };

    walk(this.tree());
    return result;
  });

  protected readonly activeRowId = computed(() => {
    const rows = this.flatRows();
    const current = this.focusedId();
    if (current && rows.some((row) => row.id === current)) {
      return current;
    }
    return rows[0]?.id ?? null;
  });

  protected isExpanded(id: string): boolean {
    return this.expandedIds().has(id);
  }

  protected indentStyle(depth: number): string {
    return depth > 0 ? `calc(${depth} * var(--tree-indent))` : '0px';
  }

  protected meta(level: OrgLevel): OrgLevelMeta {
    return ORG_LEVEL_META[level];
  }

  protected onToggle(id: string, event: Event): void {
    event.stopPropagation();
    this.toggleExpand.emit(id);
  }

  protected onRowClick(node: OrgViewNode, event: Event): void {
    const target = event.target as HTMLElement | null;
    if (target?.closest('[data-chevron], [data-row-action]')) return;
    this.focusedId.set(node.id);
    this.action.emit({ node, action: 'open' });
  }

  protected onActionSelected(node: OrgViewNode, selection: ActionSelection): void {
    switch (selection.id) {
      case 'open':
        this.action.emit({ node, action: 'open' });
        break;
      case 'edit':
        this.action.emit({ node, action: 'edit' });
        break;
      case 'addChild':
        this.action.emit({ node, action: 'addChild' });
        break;
      case 'viewUsers':
        this.action.emit({ node, action: 'viewUsers' });
        break;
    }
  }

  protected onTreeKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target || target.closest('[data-row-action]')) return;

    const rows = this.flatRows();
    if (!rows.length) return;

    const currentId = target.dataset['nodeId'] ?? this.activeRowId();
    const index = rows.findIndex((row) => row.id === currentId);
    if (index < 0) return;
    const current = rows[index];

    const rtl = this.language() === 'ar';
    const expandKey = rtl ? 'ArrowLeft' : 'ArrowRight';
    const collapseKey = rtl ? 'ArrowRight' : 'ArrowLeft';

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.focusRow(rows[Math.min(rows.length - 1, index + 1)]?.id);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.focusRow(rows[Math.max(0, index - 1)]?.id);
    } else if (event.key === 'Home') {
      event.preventDefault();
      this.focusRow(rows[0]?.id);
    } else if (event.key === 'End') {
      event.preventDefault();
      this.focusRow(rows[rows.length - 1]?.id);
    } else if (event.key === expandKey) {
      event.preventDefault();
      if (current.children.length > 0) {
        if (!this.isExpanded(current.id)) {
          this.toggleExpand.emit(current.id);
        } else if (index + 1 < rows.length) {
          this.focusRow(rows[index + 1]?.id);
        }
      }
    } else if (event.key === collapseKey) {
      event.preventDefault();
      if (current.children.length > 0 && this.isExpanded(current.id)) {
        this.toggleExpand.emit(current.id);
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
