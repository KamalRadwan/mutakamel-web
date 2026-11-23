import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { TranslocoService, provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Dropdown } from '../../../../../shared/ui/dropdown/dropdown';
import { OrganizationReadApi } from '../organization-read.api';
import { ApiError } from '../staff.api';
import { OrgCascade } from './org-cascade';

class EmptyLoader { getTranslation() { return of({}); } }
const company = { id: 'company', name: 'Company', code: 'C', status: 'ACTIVE', createdAt: '' };
const branch = { ...company, id: 'branch', name: 'Branch', companyId: company.id };
const department = { ...company, id: 'department', name: 'Department', branchId: branch.id };
const team = { ...company, id: 'team', name: 'Team', departmentId: department.id };
function page(data: object[], hasNext = false, page = 1) {
  return { data, meta: { page, limit: 100, total: data.length, totalPages: hasNext ? 2 : page, hasNext, hasPrev: page > 1 } };
}

describe('OrgCascade real organization lists', () => {
  const organization = { listCompanies: vi.fn(), listBranches: vi.fn(), listDepartments: vi.fn(), listTeams: vi.fn() };
  let fixture: ComponentFixture<OrgCascade>;

  beforeEach(() => {
    vi.resetAllMocks();
    for (const list of Object.values(organization)) list.mockResolvedValue(page([]));
    TestBed.configureTestingModule({ providers: [
      { provide: OrganizationReadApi, useValue: organization },
      provideTransloco({
        config: { availableLangs: ['en'], defaultLang: 'en', missingHandler: { logMissingKey: false } }, loader: EmptyLoader,
      }),
    ] });
    TestBed.inject(TranslocoService).setTranslation({ staff: { cascade: { company: 'Company', none: 'None' } } }, 'en');
    fixture = TestBed.createComponent(OrgCascade);
  });

  async function settle() { fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges(); }

  it('loads companies with active status, limit 100 and name order, including every page', async () => {
    organization.listCompanies.mockResolvedValueOnce(page([company], true)).mockResolvedValueOnce(page([{ ...company, id: 'second' }], false, 2));
    fixture.componentRef.setInput('levels', ['company']);
    await settle();
    expect(organization.listCompanies).toHaveBeenNthCalledWith(1, { page: 1, limit: 100, status: 'ACTIVE', sortBy: 'name', sortDir: 'ASC' });
    expect(organization.listCompanies).toHaveBeenNthCalledWith(2, { page: 2, limit: 100, status: 'ACTIVE', sortBy: 'name', sortDir: 'ASC' });
    const dropdown = fixture.debugElement.query(By.directive(Dropdown)).componentInstance as Dropdown<string | null>;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(dropdown.options().map((option) => option.value)).toEqual([null, company.id, 'second']);
    });
  });

  it('choosing a company loads branches with its companyId', async () => {
    organization.listCompanies.mockResolvedValue(page([company, { ...company, id: 'second' }]));
    await settle();
    const dropdown = fixture.debugElement.query(By.directive(Dropdown)).componentInstance as Dropdown<string | null>;
    dropdown.value.set(company.id);
    await settle();
    expect(organization.listBranches).toHaveBeenCalledWith({ companyId: company.id, page: 1, limit: 100, status: 'ACTIVE', sortBy: 'name', sortDir: 'ASC' });
  });

  it('a single option auto-selects through every level', async () => {
    organization.listCompanies.mockResolvedValue(page([company]));
    organization.listBranches.mockResolvedValue(page([branch]));
    organization.listDepartments.mockResolvedValue(page([department]));
    organization.listTeams.mockResolvedValue(page([team]));
    await settle();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.componentInstance.value()).toEqual({ companyId: company.id, branchId: branch.id, departmentId: department.id, teamId: team.id });
    });
    expect(organization.listDepartments).toHaveBeenCalledWith({ branchId: branch.id, page: 1, limit: 100, status: 'ACTIVE', sortBy: 'name', sortDir: 'ASC' });
    expect(organization.listTeams).toHaveBeenCalledWith({ departmentId: department.id, page: 1, limit: 100, status: 'ACTIVE', sortBy: 'name', sortDir: 'ASC' });
  });

  it('a rejected list leaves an empty option list', async () => {
    organization.listCompanies.mockRejectedValue(new ApiError(403, 'COMMON.GENERIC.FORBIDDEN'));
    fixture.componentRef.setInput('levels', ['company']);
    await settle();
    const dropdown = fixture.debugElement.query(By.directive(Dropdown)).componentInstance as Dropdown<string | null>;
    expect(dropdown.options()).toEqual([{ value: null, label: 'None', disabled: false }]);
    expect(fixture.componentInstance.value().companyId).toBeNull();
  });

  it('provided company and placement sources fetch no lists', async () => {
    fixture.componentRef.setInput('companySource', [company]);
    fixture.componentRef.setInput('placementSource', { branches: [branch], departments: [department], teams: [team] });
    fixture.componentInstance.value.set({ companyId: company.id, branchId: branch.id, departmentId: department.id, teamId: team.id });
    await settle();
    for (const list of Object.values(organization)) expect(list).not.toHaveBeenCalled();
  });
});
