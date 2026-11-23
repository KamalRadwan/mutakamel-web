import { Component, ElementRef, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerArrowBackUp, tablerKeyboard, tablerPlus } from '@ng-icons/tabler-icons';
import { Button } from '../../../../shared/ui/button/button';
import { rectInPage, viewport } from '../../../../shared/ui/overlay/zoom';

let nextEditHintSeq = 0;

@Component({
  selector: 'app-trade-dashboard-edit-bar',
  imports: [NgIcon, TranslocoPipe, Button],
  providers: [provideIcons({ tablerKeyboard, tablerPlus, tablerArrowBackUp })],
  templateUrl: './dashboard-edit-bar.html',
  host: { class: 'sticky top-0 z-sticky block' },
})
export class DashboardEditBar {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly tooltipRef = viewChild<ElementRef<HTMLElement>>('tooltip');

  readonly dirty = input(false);
  readonly canUndo = input(false);
  readonly saving = input(false);
  readonly canAddWidget = input(true);
  readonly placementCount = input(0);
  readonly maxPlacements = input(20);

  readonly addWidget = output<void>();
  readonly undo = output<void>();
  readonly cancel = output<void>();
  readonly save = output<void>();

  protected readonly keyboardHintId = `trade-dash-edit-kbd-${++nextEditHintSeq}`;
  protected readonly tipOpen = signal(false);
  protected readonly tooltipPlace = signal({ top: 0, start: 0 });

  protected readonly addDisabled = computed(
    () => this.saving() || this.dirty() || this.placementCount() >= this.maxPlacements(),
  );

  protected readonly addDisabledReason = computed<string | null>(() => {
    this.i18n();
    if (this.dirty()) {
      return this.transloco.translate('tradeDashboard.editBar.addDisabledDirty');
    }
    if (this.placementCount() >= this.maxPlacements()) {
      return this.transloco.translate('tradeDashboard.editBar.addDisabledLimit');
    }
    return null;
  });

  protected showTooltip(triggerEl: HTMLElement): void {
    const rect = rectInPage(triggerEl);
    const tipEl = this.tooltipRef()?.nativeElement;
    const tip = tipEl ? rectInPage(tipEl) : { width: 240, height: 20 };
    const { width, height } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';

    const rawStart = (rtl ? width - rect.left : rect.right) + 6;
    const start =
      rawStart + tip.width > width - 8
        ? Math.max(8, (rtl ? width - rect.right : rect.left) - 6 - tip.width)
        : rawStart;

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
