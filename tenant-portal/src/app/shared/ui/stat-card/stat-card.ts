import { Component, ElementRef, computed, inject, input, signal, viewChild } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerArrowDownRight,
  tablerArrowRight,
  tablerArrowUpRight,
  tablerExclamationCircle,
} from '@ng-icons/tabler-icons';
import { rectInPage, viewport } from '../overlay/zoom';
import { Sparkline, type SparklineSpec } from '../sparkline/sparkline';

let nextStatCardId = 0;

@Component({
  selector: 'ui-stat-card',
  imports: [NgIcon, Sparkline],
  providers: [
    provideIcons({
      tablerExclamationCircle,
      tablerArrowUpRight,
      tablerArrowDownRight,
      tablerArrowRight,
    }),
  ],
  templateUrl: './stat-card.html',
  host: { class: 'block h-full min-w-0' },
})
export class StatCard {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly labelRowRef = viewChild<ElementRef<HTMLElement>>('labelRow');
  private readonly tooltipRef = viewChild<ElementRef<HTMLElement>>('tooltip');

  readonly label = input.required<string>();
  readonly hint = input('');
  readonly value = input.required<string>();
  readonly valueTitle = input('');
  readonly delta = input<string | null>(null);
  readonly direction = input<'up' | 'down' | 'flat' | null>(null);
  readonly chart = input<SparklineSpec | null>(null);
  readonly framed = input(true);

  private readonly cardSeq = ++nextStatCardId;
  protected readonly hintId = `ui-stat-card-${this.cardSeq}-hint`;
  protected readonly labelId = `ui-stat-card-${this.cardSeq}-label`;
  protected readonly tooltipPlace = signal({ top: 0, start: 0 });
  protected readonly tipPlaced = signal(false);

  protected readonly directionIcon = computed(() => {
    switch (this.direction()) {
      case 'up':
        return 'tablerArrowUpRight';
      case 'down':
        return 'tablerArrowDownRight';
      case 'flat':
        return 'tablerArrowRight';
      default:
        return null;
    }
  });

  protected placeTooltip(triggerEl: HTMLElement) {
    const rect = rectInPage(triggerEl);
    const labelRowEl = this.labelRowRef()?.nativeElement;
    const labelRow = labelRowEl ? rectInPage(labelRowEl) : rect;
    const tipEl = this.tooltipRef()?.nativeElement;
    const tip = tipEl ? rectInPage(tipEl) : { width: 280, height: 20 };
    const { width } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';

    let start = (rtl ? width - rect.left : rect.right) + 6;
    if (start + tip.width > width - 8) {
      const altStart = (rtl ? width - rect.right : rect.left) - 6 - tip.width;
      start = altStart >= 8 ? altStart : Math.max(8, width - 8 - tip.width);
    }

    const top = Math.max(8, labelRow.bottom - tip.height);
    this.tooltipPlace.set({ top, start });
    this.tipPlaced.set(true);
  }

  protected hideTooltip() {
    this.tipPlaced.set(false);
  }
}
