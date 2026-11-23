import { Component, computed, effect, inject, input } from '@angular/core';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerChevronUp, tablerFilterCog, tablerPlus } from '@ng-icons/tabler-icons';
import { analyze } from '../../../../shared/query-builder/query-analyzer';
import { normalize } from '../../../../shared/query-builder/query-normalize';
import { Button } from '../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { QueryBuilder } from '../../../../shared/ui/query-builder/query-builder/query-builder';
import { QueryCondition } from '../../../../shared/ui/query-builder/query-condition/query-condition';
import { QueryGroup } from '../../../../shared/ui/query-builder/query-group/query-group';
import { QuerySummaryBar } from '../../../../shared/ui/query-builder/query-summary-bar/query-summary-bar';
import { OpportunitySearchBody } from '../opportunities.model';
import { opportunityConditions, opportunityFilterIssues } from './opportunity-search-errors';

/** Reuse the approved builder template and editing behavior; only add server validation issues. */
@Component({
  selector: 'app-opportunity-search-builder',
  imports: [
    NgIcon,
    TranslocoPipe,
    Button,
    ConfirmDialog,
    QueryCondition,
    QueryGroup,
    QuerySummaryBar,
  ],
  viewProviders: [provideTranslocoScope({ scope: 'ui-query-builder', alias: 'qb' })],
  providers: [provideIcons({ tablerFilterCog, tablerChevronUp, tablerPlus })],
  templateUrl: '../../../../shared/ui/query-builder/query-builder/query-builder.html',
})
export class OpportunitySearchBuilder extends QueryBuilder {
  readonly serverError = input<unknown>(null);
  readonly body = input<OpportunitySearchBody>({ branchId: '' });
  private readonly scope = inject(TenantScopeState);
  private readonly serverIssues = computed(() =>
    opportunityFilterIssues(
      this.serverError(),
      this.applied(),
      this.body(),
      this.timeZone(),
      this.scope.me()?.id,
    ),
  );
  protected override readonly issues = computed(() => {
    const draft = this.draft();
    const original = new Map(
      opportunityConditions(this.applied()).map((condition) => [
        condition.id,
        JSON.stringify(condition),
      ]),
    );
    const unchanged = new Set(
      opportunityConditions(draft)
        .filter((condition) => original.get(condition.id) === JSON.stringify(condition))
        .map((condition) => condition.id),
    );
    return [
      ...analyze(normalize(draft, this.fields()), this.fields(), undefined, this.timeZone()),
      ...this.serverIssues().filter((issue) => issue.nodeIds.some((id) => unchanged.has(id))),
    ];
  });

  constructor() {
    super();
    effect(() => {
      if (!this.serverIssues().length) return;
      this.applyAttempted.set(true);
      this.expanded.set(true);
    });
  }
}
