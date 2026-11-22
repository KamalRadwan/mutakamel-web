import { Component, computed, inject, input } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-tpl-pdf-frame',
  templateUrl: './pdf-frame.html',
  host: { class: 'flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-8 border border-border bg-paper shadow-card' },
})
export class PdfFrame {
  private readonly sanitizer = inject(DomSanitizer);

  readonly url = input.required<string>();
  readonly page = input<number>(1);
  readonly zoom = input<number | 'FIT'>('FIT');
  readonly title = input.required<string>();

  protected readonly frameEntries = computed<{ key: string; safeUrl: SafeResourceUrl }[]>(() => {
    const raw = this.url().split('#')[0] ?? '';
    if (!raw.startsWith('blob:')) return [];
    const safePage = Math.max(1, Math.floor(this.page() || 1));
    const zoomVal = this.zoom();
    const zoomParam =
      zoomVal === 'FIT'
        ? 'page-width'
        : String(Math.round(zoomVal <= 10 ? zoomVal * 100 : zoomVal));
    const key = `${raw}#page=${safePage}&zoom=${zoomParam}`;
    return [{ key, safeUrl: this.sanitizer.bypassSecurityTrustResourceUrl(key) }];
  });
}
