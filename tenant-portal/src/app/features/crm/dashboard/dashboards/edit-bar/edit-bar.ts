import { Component, ElementRef, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerArrowBackUp, tablerKeyboard } from '@ng-icons/tabler-icons';
import { Button } from '../../../../../shared/ui/button/button';
import { rectInPage, viewport } from '../../../../../shared/ui/overlay/zoom';

let nextKeyboardHintSeq = 0;

@Component({
  selector: 'app-edit-bar',
  imports: [NgIcon, TranslocoPipe, Button],
  providers: [
    provideTranslocoScope({ scope: 'crm-dash-edit', alias: 'dashEdit' }),
    provideIcons({ tablerArrowBackUp, tablerKeyboard }),
  ],
  templateUrl: './edit-bar.html',
  host: { class: 'sticky top-0 z-sticky block' },
})
export class EditBar {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly tooltipRef = viewChild<ElementRef<HTMLElement>>('tooltip');

  readonly dirty = input(false);
  readonly canUndo = input(false);
  readonly saving = input(false);
  readonly selectedName = input<string | null>(null);
  readonly selectedSize = input<{ w: number; h: number } | null>(null);
  readonly sizeError = input<string | null>(null);
  readonly keyboardHintId = input('');

  readonly save = output<void>();
  readonly undo = output<void>();
  readonly cancel = output<void>();

  private readonly fallbackHintId = `dash-edit-kbd-${++nextKeyboardHintSeq}`;
  protected readonly resolvedKeyboardHintId = computed(() => this.keyboardHintId() || this.fallbackHintId);
  protected readonly tipOpen = signal(false);
  protected readonly tooltipPlace = signal({ top: 0, start: 0 });

  protected showTooltip(triggerEl: HTMLElement): void {
    const rect = rectInPage(triggerEl);
    const tipEl = this.tooltipRef()?.nativeElement;
    const tip = tipEl ? rectInPage(tipEl) : { width: 240, height: 20 };
    const { width, height } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';

    const endEdge = rtl ? width - rect.left : rect.right;
    const rawStart = endEdge - tip.width;
    const start = Math.min(Math.max(8, rawStart), Math.max(8, width - 8 - tip.width));

    const belowTop = rect.bottom + 6;
    const top =
      belowTop + tip.height > height - 8 ? Math.max(8, rect.top - 6 - tip.height) : belowTop;

    this.tooltipPlace.set({ top, start });
    this.tipOpen.set(true);
  }

  protected hideTooltip(): void {
    this.tipOpen.set(false);
  }
}
