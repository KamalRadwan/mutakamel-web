import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormValueControl } from '@angular/forms/signals';
import { TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerCheck, tablerChevronDown, tablerCircleX } from '@ng-icons/tabler-icons';
import { rectInPage, viewport } from '../overlay/zoom';
import { Segmented, type SegmentedOption } from '../segmented/segmented';
import {
  type ColorFormat,
  type HsvColor,
  alphaPercentToByte,
  clamp,
  hslToHsv,
  hsvToHex,
  hsvToHsl,
  hsvToRgb,
  normalizeColor,
  parseColor,
  parseColorText,
  rgbToHex,
  rgbToHsv,
} from './color-picker.math';

interface PopoverPlace {
  readonly top: number;
  readonly start: number;
}

const VIEWPORT_MARGIN = 8;
const POPOVER_GAP = 4;
const ESTIMATED_POPOVER_WIDTH = 248;
const ESTIMATED_POPOVER_HEIGHT = 304;

const DEFAULT_THEME_TOKEN_FALLBACKS: readonly { token: string; fallback: string }[] = [
  { token: '--brand', fallback: '#1D56C9' },
  { token: '--accent', fallback: '#0F2F78' },
  { token: '--brand-soft', fallback: '#E6EDFA' },
  { token: '--text', fallback: '#12141C' },
  { token: '--text-muted', fallback: '#5B6072' },
  { token: '--border-field', fallback: '#898EA2' },
  { token: '--border', fallback: '#E4E7EC' },
  { token: '--neutral-soft', fallback: '#ECEEF2' },
  { token: '--surface', fallback: '#FFFFFF' },
];

const FALLBACK_LABELS: Readonly<Record<string, string>> = {
  'colorPicker.dialog': 'Colour picker',
  'colorPicker.svArea': 'Saturation and brightness',
  'colorPicker.svValueText': 'Saturation {{s}}%, brightness {{v}}%',
  'colorPicker.hue': 'Hue',
  'colorPicker.hueValueText': '{{h}} degrees',
  'colorPicker.opacity': 'Opacity',
  'colorPicker.opacityValueText': '{{a}}%',
  'colorPicker.format': 'Colour format',
  'colorPicker.hex': 'Hex colour',
  'colorPicker.red': 'Red',
  'colorPicker.green': 'Green',
  'colorPicker.blue': 'Blue',
  'colorPicker.saturation': 'Saturation',
  'colorPicker.lightness': 'Lightness',
  'colorPicker.swatches': 'Preset colours',
  'colorPicker.noColor': 'No colour',
  'colorPicker.invalid': 'Enter a valid colour',
};

const FORMAT_OPTIONS: readonly SegmentedOption[] = [
  { value: 'hex', label: 'HEX' },
  { value: 'rgb', label: 'RGB' },
  { value: 'hsl', label: 'HSL' },
];

const INITIAL_HSV: HsvColor = { h: 220, s: 86, v: 79, a: 100 };

let nextColorPickerId = 0;

function optionalTransloco(): TranslocoService | null {
  try {
    return inject(TranslocoService);
  } catch {
    return null;
  }
}

function interpolateFallback(template: string, params?: Readonly<Record<string, string | number>>): string {
  if (!params) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
    key in params ? String(params[key]) : `{{${key}}}`,
  );
}

@Component({
  selector: 'ui-color-picker',
  imports: [NgIcon, Segmented],
  providers: [provideIcons({ tablerChevronDown, tablerCheck, tablerCircleX })],
  templateUrl: './color-picker.html',
  styleUrl: './color-picker.css',
  host: {
    class: 'relative block w-full min-w-0',
    '(document:click)': 'onDocumentClick($event)',
    '(window:resize)': 'commitAndClose()',
    '(focusout)': 'onHostFocusOut($event)',
  },
})
export class ColorPicker<T extends string | null = string | null> implements FormValueControl<T> {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly transloco = optionalTransloco();
  private readonly i18nTick = this.transloco ? toSignal(this.transloco.selectTranslation()) : signal(null);

  private readonly triggerBox = viewChild.required<ElementRef<HTMLElement>>('triggerBox');
  private readonly triggerInput = viewChild.required<ElementRef<HTMLInputElement>>('triggerInput');
  private readonly popoverRef = viewChild<ElementRef<HTMLElement>>('popover');
  private readonly svSquareRef = viewChild<ElementRef<HTMLElement>>('svSquare');
  private readonly hueBarRef = viewChild<ElementRef<HTMLElement>>('hueBar');
  private readonly alphaBarRef = viewChild<ElementRef<HTMLElement>>('alphaBar');

  protected readonly uid = `ui-color-picker-${++nextColorPickerId}`;
  protected readonly popoverId = `${this.uid}-popover`;
  protected readonly inlineErrorId = `${this.uid}-error`;
  protected readonly formatOptions = FORMAT_OPTIONS;

