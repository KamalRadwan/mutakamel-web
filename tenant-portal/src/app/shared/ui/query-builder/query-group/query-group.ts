import { Component, computed, inject, input, output, viewChildren } from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerAlertTriangle, tablerCircleX, tablerPlus, tablerTrash } from '@ng-icons/tabler-icons';
import { fieldAvailability } from '../../../query-builder/query-analyzer';
import {
  Condition,
  Fix,
  Group,
  Issue,
  Operator,
  OperatorLabelFn,
  QUERY_LIMITS,
  Query,
  QueryField,
} from '../../../query-builder/query.model';
import { Button } from '../../button/button';
import { Field } from '../../field/field';
import { Segmented, SegmentedOption } from '../../segmented/segmented';
import { FieldAvailabilityMap, QueryCondition } from '../query-condition/query-condition';

@Component({
  selector: 'ui-query-group',
  imports: [NgIcon, TranslocoPipe, Button, Field, Segmented, QueryCondition, QueryGroup],
  providers: [provideIcons({ tablerTrash, tablerPlus, tablerCircleX, tablerAlertTriangle })],
  templateUrl: './query-group.html',
  host: {
    role: 'group',
    '[attr.aria-label]': 'groupAriaLabel()',
    '[class]': 'containerClass()',
  },
})
export class QueryGroup {
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  private readonly conditionRows = viewChildren(QueryCondition);
  private readonly childGroups = viewChildren(QueryGroup);

  readonly group = input.required<Group>();
  readonly query = input.required<Query>();
  readonly fields = input.required<QueryField[]>();
  readonly depth = input(1);
  readonly totalConditions = input(0);
  readonly issues = input<Issue[]>([]);
  readonly touchedNodes = input<ReadonlySet<string>>(new Set());
  readonly allTouched = input(false);
  readonly timeZone = input('Africa/Cairo');
  readonly disabled = input(false);
  readonly operatorLabel = input<OperatorLabelFn | null>(null);

  readonly opChange = output<{ groupId: string; op: 'AND' | 'OR' }>();
  readonly addConditionClick = output<string>();
  readonly addGroupClick = output<{ parentId: string; op: 'AND' | 'OR' }>();
  readonly removeNodeClick = output<string>();
  readonly conditionPatch = output<{ id: string; patch: Partial<Condition> }>();
  readonly applyFix = output<Fix>();
  readonly commit = output<void>();

  protected readonly groupNumber = computed(() => {
    const numbers = buildGroupNumberMap(this.query().root);
    return numbers[this.group().id] ?? 1;
  });

  protected readonly containerClass = computed(() =>
    this.depth() > 1
      ? 'flex min-w-0 flex-col gap-8 rounded-8 border-s-2 border-border p-8 ps-tree-indent transition-colors duration-fast hover:border-brand'
      : 'flex min-w-0 flex-col gap-8',
  );

  protected readonly groupAriaLabel = computed(() => {
    this.i18n();
    const label = this.transloco.translate('qb.group.label', { n: this.groupNumber() });
    const mode = this.transloco.translate(this.group().op === 'AND' ? 'qb.group.all' : 'qb.group.any');
    return `${label}: ${mode}`;
  });

