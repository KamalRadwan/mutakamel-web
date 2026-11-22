import {
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
  viewChildren,
} from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerChevronDown,
  tablerLock,
  tablerMinus,
  tablerSearch,
  tablerX,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Button } from '../../../../../shared/ui/button/button';
import { Checkbox } from '../../../../../shared/ui/checkbox/checkbox';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import {
  ActionNode,
  AreaNode,
  CheckState,
  ModuleNode,
  PermissionRecordScope,
  PermissionTreeMode,
  ResourceNode,
  TreeEntry,
  buildPermissionHierarchy,
  computeCheckState,
  countEffectivePermissions,
  pickI18n,
  resolveActionSelection,
} from './permission-tree.model';

export type PermissionFilter = 'all' | 'selected' | 'unselected';

interface FilteredResource {
  node: ResourceNode;
  actions: ActionNode[];
  state: CheckState;
  selectedCount: number;
  totalCount: number;
}

interface FilteredArea {
  node: AreaNode;
  resources: FilteredResource[];
  state: CheckState;
  selectedCount: number;
  totalCount: number;
}

interface FilteredModule {
  node: ModuleNode;
  areas: FilteredArea[];
  state: CheckState;
  selectedCount: number;
  totalCount: number;
}

@Component({
  selector: 'app-permission-tree',
  imports: [NgIcon, TranslocoPipe, Button, Checkbox, Dropdown],
  providers: [
    provideTranslocoScope('settings', 'staff', { scope: 'staff-permissions', alias: 'perm' }),
    provideIcons({ tablerChevronDown, tablerLock, tablerMinus, tablerSearch, tablerX }),
  ],
  templateUrl: './permission-tree.html',
  host: { class: 'flex min-h-0 flex-col gap-8' },
})
export class PermissionTree {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;

  private readonly treeItemEls = viewChildren<ElementRef<HTMLElement>>('treeItemEl');

  readonly entries = input.required<TreeEntry[]>();
  readonly mode = input<PermissionTreeMode>('BRANCH');
  readonly readonly = input(false);
  readonly disabledIds = input<readonly string[]>([]);
  readonly max = input(200);

  readonly selected = model<string[]>([]);
  readonly countChange = output<number>();

  protected readonly search = signal('');
  protected readonly filter = signal<PermissionFilter>('all');
  protected readonly collapsedIds = signal<ReadonlySet<string>>(new Set());
  protected readonly showTenantOnly = signal(false);
  protected readonly focusedNodeId = signal<string | null>(null);

  protected readonly hierarchy = computed(() => buildPermissionHierarchy(this.entries(), this.mode()));
  protected readonly selectedSet = computed(() => new Set(this.selected()));
  protected readonly disabledSet = computed(() => new Set(this.disabledIds()));
  protected readonly effectiveCount = computed(() =>
    countEffectivePermissions(this.hierarchy(), this.selectedSet()),
  );
  protected readonly atLimit = computed(() => this.effectiveCount() >= this.max());

  protected readonly filterOptions = computed<DropdownOption<PermissionFilter>[]>(() => {
    this.i18n();
    return [
      { value: 'all', label: this.transloco.translate('perm.tree.filter.all') },
      { value: 'selected', label: this.transloco.translate('perm.tree.filter.selected') },
      { value: 'unselected', label: this.transloco.translate('perm.tree.filter.unselected') },
    ];
  });

