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
  signal,
  viewChild,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerCheck, tablerChevronDown, tablerX } from '@ng-icons/tabler-icons';
import { rectInPage, viewport } from '../../../../../../shared/ui/overlay/zoom';
import { PartyRoleType } from '../../party-directory.model';

export interface RoleSelectOption {
  value: PartyRoleType;
  label: string;
}

interface ListPlace {
  top: number;
  start: number;
  width: number;
  maxHeight: number | null;
}

@Component({
  selector: 'app-party-role-select',
  imports: [NgIcon],
  providers: [provideIcons({ tablerCheck, tablerChevronDown, tablerX })],
  templateUrl: './party-role-select.html',
  host: {
    class: 'relative block min-w-0',
    '(document:click)': 'closeIfOutside($event)',
    '(window:resize)': 'close()',
    '(keydown.escape)': 'onEscape($event)',
  },
})
export class PartyRoleSelect {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly triggerBox = viewChild.required<ElementRef<HTMLElement>>('triggerBox');
  private readonly listRef = viewChild<ElementRef<HTMLElement>>('list');
  private listSeq = 0;

  readonly options = input.required<readonly RoleSelectOption[]>();
  readonly value = model<PartyRoleType[]>([]);
  readonly label = input.required<string>();
  readonly placeholder = input('');
  readonly removeLabel = input('');
  readonly fieldId = input('');
  readonly describedBy = input('');
  readonly disabled = input(false);
  readonly readonly = input(false);

  protected readonly open = signal(false);
  protected readonly placed = signal(false);
  protected readonly place = signal<ListPlace>({ top: 0, start: 0, width: 0, maxHeight: null });

  protected readonly optionMap = computed(() => new Map(this.options().map((o) => [o.value, o])));
  protected readonly selectedSet = computed(() => new Set(this.value()));
  protected readonly selectedOptions = computed(() => {
    const map = this.optionMap();
    return this.value()
      .map((val) => map.get(val))
      .filter((opt): opt is RoleSelectOption => opt !== undefined);
  });

  protected readonly boxClasses = computed(() => {
    const base =
      'flex min-h-field w-full flex-wrap items-center justify-between gap-4 rounded-8 border px-8 py-2 text-12 transition-colors duration-fast';
    if (this.disabled()) {
      return `${base} cursor-not-allowed border-border-field bg-neutral-soft text-text-placeholder`;
    }
    if (this.readonly()) {
      return `${base} border-border-field bg-surface-field text-text`;
    }
    if (this.open()) {
      return `${base} cursor-pointer border-focus-ring bg-surface-field text-text ring-3 ring-focus-halo`;
    }
    return `${base} cursor-pointer border-border-field bg-surface-field text-text hover:border-border-field-hover focus-within:border-focus-ring focus-within:ring-3 focus-within:ring-focus-halo`;
  });

  constructor() {
    const onScroll = (event: Event) => {
      if (!this.open()) return;
      const target = event.target;
      if (target instanceof Node && this.listRef()?.nativeElement.contains(target)) return;
      this.close();
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    inject(DestroyRef).onDestroy(() => document.removeEventListener('scroll', onScroll, { capture: true }));
  }

  protected isSelected(role: PartyRoleType): boolean {
    return this.selectedSet().has(role);
  }

  protected toggleMenu(): void {
    if (this.disabled() || this.readonly()) return;
    if (this.open()) {
      this.close();
      return;
    }
    const seq = ++this.listSeq;
    this.placed.set(false);
    this.place.set(this.initialPlace());
    this.open.set(true);
    queueMicrotask(() => this.placeList(seq));
    afterNextRender(() => this.placeList(seq), { injector: this.injector });
  }

  protected toggleOption(role: PartyRoleType): void {
    if (this.disabled() || this.readonly()) return;
    this.value.update((current) =>
      current.includes(role) ? current.filter((item) => item !== role) : [...current, role],
    );
    queueMicrotask(() => this.placeList(++this.listSeq));
  }

  protected removeRole(role: PartyRoleType): void {
    if (this.disabled() || this.readonly()) return;
    this.value.update((current) => current.filter((item) => item !== role));
    if (this.open()) {
      queueMicrotask(() => this.placeList(++this.listSeq));
    }
  }

  close(): void {
    this.listSeq++;
    this.open.set(false);
    this.placed.set(false);
  }

  protected closeIfOutside(event: Event): void {
    if (!this.open()) return;
    const target = event.target;
    if (!(target instanceof Node) || !this.host.nativeElement.contains(target)) {
      this.close();
    }
  }

  protected onEscape(event: Event): void {
    if (!this.open()) return;
    event.preventDefault();
    event.stopPropagation();
    this.close();
    this.triggerBox().nativeElement.focus();
  }

  private initialPlace(): ListPlace {
    const rect = rectInPage(this.triggerBox().nativeElement);
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
    const rect = rectInPage(this.triggerBox().nativeElement);
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
