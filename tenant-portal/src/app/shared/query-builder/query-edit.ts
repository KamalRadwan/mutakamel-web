import type { Condition, Group, Query } from './query.model';

let fallbackCounter = 0;

export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  fallbackCounter += 1;
  return `qb-${Date.now().toString(36)}-${fallbackCounter.toString(36)}`;
}

export function emptyCondition(init?: string | Partial<Omit<Condition, 'kind'>>): Condition {
  if (typeof init === 'string') {
    return { kind: 'condition', id: newId(), field: init, operator: null, value: undefined };
  }
  return {
    kind: 'condition',
    id: init?.id ?? newId(),
    field: init?.field ?? '',
    operator: init?.operator ?? null,
    value: init?.value,
  };
}

export function emptyGroup(op: 'AND' | 'OR' = 'AND', children: (Condition | Group)[] = []): Group {
  return { kind: 'group', id: newId(), op, children };
}

export function emptyQuery(): Query {
  return { root: emptyGroup('AND'), fixed: [] };
}

function mapGroup(group: Group, targetId: string, fn: (g: Group) => Group): Group {
  if (group.id === targetId) return fn(group);
  let changed = false;
  const children = group.children.map((child) => {
    if (child.kind !== 'group') return child;
    const next = mapGroup(child, targetId, fn);
    if (next !== child) changed = true;
    return next;
  });
  return changed ? { ...group, children } : group;
}

function removeFromGroup(group: Group, id: string): Group {
  let changed = false;
  const nextChildren: (Condition | Group)[] = [];
  for (const child of group.children) {
    if (child.id === id) {
      changed = true;
      continue;
    }
    if (child.kind === 'group') {
      const nextGroup = removeFromGroup(child, id);
      if (nextGroup !== child) changed = true;
      nextChildren.push(nextGroup);
    } else {
      nextChildren.push(child);
    }
  }
  return changed ? { ...group, children: nextChildren } : group;
}

function updateInGroup(
  group: Group,
  id: string,
  patch: Partial<Omit<Condition, 'kind' | 'id'>>,
): Group {
  let changed = false;
  const children = group.children.map((child) => {
    if (child.kind === 'condition') {
      if (child.id !== id) return child;
      changed = true;
      return { ...child, ...patch, kind: 'condition' as const, id: child.id };
    }
    const nextGroup = updateInGroup(child, id, patch);
    if (nextGroup !== child) changed = true;
    return nextGroup;
  });
  return changed ? { ...group, children } : group;
}

export function addCondition(q: Query, groupId: string, cond?: Partial<Omit<Condition, 'kind'>>): Query {
  const nextCond = emptyCondition(cond);
  if (groupId === 'fixed') {
    return { ...q, fixed: [...q.fixed, nextCond] };
  }
  const root = mapGroup(q.root, groupId, (g) => ({
    ...g,
    children: [...g.children, nextCond],
  }));
  return root === q.root ? q : { ...q, root };
}

export function addGroup(q: Query, parentId: string, op: 'AND' | 'OR' = 'AND'): Query {
  const root = mapGroup(q.root, parentId, (g) => ({
    ...g,
    children: [...g.children, emptyGroup(op)],
  }));
  return root === q.root ? q : { ...q, root };
}

export function removeNode(q: Query, id: string): Query {
  const nextFixed = q.fixed.filter((c) => c.id !== id);
  const nextRoot = removeFromGroup(q.root, id);
  if (nextFixed.length === q.fixed.length && nextRoot === q.root) return q;
  return { ...q, fixed: nextFixed, root: nextRoot };
}

export function updateCondition(
  q: Query,
  id: string,
  patch: Partial<Omit<Condition, 'kind' | 'id'>>,
): Query {
  let fixedChanged = false;
  const fixed = q.fixed.map((cond) => {
    if (cond.id !== id) return cond;
    fixedChanged = true;
    return { ...cond, ...patch, kind: 'condition' as const, id: cond.id };
  });
  if (fixedChanged) return { ...q, fixed };

  const root = updateInGroup(q.root, id, patch);
  return root === q.root ? q : { ...q, root };
}

export function setGroupOp(q: Query, groupId: string, op: 'AND' | 'OR'): Query {
  const root = mapGroup(q.root, groupId, (g) => (g.op === op ? g : { ...g, op }));
  return root === q.root ? q : { ...q, root };
}

export function addFixed(q: Query, cond?: Partial<Omit<Condition, 'kind'>> | Condition): Query {
  return { ...q, fixed: [...q.fixed, emptyCondition(cond)] };
}

export function removeFixed(q: Query, id: string): Query {
  const fixed = q.fixed.filter((c) => c.id !== id);
  return fixed.length === q.fixed.length ? q : { ...q, fixed };
}

function countInGroup(group: Group): number {
  let count = 0;
  for (const child of group.children) {
    count += child.kind === 'condition' ? 1 : countInGroup(child);
  }
  return count;
}

export function countConditions(q: Query): number {
  return q.fixed.length + countInGroup(q.root);
}

function depthInGroup(group: Group, id: string, currentDepth: number): number {
  if (group.id === id) return currentDepth;
  for (const child of group.children) {
    if (child.kind === 'condition') {
      if (child.id === id) return currentDepth;
    } else {
      const found = depthInGroup(child, id, currentDepth + 1);
      if (found !== -1) return found;
    }
  }
  return -1;
}

export function depthOf(q: Query, id: string): number {
  if (id === 'fixed' || q.fixed.some((c) => c.id === id)) return 0;
  return depthInGroup(q.root, id, 1);
}
