import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerX } from '@ng-icons/tabler-icons';

export type ModalSize = 'alert' | 'confirm' | 'form' | 'wide' | 'activity' | 'record';

const SIZE_CLASSES: Record<ModalSize, string> = {
  alert: 'w-modal-alert',
  confirm: 'w-modal-confirm',
  form: 'w-modal-form',
  wide: 'w-modal-form-wide',
  activity: 'w-modal-activity',
  record: 'w-modal-record',
};

const RECORD_HEIGHT_CAP =
  'min(var(--modal-record-h), calc(100% - 2 * var(--space-16)), calc(100dvh - 2 * var(--space-16)))';

const TILE_CLASSES: Record<string, string> = {
  'bg-icon-blue': 'bg-icon-blue',
  'bg-icon-navy': 'bg-icon-navy',
  'bg-icon-teal': 'bg-icon-teal',
  'bg-icon-green': 'bg-icon-green',
  'bg-icon-orange': 'bg-icon-orange',
  'bg-icon-red': 'bg-icon-red',
  'bg-icon-violet': 'bg-icon-violet',
  'bg-icon-gray': 'bg-icon-gray',
  'icon-blue': 'bg-icon-blue',
  'icon-navy': 'bg-icon-navy',
  'icon-teal': 'bg-icon-teal',
  'icon-green': 'bg-icon-green',
  'icon-orange': 'bg-icon-orange',
  'icon-red': 'bg-icon-red',
  'icon-violet': 'bg-icon-violet',
  'icon-gray': 'bg-icon-gray',
  blue: 'bg-icon-blue',
  navy: 'bg-icon-navy',
  teal: 'bg-icon-teal',
  green: 'bg-icon-green',
  orange: 'bg-icon-orange',
  red: 'bg-icon-red',
  violet: 'bg-icon-violet',
  gray: 'bg-icon-gray',
};

/** Skips disabled, hidden, roving (tabindex -1) and ui-field "!" hint elements. */
const NOT_SKIPPED = ':not([disabled]):not([tabindex="-1"]):not([data-ui-hint])';

/** An element the feature marks to take initial focus. */
const AUTOFOCUS_SELECTOR = ['[autofocus]', '[data-autofocus]'].map((s) => s + NOT_SKIPPED).join(',');

/** Form controls: native fields, ui-dropdown triggers, radio groups, switches, checkboxes, editors. */
const FORM_CONTROL_SELECTOR = [
  'input:not([type="hidden"])',
  'select',
  'textarea',
  '[contenteditable="true"]',
  '[role="textbox"]',
  '[role="combobox"]',
  '[aria-haspopup="listbox"]',
  '[role="radio"]',
  '[role="checkbox"]',
  '[role="switch"]',
  '[role="slider"]',
  '[role="spinbutton"]',
]
  .map((s) => s + NOT_SKIPPED)
  .join(',');

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button',
  'input:not([type="hidden"])',
  'select',
  'textarea',
  '[tabindex]',
]
  .map((s) => s + NOT_SKIPPED)
  .join(',');

@Component({
  selector: 'ui-modal',
  imports: [NgIcon],
  providers: [provideIcons({ tablerX })],
  templateUrl: './modal.html',
})
export class Modal {
  private static nextId = 0;
  protected readonly titleId = `ui-modal-title-${++Modal.nextId}`;

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly body = viewChild.required<ElementRef<HTMLElement>>('body');
  private readonly injector = inject(Injector);

  readonly size = input<ModalSize>('form');
  readonly title = input('');
  readonly ariaLabel = input('');
  readonly subtitle = input('');
  readonly icon = input('');
  readonly tile = input('bg-icon-blue');
  readonly closeLabel = input('');
  readonly dismissable = input(true);
  readonly preventDismiss = input(false);
  readonly hasFooter = input(true);
  readonly bodyClass = input('');

  readonly closed = output<void>();
  readonly dismiss = output<void>();

  protected readonly sizeClass = computed(() => SIZE_CLASSES[this.size()]);
  protected readonly isRecord = computed(() => this.size() === 'record');
  protected readonly dialogClass = computed(() =>
    this.isRecord() ? `${this.sizeClass()} overflow-hidden` : this.sizeClass(),
  );
  protected readonly dialogHeight = computed(() => {
    if (this.size() === 'activity') return 'min(var(--modal-activity-h), 100vh - 32px)';
    if (this.isRecord()) return RECORD_HEIGHT_CAP;
    return null;
  });
  protected readonly dialogMaxHeight = computed(() => (this.isRecord() ? RECORD_HEIGHT_CAP : null));
  protected readonly tileClass = computed(() => TILE_CLASSES[this.tile()] ?? (this.tile() || 'bg-icon-blue'));

