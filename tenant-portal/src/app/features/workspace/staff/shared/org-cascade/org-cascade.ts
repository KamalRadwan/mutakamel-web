import { Component, ElementRef, computed, effect, inject, input, model, signal, untracked } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { listAllPages, listBranches, listCompanies, listDepartments, listTeams } from '../staff.api';
import { Branch, Company, Department, OrgCascadeLevel, OrgCascadeValue, STAFF_LIMITS, Team } from '../staff.model';

@Component({
  selector: 'app-org-cascade',
  imports: [TranslocoPipe, Dropdown, Field],
  templateUrl: './org-cascade.html',
  host: { '[class.contents]': 'useContents' },
})
export class OrgCascade {
  private static nextId = 0;
  protected readonly uid = `org-cascade-${++OrgCascade.nextId}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  protected readonly useContents =
    !this.host.nativeElement.classList.contains('grid') && !this.host.nativeElement.classList.contains('flex');

  readonly levels = input<OrgCascadeLevel[]>(['company', 'branch', 'department', 'team']);
  readonly required = input<OrgCascadeLevel[]>([]);
  readonly readonly = input(false);
  readonly disabledLevels = input<OrgCascadeLevel[]>([]);
  readonly activeOnly = input(true);
  readonly companySource = input<readonly Company[] | null>(null);
  readonly placementSource = input<{
    branches: readonly Branch[];
    departments: readonly Department[];
    teams: readonly Team[];
  } | null>(null);
  readonly allowCompany = input<((company: Company) => boolean) | null>(null);
  readonly errors = input<Partial<Record<OrgCascadeLevel, string>>>({});
  readonly hints = input<Partial<Record<OrgCascadeLevel, string>>>({});

  readonly value = model<OrgCascadeValue>({
    companyId: null,
    branchId: null,
    departmentId: null,
    teamId: null,
  });

  protected readonly companies = signal<Company[]>([]);
  protected readonly branches = signal<Branch[]>([]);
  protected readonly departments = signal<Department[]>([]);
  protected readonly teams = signal<Team[]>([]);

  private companiesSeq = 0;
  private branchesSeq = 0;
  private departmentsSeq = 0;
  private teamsSeq = 0;
  private loadedCompanyFilter: boolean | null = null;
  private loadedBranchesKey = '';
  private loadedDepartmentsKey = '';
  private loadedTeamsKey = '';

  constructor() {
    effect(() => {
      const levels = this.levels();
      const activeOnly = this.activeOnly();
      if (!levels.includes('company') || this.companySource() !== null) {
        this.companiesSeq++;
        this.loadedCompanyFilter = null;
        this.companies.set([]);
        return;
      }
      if (this.loadedCompanyFilter === activeOnly) return;
      this.loadedCompanyFilter = activeOnly;
      untracked(() => {
        void this.fetchCompanies(activeOnly);
      });
    });

    effect(() => {
      const levels = this.levels();
      const activeOnly = this.activeOnly();
      const companyId = this.value().companyId;
      if (!levels.includes('branch') || !companyId || this.placementSource() !== null) {
        this.branchesSeq++;
        this.loadedBranchesKey = '';
        this.branches.set([]);
        return;
      }
      const key = `${companyId}:${activeOnly}`;
      if (this.loadedBranchesKey === key) return;
      this.loadedBranchesKey = key;
      untracked(() => {
        void this.fetchBranches(companyId, activeOnly);
      });
    });

    effect(() => {
      const levels = this.levels();
      const activeOnly = this.activeOnly();
      const branchId = this.value().branchId;
      if (!levels.includes('department') || !branchId || this.placementSource() !== null) {
        this.departmentsSeq++;
        this.loadedDepartmentsKey = '';
        this.departments.set([]);
        return;
      }
      const key = `${branchId}:${activeOnly}`;
      if (this.loadedDepartmentsKey === key) return;
      this.loadedDepartmentsKey = key;
      untracked(() => {
        void this.fetchDepartments(branchId, activeOnly);
      });
    });

    effect(() => {
      const levels = this.levels();
      const activeOnly = this.activeOnly();
      const departmentId = this.value().departmentId;
      if (!levels.includes('team') || !departmentId || this.placementSource() !== null) {
        this.teamsSeq++;
        this.loadedTeamsKey = '';
        this.teams.set([]);
        return;
      }
      const key = `${departmentId}:${activeOnly}`;
      if (this.loadedTeamsKey === key) return;
      this.loadedTeamsKey = key;
      untracked(() => {
        void this.fetchTeams(departmentId, activeOnly);
      });
    });
  }

  protected readonly companyOptions = computed(() =>
    this.buildOptions('company', (this.companySource() ?? this.companies()).filter((company) => this.allowCompany()?.(company) ?? true),
      this.value().companyId),
  );
  protected readonly branchOptions = computed(() =>
    this.buildOptions('branch',
      this.placementSource()?.branches.filter((branch) => branch.companyId === this.value().companyId) ?? this.branches(),
      this.value().branchId),
  );
  protected readonly departmentOptions = computed(() =>
    this.buildOptions('department',
      this.placementSource()?.departments.filter((department) => department.branchId === this.value().branchId) ?? this.departments(),
      this.value().departmentId),
  );
  protected readonly teamOptions = computed(() =>
    this.buildOptions('team',
      this.placementSource()?.teams.filter((team) => team.departmentId === this.value().departmentId) ?? this.teams(),
      this.value().teamId),
  );

  protected isRequired(level: OrgCascadeLevel): boolean {
    return this.required().includes(level);
  }

  protected isDisabled(level: OrgCascadeLevel): boolean {
    if (this.readonly() || this.disabledLevels().includes(level)) return true;
    const val = this.value();
    if (level === 'branch') return !val.companyId;
    if (level === 'department') return !val.branchId;
    if (level === 'team') return !val.departmentId;
    return false;
  }

  protected missingParentTitle(level: OrgCascadeLevel): string | null {
    this.i18n();
    if (this.readonly() || this.disabledLevels().includes(level)) return null;
    const val = this.value();
    if (level === 'branch' && !val.companyId) return this.transloco.translate('staff.cascade.chooseFirst.branch');
    if (level === 'department' && !val.branchId) return this.transloco.translate('staff.cascade.chooseFirst.department');
    if (level === 'team' && !val.departmentId) return this.transloco.translate('staff.cascade.chooseFirst.team');
    return null;
  }

  protected isAutoSelected(level: OrgCascadeLevel): boolean {
    if (this.readonly() || this.disabledLevels().includes(level)) return false;
    const val = this.value();
    if (level === 'company') {
      const list = this.companies();
      return list.length === 1 && val.companyId === list[0].id;
    }
    if (level === 'branch') {
      const list = this.branches();
      return Boolean(val.companyId) && list.length === 1 && val.branchId === list[0].id;
    }
    if (level === 'department') {
      const list = this.departments();
      return Boolean(val.branchId) && list.length === 1 && val.departmentId === list[0].id;
    }
    const list = this.teams();
    return Boolean(val.departmentId) && list.length === 1 && val.teamId === list[0].id;
  }

  protected describedByFor(level: OrgCascadeLevel): string {
    const base = `${this.uid}-${level}-hint`;
    return this.errors()[level] ? `${base} ${this.uid}-${level}-error` : base;
  }

  protected onLevelChange(level: OrgCascadeLevel, nextId: string | null): void {
    if (this.isDisabled(level)) return;
    const current = this.value();
    if (level === 'company') {
      if (current.companyId === nextId) return;
      this.value.set({ companyId: nextId, branchId: null, departmentId: null, teamId: null });
      return;
    }
    if (level === 'branch') {
      if (current.branchId === nextId) return;
      this.value.set({ ...current, branchId: nextId, departmentId: null, teamId: null });
      return;
    }
    if (level === 'department') {
      if (current.departmentId === nextId) return;
      this.value.set({ ...current, departmentId: nextId, teamId: null });
      return;
    }
    if (current.teamId === nextId) return;
    this.value.set({ ...current, teamId: nextId });
  }

  protected optionsFor(level: OrgCascadeLevel): DropdownOption<string | null>[] {
    if (level === 'company') return this.companyOptions();
    if (level === 'branch') return this.branchOptions();
    if (level === 'department') return this.departmentOptions();
    return this.teamOptions();
  }

  protected valueFor(level: OrgCascadeLevel): string | null {
    const val = this.value();
    if (level === 'company') return val.companyId;
    if (level === 'branch') return val.branchId;
    if (level === 'department') return val.departmentId;
    return val.teamId;
  }

  protected hintFor(level: OrgCascadeLevel): string {
    this.i18n();
    const custom = this.hints()[level];
    if (custom) return custom;
    if (level === 'team' && this.isRequired('team')) {
      return this.transloco.translate('staff.cascade.teamRequiredHint');
    }
    return this.transloco.translate(`staff.cascade.${level}Hint`);
  }

  protected displayValueFor(level: OrgCascadeLevel): string {
    this.i18n();
    const id = this.valueFor(level);
    if (!id) {
      return this.isRequired(level) ? '—' : this.transloco.translate('staff.cascade.none');
    }
    const placement = this.placementSource();
    const items: readonly { id: string; name: string }[] =
      level === 'company'
        ? this.companySource() ?? this.companies()
        : level === 'branch'
          ? placement?.branches ?? this.branches()
          : level === 'department'
            ? placement?.departments ?? this.departments()
            : placement?.teams ?? this.teams();
    return items.find((item) => item.id === id)?.name ?? '—';
  }

  private buildOptions<T extends { id: string; name: string }>(
    level: OrgCascadeLevel,
    items: T[],
    selectedId: string | null,
  ): DropdownOption<string | null>[] {
    this.i18n();
    const required = this.isRequired(level);
    const placeholder = this.transloco.translate(`staff.cascade.${level}`);
    const emptyOption: DropdownOption<string | null> = {
      value: null,
      label: required ? placeholder : this.transloco.translate('staff.cascade.none'),
      disabled: required,
    };
    const mapped = items.map((item) => ({ value: item.id, label: item.name }));
    if (required && selectedId !== null && items.some((item) => item.id === selectedId)) {
      return mapped;
    }
    return [emptyOption, ...mapped];
  }

  private async fetchCompanies(activeOnly: boolean): Promise<void> {
    const seq = ++this.companiesSeq;
    try {
      const items = await listAllPages(listCompanies, {
        status: activeOnly ? 'ACTIVE' : undefined,
        limit: STAFF_LIMITS.pageSize,
        sortBy: 'name',
        sortDir: 'ASC',
      });
      if (seq !== this.companiesSeq) return;
      this.companies.set(items);
      if (
        items.length === 1 &&
        !this.value().companyId &&
        !this.readonly() &&
        !this.disabledLevels().includes('company')
      ) {
        this.value.update((prev) => ({
          ...prev,
          companyId: items[0].id,
          branchId: null,
          departmentId: null,
          teamId: null,
        }));
      }
    } catch {
      if (seq !== this.companiesSeq) return;
      this.companies.set([]);
    }
  }

  private async fetchBranches(companyId: string, activeOnly: boolean): Promise<void> {
    const seq = ++this.branchesSeq;
    try {
      const items = await listAllPages(listBranches, {
        companyId,
        status: activeOnly ? 'ACTIVE' : undefined,
        limit: STAFF_LIMITS.pageSize,
        sortBy: 'name',
        sortDir: 'ASC',
      });
      if (seq !== this.branchesSeq) return;
      this.branches.set(items);
      if (
        items.length === 1 &&
        !this.value().branchId &&
        !this.readonly() &&
        !this.disabledLevels().includes('branch')
      ) {
        this.value.update((prev) => ({
          ...prev,
          branchId: items[0].id,
          departmentId: null,
          teamId: null,
        }));
      }
    } catch {
      if (seq !== this.branchesSeq) return;
      this.branches.set([]);
    }
  }

  private async fetchDepartments(branchId: string, activeOnly: boolean): Promise<void> {
    const seq = ++this.departmentsSeq;
    try {
      const items = await listAllPages(listDepartments, {
        branchId,
        status: activeOnly ? 'ACTIVE' : undefined,
        limit: STAFF_LIMITS.pageSize,
        sortBy: 'name',
        sortDir: 'ASC',
      });
      if (seq !== this.departmentsSeq) return;
      this.departments.set(items);
      if (
        items.length === 1 &&
        !this.value().departmentId &&
        !this.readonly() &&
        !this.disabledLevels().includes('department')
      ) {
        this.value.update((prev) => ({
          ...prev,
          departmentId: items[0].id,
          teamId: null,
        }));
      }
    } catch {
      if (seq !== this.departmentsSeq) return;
      this.departments.set([]);
    }
  }

  private async fetchTeams(departmentId: string, activeOnly: boolean): Promise<void> {
    const seq = ++this.teamsSeq;
    try {
      const items = await listAllPages(listTeams, {
        departmentId,
        status: activeOnly ? 'ACTIVE' : undefined,
        limit: STAFF_LIMITS.pageSize,
        sortBy: 'name',
        sortDir: 'ASC',
      });
      if (seq !== this.teamsSeq) return;
      this.teams.set(items);
      if (
        items.length === 1 &&
        !this.value().teamId &&
        !this.readonly() &&
        !this.disabledLevels().includes('team')
      ) {
        this.value.update((prev) => ({
          ...prev,
          teamId: items[0].id,
        }));
      }
    } catch {
      if (seq !== this.teamsSeq) return;
      this.teams.set([]);
    }
  }
}
