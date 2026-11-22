import { Component, ElementRef, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerExclamationCircle, tablerGripVertical, tablerX } from '@ng-icons/tabler-icons';
import { ActionsMenu, type ActionItem, type ActionSelection } from '../actions-menu/actions-menu';
import { Badge } from '../badge/badge';
import { rectInPage, viewport } from '../overlay/zoom';

let nextFrameId = 0;

@Component({
  selector: 'ui-widget-frame',
  imports: [NgIcon, ActionsMenu, Badge],
  providers: [provideIcons({ tablerExclamationCircle, tablerGripVertical, tablerX })],
  templateUrl: './widget-frame.html',
  host: { class: 'block size-full min-h-0 min-w-0' },
})
export class WidgetFrame {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly headerRowRef = viewChild<ElementRef<HTMLElement>>('headerRow');
  private readonly tooltipRef = viewChild<ElementRef<HTMLElement>>('tooltip');
  private readonly frameSeq = ++nextFrameId;

  readonly title = input.required<string>();
  readonly hint = input('');
  readonly tag = input<string | null>(null);
  readonly editing = input(false);
  readonly selected = input(false);
  readonly menuItems = input<ActionItem[]>([]);
  readonly menuLabel = input('');
  readonly gripLabel = input('');
  readonly removeLabel = input('');

  readonly menuSelected = output<string>();
  readonly removed = output<void>();

  protected readonly titleId = `ui-widget-frame-${this.frameSeq}-title`;
  protected readonly hintId = `ui-widget-frame-${this.frameSeq}-hint`;
  protected readonly tooltipPlace = signal({ top: 0, start: 0 });
  protected readonly tipPlaced = signal(false);
  protected readonly hasHint = computed(() => this.hint().trim().length > 0);

  protected readonly frameStateClasses = computed(() => {
    if (this.editing()) {
      return this.selected()
        ? 'outline-2 outline-solid outline-brand -outline-offset-1'
        : 'outline-2 outline-dashed outline-brand -outline-offset-1';
    }
    return this.selected()
      ? 'shadow-card outline-2 outline-solid outline-brand -outline-offset-1'
      : 'shadow-card';
  });

  protected placeTooltip(triggerEl: HTMLElement) {
    const rect = rectInPage(triggerEl);
    const headerRowEl = this.headerRowRef()?.nativeElement;
    const headerRow = headerRowEl ? rectInPage(headerRowEl) : rect;
    const tipEl = this.tooltipRef()?.nativeElement;
    const tip = tipEl ? rectInPage(tipEl) : { width: 280, height: 20 };
    const { width } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';

    let start = (rtl ? width - rect.left : rect.right) + 6;
    if (start + tip.width > width - 8) {
      const altStart = (rtl ? width - rect.right : rect.left) - 6 - tip.width;
      start = altStart >= 8 ? altStart : Math.max(8, width - 8 - tip.width);
    }

    const top = Math.max(8, headerRow.bottom - tip.height);
    this.tooltipPlace.set({ top, start });
    this.tipPlaced.set(true);
  }

  protected hideTooltip() {
    this.tipPlaced.set(false);
  }

  protected onMenuSelected(selection: ActionSelection) {
    this.menuSelected.emit(selection.id);
  }

  protected onRemove(event: MouseEvent) {
    event.stopPropagation();
    this.removed.emit();
  }
}
