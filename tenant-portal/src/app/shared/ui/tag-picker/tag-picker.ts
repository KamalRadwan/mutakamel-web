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
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerCheck,
  tablerCircleX,
  tablerLoader2,
  tablerPlus,
  tablerX,
} from '@ng-icons/tabler-icons';
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';
import { errorCodeOf, fieldErrorsOf, isValidationError } from '../../../core/api/api-errors';
import { rectInPage, viewport } from '../overlay/zoom';

export interface TagOption {
  id: string;
  name: string;
  backgroundColor: string | null;
  textColor: string | null;
}

interface ListPlace {
  top: number;
  start: number;
  width: number;
  maxHeight: number | null;
}

const MAX_TAG_NAME_LENGTH = 60;
const ARABIC_DIACRITICS = /[\u064B-\u065F\u0670\u06D6-\u06ED]/g;

function normalizeForMatch(value: string): string {
  return value.replace(ARABIC_DIACRITICS, '').toLowerCase();
}

@Component({
  selector: 'ui-tag-picker',
  imports: [NgIcon, TranslocoPipe],
  viewProviders: [provideTranslocoScope({ scope: 'ui-tag-picker', alias: 'tagPicker' })],
  providers: [provideIcons({ tablerCheck, tablerCircleX, tablerLoader2, tablerPlus, tablerX })],
  templateUrl: './tag-picker.html',
  host: {
    class: 'relative block min-w-0',
    '(document:click)': 'closeIfOutside($event)',
    '(window:resize)': 'closeMenu()',
  },
})
export class TagPicker {
  private static nextId = 0;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly fieldBox = viewChild.required<ElementRef<HTMLElement>>('fieldBox');
  private readonly inputEl = viewChild<ElementRef<HTMLInputElement>>('inputEl');
  private readonly listRef = viewChild<ElementRef<HTMLElement>>('list');

  protected readonly uid = `ui-tag-picker-${++TagPicker.nextId}`;
  protected readonly listId = `${this.uid}-list`;
  protected readonly errId = `${this.uid}-err`;

  private listSeq = 0;
  private appliedDescribedBy: string[] = [];
  private readonly createdCache = signal<TagOption[]>([]);

  readonly options = input.required<TagOption[]>();
  readonly canCreate = input(false);
  readonly max = input(50);
  readonly disabled = input(false);
  readonly readonly = input(false);
  readonly label = input.required<string>();
  readonly inputId = input('');
  /** Optional space-separated id list added to the input's aria-describedby (e.g. a ui-field hint id). */
  readonly describedBy = input<string | null>(null);
  readonly createTag = input<((name: string) => Promise<TagOption>) | null>(null);

  readonly value = model<string[]>([]);
  readonly created = output<TagOption>();

  protected readonly query = signal('');
  protected readonly open = signal(false);
  protected readonly placed = signal(false);
  protected readonly place = signal<ListPlace>({ top: 0, start: 0, width: 0, maxHeight: null });
  protected readonly activeIndex = signal(0);
  protected readonly creating = signal(false);
  protected readonly errorKey = signal<string | null>(null);

  protected readonly allOptions = computed<TagOption[]>(() => {
    const incoming = this.options();
    const incomingIds = new Set(incoming.map((opt) => opt.id));
    const pending = this.createdCache().filter((opt) => !incomingIds.has(opt.id));
    return pending.length ? [...incoming, ...pending] : incoming;
  });

  protected readonly optionById = computed(
    () => new Map(this.allOptions().map((opt) => [opt.id, opt])),
  );
  protected readonly selectedSet = computed(() => new Set(this.value()));
  protected readonly atMax = computed(() => this.value().length >= this.max());

  protected readonly selectedTags = computed<TagOption[]>(() => {
    const byId = this.optionById();
    return this.value()
      .map((id) => byId.get(id))
      .filter((tag): tag is TagOption => tag !== undefined);
  });

