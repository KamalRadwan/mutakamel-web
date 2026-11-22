import { Component, computed, inject, input } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { simpleTelegram, simpleWhatsapp } from '@ng-icons/simple-icons';
import { tablerPhone } from '@ng-icons/tabler-icons';
import { TranslocoPipe } from '@jsverse/transloco';
import { PhoneState } from '../../../core/phone/phone';
import { normalizePhone, phoneDigits } from '../../ui/phone-input/phone';
import { CrmCallSettings } from './crm-call-settings';

export type PhoneActionSourceType = 'LEAD' | 'CUSTOMER_PROFILE' | 'PARTY' | 'OPPORTUNITY';

export interface PhoneActionSource {
  type: PhoneActionSourceType;
  id: string;
  label: string;
}

@Component({
  selector: 'app-phone-actions',
  imports: [NgIcon, TranslocoPipe],
  providers: [provideIcons({ tablerPhone, simpleWhatsapp, simpleTelegram })],
  host: { class: 'inline-flex items-center gap-4' },
  templateUrl: './phone-actions.html',
})
export class PhoneActions {
  private readonly phoneState = inject(PhoneState);
  private readonly crmCallSettings = inject(CrmCallSettings);

  readonly phone = input.required<string>();
  readonly disabled = input<boolean | undefined>(undefined);
  readonly showNumber = input<boolean | undefined>(undefined);
  readonly source = input<PhoneActionSource | null>(null);
  readonly crm = input(false);

  protected readonly cleanPhone = computed(() => normalizePhone(this.phone()));
  protected readonly displayPhone = computed(() => this.cleanPhone() || this.phone());
  protected readonly digits = computed(() => this.cleanPhone().replace(/\D/g, ''));
  protected readonly renderNumber = computed(() => this.showNumber() ?? this.disabled() === undefined);
  protected readonly isDisabled = computed(() => Boolean(this.disabled()) || phoneDigits(this.cleanPhone()) < 5);

  protected readonly usable = computed(() => {
    const conn = this.phoneState.connection();
    return (
      this.phoneState.visible() &&
      this.phoneState.configured() &&
      conn !== 'error' &&
      conn !== 'offline'
    );
  });

  protected readonly callMode = computed<'tel' | 'call' | 'busy'>(() => {
    if (!this.usable()) return 'tel';
    if (this.crm() && !this.crmCallSettings.clickToCallEnabled()) return 'tel';
    return this.phoneState.busy() ? 'busy' : 'call';
  });

  protected callWithPhone(): void {
    if (this.isDisabled()) return;
    void this.phoneState.call(this.phone(), this.source());
  }
}
