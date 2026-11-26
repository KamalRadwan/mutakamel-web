import { Component, computed, inject, input, model } from '@angular/core';
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';
import { Dropdown, DropdownOption } from '../../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../../shared/ui/field/field';
import { Option } from '../record-fields.model';
import { TenantScopeState } from '../../../../../../core/scope/tenant-scope';

@Component({
  selector: 'app-scope-fields',
  imports: [TranslocoPipe, Dropdown, Field],
  providers: [provideTranslocoScope({ scope: 'record-fields', alias: 'recordFields' })],
  templateUrl: './scope-fields.html',
  host: {
    '[class]': "layout() === 'page' ? 'contents' : 'grid grid-cols-1 gap-y-8 min-w-0'",
  },
})
export class ScopeFields {
  private static nextId = 0;
  private readonly tenant = inject(TenantScopeState);
  protected readonly uid = `rf-scope-${++ScopeFields.nextId}`;

  readonly companyId = model<string | null>(null);
  readonly branchId = model<string | null>(null);
  readonly companies = input<readonly Option[]>([]);
  readonly branches = input<readonly Option[]>([]);
  readonly locked = input(false);
  readonly layout = input<'modal' | 'page'>('modal');
  readonly errors = input<Partial<Record<string, string | null>>>({});

  protected readonly companyOptions = computed<DropdownOption<string>[]>(() =>
    this.companies().map((item) => ({
      value: item.id,
      label: item.label,
      disabled: item.disabled,
    })),
  );

  protected readonly branchOptions = computed<DropdownOption<string>[]>(() =>
    this.branches().map((item) => ({
      value: item.id,
      label: item.label,
      disabled: item.disabled,
    })),
  );

  protected readonly companyLabel = computed(() => {
    const id = this.companyId();
    if (!id) return '';
    return this.companies().find((item) => item.id === id)?.label ?? '';
  });

  protected readonly branchLabel = computed(() => {
    const id = this.branchId();
    if (!id) return '';
    return this.branches().find((item) => item.id === id)?.label ?? '';
  });

  protected readonly companyError = computed(() => this.errors()['companyId'] ?? this.errors()['company'] ?? null);
  protected readonly branchError = computed(() => this.errors()['branchId'] ?? this.errors()['branch'] ?? null);

  private readonly singleCompanySelected = computed(() => {
    const me = this.tenant.me();
    if (!me || me.accessScope?.companiesTruncated) return false;
    const companies = new Set([
      ...(me.accessibleCompanies ?? []),
      ...(me.accessibleBranchCompanies ?? []).map((entry) => entry.companyId),
    ]);
    const companyId = this.companyId();
    return !!companyId && companies.size === 1 && companies.has(companyId);
  });
  protected readonly showCompany = computed(() => !this.singleCompanySelected() || !!this.companyError());
  protected readonly showBranch = computed(() => {
    const companyId = this.companyId();
    if (!companyId || !this.singleCompanySelected() || this.tenant.me()?.accessScope?.branchesTruncated ||
        this.branchError()) return true;
    const branches = new Set(this.tenant.me()?.accessibleBranches ?? []);
    const branchId = this.branchId();
    return !branchId || branches.size !== 1 || !branches.has(branchId);
  });

  protected onCompanySelect(value: string): void {
    this.companyId.set(value || null);
  }

  protected onBranchSelect(value: string): void {
    this.branchId.set(value || null);
  }
}
