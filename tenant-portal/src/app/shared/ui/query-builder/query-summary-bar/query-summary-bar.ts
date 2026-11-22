import { Component, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerFilterCog, tablerPencil } from '@ng-icons/tabler-icons';
import { Button } from '../../button/button';

@Component({
  selector: 'ui-query-summary-bar',
  imports: [NgIcon, TranslocoPipe, Button],
  providers: [provideIcons({ tablerFilterCog, tablerPencil })],
  templateUrl: './query-summary-bar.html',
  host: { class: 'block min-w-0' },
})
export class QuerySummaryBar {
  readonly title = input.required<string>();
  readonly count = input.required<number>();
  readonly groups = input.required<number>();
  readonly summaryText = input.required<string>();
  readonly dirty = input(false);
  readonly disabled = input(false);

  readonly expand = output<void>();
  readonly clear = output<void>();
  readonly apply = output<void>();
}
