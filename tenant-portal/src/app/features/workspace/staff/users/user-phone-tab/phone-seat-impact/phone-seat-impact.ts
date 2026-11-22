import { Component, computed, effect, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerAlertTriangle, tablerPhone } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../../core/i18n/language';
import { Button } from '../../../../../../shared/ui/button/button';
import { PhoneSeats } from '../../../shared/staff-phone.model';
import { formatStaffDate } from '../../users-page/users.model';

@Component({
  selector: 'app-phone-seat-impact',
  imports: [RouterLink, NgIcon, TranslocoPipe, Button],
  providers: [
    provideTranslocoScope(
      'settings',
      'staff',
      { scope: 'seats', alias: 'seats' },
      { scope: 'staff-user-phone', alias: 'userPhone' },
    ),
    provideIcons({ tablerPhone, tablerAlertTriangle }),
  ],
  templateUrl: './phone-seat-impact.html',
  host: { class: 'block' },
})
export class PhoneSeatImpact {
  private readonly language = inject(LanguageState).current;

  readonly seats = input<PhoneSeats | null>(null);
  readonly delta = input<-1 | 0 | 1>(0);
  readonly canBuy = input(false);
  readonly loading = input(false);
  readonly error = input(false);

  readonly blocking = output<boolean>();

  protected readonly visible = computed(() => this.delta() !== 0);
  protected readonly isShort = computed(() => {
    const s = this.seats();
    return this.delta() === 1 && !this.error() && s !== null && s.available === 0;
  });
  protected readonly usedAfter = computed(() => {
    const s = this.seats();
    return s ? Math.max(0, s.occupied + this.delta()) : 0;
  });
  protected readonly formattedDelta = computed(() => (this.delta() > 0 ? '+1' : '\u22121'));

  constructor() {
    effect(() => {
      this.blocking.emit(this.isShort());
    });
  }

  protected formatDate(iso: string): string {
    return formatStaffDate(iso, this.language());
  }
}
