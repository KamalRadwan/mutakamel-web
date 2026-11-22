import { DestroyRef, ElementRef, Signal, afterRenderEffect, effect, inject, signal } from '@angular/core';

/**
 * How many children marked `data-fit-item` fit in one row of the container.
 * Children that do not fit belong in a "more" menu, which reserves the width of the widest item.
 * Call it in an injection context; `items` changes trigger a fresh measure.
 */
export function overflowFit(container: Signal<ElementRef<HTMLElement> | undefined>, items: Signal<unknown>): Signal<number> {
  const visible = signal(Number.POSITIVE_INFINITY);
  let widths: number[] = [];

  const fit = () => {
    const element = container()?.nativeElement;
    if (!element || widths.length === 0) return;
    const gap = parseFloat(getComputedStyle(element).columnGap) || 0;
    const available = element.clientWidth;
    const total = widths.reduce((sum, width) => sum + width + gap, -gap);
    if (total <= available) {
      visible.set(widths.length);
      return;
    }
    let room = available - Math.max(...widths) - gap;
    let count = 0;
    for (const width of widths) {
      room -= width + gap;
      if (room < 0) break;
      count++;
    }
    visible.set(count);
  };

  effect(() => {
    items();
    visible.set(Number.POSITIVE_INFINITY);
  });

  afterRenderEffect(() => {
    const element = container()?.nativeElement;
    if (!element || visible() !== Number.POSITIVE_INFINITY) return;
    widths = [...element.querySelectorAll<HTMLElement>(':scope > [data-fit-item]')].map((item) => item.offsetWidth);
    fit();
  });

  const observer = new ResizeObserver(fit);
  afterRenderEffect(() => {
    const element = container()?.nativeElement;
    if (element) observer.observe(element);
  });
  inject(DestroyRef).onDestroy(() => observer.disconnect());

  return visible;
}
