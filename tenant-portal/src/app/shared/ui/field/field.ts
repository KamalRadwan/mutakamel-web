import { Component, DestroyRef, ElementRef, computed, effect, inject, input, isDevMode, signal, viewChild } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoService } from '@jsverse/transloco';
import { tablerCircleX, tablerExclamationCircle } from '@ng-icons/tabler-icons';
import { rectInPage, viewport } from '../overlay/zoom';

let nextFieldId = 0;
const warnedMissingHint = new Set<string>();
const DIRECT_CONTROL_SELECTOR = 'input, textarea, select';
const INTERACTIVE_CONTROL_SELECTOR =
  'input:not([type="file"]), textarea, select, button[aria-haspopup], [role="combobox"], [role="switch"], button[role="radio"], ui-file-drop button';

@Component({
  selector: 'ui-field',
  imports: [NgIcon],
  providers: [provideIcons({ tablerExclamationCircle, tablerCircleX })],
  templateUrl: './field.html',
  host: { class: 'block min-w-0' },
})
export class Field {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  /** Optional so hosts and tests without Transloco keep working; the counter then falls back to "n / max". */
  private readonly transloco = optionalTransloco();
  private readonly translation = this.transloco ? toSignal(this.transloco.selectTranslation()) : signal(null);
  private readonly labelRowRef = viewChild<ElementRef<HTMLElement>>('labelRow');
  private readonly boxRef = viewChild<ElementRef<HTMLElement>>('box');
  private readonly tooltipRef = viewChild<ElementRef<HTMLElement>>('tooltip');

  readonly label = input.required<string>();
  readonly for = input('');
  readonly hint = input('');
  readonly hintText = input<string | null>(null);
  readonly required = input(false);
  readonly error = input<string | null>(null);
  readonly count = input<number | null>(null);
  readonly max = input<number | null>(null);
  readonly size = input<'default' | 'large' | 'multiline' | 'bare'>('default');
  readonly bare = input(false);

  private readonly fallbackId = `ui-field-${++nextFieldId}`;
  private readonly detectedControlId = signal('');
  protected readonly hasControl = signal(true);

  protected readonly countLabel = computed(() => {
    this.translation();
    const params = { count: this.count() ?? 0, max: this.max() };
    const text = this.transloco?.translate('common.charsUsed', params);
    return text && text !== 'common.charsUsed' ? text : `${params.count} / ${params.max}`;
  });
  protected readonly controlId = computed(() => this.for() || this.detectedControlId() || this.fallbackId);
  protected readonly tooltipPlace = signal({ top: 0, start: 0 });
  protected readonly tipPlaced = signal(false);
  protected readonly isBare = computed(() => this.bare() || this.size() === 'bare' || !this.hasControl());
  protected readonly boxClasses = computed(() => {
    if (this.isBare()) return 'flex flex-col';
    const size = this.size();
    const key: 'default' | 'large' | 'multiline' = size === 'bare' ? 'default' : size;
    return ['flex gap-6 border bg-surface-field text-text transition-colors duration-fast', SIZES[key], this.error() ? ERROR : NORMAL].join(' ');
  });

