import { Component, computed, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAdjustments,
  tablerArrowLeft,
  tablerChevronDown,
  tablerRefresh,
} from '@ng-icons/tabler-icons';
import { PhoneState } from '../../../core/phone/phone';

@Component({
  selector: 'app-phone-header',
  imports: [TranslocoPipe, NgIcon],
  providers: [
    provideIcons({
      tablerAdjustments,
      tablerArrowLeft,
      tablerChevronDown,
      tablerRefresh,
    }),
  ],
  templateUrl: './phone-header.html',
})
export class PhoneHeader {
  protected readonly phone = inject(PhoneState);

  protected readonly dotClass = computed(() => {
    if (this.phone.ringing()) return 'bg-icon-violet';
    const leg = this.phone.focusedLeg() ?? this.phone.legs()[0];
    if (this.phone.busy() && leg?.held) return 'bg-warning';
    const conn = this.phone.connection();
    const code = this.phone.status().code;
    if (this.phone.paused() || !this.phone.configured() || conn === 'offline' || conn === 'idle') {
      return 'bg-status-none';
    }
    if (conn === 'registered') return 'bg-success';
    if (conn === 'loading' || conn === 'ready' || conn === 'connecting' || code === 'failingOver') {
      return 'bg-warning';
    }
    return 'bg-danger';
  });
}