  protected readonly filteredModules = computed<FilteredModule[]>(() => {
    const term = this.search().trim().toLowerCase();
    const activeFilter = this.filter();
    const selectedSet = this.selectedSet();
    const result: FilteredModule[] = [];

    for (const mod of this.hierarchy().modules) {
      let modSelected = 0;
      let modTotal = 0;
      const areas: FilteredArea[] = [];

      for (const area of mod.areas) {
        let areaSelected = 0;
        let areaTotal = 0;
        const resources: FilteredResource[] = [];

        for (const res of area.resources) {
          let resSelected = 0;
          const resTotal = res.actions.length;
          const matchingActions: ActionNode[] = [];

          for (const action of res.actions) {
            const resolved = resolveActionSelection(action, selectedSet);
            if (resolved.checked) {
              resSelected += 1;
            }

            if (activeFilter === 'selected' && !resolved.checked) continue;
            if (activeFilter === 'unselected' && resolved.checked) continue;
            if (term && !matchesActionSearch(action, term)) continue;

            matchingActions.push(action);
          }

          areaSelected += resSelected;
          areaTotal += resTotal;

          if (matchingActions.length > 0) {
            resources.push({
              node: res,
              actions: matchingActions,
              state: computeCheckState(resSelected, resTotal),
              selectedCount: resSelected,
              totalCount: resTotal,
            });
          }
        }

        modSelected += areaSelected;
        modTotal += areaTotal;

        if (resources.length > 0) {
          areas.push({
            node: area,
            resources,
            state: computeCheckState(areaSelected, areaTotal),
            selectedCount: areaSelected,
            totalCount: areaTotal,
          });
        }
      }

      if (areas.length > 0) {
        result.push({
          node: mod,
          areas,
          state: computeCheckState(modSelected, modTotal),
          selectedCount: modSelected,
          totalCount: modTotal,
        });
      }
    }

    return result;
  });

  protected readonly visibleNodeOrder = computed<string[]>(() => {
    const ids: string[] = [];
    const searching = this.search().trim().length > 0;
    const collapsed = this.collapsedIds();

    for (const mod of this.filteredModules()) {
      const modKey = this.moduleKey(mod.node.id);
      ids.push(modKey);
      if (!searching && collapsed.has(modKey)) continue;

      for (const area of mod.areas) {
        const areaKey = this.areaKey(area.node.id);
        ids.push(areaKey);
        if (!searching && collapsed.has(areaKey)) continue;

        for (const res of area.resources) {
          const resKey = this.resourceKey(res.node.id);
          ids.push(resKey);
          if (!searching && collapsed.has(resKey)) continue;

          for (const action of res.actions) {
            ids.push(this.actionKey(action.baseKey));
          }
        }
      }
    }

    return ids;
  });

  protected readonly activeTabNodeId = computed<string | null>(() => {
    const order = this.visibleNodeOrder();
    if (order.length === 0) return null;
    const focused = this.focusedNodeId();
    return focused && order.includes(focused) ? focused : order[0];
  });

  protected readonly tenantModules = computed(() => this.hierarchy().tenantModules);
  protected readonly totalTenantCount = computed(() => this.hierarchy().totalTenantActions);
  protected readonly hasAnySelectable = computed(() => this.hierarchy().totalSelectableActions > 0);

  private lastEmittedCount: number | null = null;

  constructor() {
    effect(() => {
      const count = this.effectiveCount();
      if (count !== this.lastEmittedCount) {
        this.lastEmittedCount = count;
        untracked(() => this.countChange.emit(count));
      }
    });

    afterRenderEffect(() => {
      this.filteredModules();
      this.collapsedIds();
      const boxes = this.host.nativeElement.querySelectorAll<HTMLInputElement>(
        'ui-checkbox input[type="checkbox"]',
      );
      boxes.forEach((box) => {
        box.tabIndex = -1;
        box.setAttribute('aria-hidden', 'true');
      });
    });
  }

  protected i18nText(value: { en: string; ar: string }): string {
    return pickI18n(value, this.language());
  }

  protected moduleLabelText(mod: ModuleNode): string {
    this.i18n();
    const key = `perm.tree.modules.${mod.id}`;
    const translated = this.transloco.translate(key);
    return translated && translated !== key ? translated : this.i18nText(mod.label);
  }

