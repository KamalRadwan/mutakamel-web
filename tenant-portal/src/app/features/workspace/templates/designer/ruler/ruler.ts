import { AfterViewInit, Component, DestroyRef, ElementRef, computed, inject, input, signal, viewChild } from '@angular/core';
import { MM_TO_PX } from '../geometry';

interface RulerTick {
  pos: number;
  major: boolean;
  minor5: boolean;
  label: number | null;
}

@Component({
  selector: 'app-tpl-ruler',
  templateUrl: './ruler.html',
  host: {
    class: 'block overflow-hidden bg-surface select-none',
    '[class]': "orientation() === 'H' ? 'h-ruler w-full border-b border-border' : 'w-ruler h-full border-r border-border'",
    'dir': 'ltr',
    'aria-hidden': 'true',
  },
})
export class Ruler implements AfterViewInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly svgRef = viewChild.required<ElementRef<SVGSVGElement>>('svgEl');

  readonly orientation = input.required<'H' | 'V'>();
  readonly lengthMm = input.required<number>();
  readonly zoom = input.required<number>();
  readonly offsetPx = input<number>(0);
  readonly scroll = input<number>(0);

  private readonly viewportPx = signal(1200);

  protected readonly ticks = computed<RulerTick[]>(() => {
    const lengthMm = Math.max(0, this.lengthMm());
    const zoom = this.zoom() > 0 ? this.zoom() : 1;
    const offset = this.offsetPx();
    const scroll = this.scroll();
    const viewPx = this.viewportPx();

    const zoomPercent = zoom * 100;
    const majorStep = zoomPercent < 50 ? 50 : 10;
    const showMm = zoomPercent >= 150;
    const step = showMm ? 1 : 5;

    const pxPerMm = MM_TO_PX * zoom;
    const origin = offset - scroll;

    const minVisibleMm = Math.max(0, Math.floor((-origin - 24) / pxPerMm / step) * step);
    const maxVisibleMm = Math.min(
      Math.ceil(lengthMm),
      Math.ceil((viewPx - origin + 24) / pxPerMm / step) * step,
    );

    const list: RulerTick[] = [];
    for (let mm = minVisibleMm; mm <= maxVisibleMm; mm += step) {
      const pos = origin + mm * pxPerMm;
      const major = mm % majorStep === 0;
      const minor5 = !major && mm % 5 === 0;
      list.push({
        pos,
        major,
        minor5,
        label: major ? mm : null,
      });
    }
    return list;
  });

  ngAfterViewInit(): void {
    const el = this.svgRef().nativeElement;
    const updateSize = () => {
      const size = this.orientation() === 'H' ? el.clientWidth : el.clientHeight;
      if (size > 0) this.viewportPx.set(size);
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    this.destroyRef.onDestroy(() => observer.disconnect());
  }
}
