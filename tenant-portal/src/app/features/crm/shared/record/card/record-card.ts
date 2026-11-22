import { Component, computed, input, model, output, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerChevronDown, tablerEye, tablerStar, tablerUserCircle } from '@ng-icons/tabler-icons';
import { tablerStarFill } from '@ng-icons/tabler-icons/fill';
import { TranslocoPipe } from '@jsverse/transloco';
import { provideTranslocoScopeInherited } from '../../../../../core/i18n/transloco-scope';
import {
  ActionItem,
  ActionSelection,
  ActionsMenu,
} from '../../../../../shared/ui/actions-menu/actions-menu';
import {
  CARD_COLORS,
  CardColor,
  DUE_BADGE,
  DueBucket,
  RecordCardOwner,
  STARS,
  ownerInitials,
} from './record-card.model';

@Component({
  selector: 'app-record-card',
  imports: [NgIcon, TranslocoPipe, ActionsMenu],
  viewProviders: [provideTranslocoScopeInherited({ scope: 'record-list', alias: 'recordList' })],
  providers: [
    provideIcons({
      tablerChevronDown,
      tablerEye,
      tablerStar,
      tablerStarFill,
      tablerUserCircle,
    }),
  ],
  templateUrl: './record-card.html',
  host: { class: 'block h-full' },
})
export class RecordCard {
  readonly title = input.required<string>();
  readonly subtitle = input<string | null>(null);
  readonly typeIcon = input.required<string>();
  readonly typeTile = input.required<string>();
  readonly typeLabel = input('');
  readonly color = input<CardColor | null>(null);
  readonly rating = input<number | null>(0);
  readonly ratingEditable = input(false);
  readonly dueBucket = input<DueBucket | null>(null);
  readonly showDue = input(true);
  readonly owner = input<RecordCardOwner | null>(null);
  readonly actions = input<ActionItem[]>([]);
  readonly actionsLabel = input<string | null>(null);
  readonly viewLabel = input<string | null>(null);
  readonly detailed = input(false);
  readonly expanded = model(false);

  readonly open = output<void>();
  readonly rate = output<number>();
  readonly recolor = output<CardColor | null>();
  readonly action = output<ActionSelection>();
  readonly due = output<void>();

  protected readonly stars = STARS;
  protected readonly hovered = signal<number | null>(null);
  protected readonly currentRating = computed(() => this.rating() ?? 0);
  protected readonly displayRating = computed(() => this.hovered() ?? this.currentRating());
  protected readonly resolvedDue = computed<DueBucket | 'NONE'>(() => this.dueBucket() ?? 'NONE');
  protected readonly dueClass = computed(() => DUE_BADGE[this.resolvedDue()]);
  protected readonly edgeClass = computed(() => {
    const color = this.color();
    return color ? CARD_COLORS[color] : null;
  });
  protected readonly ownerText = computed(() => this.owner()?.name.trim() ?? '');
  protected readonly initials = computed(() => ownerInitials(this.ownerText()));
  protected readonly showDetails = computed(() => this.detailed() || this.expanded());

  protected chooseRating(star: number): void {
    if (!this.ratingEditable()) return;
    this.hovered.set(null);
    this.rate.emit(star === this.currentRating() ? 0 : star);
  }

  protected onMenuSelect(selection: ActionSelection): void {
    if (selection.id === 'color') {
      this.recolor.emit((selection.value as CardColor | null) ?? null);
      return;
    }
    this.action.emit(selection);
  }
}
