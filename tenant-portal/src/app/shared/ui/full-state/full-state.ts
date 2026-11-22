import { Component, computed, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerFileSearch, tablerHourglass, tablerLock, tablerRefresh } from '@ng-icons/tabler-icons';
import { Button } from '../button/button';

export type FullStateKind = 'not-found' | 'forbidden' | 'load-failure' | 'provisioning';

const KIND_CONFIG: Record<FullStateKind, { tile: string; icon: string }> = {
  'not-found': { tile: 'bg-icon-gray', icon: 'tablerFileSearch' },
  forbidden: { tile: 'bg-icon-orange', icon: 'tablerLock' },
  'load-failure': { tile: 'bg-icon-red', icon: 'tablerRefresh' },
  provisioning: { tile: 'bg-icon-gray', icon: 'tablerHourglass' },
};

@Component({
  selector: 'ui-full-state',
  imports: [NgIcon, Button],
  providers: [provideIcons({ tablerFileSearch, tablerHourglass, tablerLock, tablerRefresh })],
  templateUrl: './full-state.html',
  host: { class: 'flex size-full min-h-0 flex-1 items-center justify-center p-16' },
})
export class FullState {
  readonly kind = input.required<FullStateKind>();
  readonly title = input.required<string>();
  readonly text = input('');
  readonly actionLabel = input('');
  readonly busy = input(false);

  readonly action = output<void>();

  protected readonly config = computed(() => KIND_CONFIG[this.kind()]);
}
