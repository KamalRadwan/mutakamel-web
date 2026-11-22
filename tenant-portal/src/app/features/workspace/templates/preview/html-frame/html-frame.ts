import { Component, DestroyRef, ElementRef, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

const DEFAULT_A4_WIDTH_PX = 794;
const MIN_CONTENT_HEIGHT_PX = 120;

@Component({
  selector: 'app-tpl-html-frame',
  templateUrl: './html-frame.html',
  host: { class: 'block min-w-0', dir: 'ltr' },
})
export class HtmlFrame {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);
  private readonly frameRef = viewChild<ElementRef<HTMLIFrameElement>>('frame');

  readonly html = input.required<string>();
  readonly widthPx = input<number | null>(null);
  readonly zoom = input<number>(1);
  readonly title = input.required<string>();

  protected readonly contentHeightPx = signal(640);
  private rafId: number | null = null;

  /** Safe because the iframe sets sandbox="allow-same-origin" without allow-scripts. */
  protected readonly safeHtml = computed<SafeHtml>(() =>
    this.sanitizer.bypassSecurityTrustHtml(this.html()),
  );

  protected readonly baseWidthPx = computed(() => this.widthPx() ?? DEFAULT_A4_WIDTH_PX);

  protected readonly safeZoom = computed(() => {
    const z = this.zoom();
    return Number.isFinite(z) && z > 0 ? z : 1;
  });

  protected readonly scaledWidthPx = computed(() => Math.round(this.baseWidthPx() * this.safeZoom()));
  protected readonly scaledHeightPx = computed(() => Math.round(this.contentHeightPx() * this.safeZoom()));

  protected readonly useEmailTokenClass = computed(
    () => this.safeZoom() === 1 && (this.widthPx() === 600 || this.widthPx() === 320),
  );

  protected readonly wrapperWidthClass = computed(() => {
    if (!this.useEmailTokenClass()) return '';
    return this.widthPx() === 600 ? 'w-email-col' : 'w-email-col-sm';
  });

  protected readonly frameTransform = computed(() =>
    this.safeZoom() === 1 ? null : `scale(${this.safeZoom()})`,
  );

  constructor() {
    effect((onCleanup) => {
      this.widthPx();
      this.html();
      const id = requestAnimationFrame(() => {
        this.rafId = null;
        this.measureHeight();
      });
      this.rafId = id;
      onCleanup(() => {
        cancelAnimationFrame(id);
        if (this.rafId === id) {
          this.rafId = null;
        }
      });
    });

    this.destroyRef.onDestroy(() => {
      if (this.rafId !== null) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
    });
  }

  protected measureHeight(): void {
    const iframe = this.frameRef()?.nativeElement;
    if (!iframe) return;
    try {
      const doc = iframe.contentDocument;
      if (!doc) return;
      let measured = 0;
      if (doc.body) {
        const bodyStyle = doc.defaultView?.getComputedStyle(doc.body);
        const marginTop = bodyStyle ? parseFloat(bodyStyle.marginTop) || 0 : 0;
        const marginBottom = bodyStyle ? parseFloat(bodyStyle.marginBottom) || 0 : 0;
        measured = Math.ceil(Math.max(doc.body.scrollHeight, doc.body.offsetHeight) + marginTop + marginBottom);
      } else {
        measured = doc.documentElement?.scrollHeight ?? 0;
      }
      const next = Math.max(MIN_CONTENT_HEIGHT_PX, measured);
      this.contentHeightPx.set(next);
    } catch {
      // Ignore cross-origin frame access errors when sandbox blocks inspection.
    }
  }
}