  readonly value = model<T>('' as T);
  readonly allowAlpha = input(true);
  readonly swatches = input<readonly string[] | null>(null);
  readonly placeholder = input('#RRGGBB');
  readonly nullable = input(false);

  readonly id = input<string | null>(null);
  readonly ariaLabel = input('');
  readonly describedBy = input<string | null>(null);
  readonly disabled = input(false);
  readonly readonly = input(false);
  readonly invalid = input(false);
  readonly required = input(false);
  /** Hides the built-in parse-error row when a wrapping `ui-field` already renders `[error]`. */
  readonly suppressInlineError = input(false);

  readonly touch = output<void>();
  readonly rawValueChange = output<string>();

  readonly parseError = signal(false);

  protected readonly open = signal(false);
  protected readonly focused = signal(false);
  protected readonly format = signal<ColorFormat>('hex');
  protected readonly hsv = signal<HsvColor>(INITIAL_HSV);
  protected readonly hasActiveColor = signal(false);
  protected readonly place = signal<PopoverPlace>({ top: 0, start: 0 });
  protected readonly rtlLayout = signal(false);

  protected readonly triggerText = signal('');
  protected readonly hexDraft = signal('');
  protected readonly rDraft = signal('0');
  protected readonly gDraft = signal('0');
  protected readonly bDraft = signal('0');
  protected readonly hDraft = signal('0');
  protected readonly sDraft = signal('0');
  protected readonly lDraft = signal('0');
  protected readonly alphaDraft = signal('100');

  private lastSyncedModelValue: string | null | undefined = undefined;
  private lastSyncedAllowAlpha: boolean | undefined = undefined;
  private previousDescribedBy: string[] = [];
  private openedModelValue: T = '' as T;
  private openedHsv: HsvColor = INITIAL_HSV;
  private openedHasColor = false;
  private draggingTarget: 'sv' | 'hue' | 'alpha' | null = null;

  protected readonly currentRgb = computed(() => hsvToRgb(this.hsv()));
  protected readonly currentHsl = computed(() => hsvToHsl(this.hsv()));

  protected readonly roundedH = computed(() => Math.round(this.hsv().h));
  protected readonly roundedS = computed(() => Math.round(this.hsv().s));
  protected readonly roundedV = computed(() => Math.round(this.hsv().v));
  protected readonly roundedA = computed(() =>
    this.allowAlpha() ? Math.round(clamp(this.hsv().a, 0, 100)) : 100,
  );

  protected readonly normalizedHex = computed(() => {
    if (!this.hasActiveColor()) return null;
    return hsvToHex(this.hsv(), this.allowAlpha());
  });

  protected readonly swatchCssColor = computed(() => {
    if (!this.hasActiveColor()) return 'transparent';
    const rgb = this.currentRgb();
    const alpha = this.allowAlpha() ? clamp(rgb.a, 0, 100) / 100 : 1;
    return `rgb(${rgb.r} ${rgb.g} ${rgb.b} / ${alpha})`;
  });

  protected readonly showSwatchCheckerboard = computed(
    () => this.hasActiveColor() && this.allowAlpha() && alphaPercentToByte(this.hsv().a) < 255,
  );

  protected readonly huePureCss = computed(() => `hsl(${this.hsv().h} 100% 50%)`);

  protected readonly alphaTrackGradient = computed(() => {
    const rgb = this.currentRgb();
    return `linear-gradient(to right, rgb(${rgb.r} ${rgb.g} ${rgb.b} / 0), rgb(${rgb.r} ${rgb.g} ${rgb.b} / 1))`;
  });

  protected readonly hueKnobTopPercent = computed(() => 100 - (clamp(this.hsv().h, 0, 360) / 360) * 100);
  protected readonly svKnobLeftPercent = computed(() => clamp(this.hsv().s, 0, 100));
  protected readonly svKnobTopPercent = computed(() => 100 - clamp(this.hsv().v, 0, 100));
  protected readonly alphaKnobLeftPercent = computed(() => clamp(this.hsv().a, 0, 100));

  protected readonly hasErrorState = computed(() => this.invalid() || this.parseError());
  protected readonly showInlineError = computed(
    () => this.parseError() && !this.suppressInlineError() && !this.invalid(),
  );

  protected readonly triggerBoxClasses = computed(() => {
    const base =
      'flex h-field w-full items-center gap-6 rounded-8 border px-8 text-12 transition-colors duration-fast';
    if (this.disabled()) {
      return `${base} cursor-not-allowed border-border-field bg-neutral-soft text-text-placeholder`;
    }
    if (this.hasErrorState()) {
      return `${base} border-danger-border bg-surface-field text-text ring-2 ring-danger-halo`;
    }
    if (this.open() || this.focused()) {
      return `${base} border-focus-ring bg-surface-field text-text ring-3 ring-focus-halo-strong`;
    }
    if (this.readonly()) {
      return `${base} border-border-field bg-surface-field text-text`;
    }
    return `${base} cursor-pointer border-border-field bg-surface-field text-text hover:border-border-field-hover focus-within:border-focus-ring focus-within:ring-3 focus-within:ring-focus-halo-strong`;
  });

