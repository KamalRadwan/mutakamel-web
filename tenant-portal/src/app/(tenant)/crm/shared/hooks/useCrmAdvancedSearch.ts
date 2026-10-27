"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  crmCompileFilterTree,
  crmGroupsWithCondition,
  crmGroupsWithConditionAdded,
  crmGroupsWithConditionRemoved,
  crmGroupsWithConnector,
  crmGroupsWithGroupAdded,
  crmGroupsWithGroupRemoved,
  type CrmSearchCondition,
  type CrmSearchConnector,
  type CrmSearchFieldDef,
  type CrmSearchGroup,
} from "../search/filter-tree";

interface UseCrmAdvancedSearchOptions<Id extends string> {
  fields: readonly CrmSearchFieldDef<Id>[];
  groups: readonly CrmSearchGroup<Id>[];
  onGroupsChange: (next: readonly CrmSearchGroup<Id>[]) => void;
  onSubmit: () => void;
  disabled?: boolean;
  requireFieldSelection: boolean;
}

/**
 * The advanced-search card's state and edits: open/shut, the filled-condition
 * count, every structural change, and where keyboard focus goes after one.
 *
 * Rows and conditions are keyed by position, so after a structural edit the
 * focused button is either gone (focus drops to the body) or silently belongs
 * to the next condition. Each edit therefore names the field picker that should
 * take focus once the caller hands the new groups back.
 */
export function useCrmAdvancedSearch<Id extends string>({
  fields,
  groups,
  onGroupsChange,
  onSubmit,
  disabled,
  requireFieldSelection,
}: UseCrmAdvancedSearchOptions<Id>) {
  // Open on arrival: the card exists to be filled in. It closes itself on
  // Apply and the toggle reopens it to adjust the question.
  const [isOpen, setIsOpen] = useState(true);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const rowsRef = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<string | null>(null);

  // Never empty: every caller passes its whole whitelist, and a module with no
  // filterable field would not mount the card at all.
  const first = fields[0]!;
  const startsSelected = !requireFieldSelection;

  useEffect(() => {
    const target = pendingFocus.current;
    if (target === null) return;
    pendingFocus.current = null;
    rowsRef.current?.querySelector<HTMLElement>(`[data-crm-search-field="${target}"]`)?.focus();
  }, [groups]);

  function resolve(id: Id): CrmSearchFieldDef<Id> {
    const definition = fields.find((candidate) => candidate.id === id);
    // Only reachable through a cast — the picker offers ids from this list.
    if (!definition) throw new Error(`Unknown search field: ${id}`);
    return definition;
  }

  // A condition counts only if the compiler would send it — asking the
  // compiler itself, so a one-sided `between` or a stale operator never
  // inflates the badge past what the request actually holds.
  const filledCount = groups.reduce(
    (total, group) =>
      total +
      group.conditions.filter(
        (condition) => crmCompileFilterTree([{ conditions: [condition] }], resolve) !== undefined,
      ).length,
    0,
  );

  function change(
    next: readonly CrmSearchGroup<Id>[],
    focus: (next: readonly CrmSearchGroup<Id>[]) => [number, number],
  ) {
    if (next === groups) return;
    const [groupIndex, conditionIndex] = focus(next);
    pendingFocus.current = `${groupIndex}:${conditionIndex}`;
    onGroupsChange(next);
  }

  return {
    isOpen,
    setIsOpen,
    toggleRef,
    rowsRef,
    resolve,
    filledCount,
    submit(event: FormEvent<HTMLFormElement>) {
      event.preventDefault();
      if (disabled) return;
      onSubmit();
      setIsOpen(false);
      // Apply (or the box Enter was pressed in) unmounts with the body; the
      // toggle that reopens it is where keyboard focus belongs next.
      toggleRef.current?.focus();
    },
    addGroup() {
      change(crmGroupsWithGroupAdded(groups, first, startsSelected), () => [groups.length, 0]);
    },
    changeConnector(groupIndex: number, connector: CrmSearchConnector) {
      // AND merges the row into the one above: focus its first condition
      // there. OR returns the same groups and is a no-op.
      change(crmGroupsWithConnector(groups, groupIndex, 0, connector), () => [
        groupIndex - 1,
        groups[groupIndex - 1]?.conditions.length ?? 0,
      ]);
    },
    patchCondition(groupIndex: number, conditionIndex: number, patch: Partial<CrmSearchCondition<Id>>) {
      onGroupsChange(crmGroupsWithCondition(groups, groupIndex, conditionIndex, patch, resolve));
    },
    addCondition(groupIndex: number) {
      change(crmGroupsWithConditionAdded(groups, groupIndex, first, startsSelected), () => [
        groupIndex,
        groups[groupIndex]?.conditions.length ?? 0,
      ]);
    },
    removeCondition(groupIndex: number, conditionIndex: number) {
      change(
        crmGroupsWithConditionRemoved(groups, groupIndex, conditionIndex, first, startsSelected),
        (next) =>
          next.length < groups.length
            ? [Math.min(groupIndex, next.length - 1), 0]
            : [groupIndex, Math.min(conditionIndex, next[groupIndex]!.conditions.length - 1)],
      );
    },
    removeGroup(groupIndex: number) {
      change(crmGroupsWithGroupRemoved(groups, groupIndex, first, startsSelected), (next) => [
        Math.min(groupIndex, next.length - 1),
        0,
      ]);
    },
  };
}
