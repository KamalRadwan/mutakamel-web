import {
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
  viewChildren,
  untracked,
} from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerChevronUp, tablerFilterCog, tablerPlus } from '@ng-icons/tabler-icons';
import { analyze, canApply, fieldAvailability } from '../../../query-builder/query-analyzer';
import { normalize } from '../../../query-builder/query-normalize';
import { summarize } from '../../../query-builder/query-summary';
import {
  Condition,
  Fix,
  Group,
  OperatorLabelFn,
  QUERY_LIMITS,
  Query,
  QueryField,
  addCondition,
  addFixed,
  addGroup,
  countConditions,
  emptyCondition,
  emptyQuery,
  removeFixed,
  removeNode,
  setGroupOp,
  updateCondition,
} from '../../../query-builder/query.model';
import { Button } from '../../button/button';
import { ConfirmDialog } from '../../confirm-dialog/confirm-dialog';
import { FieldAvailabilityMap, QueryCondition } from '../query-condition/query-condition';
import { QueryGroup } from '../query-group/query-group';
import { QuerySummaryBar } from '../query-summary-bar/query-summary-bar';

@Component({
  selector: 'ui-query-builder',
  imports: [
    NgIcon,
    TranslocoPipe,
    Button,
    ConfirmDialog,
    QueryCondition,
    QueryGroup,
    QuerySummaryBar,
  ],
  viewProviders: [provideTranslocoScope({ scope: 'ui-query-builder', alias: 'qb' })],
  providers: [provideIcons({ tablerFilterCog, tablerChevronUp, tablerPlus })],
  templateUrl: './query-builder.html',
  host: {
    role: 'group',
    '[attr.aria-label]': 'resolvedTitle()',
    class: 'block min-w-0',
    '(keydown)': 'onKeydown($event)',
  },
})
export class QueryBuilder {
  private static nextId = 0;

  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  private readonly rootGroup = viewChild<QueryGroup>('rootGroup');
  private readonly fixedRows = viewChildren<QueryCondition>('fixedRow');
  private readonly clearDialog = viewChild.required<ConfirmDialog>('clearDialog');
  private readonly discardDialog = viewChild.required<ConfirmDialog>('discardDialog');

  readonly fields = input.required<QueryField[]>();
  readonly applied = input.required<Query>();
  readonly title = input('');
  readonly panelId = input(`ui-qb-panel-${++QueryBuilder.nextId}`);
  readonly timeZone = input('Africa/Cairo');
  readonly disabled = input(false);
  /**
   * Optional host hook that labels an operator for one condition (rows, option lists and summaries). Null, or a null
   * result, keeps the built-in label, so hosts that do not set it are unchanged.
   */
  readonly operatorLabel = input<OperatorLabelFn | null>(null);

  readonly expanded = model(false);

  readonly apply = output<Query>();
  readonly clear = output<void>();
  readonly dirtyChange = output<boolean>();

  protected readonly draft = signal<Query>(emptyQuery());
  protected readonly applyAttempted = signal(false);
  protected readonly touchedNodes = signal<ReadonlySet<string>>(new Set());

  private lastSyncedApplied: Query | null = null;
  private prevDirty = false;
  private confirming = false;

  protected readonly resolvedTitle = computed(() => {
    this.i18n();
    return this.title() || this.transloco.translate('qb.title');
  });

  protected readonly rootFields = computed(() =>
    this.fields().filter((field) => field.placement === 'root'),
  );

  protected readonly fixedAvailability = computed<FieldAvailabilityMap>(() =>
    fieldAvailability(this.draft(), this.fields(), { groupId: 'fixed', depth: 0 }),
  );

  protected readonly issues = computed(() =>
    analyze(normalize(this.draft(), this.fields()), this.fields(), undefined, this.timeZone()),
  );
  protected readonly canApplyDraft = computed(() => canApply(this.issues()));
  protected readonly totalConditions = computed(() => countConditions(this.draft()));

  protected readonly hasAvailableRootField = computed(() => {
    const avail = this.fixedAvailability();
    return this.rootFields().some((field) => avail[field.id]?.enabled !== false);
  });

  protected readonly canAddFixed = computed(
    () =>
      !this.disabled() &&
      this.totalConditions() < QUERY_LIMITS.conditions &&
      this.hasAvailableRootField(),
  );

