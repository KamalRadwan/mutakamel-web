import { Component, computed, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerX } from '@ng-icons/tabler-icons';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { Button } from '../../../../../shared/ui/button/button';
import type { CrossFilter } from '../../../../../shared/widgets/dashboard/analytics.model';
import { selectScopeTranslation } from '../../../../../shared/widgets/dashboard/scope-translation';

export interface CrossFilterSelection extends CrossFilter {
  labels: Record<string, string>;
}

interface CrossFilterChipView {
  index: number;
  field: string;
  value: string;
  fieldLabel: string;
  valueLabel: string;
  display: string;
}

@Component({
  selector: 'app-cross-filter-chips',
  imports: [TranslocoPipe, NgIcon, Button],
  viewProviders: [
    provideTranslocoScope({ scope: 'crm-dash-filters', alias: 'dashFilters' }),
    provideIcons({ tablerX }),
  ],
  templateUrl: './cross-filter-chips.html',
  host: { class: 'block min-w-0' },
})
export class CrossFilterChips {
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly filtersScope = toSignal(selectScopeTranslation(this.transloco, 'crm-dash-filters', 'dashFilters'));

  readonly items = input.required<readonly CrossFilterSelection[]>();
  readonly remove = output<{ index: number; value: string }>();
  readonly clear = output<void>();

  protected readonly chips = computed<CrossFilterChipView[]>(() => {
    this.i18n();
    this.filtersScope();
    const result: CrossFilterChipView[] = [];
    const list = this.items();
    for (let index = 0; index < list.length; index++) {
      const sel = list[index];
      const fieldKey =
        sel.field === 'branch' || sel.field === 'company' || sel.field === 'owner'
          ? `dashFilters.crossField.${sel.field}`
          : sel.field;
      const fieldLabel = sel.field ? this.transloco.translate(fieldKey) : '';
      for (const value of sel.values) {
        const valueLabel = sel.labels[value] ?? value;
        const display = `${fieldLabel}: ${valueLabel}`;
        result.push({
          index,
          field: sel.field,
          value,
          fieldLabel,
          valueLabel,
          display,
        });
      }
    }
    return result;
  });
}
