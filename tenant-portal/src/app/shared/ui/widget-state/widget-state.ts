import { Component, computed, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerArchive,
  tablerChartBarOff,
  tablerDatabaseOff,
  tablerLock,
  tablerRefresh,
} from '@ng-icons/tabler-icons';
import { Button } from '../button/button';

export type WidgetStateKind =
  | 'loading'
  | 'empty'
  | 'timeout'
  | 'failed'
  | 'unavailable'
  | 'denied'
  | 'retired';

@Component({
  selector: 'ui-widget-state',
  imports: [NgIcon, Button],
  providers: [
    provideIcons({
      tablerChartBarOff,
      tablerRefresh,
      tablerDatabaseOff,
      tablerLock,
      tablerArchive,
    }),
  ],
  templateUrl: './widget-state.html',
  host: {
    '[class]': 'hostClasses()',
    '[attr.aria-busy]': "kind() === 'loading' ? 'true' : null",
  },
})
export class WidgetState {
  readonly kind = input.required<WidgetStateKind>();
  readonly text = input('');
  readonly actionLabel = input('');
  readonly secondaryLabel = input('');

  readonly action = output<void>();
  readonly secondary = output<void>();

  protected readonly hostClasses = computed(() =>
    this.kind() === 'loading'
      ? 'absolute inset-0 flex flex-col gap-8 pt-8'
      : 'absolute inset-0 flex flex-col items-center justify-center gap-6 px-8 text-center',
  );
}
