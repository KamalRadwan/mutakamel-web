import { Component, ElementRef, effect, inject, signal, viewChild } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerAlertTriangle, tablerCircleCheck, tablerCircleX, tablerInfoCircle, tablerX } from '@ng-icons/tabler-icons';
import { TranslocoPipe } from '@jsverse/transloco';
import { Notify, ToastType } from '../../../core/notify/notify';

const LOOK: Record<ToastType, { icon: string; circle: string; bar: string }> = {
  success: { icon: 'tablerCircleCheck', circle: 'bg-success text-on-success', bar: 'bg-success' },
  error: { icon: 'tablerCircleX', circle: 'bg-danger text-on-danger', bar: 'bg-danger' },
  warning: { icon: 'tablerAlertTriangle', circle: 'bg-warning text-on-warning', bar: 'bg-warning' },
  info: { icon: 'tablerInfoCircle', circle: 'bg-brand text-on-brand', bar: 'bg-brand' },
};

@Component({
  selector: 'ui-toast-host',
  imports: [NgIcon, TranslocoPipe],
  providers: [provideIcons({ tablerCircleCheck, tablerCircleX, tablerAlertTriangle, tablerInfoCircle, tablerX })],
  templateUrl: './toast-host.html',
  styleUrl: './toast-host.css',
})
export class ToastHost {
  protected readonly notify = inject(Notify);
  protected readonly look = LOOK;
  private readonly region = viewChild.required<ElementRef<HTMLElement>>('region');

  protected readonly polite = signal('');
  protected readonly assertive = signal('');
  private announced = 0;

  constructor() {
    // Announce each new toast through the persistent live regions. The text is cleared first so that
    // an identical repeat is still read out.
    effect(() => {
      const fresh = this.notify.toasts().filter((toast) => toast.id > this.announced);
      if (!fresh.length) return;
      this.announced = fresh[fresh.length - 1].id;
      const say = (type: 'assertive' | 'polite', text: string) => {
        const target = type === 'assertive' ? this.assertive : this.polite;
        target.set('');
        setTimeout(() => target.set(text), 50);
      };
      const text = (toasts: typeof fresh) => toasts.map((toast) => [toast.title, toast.text].filter(Boolean).join('. ')).join('. ');
      const errors = fresh.filter((toast) => toast.type === 'error');
      const others = fresh.filter((toast) => toast.type !== 'error');
      if (errors.length) say('assertive', text(errors));
      if (others.length) say('polite', text(others));
    });

    // Modals are <dialog> elements in the browser top layer, so a normal fixed element always sits under them.
    // The region is a manual popover; re-showing it on every change moves it to the top of the top layer,
    // above any open modal.
    effect(() => {
      const count = this.notify.toasts().length;
      const el = this.region().nativeElement;
      if (typeof el.showPopover !== 'function') return;
      if (el.matches(':popover-open')) el.hidePopover();
      if (count > 0) el.showPopover();
    });
  }
}
