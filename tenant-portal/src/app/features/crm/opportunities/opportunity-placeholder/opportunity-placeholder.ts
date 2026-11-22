import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerTarget } from '@ng-icons/tabler-icons';
import { ApiError } from '../../settings/shared/settings-api';
import { OPPORTUNITY_ERROR_KEYS, getOpportunity, opportunitySharedErrorKey } from '../opportunities.api';
import { opportunityRef, type OpportunityRow } from '../opportunities.model';

@Component({
  selector: 'app-opportunity-placeholder',
  imports: [TranslocoPipe, NgIcon],
  providers: [provideIcons({ tablerTarget })],
  templateUrl: './opportunity-placeholder.html',
  host: { class: 'flex flex-1 flex-col gap-12 p-12' },
})
export class OpportunityPlaceholder {
  private readonly route = inject(ActivatedRoute);

  readonly id = input<string>();

  protected readonly isCreate = this.route.snapshot.routeConfig?.path === 'new';
  protected readonly loading = signal(false);
  protected readonly opportunity = signal<OpportunityRow | null>(null);
  protected readonly errorKey = signal<string | null>(null);

  protected readonly reference = computed(() => {
    const opp = this.opportunity();
    return opp ? opportunityRef(opp.id) : null;
  });

  private requestSeq = 0;

  constructor() {
    effect(() => {
      const oppId = this.id();
      const seq = ++this.requestSeq;

      if (!oppId) {
        this.loading.set(false);
        this.opportunity.set(null);
        this.errorKey.set(null);
        return;
      }

      this.loading.set(true);
      this.opportunity.set(null);
      this.errorKey.set(null);

      void getOpportunity(oppId)
        .then((row) => {
          if (seq !== this.requestSeq) return;
          this.opportunity.set(row);
        })
        .catch((error: unknown) => {
          if (seq !== this.requestSeq) return;
          const code = error instanceof ApiError ? error.code : null;
          const key = code ? (OPPORTUNITY_ERROR_KEYS[code] ?? opportunitySharedErrorKey(code)) : null;
          this.errorKey.set(key ?? 'opportunities.errors.generic');
        })
        .finally(() => {
          if (seq === this.requestSeq) {
            this.loading.set(false);
          }
        });
    });
  }
}