  protected readonly trimmedQuery = computed(() => this.query().trim());
  protected readonly trimmedLength = computed(() => [...this.trimmedQuery()].length);

  protected readonly filteredOptions = computed(() => {
    const q = normalizeForMatch(this.trimmedQuery());
    const list = this.allOptions();
    return q ? list.filter((opt) => normalizeForMatch(opt.name).includes(q)) : list;
  });

  protected readonly hasExactMatch = computed(() => {
    const q = this.trimmedQuery().toLowerCase();
    return q.length > 0 && this.allOptions().some((opt) => opt.name.trim().toLowerCase() === q);
  });

  protected readonly createTooLong = computed(() => this.trimmedLength() > MAX_TAG_NAME_LENGTH);

  protected readonly showCreateRow = computed(
    () =>
      this.canCreate() &&
      this.createTag() !== null &&
      this.trimmedLength() >= 1 &&
      !this.hasExactMatch(),
  );

  protected readonly canActivateCreate = computed(
    () => this.showCreateRow() && !this.createTooLong() && !this.atMax(),
  );

  protected readonly navigableCount = computed(
    () => this.filteredOptions().length + (this.canActivateCreate() ? 1 : 0),
  );

  protected readonly safeActiveIndex = computed(() => {
    const count = this.navigableCount();
    if (count === 0) return -1;
    const idx = this.activeIndex();
    return idx >= 0 && idx < count ? idx : 0;
  });

  protected readonly activeDescendantId = computed(() => {
    if (!this.open() || this.readonly() || this.disabled()) return null;
    const idx = this.safeActiveIndex();
    return idx >= 0 ? this.optionId(idx) : null;
  });

  protected readonly fieldBoxClasses = computed(() => {
    const base =
      'flex min-h-field flex-wrap items-center gap-2 rounded-8 border px-8 py-border text-12 transition-colors duration-fast';
    if (this.disabled()) {
      return `${base} cursor-not-allowed border-border-field bg-neutral-soft text-text-placeholder`;
    }
    if (this.readonly()) {
      return `${base} border-border-field bg-surface-field text-text`;
    }
    if (this.errorKey()) {
      return `${base} border-danger-border bg-surface-field text-text ring-2 ring-danger-halo`;
    }
    if (this.open()) {
      return `${base} border-focus-ring bg-surface-field text-text ring-3 ring-focus-halo-strong`;
    }
    return `${base} border-border-field bg-surface-field text-text hover:border-border-field-hover focus-within:border-focus-ring focus-within:ring-3 focus-within:ring-focus-halo-strong`;
  });

