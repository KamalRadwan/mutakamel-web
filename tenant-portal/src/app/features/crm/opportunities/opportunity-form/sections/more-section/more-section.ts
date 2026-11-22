import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerExternalLink, tablerTrendingUp } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../../core/i18n/language';
import { Field } from '../../../../../../shared/ui/field/field';
import { RECORD_PAGE_GRID, RecordLayout } from '../../../../../../shared/ui/record-layout/record-layout';
import { CrmModules } from '../../../../shared/crm-modules/crm-modules';
import { opportunityRef, type OpportunityRow } from '../../../opportunities.model';

@Component({
  selector: 'app-opp-more-section',
  imports: [RouterLink, NgIcon, TranslocoPipe, Field],
  providers: [
    provideTranslocoScope('opportunities', { scope: 'opportunity-form', alias: 'oppForm' }),
    provideIcons({ tablerExternalLink, tablerTrendingUp }),
  ],
  templateUrl: './more-section.html',
  host: { class: 'block min-w-0' },
})
export class MoreSection {
  private static nextId = 0;
  protected readonly uid = `opp-more-${++MoreSection.nextId}`;

  private readonly language = inject(LanguageState).current;
  protected readonly crmModules = inject(CrmModules);

  readonly row = input<OpportunityRow | null>(null);
  readonly mode = input<'create' | 'edit' | 'view'>('create');
  readonly layout = input<RecordLayout>('modal');

  protected readonly pageGrid = RECORD_PAGE_GRID;

  protected readonly reference = computed(() => {
    const r = this.row();
    return r ? opportunityRef(r.id) : '';
  });

  protected readonly showFromLead = computed(() => {
    const r = this.row();
    return Boolean(r?.leadId && this.crmModules.leadsEnabled());
  });

  protected readonly createdAtText = computed(() => this.formatDateTime(this.row()?.createdAt ?? null));
  protected readonly updatedAtText = computed(() => this.formatDateTime(this.row()?.updatedAt ?? null));

  constructor() {
    void this.crmModules.ensureLoaded();
  }

  private formatDateTime(raw: string | null): string {
    if (!raw) return '—';
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return '—';
    return new Intl.DateTimeFormat(`${this.language()}-u-nu-latn`, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(parsed);
  }
}
