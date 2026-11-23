import { ApiError } from '../../../../core/api/api-errors';
import { Condition, Group, Issue, Query } from '../../../../shared/query-builder/query.model';
import { OpportunitySearchBody, WireNode } from '../opportunities.model';
import { compileOpportunityQuery, opportunitySearchErrorKey } from './opportunity-search.compile';

export function opportunityConditions(query: Query): Condition[] {
  const walk = (group: Group): Condition[] =>
    group.children.flatMap((node) => (node.kind === 'group' ? walk(node) : [node]));
  return [...query.fixed, ...walk(query.root)];
}

/** Resolve the server's path against the actual flattened wire tree, rather than UI child indexes. */
export function opportunityFilterIssues(
  error: unknown,
  query: Query,
  body: OpportunitySearchBody,
  timeZone: string,
  meUserId = '',
): Issue[] {
  if (!(error instanceof ApiError) || !opportunitySearchErrorKey(error)) return [];
  const conditions = opportunityConditions(query);
  if (error.code === 'OPPORTUNITY_FILTER_TAGS_CONFLICT') {
    return conditions.filter((condition) => condition.field === 'tags').map(issue);
  }
  const rawPath = error.details?.['path'];
  const path = Array.isArray(rawPath) ? rawPath[0] : undefined;
  if (
    typeof path !== 'string' ||
    !/^filterTree(?:\.children\[\d+\])*(?:\.(?:field|operator|value))?$/.test(path)
  )
    return [];
  let target = body.filterTree;
  for (const match of path.matchAll(/\.children\[(\d+)\]/g)) {
    if (!target || !('children' in target)) return [];
    target = target.children[Number(match[1])];
  }
  if (!target) return [];
  const leaves = (node: WireNode): WireNode[] =>
    'children' in node ? node.children.flatMap(leaves) : [node];
  const rejectedLeaves = new Set(leaves(target).map((leaf) => JSON.stringify(leaf)));
  return conditions
    .filter((condition) => {
      const single: Query = {
        fixed: [],
        root: { kind: 'group', id: 'root', op: 'AND', children: [] },
      };
      if (query.fixed.includes(condition)) single.fixed.push(condition);
      else single.root.children.push(condition);
      const compiled = compileOpportunityQuery(single, {
        branchId: body.branchId,
        meUserId,
        timeZone,
      }).body.filterTree;
      return compiled && leaves(compiled).some((leaf) => rejectedLeaves.has(JSON.stringify(leaf)));
    })
    .map(issue);
}

export function withoutPipelineFilter(node: WireNode | undefined): WireNode | undefined {
  if (!node) return undefined;
  if (!('children' in node)) return node.field === 'pipelineId' ? undefined : node;
  const children = node.children
    .map(withoutPipelineFilter)
    .filter((child): child is WireNode => !!child);
  if (!children.length) return undefined;
  return children.length === 1 ? children[0] : { ...node, children };
}

function issue(condition: Condition): Issue {
  return {
    code: 'INVALID_VALUE',
    severity: 'error',
    nodeIds: [condition.id],
    params: { field: condition.field },
  };
}