  constructor() {
    effect(() => {
      const input = this.inputEl()?.nativeElement;
      const hasErr = Boolean(this.errorKey());
      const external = (this.describedBy() ?? '').split(/\s+/).filter(Boolean);
      if (!input) return;
      const previous = this.appliedDescribedBy;
      const tokens = (input.getAttribute('aria-describedby') ?? '')
        .split(/\s+/)
        .filter(
          (t) => Boolean(t) && t !== this.errId && !previous.includes(t) && !external.includes(t),
        );
      tokens.push(...external);
      this.appliedDescribedBy = external;
      if (hasErr) tokens.push(this.errId);
      const next = tokens.join(' ');
      const current = input.getAttribute('aria-describedby') ?? '';
      if (next === current) return;
      if (next) {
        input.setAttribute('aria-describedby', next);
      } else {
        input.removeAttribute('aria-describedby');
      }
    });

    const onScroll = (event: Event) => {
      if (!this.open()) return;
      const target = event.target;
      if (target instanceof Node && this.host.nativeElement.contains(target)) return;
      this.closeMenu();
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    inject(DestroyRef).onDestroy(() =>
      document.removeEventListener('scroll', onScroll, { capture: true }),
    );
  }

  protected optionId(index: number): string {
    return `${this.uid}-opt-${index}`;
  }

  protected isSelected(id: string): boolean {
    return this.selectedSet().has(id);
  }

  protected hasCustomColors(tag: TagOption): boolean {
    return Boolean(tag.backgroundColor && tag.textColor);
  }

  protected rowClasses(option: TagOption, index: number): string {
    const selected = this.isSelected(option.id);
    const active = this.safeActiveIndex() === index;
    const disabledAdd = !selected && this.atMax();
    if (disabledAdd) {
      return 'cursor-not-allowed text-text-placeholder opacity-drag-source';
    }
    if (selected) {
      return active
        ? 'cursor-pointer bg-brand-soft text-on-brand-soft ring-2 ring-focus-halo'
        : 'cursor-pointer bg-brand-soft text-on-brand-soft';
    }
    return active
      ? 'cursor-pointer bg-row-hover text-text'
      : 'cursor-pointer text-text hover:bg-row-hover';
  }

  protected createRowClasses(): string {
    if (this.createTooLong() || this.atMax()) {
      return 'cursor-not-allowed text-text-placeholder opacity-drag-source';
    }
    const index = this.filteredOptions().length;
    const active = this.safeActiveIndex() === index;
    return active
      ? 'cursor-pointer bg-row-hover text-text'
      : 'cursor-pointer text-text hover:bg-row-hover';
  }

  protected onFieldClick(): void {
    if (this.disabled() || this.readonly()) return;
    this.inputEl()?.nativeElement.focus();
    this.openMenu();
  }

  protected onInput(event: Event): void {
    if (this.disabled() || this.readonly() || this.atMax()) {
      if (this.atMax()) {
        (event.target as HTMLInputElement).value = '';
        this.query.set('');
      }
      return;
    }
    const value = (event.target as HTMLInputElement).value;
    this.query.set(value);
    this.errorKey.set(null);
    this.activeIndex.set(0);
    if (!this.open()) {
      this.openMenu();
    } else {
      this.schedulePlace();
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (this.disabled() || this.readonly()) return;

    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault();
        if (!this.open()) {
          this.activeIndex.set(0);
          this.openMenu();
          return;
        }
        const count = this.navigableCount();
        if (count > 0) {
          const next = (this.safeActiveIndex() + 1) % count;
          this.activeIndex.set(next);
          this.scrollOptionIntoView(next);
        }
        break;
      }
      case 'ArrowUp': {
        event.preventDefault();
        if (!this.open()) {
          this.activeIndex.set(0);
          this.openMenu();
          return;
        }
        const count = this.navigableCount();
        if (count > 0) {
          const prev = (this.safeActiveIndex() - 1 + count) % count;
          this.activeIndex.set(prev);
          this.scrollOptionIntoView(prev);
        }
        break;
      }
      case 'Enter': {
        if (!this.open()) return;
        event.preventDefault();
        event.stopPropagation();
        const idx = this.safeActiveIndex();
        const filtered = this.filteredOptions();
        if (idx >= 0 && idx < filtered.length) {
          this.toggleOption(filtered[idx]);
        } else if (idx === filtered.length && this.canActivateCreate()) {
          void this.triggerCreate();
        }
        break;
      }
      case 'Escape': {
        if (!this.open()) return;
        event.preventDefault();
        event.stopPropagation();
        this.closeMenu();
        break;
      }
      case 'Backspace': {
        if (this.query() === '' && this.value().length > 0) {
          this.value.update((ids) => ids.slice(0, -1));
          if (this.open()) this.schedulePlace();
        }
        break;
      }
      case 'Tab': {
        this.closeMenu();
        break;
      }
    }
  }

  protected toggleOption(option: TagOption): void {
    if (this.disabled() || this.readonly() || this.creating()) return;
    if (this.isSelected(option.id)) {
      this.value.update((ids) => ids.filter((id) => id !== option.id));
      this.clearInput();
      this.activeIndex.set(0);
      this.schedulePlace();
      this.inputEl()?.nativeElement.focus();
      return;
    }
    if (this.atMax()) return;
    this.value.update((ids) => [...ids, option.id]);
    this.clearInput();
    this.activeIndex.set(0);
    if (this.atMax()) {
      this.closeMenu();
    } else {
      this.schedulePlace();
    }
    this.inputEl()?.nativeElement.focus();
  }

