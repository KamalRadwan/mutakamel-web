import { Component, type Signal, computed, inject, input } from '@angular/core';
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { tablerLock } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Badge } from '../../../../../shared/ui/badge/badge';
import { formatDate } from '../../../shared/trade-format';

const TIME_24H = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

@Component({
  selector: 'app-price-lock-chip',
  imports: [TranslocoPipe, Badge],
  providers: [
    provideTranslocoScope({ scope: 'trade-shared', alias: 'tradeShared' }, { scope: 'trade-documents-actions', alias: 'tda' }),
    provideIcons({ tablerLock }),
  ],
  template: `
    @if (visible()) {
      <ui-badge [tone]="expired() ? 'danger' : 'warning'" icon="tablerLock">
        @if (expired()) {
          {{ 'tda.priceLock.expired' | transloco }}
        } @else {
          {{ 'tda.priceLock.heldUntil' | transloco: { dateTime: formattedExpiry() } }}
        }
      </ui-badge>
    }
  `,
  host: { class: 'inline-flex' },
})
export class PriceLockChip {
  private readonly lang = inject(LanguageState).current;

  readonly expiresAt = input<string | null>(null);
  readonly now = input.required<Signal<Date> | Date>();

  private readonly expiresMs = computed<number | null>(() => {
    const raw = this.expiresAt();
    if (!raw) return null;
    const ms = Date.parse(raw);
    return Number.isFinite(ms) ? ms : null;
  });

  protected readonly visible = computed(() => this.expiresMs() !== null);

  protected readonly expired = computed(() => {
    const ms = this.expiresMs();
    if (ms === null) return false;
    const rawNow = this.now();
    const nowDate = typeof rawNow === 'function' ? rawNow() : rawNow;
    return nowDate.getTime() > ms;
  });

  protected readonly formattedExpiry = computed(() => {
    const raw = this.expiresAt();
    const ms = this.expiresMs();
    if (!raw || ms === null) return '';
    return `${formatDate(raw, this.lang())} ${TIME_24H.format(new Date(ms))}`;
  });
}