  constructor() {
    let observer: MutationObserver | null = null;
    effect(() => {
      observer?.disconnect();
      observer = null;
      const el = this.boxRef()?.nativeElement;
      if (!el) return;

      const id = this.controlId();
      const hasHint = !!this.hint().trim();
      const hasError = !!this.error();

      const sync = () => {
        const directControls = Array.from(el.children).filter((child): child is HTMLElement =>
          child.matches(DIRECT_CONTROL_SELECTOR),
        );
        this.hasControl.set(directControls.length > 0);

        const primaryDirect = directControls[0];
        if (primaryDirect) {
          const existingId = primaryDirect.getAttribute('id') ?? '';
          if (!this.for()) {
            if (existingId && existingId !== this.fallbackId) {
              if (existingId !== this.detectedControlId()) {
                this.detectedControlId.set(existingId);
                return;
              }
            } else {
              if (this.detectedControlId()) {
                this.detectedControlId.set('');
                return;
              }
              if (!existingId) {
                primaryDirect.id = id;
              }
            }
          } else if (!existingId) {
            primaryDirect.id = id;
          }
          syncDescribedBy(primaryDirect, id, hasHint, hasError);
          return;
        }

        if (this.detectedControlId()) {
          this.detectedControlId.set('');
          return;
        }

        // Only controls that belong to THIS field, not ones inside a nested ui-field (e.g. a picker's own filters).
        const hostEl = this.host.nativeElement;
        const matched = Array.from(el.querySelectorAll<HTMLElement>(INTERACTIVE_CONTROL_SELECTOR)).filter(
          (control) => control.closest('ui-field') === hostEl,
        );
        const targets = matched.length
          ? matched
          : Array.from(el.querySelectorAll<HTMLElement>('[role="radiogroup"]')).filter(
              (node) => node.closest('ui-field') === hostEl,
            );

        const firstTarget = targets[0];
        if (firstTarget && this.for() && !firstTarget.getAttribute('id')) {
          const idTaken = Array.from(el.querySelectorAll<HTMLElement>('[id]')).some(
            (node) => node.closest('ui-field') === hostEl && node.id === id,
          );
          if (!idTaken) {
            firstTarget.id = id;
          }
        }

        for (const target of targets) {
          syncDescribedBy(target, id, hasHint, hasError);
        }
      };

      sync();
      observer = new MutationObserver(sync);
      observer.observe(el, { childList: true, subtree: true });
    });

    if (isDevMode()) {
      effect(() => {
        const key = this.fallbackId;
        const id = this.controlId();
        const label = this.label().trim();
        const hint = this.hint().trim();
        if (!label || hint || warnedMissingHint.has(key)) return;
        warnedMissingHint.add(key);
        console.warn(`[ui-field] Missing hint for field "${id}" (${label}).`);
      });
    }

    this.destroyRef.onDestroy(() => observer?.disconnect());
  }

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

  private hovered = false;
  private focused = false;

  protected onHover(triggerEl: HTMLElement, on: boolean) {
    this.hovered = on;
    this.sync(triggerEl);
  }

  protected onFocus(triggerEl: HTMLElement, on: boolean) {
    this.focused = on;
    this.sync(triggerEl);
  }

  // WCAG 1.4.13: dismissible without moving pointer or focus. Only swallow Escape while the hint is open.
  protected onEscape(event: Event) {
    if (!this.tipPlaced()) return;
    event.stopPropagation();
    this.tipPlaced.set(false);
  }

  private sync(triggerEl: HTMLElement) {
    if (this.hovered || this.focused) {
      this.placeTooltip(triggerEl);
    } else {
      this.tipPlaced.set(false);
    }
  }
}

function syncDescribedBy(target: HTMLElement, id: string, hasHint: boolean, hasError: boolean) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const existing = (target.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
  const nextTokens = existing.filter((token) => token !== hintId && token !== errorId);
  if (hasHint) nextTokens.push(hintId);
  if (hasError) nextTokens.push(errorId);
  const next = nextTokens.join(' ');
  const current = existing.join(' ');
  if (next === current) return;
  if (next) {
    target.setAttribute('aria-describedby', next);
  } else {
    target.removeAttribute('aria-describedby');
  }
}

const SIZES = {
  default: 'h-field px-8 rounded-8 text-12 items-center',
  large: 'h-login-field px-12 rounded-10 text-14 items-center',
  multiline: 'min-h-textarea py-6 px-8 rounded-8 text-12 items-start',
};
const NORMAL =
  'border-border-field hover:border-border-field-hover focus-within:border-focus-ring focus-within:ring-3 focus-within:ring-focus-halo-strong';
const ERROR = 'border-danger-border ring-2 ring-danger-halo';

function optionalTransloco(): TranslocoService | null {
  try {
    return inject(TranslocoService);
  } catch {
    return null;
  }
}