  protected removeTag(id: string): void {
    if (this.disabled() || this.readonly()) return;
    this.value.update((ids) => ids.filter((item) => item !== id));
    if (this.open()) {
      this.schedulePlace();
    }
  }

  protected onCreateRowClick(): void {
    if (!this.canActivateCreate() || this.creating()) return;
    void this.triggerCreate();
  }

  protected closeIfOutside(event: Event): void {
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.closeMenu();
    }
  }

  protected closeMenu(): void {
    this.listSeq++;
    this.open.set(false);
    this.placed.set(false);
  }

  private openMenu(): void {
    if (this.open() || this.disabled() || this.readonly() || this.atMax()) return;
    this.placed.set(false);
    this.place.set(this.initialPlace());
    this.open.set(true);
    this.schedulePlace();
  }

  private schedulePlace(): void {
    const seq = ++this.listSeq;
    queueMicrotask(() => this.placeList(seq));
    afterNextRender(() => this.placeList(seq), { injector: this.injector });
  }

  private clearInput(): void {
    this.query.set('');
    this.errorKey.set(null);
    const input = this.inputEl()?.nativeElement;
    if (input) input.value = '';
  }

  private async triggerCreate(): Promise<void> {
    if (!this.canActivateCreate() || this.creating()) return;
    const createFn = this.createTag();
    const name = this.trimmedQuery();
    if (!createFn || !name) return;

    this.creating.set(true);
    this.errorKey.set(null);
    try {
      const tag = await createFn(name);
      this.createdCache.update((list) => [...list.filter((item) => item.id !== tag.id), tag]);
      if (!this.selectedSet().has(tag.id) && this.value().length < this.max()) {
        this.value.update((ids) => [...ids, tag.id]);
      }
      this.created.emit(tag);
      this.clearInput();
      this.activeIndex.set(0);
      if (this.atMax()) {
        this.closeMenu();
      } else {
        this.schedulePlace();
      }
      this.inputEl()?.nativeElement.focus();
    } catch (error) {
      this.errorKey.set(tagCreateErrorKey(error));
    } finally {
      this.creating.set(false);
    }
  }

  private scrollOptionIntoView(index: number): void {
    document.getElementById(this.optionId(index))?.scrollIntoView({ block: 'nearest' });
  }

  private initialPlace(): ListPlace {
    const rect = rectInPage(this.fieldBox().nativeElement);
    const { width } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';
    return {
      top: rect.bottom + 4,
      start: rtl ? width - rect.right : rect.left,
      width: rect.width,
      maxHeight: null,
    };
  }

  private placeList(seq: number): void {
    if (seq !== this.listSeq || !this.open()) return;
    const listEl = this.listRef()?.nativeElement;
    if (!listEl) return;

    listEl.style.maxHeight = '';
    const rect = rectInPage(this.fieldBox().nativeElement);
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

/**
 * Message key for a failed tag creation. 400 CRM_VALIDATION_FAILED is mapped like settings tagErrorMessage:
 * colour keys first, then `name`; CRM_TAG_NAME_INVALID / CRM_TAG_COLOR_INVALID are no longer sent.
 */
export function tagCreateErrorKey(error: unknown): string {
  const code = errorCodeOf(error);
  if (code === 'CRM_TAG_NAME_TAKEN') return 'tagPicker.errors.taken';
  if (code === 'CRM_TAG_LIMIT_EXCEEDED') return 'tagPicker.errors.limit';
  if (isValidationError(error)) {
    const fields = Object.keys(fieldErrorsOf(error));
    if (fields.includes('backgroundColor') || fields.includes('textColor')) return 'tagPicker.errors.colorInvalid';
    if (fields.includes('name')) return 'tagPicker.errors.nameInvalid';
  }
  return 'tagPicker.errors.failed';
}
