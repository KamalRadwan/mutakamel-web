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
  viewChildren,
} from '@angular/core';
import { translationEvents } from '../../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerCheck, tablerChevronDown, tablerCircleOff, tablerStar } from '@ng-icons/tabler-icons';
import { tablerStarFill } from '@ng-icons/tabler-icons/fill';
import { Field } from '../../../../../../shared/ui/field/field';
import { rectInPage, viewport } from '../../../../../../shared/ui/overlay/zoom';
import { CARD_COLORS, CardColor } from '../record-fields.model';

const STARS = [1, 2, 3] as const;
const COLOR_KEYS = Object.keys(CARD_COLORS) as CardColor[];

interface MenuPlace {
  top: number;
  start: number;
  width: number;
  maxHeight: number | null;
}

@Component({
  selector: 'app-rating-colour-field',
  imports: [NgIcon, TranslocoPipe, Field],
  providers: [
    provideTranslocoScope({ scope: 'record-fields', alias: 'recordFields' }),
    provideIcons({ tablerCheck, tablerChevronDown, tablerCircleOff, tablerStar, tablerStarFill }),
  ],
  templateUrl: './rating-colour-field.html',
  host: {
    class: 'grid grid-cols-2 items-start gap-x-10 gap-y-8 min-w-0',
    '(document:click)': 'closeIfOutside($event)',
    '(window:resize)': 'close()',
    '(keydown.escape)': 'onEscape($event)',
  },
})
export class RatingColourField {
  private static nextId = 0;
  protected readonly uid = `rf-rating-color-${++RatingColourField.nextId}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly ratingGroup = viewChild<ElementRef<HTMLElement>>('ratingGroup');
  private readonly starBtns = viewChildren<ElementRef<HTMLButtonElement>>('starBtn');
  private readonly colorTrigger = viewChild<ElementRef<HTMLButtonElement>>('colorTrigger');
  private readonly menuListRef = viewChild<ElementRef<HTMLElement>>('menuList');

  protected readonly stars = STARS;
  protected readonly cardColors = CARD_COLORS;
  protected readonly colorKeys = COLOR_KEYS;

  readonly rating = model(0);
  readonly color = model<CardColor | null>(null);
  readonly instant = input(false);
  readonly readonly = input(false);
  readonly updating = input(false);
  readonly ratingLabelKey = input<string>('recordFields.rating.label');
  readonly ratingHintKey = input<string>('recordFields.rating.hint');
  readonly colorLabelKey = input<string>('recordFields.color.label');
  readonly colorHintKey = input<string>('recordFields.color.hint');

  readonly rate = output<number>();
  readonly recolor = output<CardColor | null>();

  protected readonly hoveredStar = signal<number | null>(null);
  protected readonly colorOpen = signal(false);
  protected readonly menuPlaced = signal(false);
  protected readonly menuPlace = signal<MenuPlace>({ top: 0, start: 0, width: 0, maxHeight: null });

  private menuSeq = 0;

  protected readonly activeRating = computed(() => this.hoveredStar() ?? this.rating());

  protected readonly ratingLabel = computed(() => {
    this.i18n();
    return this.transloco.translate(this.ratingLabelKey());
  });

  protected readonly ratingHint = computed(() => {
    this.i18n();
    return this.transloco.translate(this.ratingHintKey());
  });

  protected readonly colorFieldLabel = computed(() => {
    this.i18n();
    return this.transloco.translate(this.colorLabelKey());
  });

  protected readonly colorFieldHint = computed(() => {
    this.i18n();
    return this.transloco.translate(this.colorHintKey());
  });

  protected readonly colorLabel = computed(() => {
    this.i18n();
    const current = this.color();
    const key = current ? `recordFields.color.${current}` : 'recordFields.color.none';
    return this.transloco.translate(key);
  });

  constructor() {
    const onScroll = (event: Event) => {
      if (!this.colorOpen()) return;
      const target = event.target;
      if (target instanceof Node && this.menuListRef()?.nativeElement.contains(target)) return;
      this.close();
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    inject(DestroyRef).onDestroy(() => document.removeEventListener('scroll', onScroll, { capture: true }));

    afterNextRender(() => {
      const groupEl = this.ratingGroup()?.nativeElement;
      const labelEl = groupEl?.closest('ui-field')?.querySelector('label');
      if (labelEl) {
        labelEl.id = `${this.uid}-rating-label`;
      }
    });
  }

  protected starTabIndex(star: number): number {
    const current = this.rating();
    if (current >= 1 && current <= 3) {
      return star === current ? 0 : -1;
    }
    return star === 1 ? 0 : -1;
  }

  protected chooseRating(star: number): void {
    if (this.readonly() || this.updating()) return;
    this.hoveredStar.set(null);
    const next = star === this.rating() ? 0 : star;
    this.emitOrSetRating(next);
  }

  protected onRatingKeydown(event: KeyboardEvent, star: number): void {
    if (this.readonly() || this.updating()) return;
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';

    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault();
        this.selectStar(rtl ? (star === 1 ? 3 : star - 1) : (star === 3 ? 1 : star + 1));
        break;
      case 'ArrowLeft':
        event.preventDefault();
        this.selectStar(rtl ? (star === 3 ? 1 : star + 1) : (star === 1 ? 3 : star - 1));
        break;
      case 'ArrowDown':
        event.preventDefault();
        this.selectStar(star === 3 ? 1 : star + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.selectStar(star === 1 ? 3 : star - 1);
        break;
      case 'Home':
        event.preventDefault();
        this.selectStar(1);
        break;
      case 'End':
        event.preventDefault();
        this.selectStar(3);
        break;
      case '1':
      case '2':
      case '3':
        event.preventDefault();
        this.selectStar(Number(event.key));
        break;
      case '0':
      case 'Backspace':
      case 'Delete':
        event.preventDefault();
        this.hoveredStar.set(null);
        if (this.rating() !== 0) {
          this.emitOrSetRating(0);
        }
        break;
    }
  }

  protected toggleColorMenu(): void {
    if (this.readonly() || this.updating()) return;
    if (this.colorOpen()) {
      this.close();
      return;
    }
    const triggerEl = this.colorTrigger()?.nativeElement;
    if (!triggerEl) return;

    const seq = ++this.menuSeq;
    this.menuPlaced.set(false);
    this.menuPlace.set(this.initialPlace(triggerEl));
    this.colorOpen.set(true);
    queueMicrotask(() => this.placeMenu(seq));
    afterNextRender(() => this.placeMenu(seq), { injector: this.injector });
  }

  protected selectColor(nextColor: CardColor | null): void {
    this.close();
    this.colorTrigger()?.nativeElement.focus();
    if (this.readonly() || this.updating()) return;
    if (this.instant()) {
      this.recolor.emit(nextColor);
    } else {
      this.color.set(nextColor);
    }
  }

  protected close(): void {
    this.menuSeq++;
    this.colorOpen.set(false);
    this.menuPlaced.set(false);
  }

  protected closeIfOutside(event: Event): void {
    if (!this.colorOpen()) return;
    const target = event.target;
    if (!(target instanceof Node)) {
      this.close();
      return;
    }
    const triggerEl = this.colorTrigger()?.nativeElement;
    const listEl = this.menuListRef()?.nativeElement;
    if (triggerEl?.contains(target) || listEl?.contains(target)) return;
    this.close();
  }

  protected onEscape(event: Event): void {
    if (!this.colorOpen()) return;
    event.preventDefault();
    event.stopPropagation();
    this.close();
    this.colorTrigger()?.nativeElement.focus();
  }

  protected onColorMenuKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.onEscape(event);
      return;
    }

    const isNext = event.key === 'ArrowDown' || event.key === 'ArrowRight';
    const isPrev = event.key === 'ArrowUp' || event.key === 'ArrowLeft';
    const isHome = event.key === 'Home';
    const isEnd = event.key === 'End';
    if (!isNext && !isPrev && !isHome && !isEnd) return;

    const menuEl = this.menuListRef()?.nativeElement;
    if (!menuEl) return;
    const buttons = Array.from(menuEl.querySelectorAll<HTMLButtonElement>('button:not([disabled])'));
    if (buttons.length === 0) return;

    event.preventDefault();
    const currentIdx = buttons.findIndex((btn) => btn === document.activeElement);
    let nextIdx = 0;
    if (isHome) {
      nextIdx = 0;
    } else if (isEnd) {
      nextIdx = buttons.length - 1;
    } else if (isNext) {
      nextIdx = currentIdx < 0 ? 0 : (currentIdx + 1) % buttons.length;
    } else {
      nextIdx = currentIdx < 0 ? buttons.length - 1 : (currentIdx - 1 + buttons.length) % buttons.length;
    }

    for (let i = 0; i < buttons.length; i++) {
      buttons[i].tabIndex = i === nextIdx ? 0 : -1;
    }
    buttons[nextIdx]?.focus();
  }

  private selectStar(star: number): void {
    this.hoveredStar.set(null);
    if (star !== this.rating()) {
      this.emitOrSetRating(star);
    }
    this.starBtns()[star - 1]?.nativeElement.focus();
  }

  private emitOrSetRating(next: number): void {
    if (this.instant()) {
      this.rate.emit(next);
    } else {
      this.rating.set(next);
    }
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
    if (seq !== this.menuSeq || !this.colorOpen() || this.menuPlaced()) return;
    const triggerEl = this.colorTrigger()?.nativeElement;
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

    this.menuPlace.set({ top, start, width: rect.width, maxHeight });
    this.menuPlaced.set(true);

    listEl.style.top = `${top}px`;
    listEl.style.insetInlineStart = `${start}px`;
    listEl.style.minWidth = `${rect.width}px`;
    listEl.style.maxHeight = maxHeight !== null ? `${maxHeight}px` : '';
    listEl.classList.remove('invisible');

    const activeBtn =
      listEl.querySelector<HTMLButtonElement>('button[tabindex="0"]') ??
      listEl.querySelector<HTMLButtonElement>('button:not([disabled])');
    activeBtn?.focus();
  }
}