  protected readonly resolvedSwatches = computed<readonly string[]>(() => {
    const custom = this.swatches();
    const allowAlpha = this.allowAlpha();
    if (custom !== null) {
      const seen = new Set<string>();
      const out: string[] = [];
      for (const item of custom) {
        const norm = normalizeColor(item, allowAlpha);
        if (norm && !seen.has(norm)) {
          seen.add(norm);
          out.push(norm);
        }
      }
      return out;
    }

    // Read current theme tokens when popover opens or initializes.
    this.open();
    const styles =
      typeof document !== 'undefined' && typeof getComputedStyle === 'function'
        ? getComputedStyle(document.documentElement)
        : null;

    const seen = new Set<string>();
    const defaults: string[] = [];
    for (const entry of DEFAULT_THEME_TOKEN_FALLBACKS) {
      const rawCss = styles?.getPropertyValue(entry.token).trim() ?? '';
      const resolved = normalizeColor(rawCss, false) ?? entry.fallback;
      if (!seen.has(resolved)) {
        seen.add(resolved);
        defaults.push(resolved);
      }
    }
    return defaults;
  });

  protected readonly dialogLabel = computed(() => this.translate('colorPicker.dialog'));
  protected readonly svAreaLabel = computed(() => this.translate('colorPicker.svArea'));
  protected readonly svValueText = computed(() =>
    this.translate('colorPicker.svValueText', { s: this.roundedS(), v: this.roundedV() }),
  );
  protected readonly hueLabel = computed(() => this.translate('colorPicker.hue'));
  protected readonly hueValueText = computed(() =>
    this.translate('colorPicker.hueValueText', { h: this.roundedH() }),
  );
  protected readonly opacityLabel = computed(() => this.translate('colorPicker.opacity'));
  protected readonly opacityValueText = computed(() =>
    this.translate('colorPicker.opacityValueText', { a: this.roundedA() }),
  );
  protected readonly formatLabel = computed(() => this.translate('colorPicker.format'));
  protected readonly hexInputLabel = computed(() => this.translate('colorPicker.hex'));
  protected readonly redLabel = computed(() => this.translate('colorPicker.red'));
  protected readonly greenLabel = computed(() => this.translate('colorPicker.green'));
  protected readonly blueLabel = computed(() => this.translate('colorPicker.blue'));
  protected readonly saturationLabel = computed(() => this.translate('colorPicker.saturation'));
  protected readonly lightnessLabel = computed(() => this.translate('colorPicker.lightness'));
  protected readonly swatchesLabel = computed(() => this.translate('colorPicker.swatches'));
  protected readonly noColorLabel = computed(() => this.translate('colorPicker.noColor'));
  protected readonly invalidMessage = computed(() => this.translate('colorPicker.invalid'));

  protected readonly liveAnnouncement = computed(() => {
    const hex = this.normalizedHex();
    return hex ?? this.noColorLabel();
  });

