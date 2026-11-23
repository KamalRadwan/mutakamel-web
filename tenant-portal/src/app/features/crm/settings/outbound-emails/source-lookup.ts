import { Injector, computed, inject, linkedSignal, runInInjectionContext, signal } from '@angular/core';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { WorkspaceLookups } from '../../../../shared/widgets/workspace-lookups/workspace-lookups.api';
import { WorkspaceBranch } from '../../../../shared/widgets/workspace-lookups/workspace-lookups.model';
import { crmQueries } from '../../shared/crm-http';
import { requestEmailData } from './outbound-email-request.api';
import { anyGrant, branchGrants } from '../shared/settings-access';
import { CrmSourceRecord, EMAIL_SOURCE_TYPES, EmailSourceType } from './outbound-emails.model';

const sourceRoutes: Record<EmailSourceType, { route: string; field: string; key: string }> = {
  LEAD: { route: 'leads', field: 'lead', key: 'crm.leads.read' },
  CUSTOMER_PROFILE: { route: 'customer-profiles', field: 'customer', key: 'crm.customer_profiles.read' },
  OPPORTUNITY: { route: 'opportunities', field: 'opportunity', key: 'crm.opportunities.read' },
};

export function searchSourceRecords(type: EmailSourceType, branchId: string, text: string, page: number): Promise<CrmSourceRecord[]> {
  const { route, field } = sourceRoutes[type];
  const body = { branchId, search: text.trim(), searchField: field, page, limit: 25 };
  return crmQueries().fetchQuery({
    queryKey: ['crm-settings', 'outbound-emails', 'sources', type, body],
    queryFn: async () => {
      const result = await requestEmailData<{ items: { id: string; displayName: string; title: string }[] }>(
        `/${route}/search`, body);
      return result.items.map((row) => ({ id: row.id, type,
        name: type === 'OPPORTUNITY' ? row.title : row.displayName }));
    },
  });
}

/** Shared branch and permission state for the log filter and compose picker. */
export class SourceLookup {
  private readonly injector = inject(Injector);
  private readonly scope = inject(TenantScopeState);
  private readonly lookups = inject(WorkspaceLookups);
  readonly branchId = linkedSignal(() => this.scope.selection()?.branchId ?? null);
  readonly branches = signal<WorkspaceBranch[]>([]);
  readonly canChooseBranch = computed(() => runInInjectionContext(this.injector, () => anyGrant('org.branch.read')));

  types(): EmailSourceType[] {
    return EMAIL_SOURCE_TYPES.filter((type) => {
      const grants = this.grants(type);
      return grants === 'ALL' || (!!this.branchId() && grants.has(this.branchId()!));
    });
  }

  branchesFor(type: EmailSourceType): WorkspaceBranch[] {
    const grants = this.grants(type);
    return this.branches().filter((branch) => grants === 'ALL' ||
      this.scope.me()?.accessScope?.branchesTruncated || grants.has(branch.id));
  }

  availableBranches(): WorkspaceBranch[] {
    return this.branches().filter((branch) => EMAIL_SOURCE_TYPES.some((type) => this.branchesFor(type).includes(branch)));
  }

  async loadBranches(): Promise<void> {
    if (this.canChooseBranch()) this.branches.set(await this.lookups.allBranches({ status: 'ACTIVE' }));
  }

  private grants(type: EmailSourceType): 'ALL' | Set<string> {
    return runInInjectionContext(this.injector, () => branchGrants(sourceRoutes[type].key));
  }
}
