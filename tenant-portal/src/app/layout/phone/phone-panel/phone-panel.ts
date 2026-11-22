import {
  Component,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  model,
  viewChild,
  viewChildren,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerDialpad, tablerHistory } from '@ng-icons/tabler-icons';
import { PhoneState } from '../../../core/phone/phone';
import { CallLog } from '../call-log/call-log';
import { Conference } from '../conference/conference';
import { ConsultCall } from '../consult-call/consult-call';
import { DialDisplay } from '../dial-display/dial-display';
import { Dialer } from '../dialer/dialer';
import { IncomingCall } from '../incoming-call/incoming-call';
import { PhoneDevices } from '../phone-devices/phone-devices';
import { PhoneHeader } from '../phone-header/phone-header';
import { PhoneStateView } from '../phone-state/phone-state';
import { Transfer } from '../transfer/transfer';

type PrimaryTab = 'phone' | 'calls';

const TABS: readonly { id: PrimaryTab; icon: string }[] = [
  { id: 'phone', icon: 'tablerDialpad' },
  { id: 'calls', icon: 'tablerHistory' },
];

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), input:not([disabled]):not([readonly]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

@Component({
  selector: 'app-phone-panel',
  imports: [
    TranslocoPipe,
    NgIcon,
    PhoneHeader,
    DialDisplay,
    Dialer,
    Transfer,
    ConsultCall,
    Conference,
    IncomingCall,
    CallLog,
    PhoneDevices,
    PhoneStateView,
  ],
  providers: [provideIcons({ tablerDialpad, tablerHistory })],
  templateUrl: './phone-panel.html',
  styleUrl: './phone-panel.css',
})
export class PhonePanel {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly dialogRef = viewChild<ElementRef<HTMLElement>>('dialog');
  private readonly panelBodyRef = viewChild<ElementRef<HTMLElement>>('panelBody');
  private readonly tabButtons = viewChildren<ElementRef<HTMLButtonElement>>('tabBtn');
  protected readonly phone = inject(PhoneState);

  readonly transferOpen = model(false);
  protected readonly tabs = TABS;

  protected readonly missedBadge = computed(() => {
    const count = this.phone.missedCount();
    return count > 99 ? '99+' : String(count);
  });

  protected readonly showInCall = computed(() => {
    const state = this.phone.callState();
    return state === 'calling' || state === 'ringing' || state === 'active';
  });

  constructor() {
    afterNextRender(() => this.focusFirstControl());

    effect(() => {
      if (!this.phone.busy() || this.phone.mode() !== 'single') {
        this.transferOpen.set(false);
      }
    });
  }

  protected selectTab(tab: PrimaryTab): void {
    this.phone.setTab(tab);
    if (tab === 'calls') {
      this.phone.clearMissed();
    }
  }

  protected onTabKeydown(event: KeyboardEvent, index: number): void {
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';
    const nextKey = rtl ? 'ArrowLeft' : 'ArrowRight';
    const prevKey = rtl ? 'ArrowRight' : 'ArrowLeft';

    let nextIndex = -1;
    if (event.key === nextKey) {
      nextIndex = (index + 1) % this.tabs.length;
    } else if (event.key === prevKey) {
      nextIndex = (index - 1 + this.tabs.length) % this.tabs.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = this.tabs.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    const target = this.tabs[nextIndex];
    this.selectTab(target.id);
    this.tabButtons()[nextIndex]?.nativeElement.focus();
  }

  protected onEscape(event: Event): void {
    event.stopPropagation();
    this.phone.close();
  }

  protected onAnswerAndTransfer(): void {
    this.transferOpen.set(true);
  }

  private focusFirstControl(): void {
    const dialog = this.dialogRef()?.nativeElement;
    if (!dialog) return;
    const active = document.activeElement;
    if (active && dialog.contains(active)) return;
    const body = this.panelBodyRef()?.nativeElement ?? dialog;
    const preferred = body.querySelector<HTMLElement>(
      '#phone-dial-input:not([disabled]):not([readonly]), #phone-transfer-input:not([disabled]), #phone-add-party-input:not([disabled]), #phone-conf-add-input:not([disabled]), [data-call-control]:not([disabled])',
    );
    if (preferred) {
      preferred.focus();
      return;
    }
    const firstInBody = body.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    firstInBody?.focus();
  }
}