  private isOpen = false;
  /** The element the modal itself last focused; anything else means the user or the feature moved focus. */
  private autoFocused: HTMLElement | null = null;
  private stopLateFocus: (() => void) | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.isOpen = false;
      this.stopLateFocus?.();
    });
  }

  open(): void {
    const element = this.dialog().nativeElement;
    if (!element.open) {
      element.showModal();
    }
    this.isOpen = true;
    const focused = this.focusInitial();
    // The body may still show the previous state (signals set just before open() render later), so check
    // again after the next render, unless the user or the feature has already moved focus elsewhere.
    afterNextRender(
      () => {
        if (!this.isOpen) return;
        if (this.focusUntouched(focused)) this.focusInitial();
      },
      { injector: this.injector },
    );
    this.watchLateContent();
  }

  private focusUntouched(focused: HTMLElement | null): boolean {
    const element = this.dialog().nativeElement;
    const active = document.activeElement as HTMLElement | null;
    return active === focused || !element.contains(active) || !!active?.hasAttribute('data-ui-hint');
  }

  private static isPreferred(target: HTMLElement): boolean {
    return target.matches(AUTOFOCUS_SELECTOR) || target.matches(FORM_CONTROL_SELECTOR);
  }

  /**
   * The first field can render well after open (a translation scope or a list still loading, or a control kept
   * disabled until its options arrive), past the next-render check. While focus sits on a fallback (a header
   * button or the dialog itself), watch the body and move focus once a field appears. Stops when a field takes
   * focus, the user clicks or presses a key, the feature moves focus, or the modal closes.
   */
  private watchLateContent(): void {
    this.stopLateFocus?.();
    if (this.autoFocused && Modal.isPreferred(this.autoFocused)) return;
    const element = this.dialog().nativeElement;
    const observer = new MutationObserver(() => {
      if (!this.isOpen || !this.focusUntouched(this.autoFocused)) {
        stop();
        return;
      }
      const target = this.findInitial();
      if (target !== document.activeElement) {
        target.focus();
        this.autoFocused = target;
      }
      if (Modal.isPreferred(target)) stop();
    });
    const stop = () => {
      observer.disconnect();
      element.removeEventListener('pointerdown', stop, true);
      element.removeEventListener('keydown', stop, true);
      if (this.stopLateFocus === stop) this.stopLateFocus = null;
    };
    observer.observe(this.body().nativeElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['disabled', 'tabindex', 'hidden', 'autofocus', 'data-autofocus'],
    });
    element.addEventListener('pointerdown', stop, true);
    element.addEventListener('keydown', stop, true);
    this.stopLateFocus = stop;
  }

  /**
   * Initial focus: an element marked autofocus / data-autofocus, else the first form control, else the first
   * other focusable element, never a ui-field "!" hint (its tooltip would open over the content). Tab still
   * reaches the hint. With nothing to focus in the body, the dialog itself takes focus.
   */
  private focusInitial(): HTMLElement {
    const target = this.findInitial();
    target.focus();
    this.autoFocused = target;
    return target;
  }

  private findInitial(): HTMLElement {
    const body = this.body().nativeElement;
    return (
      body.querySelector<HTMLElement>(AUTOFOCUS_SELECTOR) ??
      body.querySelector<HTMLElement>(FORM_CONTROL_SELECTOR) ??
      body.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ??
      this.dialog().nativeElement
    );
  }

  close(): void {
    const element = this.dialog().nativeElement;
    const wasOpen = this.isOpen || element.open;
    this.isOpen = false;
    this.stopLateFocus?.();
    if (element.open) {
      element.close();
    }
    if (wasOpen) {
      this.closed.emit();
    }
  }

  protected onCancel(event: Event): void {
    if (!this.dismissable() || this.preventDismiss()) {
      event.preventDefault();
    }
  }

  protected onEscape(event: Event): void {
    if (event.defaultPrevented) return;
    if (!this.dismissable()) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    event.preventDefault();
    if (this.preventDismiss()) {
      this.dismiss.emit();
      return;
    }
    this.close();
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (this.dismissable() && event.target === this.dialog().nativeElement) {
      if (this.preventDismiss()) {
        this.dismiss.emit();
        return;
      }
      this.close();
    }
  }

  protected onHeaderClose(): void {
    if (this.preventDismiss()) {
      this.dismiss.emit();
      return;
    }
    this.close();
  }

  protected onNativeClose(): void {
    this.stopLateFocus?.();
    if (this.isOpen) {
      this.isOpen = false;
      this.closed.emit();
    }
  }
}
