import { Component, computed, inject, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerBook } from '@ng-icons/tabler-icons';
import { tablerStarFill } from '@ng-icons/tabler-icons/fill';
import { LanguageState } from '../../../../core/i18n/language';
import { ActionsMenu, type ActionItem, type ActionSelection } from '../../../../shared/ui/actions-menu/actions-menu';
import { VersionStatusBadge } from '../governance-shared/version-status-badge/version-status-badge';
import type { PriceBookListItem } from '../pricing.model';
import { bookGovernanceState } from '../pricing.service';

const EN_INT = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

@Component({
  selector: 'app-price-book-card',
  imports: [NgIcon, TranslocoPipe, ActionsMenu, VersionStatusBadge],
  providers: [provideIcons({ tablerBook, tablerStarFill })],
  templateUrl: './price-book-card.html',
  host: { class: 'block h-full min-w-0' },
})
export class PriceBookCard {
  protected readonly lang = inject(LanguageState).current;

  readonly book = input.required<PriceBookListItem>();
  readonly actions = input.required<ActionItem[]>();

  readonly open = output<PriceBookListItem>();
  readonly action = output<ActionSelection>();

  protected readonly displayName = computed(() => {
    const b = this.book();
    const language = this.lang();
    return b.localizedNames[language] || b.localizedNames['en'] || b.localizedNames['ar'] || b.name || b.code;
  });

  protected readonly governanceState = computed(() => bookGovernanceState(this.book()));
  protected readonly linesCount = computed(() => EN_INT.format(this.book().entryCount));
  protected readonly promotionsCount = computed(() => EN_INT.format(this.book().promotionCount));

  protected onCardKeydown(event: KeyboardEvent): void {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.open.emit(this.book());
    }
  }
}
