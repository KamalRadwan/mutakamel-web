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
        canReadCompany: (company) => company === 'company',
        canReadBranch: (company, branch) => company === 'company' && branch === 'branch',
        canReadDepartments: () => departments,
        canReadTeams: () => teams,
      });
      expect(result.counts).toEqual({
        c: 1,
        b: 1,
        d: Number(departments),
        t: Number(departments && teams),
      });
      const children = result.tree[0].children[0].children;
      expect(children.map((child) => child.id)).toEqual(departments ? ['department'] : []);
      expect(children.flatMap((child) => child.children.map((team) => team.id))).toEqual(
        departments && teams ? ['team'] : [],
      );
    },
  );
});