  protected readonly dirty = computed(() => {
    const fields = this.fields();
    return canonicalQueryJson(this.draft(), fields) !== canonicalQueryJson(this.applied(), fields);
  });

  protected readonly attentionCount = computed(() => {
    const errorIssues = this.issues().filter((issue) => issue.severity === 'error');
    if (errorIssues.length === 0) return 0;
    const nodeIds = new Set<string>();
    for (const issue of errorIssues) {
      for (const id of issue.nodeIds) nodeIds.add(id);
    }
    return nodeIds.size > 0 ? nodeIds.size : errorIssues.length;
  });

  protected readonly appliedSummary = computed(() => {
    this.i18n();
    return summarize(this.applied(), this.fields(), (key, params) => {
      const fullKey = key.startsWith('qb.') ? key : `qb.${key}`;
      return this.transloco.translate(fullKey, params as Record<string, unknown> | undefined);
    });
  });

  protected readonly draftSummary = computed(() => {
    this.i18n();
    return summarize(this.draft(), this.fields(), (key, params) => {
      const fullKey = key.startsWith('qb.') ? key : `qb.${key}`;
      return this.transloco.translate(fullKey, params as Record<string, unknown> | undefined);
    });
  });

  constructor() {
    effect(() => {
      const nextApplied = this.applied();
      const fields = this.fields();
      if (!this.lastSyncedApplied) {
        this.lastSyncedApplied = nextApplied;
        this.draft.set(structuredClone(nextApplied));
        return;
      }
      const wasClean =
        // untracked: this effect writes `draft`, so tracking it here would loop forever (page freeze).
        canonicalQueryJson(
          untracked(() => this.draft()),
          fields,
        ) === canonicalQueryJson(this.lastSyncedApplied, fields);
      this.lastSyncedApplied = nextApplied;
      if (wasClean) {
        this.draft.set(structuredClone(nextApplied));
        this.applyAttempted.set(false);
        this.touchedNodes.set(new Set());
      }
    });

    effect(() => {
      const isDirty = this.dirty();
      if (isDirty !== this.prevDirty) {
        this.prevDirty = isDirty;
        this.dirtyChange.emit(isDirty);
      }
    });
  }

  open(focusFieldId?: string): void {
    this.expanded.set(true);
    setTimeout(() => this.focusCondition(undefined, focusFieldId), 0);
  }

  discardDraft(): void {
    this.draft.set(structuredClone(this.applied()));
    this.applyAttempted.set(false);
    this.touchedNodes.set(new Set());
  }

  protected onApply(): void {
    if (this.disabled() || this.confirming) return;
    if (!this.canApplyDraft()) {
      this.applyAttempted.set(true);
      if (!this.expanded()) {
        this.expanded.set(true);
      }
      setTimeout(() => this.focusFirstErrorRow(), 0);
      return;
    }

    const normalized = normalize(this.draft(), this.fields());
    this.draft.set(structuredClone(normalized));
    this.applyAttempted.set(false);
    this.touchedNodes.set(new Set());
    this.apply.emit(normalized);
    this.expanded.set(false);
  }

  protected async onClearAll(): Promise<void> {
    if (this.disabled() || this.confirming) return;
    const conditionCount = Math.max(countConditions(this.draft()), countConditions(this.applied()));
    if (conditionCount > 1) {
      this.confirming = true;
      try {
        if (!(await this.clearDialog().open())) return;
      } finally {
        this.confirming = false;
      }
    }

    this.draft.set(emptyQuery());
    this.applyAttempted.set(false);
    this.touchedNodes.set(new Set());
    this.clear.emit();
  }

  protected onAddFixed(): void {
    if (!this.canAddFixed()) return;
    const cond = emptyCondition();
    this.draft.update((q) => addFixed(q, cond));
    setTimeout(() => this.focusCondition(cond.id), 0);
  }

  protected onRemoveFixed(id: string): void {
    if (this.disabled()) return;
    this.draft.update((q) => removeFixed(q, id));
  }

  protected onFixedPatch(id: string, patch: Partial<Condition>): void {
    if (this.disabled()) return;
    this.markNodeTouched(id);
    this.draft.update((q) => ({
      ...q,
      fixed: q.fixed.map((cond) => (cond.id === id ? { ...cond, ...patch } : cond)),
    }));
  }

