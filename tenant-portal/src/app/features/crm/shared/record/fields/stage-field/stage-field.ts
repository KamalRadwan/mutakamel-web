import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { translationEvents } from '../../../../../../core/i18n/translation-events';
import { TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerCheck, tablerChevronDown, tablerLoader2 } from '@ng-icons/tabler-icons';
import { Field } from '../../../../../../shared/ui/field/field';
import { rectInPage, viewport } from '../../../../../../shared/ui/overlay/zoom';
import { Option, OptionGroup } from '../record-fields.model';

interface MenuPlace {
  top: number;
  start: number;
  width: number;
  maxHeight: number | null;
}

@Component({
  selector: 'app-stage-field',
  imports: [NgIcon, Field],
  providers: [
    provideTranslocoScope({ scope: 'record-fields', alias: 'recordFields' }),
    provideIcons({ tablerCheck, tablerChevronDown, tablerLoader2 }),
  ],
  templateUrl: './stage-field.html',
  host: {
    class: 'block min-w-0',
    '(document:click)': 'closeIfOutside($event)',
    '(window:resize)': 'close()',
    '(keydown.escape)': 'onEscape($event)',
  },
})
export class StageField {
  private static nextId = 0;
  protected readonly uid = `rf-stage-${++StageField.nextId}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  private readonly menuListRef = viewChild<ElementRef<HTMLElement>>('menuList');

  readonly value = model<string | null>(null);
  readonly options = input<readonly Option[]>([]);
  readonly groups = input<readonly OptionGroup[]>([]);
  readonly labelKey = input<string>('recordFields.stage.label');
  readonly hintKey = input<string>('recordFields.stage.hint');
  readonly readonly = input(false);
  readonly updating = input(false);
  readonly instant = input(false);
  readonly error = input<string | null>(null);

  readonly commit = output<string>();

  protected readonly open = signal(false);
  protected readonly placed = signal(false);
  protected readonly place = signal<MenuPlace>({ top: 0, start: 0, width: 0, maxHeight: null });

  private menuSeq = 0;

  protected readonly label = computed(() => {
    this.i18n();
    return this.transloco.translate(this.labelKey());
  });
  protected readonly hint = computed(() => {
    this.i18n();
    return this.transloco.translate(this.hintKey());
  });

  protected readonly hasGroups = computed(() => this.groups().length > 0);
  protected readonly allOptions = computed<readonly Option[]>(() =>
    this.hasGroups() ? this.groups().flatMap((group) => group.options) : this.options(),
  );
  protected readonly selectedOption = computed<Option | null>(() => {
    const current = this.value();
    if (!current) return null;
    return this.allOptions().find((opt) => opt.id === current) ?? null;
  });

  constructor() {
    const onScroll = (event: Event) => {
      if (!this.open()) return;
      const target = event.target;
      if (target instanceof Node && this.menuListRef()?.nativeElement.contains(target)) return;
      this.close();
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    inject(DestroyRef).onDestroy(() => document.removeEventListener('scroll', onScroll, { capture: true }));
  }

  protected toggle(): void {
    if (this.readonly() || this.updating() || this.allOptions().length === 0) return;
    if (this.open()) {
      this.close();
      return;
    }

    const triggerEl = this.trigger()?.nativeElement;
    if (!triggerEl) return;

    const seq = ++this.menuSeq;
    this.placed.set(false);
    this.place.set(this.initialPlace(triggerEl));
    this.open.set(true);
    queueMicrotask(() => this.placeMenu(seq));
    afterNextRender(() => this.placeMenu(seq), { injector: this.injector });
  }

  protected choose(option: Option): void {
    if (option.disabled || this.readonly() || this.updating()) return;
    this.close();
    this.trigger()?.nativeElement.focus();
    if (option.id === this.value()) return;
    if (this.instant()) {
      this.commit.emit(option.id);
    } else {
      this.value.set(option.id);
    }
  }

  protected close(): void {
    this.menuSeq++;
    this.open.set(false);
    this.placed.set(false);
  }

  protected closeIfOutside(event: Event): void {
    if (!this.open()) return;
    const target = event.target;
    if (!(target instanceof Node)) {
      this.close();
      return;
    }
    const triggerEl = this.trigger()?.nativeElement;
    const listEl = this.menuListRef()?.nativeElement;
    if (triggerEl?.contains(target) || listEl?.contains(target)) return;
    this.close();
  }

  protected onEscape(event: Event): void {
    if (!this.open()) return;
    event.preventDefault();
    event.stopPropagation();
    this.close();
    this.trigger()?.nativeElement.focus();
  }

  protected onMenuKeydown(event: KeyboardEvent): void {
    const listEl = this.menuListRef()?.nativeElement;
    if (!listEl) return;
    const buttons = Array.from(listEl.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
    if (buttons.length === 0) return;

    const currentIndex = buttons.indexOf(document.activeElement as HTMLButtonElement);
    let nextIndex = -1;
    switch (event.key) {
      case 'ArrowDown':
        nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % buttons.length;
        break;
      case 'ArrowUp':
        nextIndex = currentIndex < 0 ? buttons.length - 1 : (currentIndex - 1 + buttons.length) % buttons.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = buttons.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    buttons[nextIndex].focus();
  }

  private initialPlace(triggerEl: HTMLElement): MenuPlace {
    const rect = rectInPage(triggerEl);
    const { width } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';
    return {
      top: rect.bottom + 4,
      start: rtl ? width - rect.right : rect.left,
      width: rect.width,
      maxHeight: null,
    };
  }

  private placeMenu(seq: number): void {
    if (seq !== this.menuSeq || !this.open() || this.placed()) return;
    const triggerEl = this.trigger()?.nativeElement;
    const listEl = this.menuListRef()?.nativeElement;
    if (!triggerEl || !listEl) return;

    const rect = rectInPage(triggerEl);
    const listRect = rectInPage(listEl);
    const { width, height } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';

    const belowTop = rect.bottom + 4;
    const spaceBelow = Math.max(8, height - 8 - belowTop);
    const spaceAbove = Math.max(8, rect.top - 12);
    const flipUp = listRect.height > spaceBelow && spaceAbove > spaceBelow;
    const avail = flipUp ? spaceAbove : spaceBelow;
    const maxHeight = listRect.height > avail ? avail : null;
    const finalHeight = maxHeight ?? listRect.height;
    const top = flipUp ? Math.max(8, rect.top - 4 - finalHeight) : belowTop;

    const triggerStart = rtl ? width - rect.right : rect.left;
    const triggerEnd = rtl ? width - rect.left : rect.right;
    const alignEnd = triggerStart + listRect.width > width - 8;
    const rawStart = alignEnd ? triggerEnd - listRect.width : triggerStart;
    const start = Math.min(Math.max(8, rawStart), Math.max(8, width - 8 - listRect.width));

    this.place.set({ top, start, width: rect.width, maxHeight });
    this.placed.set(true);

    listEl.style.top = `${top}px`;
    listEl.style.insetInlineStart = `${start}px`;
    listEl.style.minWidth = `${rect.width}px`;
    listEl.style.maxHeight = maxHeight !== null ? `${maxHeight}px` : '';
    listEl.classList.remove('invisible');
  }
}
