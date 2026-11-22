import { Component, ElementRef, computed, inject, input, model, viewChildren } from '@angular/core';

export interface SegmentedOption {
  value: string;
  label: string;
  dot?: string;
  disabled?: boolean;
}

@Component({
  selector: 'ui-segmented',
  templateUrl: './segmented.html',
  host: {
    role: 'radiogroup',
    '[attr.aria-label]': 'label() || null',
    class: 'inline-flex items-center gap-2 rounded-10 bg-neutral-soft p-3',
  },
})
export class Segmented {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly optionButtons = viewChildren<ElementRef<HTMLButtonElement>>('optionBtn');

  readonly options = input<readonly SegmentedOption[]>([]);
  readonly label = input('');
  readonly id = input<string | null>(null);
  readonly describedBy = input<string | null>(null);
  readonly value = model<string | null>(null);

  protected readonly activeTabIndex = computed(() => {
    const items = this.options();
    const current = this.value();
    const selectedIndex = items.findIndex((item) => !item.disabled && item.value === current);
    if (selectedIndex !== -1) return selectedIndex;
    return items.findIndex((item) => !item.disabled);
  });

  protected select(option: SegmentedOption): void {
    if (option.disabled) return;
    this.value.set(option.value);
  }

  protected onKeydown(event: KeyboardEvent, index: number): void {
    const items = this.options();
    const enabledIndices = items.reduce<number[]>((acc, item, i) => {
      if (!item.disabled) acc.push(i);
      return acc;
    }, []);
    if (enabledIndices.length === 0) return;

    const rtl = this.isRtl();
    const nextKey = rtl ? 'ArrowLeft' : 'ArrowRight';
    const prevKey = rtl ? 'ArrowRight' : 'ArrowLeft';

    let targetPos = -1;
    const currentPos = enabledIndices.indexOf(index);
    const startPos = currentPos !== -1 ? currentPos : 0;

    if (event.key === nextKey || event.key === 'ArrowDown') {
      targetPos = (startPos + 1) % enabledIndices.length;
    } else if (event.key === prevKey || event.key === 'ArrowUp') {
      targetPos = (startPos - 1 + enabledIndices.length) % enabledIndices.length;
    } else if (event.key === 'Home') {
      targetPos = 0;
    } else if (event.key === 'End') {
      targetPos = enabledIndices.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    const targetIndex = enabledIndices[targetPos];
    const targetOption = items[targetIndex];
    this.value.set(targetOption.value);
    this.optionButtons()[targetIndex]?.nativeElement.focus();
  }

  private isRtl(): boolean {
    const element = this.host.nativeElement;
    const dirAttr = element.closest('[dir]')?.getAttribute('dir')?.toLowerCase();
    if (dirAttr === 'rtl' || dirAttr === 'ltr') {
      return dirAttr === 'rtl';
    }
    return getComputedStyle(element).direction === 'rtl';
  }
}
