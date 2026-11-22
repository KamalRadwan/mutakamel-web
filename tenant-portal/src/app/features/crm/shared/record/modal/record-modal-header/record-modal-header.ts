import { Component, computed, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { provideTranslocoScopeInherited } from '../../../../../../core/i18n/transloco-scope';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerBuilding,
  tablerChevronLeft,
  tablerChevronRight,
  tablerTarget,
  tablerUser,
  tablerUserPlus,
  tablerUsers,
  tablerX,
} from '@ng-icons/tabler-icons';
import { RecordNavPosition } from '../../nav/record-nav';

const TILE_CLASSES: Record<string, string> = {
  'bg-icon-blue': 'bg-icon-blue',
  'bg-icon-navy': 'bg-icon-navy',
  'bg-icon-teal': 'bg-icon-teal',
  'bg-icon-green': 'bg-icon-green',
  'bg-icon-orange': 'bg-icon-orange',
  'bg-icon-red': 'bg-icon-red',
  'bg-icon-violet': 'bg-icon-violet',
  'bg-icon-gray': 'bg-icon-gray',
  'icon-blue': 'bg-icon-blue',
  'icon-navy': 'bg-icon-navy',
  'icon-teal': 'bg-icon-teal',
  'icon-green': 'bg-icon-green',
  'icon-orange': 'bg-icon-orange',
  'icon-red': 'bg-icon-red',
  'icon-violet': 'bg-icon-violet',
  'icon-gray': 'bg-icon-gray',
  blue: 'bg-icon-blue',
  navy: 'bg-icon-navy',
  teal: 'bg-icon-teal',
  green: 'bg-icon-green',
  orange: 'bg-icon-orange',
  red: 'bg-icon-red',
  violet: 'bg-icon-violet',
  gray: 'bg-icon-gray',
};

/** Shared quick-modal header displaying type tile, title, subtitle, list navigation, related badges slot, and close action. */
@Component({
  selector: 'app-record-modal-header',
  imports: [NgIcon, TranslocoPipe],
  viewProviders: [provideTranslocoScopeInherited({ scope: 'record-modal', alias: 'recordModal' })],
  providers: [
    provideIcons({
      tablerChevronLeft,
      tablerChevronRight,
      tablerX,
      tablerUserPlus,
      tablerUsers,
      tablerTarget,
      tablerBuilding,
      tablerUser,
    }),
  ],
  templateUrl: './record-modal-header.html',
  host: { class: 'block shrink-0' },
})
export class RecordModalHeader {
  readonly typeIcon = input('');
  readonly typeTile = input('bg-icon-blue');
  readonly typeTitle = input('');
  readonly subtitle = input<string | null>(null);
  readonly position = input<RecordNavPosition | null>(null);
  readonly updating = input(false);
  readonly showClose = input(true);
  readonly prevLabel = input<string | null>(null);
  readonly nextLabel = input<string | null>(null);
  readonly closeLabel = input<string | null>(null);

  readonly prev = output<void>();
  readonly next = output<void>();
  readonly close = output<void>();

  protected readonly tileClass = computed(
    () => TILE_CLASSES[this.typeTile()] ?? (this.typeTile() || 'bg-icon-blue'),
  );
  protected readonly resolvedSubtitle = computed(() => this.subtitle()?.trim() ?? '');
}