  protected resourceLabelText(modId: string, res: ResourceNode): string {
    this.i18n();
    if (res.key) {
      const scopedKey = `perm.tree.resources.${modId}_${res.key}`;
      const scoped = this.transloco.translate(scopedKey);
      if (scoped && scoped !== scopedKey) return scoped;
      const key = `perm.tree.resources.${res.key}`;
      const translated = this.transloco.translate(key);
      if (translated && translated !== key) return translated;
    }
    return this.i18nText(res.label);
  }

  protected moduleKey(id: string): string {
    return `m:${id}`;
  }

  protected areaKey(id: string): string {
    return `a:${id}`;
  }

  protected resourceKey(id: string): string {
    return `r:${id}`;
  }

  protected actionKey(baseKey: string): string {
    return `act:${baseKey}`;
  }

  protected isExpanded(groupKey: string): boolean {
    return this.search().trim().length > 0 || !this.collapsedIds().has(groupKey);
  }

  protected toggleExpand(groupKey: string): void {
    this.collapsedIds.update((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  }

  protected expandAll(): void {
    this.collapsedIds.set(new Set());
  }

  protected collapseAll(): void {
    const next = new Set<string>();
    for (const mod of this.hierarchy().modules) {
      next.add(this.moduleKey(mod.id));
      for (const area of mod.areas) {
        next.add(this.areaKey(area.id));
        for (const res of area.resources) {
          next.add(this.resourceKey(res.id));
        }
      }
    }
    this.collapsedIds.set(next);
  }

  protected onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.search.set(value);
  }

  protected clearSearch(): void {
    this.search.set('');
    this.filter.set('all');
  }

  protected actionSelection(action: ActionNode) {
    return resolveActionSelection(action, this.selectedSet());
  }

  protected scopeOptionsFor(action: ActionNode): DropdownOption<PermissionRecordScope>[] {
    this.i18n();
    const isGlobal = this.mode() === 'GLOBAL';
    const disabled = this.disabledSet();
    const activeScope = this.actionSelection(action).activeScope;
    return action.availableScopes
      .filter((scope) => {
        if (disabled.size === 0) return true;
        const variant = action.variants.find((v) => v.recordScope === scope);
        if (!variant) return false;
        return !disabled.has(variant.id) || scope === activeScope;
      })
      .map((scope) => ({
        value: scope,
        label: this.scopeLabel(scope, isGlobal),
      }));
  }

  protected scopeLabel(scope: PermissionRecordScope, isGlobal = this.mode() === 'GLOBAL'): string {
    const key = scope === 'ALL' && isGlobal ? 'ALL_GLOBAL' : scope;
    return this.transloco.translate(`perm.tree.scope.${key}`);
  }

  private isActionLocked(action: ActionNode): boolean {
    const disabled = this.disabledSet();
    if (disabled.size === 0) return false;
    return action.variants.every((v) => disabled.has(v.id));
  }

  private unlockedBroadestEntry(action: ActionNode) {
    const disabled = this.disabledSet();
    if (disabled.size === 0) return action.broadestEntry;
    for (let i = action.variants.length - 1; i >= 0; i--) {
      const candidate = action.variants[i];
      if (!disabled.has(candidate.id)) return candidate;
    }
    return action.broadestEntry;
  }

  protected isGroupDisabled(state: CheckState, actions?: readonly ActionNode[]): boolean {
    if (this.readonly()) return true;
    if (actions && actions.length > 0 && actions.every((a) => this.isActionLocked(a))) return true;
    return state === 'none' && this.atLimit();
  }

  protected moduleGroupDisabled(mod: FilteredModule): boolean {
    return this.isGroupDisabled(mod.state, this.tenantModuleActions(mod.node));
  }

  protected areaGroupDisabled(area: FilteredArea): boolean {
    return this.isGroupDisabled(
      area.state,
      area.node.resources.flatMap((r) => r.actions),
    );
  }

  protected resourceGroupDisabled(res: FilteredResource): boolean {
    return this.isGroupDisabled(res.state, res.node.actions);
  }

  protected isActionDisabled(action: ActionNode, checked: boolean): boolean {
    if (this.readonly() || this.isActionLocked(action)) return true;
    return !checked && this.atLimit();
  }

  protected limitTitle(disabledByLimit: boolean): string | null {
    if (!disabledByLimit) return null;
    this.i18n();
    return this.transloco.translate('perm.tree.limit', { max: this.max() });
  }

  protected toggleAction(action: ActionNode): void {
    const resolved = this.actionSelection(action);
    if (this.isActionDisabled(action, resolved.checked)) return;

    const variantIds = new Set(action.variants.map((v) => v.id));
    const current = this.selected().filter((id) => !variantIds.has(id));
    if (!resolved.checked) {
      current.push(this.unlockedBroadestEntry(action).id);
    }
    this.selected.set(current);
  }

  protected setActionScope(action: ActionNode, scope: PermissionRecordScope): void {
    if (this.readonly()) return;
    const resolved = this.actionSelection(action);
    if (!resolved.checked) return;

    const target = action.variants.find((v) => v.recordScope === scope);
    if (!target || this.disabledSet().has(target.id)) return;

    const variantIds = new Set(action.variants.map((v) => v.id));
    const current = this.selected().filter((id) => !variantIds.has(id));
    current.push(target.id);
    this.selected.set(current);
  }

  protected toggleModule(mod: FilteredModule): void {
    this.toggleActionsBatch(
      mod.node.areas.flatMap((a) => a.resources.flatMap((r) => r.actions)),
      mod.state,
    );
  }

  protected toggleArea(area: FilteredArea): void {
    this.toggleActionsBatch(
      area.node.resources.flatMap((r) => r.actions),
      area.state,
    );
  }

  protected toggleResource(res: FilteredResource): void {
    this.toggleActionsBatch(res.node.actions, res.state);
  }

  protected rowTabIndex(nodeId: string): number {
    return this.activeTabNodeId() === nodeId ? 0 : -1;
  }

  protected onTreeItemFocus(nodeId: string): void {
    this.focusedNodeId.set(nodeId);
  }

  protected onModuleKeydown(event: KeyboardEvent, modKey: string, mod: FilteredModule): void {
    this.handleGroupKeydown(
      event,
      modKey,
      null,
      () => this.toggleModule(mod),
      this.moduleGroupDisabled(mod),
    );
  }

  protected onAreaKeydown(event: KeyboardEvent, areaKeyId: string, modKey: string, area: FilteredArea): void {
    this.handleGroupKeydown(
      event,
      areaKeyId,
      modKey,
      () => this.toggleArea(area),
      this.areaGroupDisabled(area),
    );
  }

  protected onResourceKeydown(
    event: KeyboardEvent,
    resKeyId: string,
    areaKeyId: string,
    res: FilteredResource,
  ): void {
    this.handleGroupKeydown(
      event,
      resKeyId,
      areaKeyId,
      () => this.toggleResource(res),
      this.resourceGroupDisabled(res),
    );
  }

  private handleGroupKeydown(
    event: KeyboardEvent,
    groupKey: string,
    parentKey: string | null,
    toggleCheck: () => void,
    disabledCheck: boolean,
  ): void {
    const target = event.target as HTMLElement | null;
    if (target?.closest('button, input, ui-dropdown')) {
      return;
    }

    const rtl = this.isRtl();
    const expandKey = rtl ? 'ArrowLeft' : 'ArrowRight';
    const collapseKey = rtl ? 'ArrowRight' : 'ArrowLeft';

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.moveFocusByOffset(groupKey, 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.moveFocusByOffset(groupKey, -1);
    } else if (event.key === expandKey) {
      event.preventDefault();
      if (!this.isExpanded(groupKey)) {
        this.toggleExpand(groupKey);
      } else {
        this.moveFocusByOffset(groupKey, 1);
      }
    } else if (event.key === collapseKey) {
      event.preventDefault();
      if (this.isExpanded(groupKey)) {
        this.toggleExpand(groupKey);
      } else if (parentKey) {
        this.focusNode(parentKey);
      }
    } else if (event.key === ' ') {
      event.preventDefault();
      if (!disabledCheck) toggleCheck();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.toggleExpand(groupKey);
    }
  }

  protected onActionKeydown(
    event: KeyboardEvent,
    nodeId: string,
    parentKey: string,
    action: ActionNode,
  ): void {
    const target = event.target as HTMLElement | null;
    if (target?.closest('button, input, ui-dropdown')) {
      return;
    }

    const rtl = this.isRtl();
    const collapseKey = rtl ? 'ArrowRight' : 'ArrowLeft';

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.moveFocusByOffset(nodeId, 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.moveFocusByOffset(nodeId, -1);
    } else if (event.key === collapseKey) {
      event.preventDefault();
      this.focusNode(parentKey);
    } else if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      this.toggleAction(action);
    }
  }

