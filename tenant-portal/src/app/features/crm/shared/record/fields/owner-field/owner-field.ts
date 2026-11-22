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
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerCheck, tablerChevronDown } from '@ng-icons/tabler-icons';
import { CurrentUser } from '../../../../../../core/auth/current-user';
import { Field } from '../../../../../../shared/ui/field/field';
import { rectInPage, viewport } from '../../../../../../shared/ui/overlay/zoom';
import { OwnerOption } from '../record-fields.model';

interface MenuPlace {
  top: number;
  start: number;
  width: number;
  maxHeight: number | null;
}

function formatInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

@Component({
  selector: 'app-owner-field',
  imports: [NgIcon, TranslocoPipe, Field],
  providers: [
    provideTranslocoScope({ scope: 'record-fields', alias: 'recordFields' }),
    provideIcons({ tablerCheck, tablerChevronDown }),
  ],
  templateUrl: './owner-field.html',
  host: {
    class: 'block min-w-0',
    '(document:click)': 'closeIfOutside($event)',
    '(window:resize)': 'close()',
    '(keydown.escape)': 'onEscape($event)',
  },
})
export class OwnerField {
  private static nextId = 0;
  protected readonly uid = `rf-owner-${++OwnerField.nextId}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  private readonly menuListRef = viewChild<ElementRef<HTMLElement>>('menuList');
  protected readonly currentUser = inject(CurrentUser);

  readonly ownerId = model<string | null>(null);
  readonly owners = input<readonly OwnerOption[]>([]);
  readonly selfOnly = input(false);
  readonly readonly = input(false);
  readonly error = input<string | null>(null);
  readonly allowSelfDefault = input(false);
  readonly fallbackName = input<string | null>(null);

  protected readonly open = signal(false);
  protected readonly placed = signal(false);
  protected readonly place = signal<MenuPlace>({ top: 0, start: 0, width: 0, maxHeight: null });

  private menuSeq = 0;

  protected readonly isReadonly = computed(() => this.readonly() || this.selfOnly());

  protected readonly selectedOwner = computed<OwnerOption | null>(() => {
    const id = this.ownerId();
    const list = this.owners();
    if (id) {
      const match = list.find((item) => item.userId === id);
      if (match) return match;
      const fallback = this.fallbackName()?.trim();
      return fallback ? { userId: id, name: fallback, avatarUrl: null } : null;
    }
    if (this.selfOnly()) {
      return list[0] ?? { userId: '', name: this.currentUser.user().displayName, avatarUrl: null };
    }
    return null;
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

  protected initialsOf(name: string): string {
    return formatInitials(name);
  }

  protected toggle(): void {
    if (this.isReadonly()) return;
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

  protected select(userId: string | null): void {
    this.ownerId.set(userId);
    this.close();
    this.trigger()?.nativeElement.focus();
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
