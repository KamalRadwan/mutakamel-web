import { NgOptimizedImage } from '@angular/common';
import { Component, computed, inject, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerApps,
  tablerDatabase,
  tablerHeadset,
  tablerHourglassHigh,
  tablerShieldCheck,
  tablerWorld,
  tablerWorldOff,
} from '@ng-icons/tabler-icons';
import { ThemeState } from '../../core/theme/theme';
import { Button } from '../../shared/ui/button/button';
import { Preferences } from '../../shared/ui/preferences/preferences';

export type StatusScreenTone = 'gray' | 'blue';

export interface StatusScreenNote {
  readonly icon: string;
  readonly text: string;
  readonly ltr?: boolean;
}

/** Full-viewport, centred status screen used before the app shell exists (tenant gone, tenant being set up). */
@Component({
  selector: 'app-status-screen',
  imports: [NgOptimizedImage, NgIcon, TranslocoPipe, Button, Preferences],
  providers: [
    provideIcons({
      tablerApps,
      tablerDatabase,
      tablerHeadset,
      tablerHourglassHigh,
      tablerShieldCheck,
      tablerWorld,
      tablerWorldOff,
    }),
  ],
  templateUrl: './status-screen.html',
  styleUrls: ['./status-screen.css', '../../features/auth/shared/auth-card/auth-preferences.css'],
  host: { class: 'block' },
})
export class StatusScreen {
  protected readonly theme = inject(ThemeState);

  readonly icon = input.required<string>();
  readonly tone = input<StatusScreenTone>('gray');
  readonly spin = input(false);
  readonly title = input.required<string>();
  readonly text = input('');
  readonly notes = input<readonly StatusScreenNote[]>([]);
  readonly actionLabel = input('');
  readonly busy = input(false);

  readonly action = output<void>();

  protected readonly tile = computed(() => (this.tone() === 'blue' ? 'bg-icon-blue' : 'bg-icon-gray'));
}