  protected stateTextKey(state: CheckState): string | null {
    if (state === 'all') return 'perm.tree.full';
    if (state === 'partial') return 'perm.tree.partial';
    return null;
  }

  protected tenantModuleActions(mod: ModuleNode): ActionNode[] {
    return mod.areas.flatMap((area) => area.resources.flatMap((res) => res.actions));
  }

  private toggleActionsBatch(actions: ActionNode[], currentState: CheckState): void {
    if (this.isGroupDisabled(currentState, actions)) return;

    const editableActions = actions.filter((a) => !this.isActionLocked(a));
    if (editableActions.length === 0) return;

    const selectedSet = this.selectedSet();
    const remainingSlots = Math.max(0, this.max() - this.effectiveCount());
    const editableSelectedCount = editableActions.filter((a) => resolveActionSelection(a, selectedSet).checked).length;
    const allEditableSelected = editableSelectedCount === editableActions.length;
    const shouldClear =
      currentState === 'all' ||
      allEditableSelected ||
      (currentState === 'partial' && remainingSlots === 0 && editableSelectedCount > 0);

    const editableVariantIds = new Set<string>();
    for (const action of editableActions) {
      for (const variant of action.variants) {
        editableVariantIds.add(variant.id);
      }
    }

    const baseSelected = this.selected().filter((id) => !editableVariantIds.has(id));
    if (shouldClear) {
      this.selected.set(baseSelected);
      return;
    }

    let added = 0;
    const next = [...baseSelected];
    for (const action of editableActions) {
      const resolved = resolveActionSelection(action, selectedSet);
      if (resolved.checked) {
        next.push(resolved.activeEntry.id);
      } else if (added < remainingSlots) {
        next.push(this.unlockedBroadestEntry(action).id);
        added += 1;
      }
    }

    this.selected.set(next);
  }

  private moveFocusByOffset(currentNodeId: string, delta: number): void {
    const order = this.visibleNodeOrder();
    const index = order.indexOf(currentNodeId);
    if (index < 0) return;
    const targetId = order[index + delta];
    if (targetId) {
      this.focusNode(targetId);
    }
  }

  private focusNode(nodeId: string): void {
    this.focusedNodeId.set(nodeId);
    const el = this.treeItemEls().find((ref) => ref.nativeElement.dataset['nodeId'] === nodeId)?.nativeElement;
    el?.focus();
  }

  private isRtl(): boolean {
    return getComputedStyle(this.host.nativeElement).direction === 'rtl';
  }
}

function matchesActionSearch(action: ActionNode, term: string): boolean {
  if (
    action.label.en.toLowerCase().includes(term) ||
    action.label.ar.toLowerCase().includes(term) ||
    action.baseKey.toLowerCase().includes(term)
  ) {
    return true;
  }
  return action.variants.some(
    (v) =>
      v.key.toLowerCase().includes(term) ||
      v.label.en.toLowerCase().includes(term) ||
      v.label.ar.toLowerCase().includes(term),
  );
}