  protected readonly combineOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    return [
      { value: 'AND', label: this.transloco.translate('qb.group.all'), disabled: this.disabled() },
      { value: 'OR', label: this.transloco.translate('qb.group.any'), disabled: this.disabled() },
    ];
  });

  protected readonly groupAvailability = computed<FieldAvailabilityMap>(() =>
    fieldAvailability(this.query(), this.fields(), {
      groupId: this.group().id,
      depth: this.depth(),
    }),
  );

  protected readonly canAddCondition = computed(
    () =>
      !this.disabled() &&
      this.totalConditions() < QUERY_LIMITS.conditions &&
      this.group().children.length < QUERY_LIMITS.childrenPerGroup,
  );

  protected readonly canAddGroup = computed(
    () =>
      !this.disabled() &&
      this.depth() < QUERY_LIMITS.depth &&
      this.totalConditions() < QUERY_LIMITS.conditions &&
      this.group().children.length < QUERY_LIMITS.childrenPerGroup,
  );

  protected readonly conditionLimitTitle = computed(() => {
    this.i18n();
    if (this.totalConditions() >= QUERY_LIMITS.conditions) {
      return this.transloco.translate('qb.limits.conditions');
    }
    if (this.group().children.length >= QUERY_LIMITS.childrenPerGroup) {
      return this.transloco.translate('qb.limits.children');
    }
    return null;
  });

  protected readonly groupLimitTitle = computed(() => {
    this.i18n();
    if (this.depth() >= QUERY_LIMITS.depth) {
      return this.transloco.translate('qb.limits.depth');
    }
    return this.conditionLimitTitle();
  });

  protected readonly groupIssues = computed(() => {
    const id = this.group().id;
    const childIds = new Set(this.group().children.map((child) => child.id));
    return this.issues().filter((issue) => {
      if (!issue.nodeIds.includes(id)) return false;
      const shownOnChild = issue.nodeIds.some((nodeId) => nodeId !== id && childIds.has(nodeId));
      return !shownOnChild && (issue.severity === 'warning' || this.allTouched());
    });
  });

  focusCondition(conditionId?: string, fieldId?: string): boolean {
    for (const row of this.conditionRows()) {
      const matchesId = conditionId !== undefined && row.conditionId() === conditionId;
      const matchesField = fieldId !== undefined && row.fieldId() === fieldId;
      if (matchesId || matchesField || (conditionId === undefined && fieldId === undefined)) {
        row.focusField();
        return true;
      }
    }
    for (const childGroup of this.childGroups()) {
      if (childGroup.focusCondition(conditionId, fieldId)) return true;
    }
    return false;
  }

  protected onOpChange(next: string | null): void {
    if (this.disabled() || (next !== 'AND' && next !== 'OR') || next === this.group().op) return;
    this.opChange.emit({ groupId: this.group().id, op: next });
  }

  protected onAddGroup(): void {
    if (!this.canAddGroup()) return;
    const oppositeOp = this.group().op === 'AND' ? 'OR' : 'AND';
    this.addGroupClick.emit({ parentId: this.group().id, op: oppositeOp });
  }

  protected issueKey(issue: Issue): string {
    if (issue.code === 'CONTRADICTION' && issue.params['canIn']) {
      return 'qb.issue.CONTRADICTION_IN';
    }
    return `qb.issue.${issue.code}`;
  }

  protected issueParams(issue: Issue): Record<string, string | number> {
    this.i18n();
    const resolved: Record<string, string | number> = { ...issue.params };
    const fieldParam = resolved['field'];
    const matchedField =
      typeof fieldParam === 'string'
        ? this.fields().find((item) => item.id === fieldParam || item.label === fieldParam)
        : undefined;
    if (matchedField) {
      resolved['field'] = matchedField.label;
    }
    if (typeof resolved['opA'] === 'string') {
      resolved['a'] = this.formatIssueSide(matchedField, resolved['opA'] as Operator, resolved['valA']);
    }
    if (typeof resolved['opB'] === 'string') {
      resolved['b'] = this.formatIssueSide(matchedField, resolved['opB'] as Operator, resolved['valB']);
    }
    return resolved;
  }

  private formatIssueSide(
    field: QueryField | undefined,
    op: Operator,
    rawVal: string | number | undefined,
  ): string {
    if (op === 'isNull') return field?.nullLabels?.isNull ?? this.transloco.translate('qb.shortOp.isNull');
    if (op === 'isNotNull') return field?.nullLabels?.isNotNull ?? this.transloco.translate('qb.shortOp.isNotNull');
    if (rawVal === undefined || rawVal === '') return this.transloco.translate(`qb.op.${op}`);
    let valText = String(rawVal);
    if (field?.kind === 'boolean' && (valText === 'Yes' || valText === 'No' || valText === 'true' || valText === 'false')) {
      valText = this.transloco.translate(valText === 'Yes' || valText === 'true' ? 'qb.bool.true' : 'qb.bool.false');
    } else if (op === 'relative') {
      valText = this.transloco.translate(`qb.date.${valText}`);
    }
    if (op === 'eq' || op === 'is') return valText;
    if (op === 'neq' || op === 'in' || op === 'nin') {
      const shortOp = this.shortOpText(op);
      return shortOp ? `${shortOp} ${valText}` : valText;
    }
    const opLabel = this.transloco.translate(`qb.op.${op}`);
    return `${opLabel} ${valText}`;
  }

  /** An empty translation makes Transloco return the key itself; treat that as empty. */
  private shortOpText(op: Operator): string {
    const key = `qb.shortOp.${op}`;
    const text = this.transloco.translate(key);
    return text === key ? '' : text;
  }
}

function buildGroupNumberMap(root: Group): Record<string, number> {
  const map: Record<string, number> = {};
  let next = 1;
  const visit = (node: Group): void => {
    map[node.id] = next++;
    for (const child of node.children) {
      if (child.kind === 'group') visit(child);
    }
  };
  visit(root);
  return map;
}