  protected onOpChange(event: { groupId: string; op: 'AND' | 'OR' }): void {
    if (this.disabled()) return;
    this.draft.update((q) => setGroupOp(q, event.groupId, event.op));
  }

  protected onAddCondition(groupId: string): void {
    if (this.disabled()) return;
    const cond = emptyCondition();
    this.draft.update((q) => addCondition(q, groupId, cond));
    setTimeout(() => this.focusCondition(cond.id), 0);
  }

  protected onAddGroup(event: { parentId: string; op: 'AND' | 'OR' }): void {
    if (this.disabled()) return;
    let addedCondId: string | undefined;
    this.draft.update((q) => {
      const beforeIds = new Set(collectGroupIds(q.root));
      let next = addGroup(q, event.parentId, event.op);
      const added = findNewEmptyGroup(next.root, beforeIds);
      if (added) {
        const cond = emptyCondition();
        addedCondId = cond.id;
        next = addCondition(next, added.id, cond);
      }
      return next;
    });
    if (addedCondId) {
      const id = addedCondId;
      setTimeout(() => this.focusCondition(id), 0);
    }
  }

  protected onRemoveNode(id: string): void {
    if (this.disabled()) return;
    this.draft.update((q) => removeNode(q, id));
  }

  protected onConditionPatch(event: { id: string; patch: Partial<Condition> }): void {
    if (this.disabled()) return;
    this.markNodeTouched(event.id);
    this.draft.update((q) => updateCondition(q, event.id, event.patch));
  }

  protected onApplyFix(fix: Fix): void {
    if (this.disabled()) return;
    this.draft.update((q) => fix.apply(q));
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (!this.expanded() || this.disabled() || this.confirming) return;
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      this.onApply();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      void this.requestCollapseOnEscape();
    }
  }

  private async requestCollapseOnEscape(): Promise<void> {
    if (this.confirming) return;
    if (!this.dirty()) {
      this.expanded.set(false);
      return;
    }
    this.confirming = true;
    try {
      if (await this.discardDialog().open()) {
        this.discardDraft();
        this.expanded.set(false);
      }
    } finally {
      this.confirming = false;
    }
  }

  private markNodeTouched(id: string): void {
    this.touchedNodes.update((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }

  private focusFirstErrorRow(): void {
    const errorIds = new Set<string>();
    for (const issue of this.issues()) {
      if (issue.severity === 'error') {
        for (const id of issue.nodeIds) errorIds.add(id);
      }
    }
    for (const id of errorIds) {
      if (this.focusCondition(id)) return;
    }
    this.focusCondition();
  }

  private focusCondition(conditionId?: string, fieldId?: string): boolean {
    for (const row of this.fixedRows()) {
      const matchesId = conditionId !== undefined && row.conditionId() === conditionId;
      const matchesField = fieldId !== undefined && row.fieldId() === fieldId;
      if (matchesId || matchesField) {
        row.focusField();
        return true;
      }
    }
    if (this.rootGroup()?.focusCondition(conditionId, fieldId)) return true;
    if (conditionId === undefined && fieldId === undefined) {
      const firstFixed = this.fixedRows()[0];
      if (firstFixed) {
        firstFixed.focusField();
        return true;
      }
    }
    return false;
  }
}

function stripNodeIds(node: Condition | Group): unknown {
  if (node.kind === 'condition') {
    return { kind: node.kind, field: node.field, operator: node.operator, value: node.value };
  }
  return { kind: node.kind, op: node.op, children: node.children.map(stripNodeIds) };
}

function canonicalQueryJson(q: Query, fields: QueryField[]): string {
  const norm = normalize(q, fields);
  return JSON.stringify({
    root: stripNodeIds(norm.root),
    fixed: norm.fixed.map(stripNodeIds),
  });
}

function collectGroupIds(group: Group): string[] {
  const ids = [group.id];
  for (const child of group.children) {
    if (child.kind === 'group') ids.push(...collectGroupIds(child));
  }
  return ids;
}

function findNewEmptyGroup(group: Group, beforeIds: ReadonlySet<string>): Group | null {
  if (!beforeIds.has(group.id) && group.children.length === 0) return group;
  for (const child of group.children) {
    if (child.kind === 'group') {
      const found = findNewEmptyGroup(child, beforeIds);
      if (found) return found;
    }
  }
  return null;
}
