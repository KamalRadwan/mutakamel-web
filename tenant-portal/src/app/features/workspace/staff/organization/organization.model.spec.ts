import type { OrgTreeNode } from '../shared/staff.model';
import { buildOrgViewTree } from './organization.model';

function node(id: string, children: OrgTreeNode[] = []): OrgTreeNode {
  return { id, code: id, name: id, status: 'ACTIVE', children };
}

describe('Organization tree and summary permissions', () => {
  const tree = [
    node('company', [
      node('branch', [node('department', [node('team')])]),
      node('sibling', [node('other-department')]),
    ]),
    node('other-company', [node('other-branch')]),
  ];

  it.each([
    { departments: false, teams: false },
    { departments: false, teams: true },
    { departments: true, teams: false },
    { departments: true, teams: true },
  ])(
    'projects permitted descendants and counts with department=$departments, team=$teams',
    ({ departments, teams }) => {
      const result = buildOrgViewTree(tree, {
        showInactive: false,
        search: '',
        locale: 'en',
        canReadCompany: (company) => company === 'company',
        canReadDepartments: () => departments,
        canReadTeams: () => teams,
      });
      expect(result.counts).toEqual({
        c: 1,
        b: 2,
        d: 2 * Number(departments),
        t: Number(departments && teams),
      });
      const children = result.tree[0].children[0].children;
      expect(children.map((child) => child.id)).toEqual(departments ? ['department'] : []);
      expect(children.flatMap((child) => child.children.map((team) => team.id))).toEqual(
        departments && teams ? ['team'] : [],
      );
    },
  );

  const options = {
    showInactive: false,
    search: '',
    locale: 'en' as const,
    canReadDepartments: () => true,
    canReadTeams: () => true,
  };

  it.each(['en', 'ar'] as const)('sorts siblings by name then code in the given locale (%s)', (locale) => {
    const siblings = [
      { ...node('z'), name: 'Zulu' },
      { ...node('b2'), name: 'باء', code: '02' },
      { ...node('a'), name: 'ألف' },
      { ...node('b1'), name: 'باء', code: '01' },
    ];
    const original = structuredClone(siblings);
    const result = buildOrgViewTree(siblings, { ...options, locale });
    expect(result.tree.map(({ id }) => id)).toEqual(
      locale === 'ar' ? ['a', 'b1', 'b2', 'z'] : ['z', 'a', 'b1', 'b2'],
    );
    expect(siblings).toEqual(original);
  });

  it('keeps the sort in every level', () => {
    const siblings = (depth: number): OrgTreeNode[] =>
      ['Z', 'A'].map((name) => ({
        ...node(`${depth}-${name}`, depth < 3 ? siblings(depth + 1) : []),
        name,
      }));
    const result = buildOrgViewTree(siblings(0), options);
    const check = (nodes: typeof result.tree): void => {
      expect(nodes.map(({ name }) => name)).toEqual(['A', 'Z']);
      for (const item of nodes) if (item.children.length) check(item.children);
    };
    check(result.tree);
    expect(result.counts).toEqual({ c: 2, b: 4, d: 8, t: 16 });
  });
});