  constructor() {
    effect(() => {
      const raw = this.value();
      const allowAlpha = this.allowAlpha();
      if (raw === this.lastSyncedModelValue && allowAlpha === this.lastSyncedAllowAlpha) return;
      this.lastSyncedModelValue = raw;
      this.lastSyncedAllowAlpha = allowAlpha;
      this.syncFromExternalValue(raw, allowAlpha);
    });

    effect(() => {
      const inputEl = this.triggerInput().nativeElement;
      const explicit = (this.describedBy() ?? '').split(/\s+/).filter(Boolean);
      const showErr = this.showInlineError();
      const existing = (inputEl.getAttribute('aria-describedby') ?? '')
        .split(/\s+/)
        .filter((tok) => Boolean(tok) && tok !== this.inlineErrorId && !this.previousDescribedBy.includes(tok));
      const merged = [...new Set([...existing, ...explicit])];
      this.previousDescribedBy = explicit;
      if (showErr) merged.push(this.inlineErrorId);
      const next = merged.join(' ');
      if (next) {
        inputEl.setAttribute('aria-describedby', next);
      } else {
        inputEl.removeAttribute('aria-describedby');
      }
    });

    const onScroll = (event: Event) => {
      if (!this.open()) return;
      const target = event.target;
      if (target instanceof Node && this.host.nativeElement.contains(target)) return;
      this.commitAndClose();
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('scroll', onScroll, { capture: true });
    });
  }

  focus(options?: FocusOptions): void {
    this.triggerInput().nativeElement.focus(options);
  }

  protected onTriggerBoxClick(event: MouseEvent): void {
    if (this.disabled() || this.readonly()) return;
    const target = event.target;
    if (target instanceof Element && target.closest('[data-chevron-btn]')) {
      if (this.open()) {
        this.commitAndClose();
      } else {
        this.openPopover(true);
      }
      return;
    }
    if (!this.open()) {
      const clickedSwatch = target instanceof Element && Boolean(target.closest('[data-trigger-swatch]'));
      this.openPopover(clickedSwatch);
    }
  }

  protected onTriggerFocus(): void {
    if (!this.disabled()) {
      this.focused.set(true);
    }
  }

  protected onTriggerKeydown(event: KeyboardEvent): void {
    if (this.disabled() || this.readonly()) return;

    if (event.key === 'Escape' && this.open()) {
      event.preventDefault();
      event.stopPropagation();
      this.revertAndClose();
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.openPopover(true);
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      if (!this.open()) {
        this.openPopover(true);
      } else {
        this.commitAndClose();
      }
      return;
    }

    if (event.key === ' ' && !this.open()) {
      const text = this.triggerText().trim().toLowerCase();
      const typingFunction = text.startsWith('rgb') || text.startsWith('hsl');
      if (!typingFunction) {
        event.preventDefault();
        this.openPopover(true);
      }
    }
  }

  protected onTriggerInput(event: Event): void {
    if (this.disabled() || this.readonly()) return;
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;

    const raw = target.value;
    this.triggerText.set(raw);
    const trimmed = raw.trim();
    if (!trimmed) {
      this.rawValueChange.emit(raw);
      if (this.nullable()) {
        this.parseError.set(false);
        this.hasActiveColor.set(false);
        this.hexDraft.set('');
        this.emitModelValue(null as T);
      } else {
        this.parseError.set(true);
      }
      return;
    }

    const parsed = parseColorText(trimmed, this.allowAlpha());
    if (!parsed) {
      this.rawValueChange.emit(raw);
      this.parseError.set(true);
      return;
    }

    this.parseError.set(false);
    const nextHsv = this.preserveAchromaticHue(rgbToHsv(parsed));
    this.hsv.set(nextHsv);
    this.hasActiveColor.set(true);
    const hex = rgbToHex(parsed, this.allowAlpha());
    this.syncFormatDrafts(nextHsv, hex);
    this.rawValueChange.emit(hex);
    this.emitModelValue(hex as T);
  }

  protected onPaste(event: ClipboardEvent): void {
    if (this.disabled() || this.readonly()) return;
    const pasted = event.clipboardData?.getData('text') ?? '';
    if (!pasted.trim()) return;

    event.preventDefault();
    const parsed = parseColor(pasted, this.allowAlpha()) ?? parseColorText(pasted, this.allowAlpha());
    if (!parsed) {
      this.rawValueChange.emit(pasted);
      this.triggerText.set(pasted);
      this.hexDraft.set(pasted);
      this.parseError.set(true);
      return;
    }

    this.parseError.set(false);
    const nextHsv = this.preserveAchromaticHue(rgbToHsv(parsed));
    this.hsv.set(nextHsv);
    this.hasActiveColor.set(true);
    const normalized = rgbToHex(parsed, this.allowAlpha());
    this.triggerText.set(normalized);
    this.syncFormatDrafts(nextHsv, normalized);
    this.rawValueChange.emit(normalized);
    this.emitModelValue(normalized as T);
  }

  protected onPopoverKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.revertAndClose();
    }
  }

  protected onSvPointerDown(event: PointerEvent): void {
    if (this.disabled() || this.readonly()) return;
    event.preventDefault();
    const el = this.svSquareRef()?.nativeElement;
    if (!el) return;
    this.draggingTarget = 'sv';
    this.safeSetPointerCapture(el, event.pointerId);
    el.focus({ preventScroll: true });
    this.updateSvFromPointer(el, event);
  }

  protected onSvPointerMove(event: PointerEvent): void {
    if (this.draggingTarget !== 'sv') return;
    const el = this.svSquareRef()?.nativeElement;
    if (!el) return;
    this.updateSvFromPointer(el, event);
  }

  protected onSvPointerUp(event: PointerEvent): void {
    if (this.draggingTarget !== 'sv') return;
    this.draggingTarget = null;
    const el = this.svSquareRef()?.nativeElement;
    if (el) this.safeReleasePointerCapture(el, event.pointerId);
  }

  protected onSvKeydown(event: KeyboardEvent): void {
    if (this.disabled() || this.readonly()) return;
    const step = event.shiftKey ? 10 : 1;
    const current = this.hsv();
    let nextS = current.s;
    let nextV = current.v;

    switch (event.key) {
      case 'ArrowRight':
        nextS = clamp(current.s + step, 0, 100);
        break;
      case 'ArrowLeft':
        nextS = clamp(current.s - step, 0, 100);
        break;
      case 'ArrowUp':
        nextV = clamp(current.v + step, 0, 100);
        break;
      case 'ArrowDown':
        nextV = clamp(current.v - step, 0, 100);
        break;
      case 'Home':
        nextS = 0;
        break;
      case 'End':
        nextS = 100;
        break;
      default:
        return;
    }

    event.preventDefault();
    this.applyHsvLive({ ...current, s: nextS, v: nextV });
  }

  protected onHuePointerDown(event: PointerEvent): void {
    if (this.disabled() || this.readonly()) return;
    event.preventDefault();
    const el = this.hueBarRef()?.nativeElement;
    if (!el) return;
    this.draggingTarget = 'hue';
    this.safeSetPointerCapture(el, event.pointerId);
    el.focus({ preventScroll: true });
    this.updateHueFromPointer(el, event);
  }

  protected onHuePointerMove(event: PointerEvent): void {
    if (this.draggingTarget !== 'hue') return;
    const el = this.hueBarRef()?.nativeElement;
    if (!el) return;
    this.updateHueFromPointer(el, event);
  }

  protected onHuePointerUp(event: PointerEvent): void {
    if (this.draggingTarget !== 'hue') return;
    this.draggingTarget = null;
    const el = this.hueBarRef()?.nativeElement;
    if (el) this.safeReleasePointerCapture(el, event.pointerId);
  }

  protected onHueKeydown(event: KeyboardEvent): void {
    if (this.disabled() || this.readonly()) return;
    const step = event.shiftKey ? 10 : 1;
    const current = this.hsv();
    let nextH = current.h;

    switch (event.key) {
      case 'ArrowUp':
        nextH = clamp(current.h + step, 0, 360);
        break;
      case 'ArrowDown':
        nextH = clamp(current.h - step, 0, 360);
        break;
      case 'Home':
        nextH = 0;
        break;
      case 'End':
        nextH = 360;
        break;
      default:
        return;
    }

    event.preventDefault();
    this.applyHsvLive({ ...current, h: nextH });
  }

  protected onAlphaPointerDown(event: PointerEvent): void {
    if (this.disabled() || this.readonly() || !this.allowAlpha()) return;
    event.preventDefault();
    const el = this.alphaBarRef()?.nativeElement;
    if (!el) return;
    this.draggingTarget = 'alpha';
    this.safeSetPointerCapture(el, event.pointerId);
    el.focus({ preventScroll: true });
    this.updateAlphaFromPointer(el, event);
  }

  protected onAlphaPointerMove(event: PointerEvent): void {
    if (this.draggingTarget !== 'alpha') return;
    const el = this.alphaBarRef()?.nativeElement;
    if (!el) return;
    this.updateAlphaFromPointer(el, event);
  }

  protected onAlphaPointerUp(event: PointerEvent): void {
    if (this.draggingTarget !== 'alpha') return;
    this.draggingTarget = null;
    const el = this.alphaBarRef()?.nativeElement;
    if (el) this.safeReleasePointerCapture(el, event.pointerId);
  }

  protected onAlphaKeydown(event: KeyboardEvent): void {
    if (this.disabled() || this.readonly() || !this.allowAlpha()) return;
    const step = event.shiftKey ? 10 : 1;
    const current = this.hsv();
    let nextA = current.a;

    switch (event.key) {
      case 'ArrowRight':
        nextA = clamp(Math.round(current.a) + step, 0, 100);
        break;
      case 'ArrowLeft':
        nextA = clamp(Math.round(current.a) - step, 0, 100);
        break;
      case 'Home':
        nextA = 0;
        break;
      case 'End':
        nextA = 100;
        break;
      default:
        return;
    }

    event.preventDefault();
    this.applyHsvLive({ ...current, a: nextA });
  }

  protected onFormatChange(next: string | null): void {
    if (next !== 'hex' && next !== 'rgb' && next !== 'hsl') return;
    this.format.set(next);
    this.parseError.set(false);
    const hex = this.normalizedHex() ?? '';
    this.syncFormatDrafts(this.hsv(), hex);
  }

  protected onHexDraftInput(event: Event): void {
    if (this.disabled() || this.readonly()) return;
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const raw = target.value;
    this.hexDraft.set(raw);
    this.rawValueChange.emit(raw);

    const parsed = parseColorText(raw, this.allowAlpha());
    if (!parsed) {
      this.parseError.set(true);
      return;
    }

    this.parseError.set(false);
    const nextHsv = this.preserveAchromaticHue(rgbToHsv(parsed));
    this.hsv.set(nextHsv);
    this.hasActiveColor.set(true);
    const hex = rgbToHex(parsed, this.allowAlpha());
    this.triggerText.set(hex);
    this.syncChannelDraftsOnly(nextHsv);
    this.emitModelValue(hex as T);
  }

  protected onRgbChannelInput(channel: 'r' | 'g' | 'b', event: Event): void {
    if (this.disabled() || this.readonly()) return;
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const raw = target.value;

    if (channel === 'r') this.rDraft.set(raw);
    else if (channel === 'g') this.gDraft.set(raw);
    else this.bDraft.set(raw);

    const r = this.parseBoundedInt(this.rDraft(), 0, 255);
    const g = this.parseBoundedInt(this.gDraft(), 0, 255);
    const b = this.parseBoundedInt(this.bDraft(), 0, 255);

    if (r === null || g === null || b === null) {
      this.parseError.set(true);
      return;
    }

    this.parseError.set(false);
    const alpha = this.allowAlpha() ? this.hsv().a : 100;
    const nextHsv = this.preserveAchromaticHue(rgbToHsv({ r, g, b, a: alpha }));
    this.hsv.set(nextHsv);
    this.hasActiveColor.set(true);
    const hex = rgbToHex({ r, g, b, a: alpha }, this.allowAlpha());
    this.triggerText.set(hex);
    this.hexDraft.set(hex);
    const hsl = hsvToHsl(nextHsv);
    this.hDraft.set(String(Math.round(hsl.h)));
    this.sDraft.set(String(Math.round(hsl.s)));
    this.lDraft.set(String(Math.round(hsl.l)));
    this.rawValueChange.emit(hex);
    this.emitModelValue(hex as T);
  }

  protected onHslChannelInput(channel: 'h' | 's' | 'l', event: Event): void {
    if (this.disabled() || this.readonly()) return;
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const raw = target.value;

    if (channel === 'h') this.hDraft.set(raw);
    else if (channel === 's') this.sDraft.set(raw);
    else this.lDraft.set(raw);

    const h = this.parseBoundedInt(this.hDraft(), 0, 360);
    const s = this.parseBoundedInt(this.sDraft(), 0, 100);
    const l = this.parseBoundedInt(this.lDraft(), 0, 100);

    if (h === null || s === null || l === null) {
      this.parseError.set(true);
      return;
    }

    this.parseError.set(false);
    const alpha = this.allowAlpha() ? this.hsv().a : 100;
    const nextHsv = hslToHsv({ h, s, l, a: alpha });
    this.hsv.set(nextHsv);
    this.hasActiveColor.set(true);
    const hex = hsvToHex(nextHsv, this.allowAlpha());
    this.triggerText.set(hex);
    this.hexDraft.set(hex);
    const rgb = hsvToRgb(nextHsv);
    this.rDraft.set(String(rgb.r));
    this.gDraft.set(String(rgb.g));
    this.bDraft.set(String(rgb.b));
    this.rawValueChange.emit(hex);
    this.emitModelValue(hex as T);
  }

  protected onAlphaDraftInput(event: Event): void {
    if (this.disabled() || this.readonly() || !this.allowAlpha()) return;
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const raw = target.value;
    this.alphaDraft.set(raw);

    const alpha = this.parseBoundedInt(raw, 0, 100);
    if (alpha === null) {
      this.parseError.set(true);
      return;
    }

    this.parseError.set(false);
    const nextHsv: HsvColor = { ...this.hsv(), a: alpha };
    this.hsv.set(nextHsv);
    this.hasActiveColor.set(true);
    const hex = hsvToHex(nextHsv, true);
    this.triggerText.set(hex);
    this.hexDraft.set(hex);
    this.rawValueChange.emit(hex);
    this.emitModelValue(hex as T);
  }

  protected selectSwatch(swatch: string): void {
    if (this.disabled() || this.readonly()) return;
    const parsed = parseColor(swatch, this.allowAlpha());
    if (!parsed) return;
    this.parseError.set(false);
    const nextHsv = this.preserveAchromaticHue(rgbToHsv(parsed));
    this.hsv.set(nextHsv);
    this.hasActiveColor.set(true);
    const hex = rgbToHex(parsed, this.allowAlpha());
    this.triggerText.set(hex);
    this.syncFormatDrafts(nextHsv, hex);
    this.rawValueChange.emit(hex);
    this.emitModelValue(hex as T);
  }

  protected selectNoColor(): void {
    if (this.disabled() || this.readonly() || !this.nullable()) return;
    this.parseError.set(false);
    this.hasActiveColor.set(false);
    this.triggerText.set('');
    this.hexDraft.set('');
    this.rawValueChange.emit('');
    this.emitModelValue(null as T);
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (!this.open()) return;
    const target = event.target;
    if (target instanceof Node && this.host.nativeElement.contains(target)) return;
    this.commitAndClose();
    this.touch.emit();
  }

  protected onHostFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget;
    if (next instanceof Node && this.host.nativeElement.contains(next)) return;
    this.focused.set(false);
    if (next instanceof Node && this.open()) {
      this.commitAndClose();
    }
    if (!this.open()) {
      this.touch.emit();
    }
  }

  protected commitAndClose(): void {
    if (!this.open()) return;
    this.draggingTarget = null;
    this.open.set(false);
    if (this.parseError()) {
      this.parseError.set(false);
      const validHex = this.normalizedHex() ?? '';
      this.triggerText.set(validHex);
      this.syncFormatDrafts(this.hsv(), validHex);
      this.rawValueChange.emit(validHex);
      this.emitModelValue((this.hasActiveColor() ? validHex : this.value()) as T);
    }
  }

  private revertAndClose(): void {
    this.draggingTarget = null;
    this.parseError.set(false);
    this.hsv.set(this.openedHsv);
    this.hasActiveColor.set(this.openedHasColor);
    const restoredText =
      typeof this.openedModelValue === 'string' && this.openedModelValue.trim()
        ? (normalizeColor(this.openedModelValue, this.allowAlpha()) ?? this.openedModelValue)
        : '';
    this.triggerText.set(restoredText);
    this.syncFormatDrafts(this.openedHsv, restoredText);
    if (this.value() !== this.openedModelValue) {
      this.rawValueChange.emit(restoredText);
      this.emitModelValue(this.openedModelValue);
    }
    this.open.set(false);
    this.triggerInput().nativeElement.focus({ preventScroll: true });
  }

  private openPopover(focusSquare: boolean): void {
    if (this.disabled() || this.readonly()) return;
    if (!this.open()) {
      this.openedModelValue = this.value();
      this.openedHsv = { ...this.hsv() };
      this.openedHasColor = this.hasActiveColor();
    }
    this.rtlLayout.set(this.detectRtl());
    this.place.set(this.measurePopover(ESTIMATED_POPOVER_WIDTH, ESTIMATED_POPOVER_HEIGHT));
    this.open.set(true);

    afterNextRender(
      () => {
        if (!this.open()) return;
        this.rtlLayout.set(this.detectRtl());
        const popEl = this.popoverRef()?.nativeElement;
        if (popEl) {
          this.place.set(
            this.measurePopover(
              popEl.offsetWidth || ESTIMATED_POPOVER_WIDTH,
              popEl.offsetHeight || ESTIMATED_POPOVER_HEIGHT,
            ),
          );
        }
        if (focusSquare) {
          this.svSquareRef()?.nativeElement.focus({ preventScroll: true });
        }
      },
      { injector: this.injector },
    );
  }

  private applyHsvLive(nextHsv: HsvColor): void {
    const normalized: HsvColor = {
      h: clamp(nextHsv.h, 0, 360),
      s: clamp(nextHsv.s, 0, 100),
      v: clamp(nextHsv.v, 0, 100),
      a: this.allowAlpha() ? clamp(nextHsv.a, 0, 100) : 100,
    };
    this.parseError.set(false);
    this.hsv.set(normalized);
    this.hasActiveColor.set(true);
    const hex = hsvToHex(normalized, this.allowAlpha());
    this.triggerText.set(hex);
    this.syncFormatDrafts(normalized, hex);
    this.rawValueChange.emit(hex);
    this.emitModelValue(hex as T);
  }

  private updateSvFromPointer(el: HTMLElement, event: PointerEvent): void {
    const rect = el.getBoundingClientRect();
    const width = rect.width > 0 ? rect.width : 200;
    const height = rect.height > 0 ? rect.height : 140;
    const s = clamp(((event.clientX - rect.left) / width) * 100, 0, 100);
    const v = clamp((1 - (event.clientY - rect.top) / height) * 100, 0, 100);
    this.applyHsvLive({ ...this.hsv(), s, v });
  }

  private updateHueFromPointer(el: HTMLElement, event: PointerEvent): void {
    const rect = el.getBoundingClientRect();
    const height = rect.height > 0 ? rect.height : 140;
    const h = clamp((1 - (event.clientY - rect.top) / height) * 360, 0, 360);
    this.applyHsvLive({ ...this.hsv(), h });
  }

  private updateAlphaFromPointer(el: HTMLElement, event: PointerEvent): void {
    const rect = el.getBoundingClientRect();
    const width = rect.width > 0 ? rect.width : 230;
    const a = Math.round(clamp(((event.clientX - rect.left) / width) * 100, 0, 100));
    this.applyHsvLive({ ...this.hsv(), a });
  }

  private syncFromExternalValue(raw: string | null, allowAlpha: boolean): void {
    this.parseError.set(false);
    if (raw === null || raw.trim() === '') {
      this.hasActiveColor.set(false);
      this.triggerText.set('');
      this.syncFormatDrafts(this.hsv(), '');
      return;
    }

    const parsed = parseColorText(raw, allowAlpha) ?? parseColor(raw, allowAlpha);
    if (!parsed) {
      this.parseError.set(true);
      this.triggerText.set(raw);
      this.hexDraft.set(raw);
      return;
    }

    const nextHsv = this.preserveAchromaticHue(rgbToHsv(parsed));
    const hex = rgbToHex(parsed, allowAlpha);
    this.hsv.set(nextHsv);
    this.hasActiveColor.set(true);
    this.triggerText.set(hex);
    this.syncFormatDrafts(nextHsv, hex);
  }

  private syncFormatDrafts(hsv: HsvColor, hex: string): void {
    this.hexDraft.set(hex);
    this.syncChannelDraftsOnly(hsv);
  }

  private syncChannelDraftsOnly(hsv: HsvColor): void {
    const rgb = hsvToRgb(hsv);
    const hsl = hsvToHsl(hsv);
    this.rDraft.set(String(rgb.r));
    this.gDraft.set(String(rgb.g));
    this.bDraft.set(String(rgb.b));
    this.hDraft.set(String(Math.round(hsl.h)));
    this.sDraft.set(String(Math.round(hsl.s)));
    this.lDraft.set(String(Math.round(hsl.l)));
    this.alphaDraft.set(String(this.allowAlpha() ? Math.round(clamp(hsv.a, 0, 100)) : 100));
  }

  private preserveAchromaticHue(next: HsvColor): HsvColor {
    if (next.s === 0 || next.v === 0) {
      return { ...next, h: this.hsv().h };
    }
    return next;
  }

  private parseBoundedInt(raw: string, min: number, max: number): number | null {
    const trimmed = raw.trim();
    if (!/^\d+$/.test(trimmed)) return null;
    const num = Number(trimmed);
    if (!Number.isInteger(num) || num < min || num > max) return null;
    return num;
  }

  private emitModelValue(next: T): void {
    this.lastSyncedModelValue = next;
    this.value.set(next);
  }

  private detectRtl(): boolean {
    const el = this.host.nativeElement;
    const dirAttr = el.closest('[dir]')?.getAttribute('dir')?.toLowerCase();
    if (dirAttr === 'rtl' || dirAttr === 'ltr') {
      return dirAttr === 'rtl';
    }
    return getComputedStyle(el).direction === 'rtl';
  }

  private measurePopover(width: number, height: number): PopoverPlace {
    const rect = rectInPage(this.triggerBox().nativeElement);
    const vp = viewport();
    const rtl = this.detectRtl();

    const triggerStart = rtl ? vp.width - rect.right : rect.left;
    const triggerEnd = rtl ? vp.width - rect.left : rect.right;
    const alignEnd = triggerStart + width > vp.width - VIEWPORT_MARGIN;
    const rawStart = alignEnd ? triggerEnd - width : triggerStart;
    const maxStart = Math.max(VIEWPORT_MARGIN, vp.width - width - VIEWPORT_MARGIN);
    const start = Math.min(Math.max(VIEWPORT_MARGIN, rawStart), maxStart);

    const spaceBelow = vp.height - rect.bottom - POPOVER_GAP - VIEWPORT_MARGIN;
    const spaceAbove = rect.top - POPOVER_GAP - VIEWPORT_MARGIN;
    const flipUp = spaceBelow < height && spaceAbove > spaceBelow;
    const rawTop = flipUp ? rect.top - POPOVER_GAP - height : rect.bottom + POPOVER_GAP;
    const maxTop = Math.max(VIEWPORT_MARGIN, vp.height - height - VIEWPORT_MARGIN);
    const top = Math.min(Math.max(VIEWPORT_MARGIN, rawTop), maxTop);

    return { top, start };
  }

  private translate(key: string, params?: Readonly<Record<string, string | number>>): string {
    this.i18nTick();
    if (this.transloco) {
      const result = this.transloco.translate(key, params);
      if (result && result !== key) return result;
    }
    const fallback = FALLBACK_LABELS[key] ?? key;
    return interpolateFallback(fallback, params);
  }

  private safeSetPointerCapture(el: HTMLElement, pointerId: number): void {
    if (typeof el.setPointerCapture === 'function') {
      try {
        el.setPointerCapture(pointerId);
      } catch {
        // Synthetic pointer events in unit tests may not have an active pointer id.
      }
    }
  }

  private safeReleasePointerCapture(el: HTMLElement, pointerId: number): void {
    if (typeof el.releasePointerCapture === 'function') {
      try {
        if (typeof el.hasPointerCapture !== 'function' || el.hasPointerCapture(pointerId)) {
          el.releasePointerCapture(pointerId);
        }
      } catch {
        // Ignore synthetic test events.
      }
    }
  }
}
