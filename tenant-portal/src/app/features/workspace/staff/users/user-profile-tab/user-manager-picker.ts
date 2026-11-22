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
import { tablerCheck, tablerChevronDown, tablerLoader2, tablerSearch } from '@ng-icons/tabler-icons';
import { TranslocoPipe } from '@jsverse/transloco';
import { rectInPage, viewport } from '../../../../../shared/ui/overlay/zoom';
import { TenantUser } from '../../shared/staff.model';
import { StaffUsersApi } from '../users.api';
import { userFullName } from '../users-page/users.model';

interface MenuPlace {
  top: number;
  start: number;
  width: number;
  maxHeight: number | null;
}

const SEARCH_DEBOUNCE_MS = 200;

@Component({
  selector: 'app-user-manager-picker',
  imports: [NgIcon, TranslocoPipe],
  providers: [provideIcons({ tablerChevronDown, tablerSearch, tablerLoader2, tablerCheck })],
  templateUrl: './user-manager-picker.html',
  host: {
    class: 'block min-w-0',
    '(document:click)': 'closeIfOutside($event)',
    '(window:resize)': 'close()',
    '(keydown.escape)': 'onHostEscape($event)',
  },
})
export class UserManagerPicker {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly api = inject(StaffUsersApi);

  private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  private readonly menuPanel = viewChild<ElementRef<HTMLElement>>('menuPanel');
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  readonly value = model<string | null>(null);
  readonly excludeUserId = input<string | null>(null);
  readonly knownUsers = input<TenantUser[]>([]);
  readonly readonly = input(false);
  readonly disabled = input(false);
  readonly fieldId = input('');
  readonly describedBy = input('');
  readonly hasError = input(false);
  readonly label = input('');
  readonly emptyLabel = input('');
  readonly searchPlaceholder = input('');

  protected readonly menuOpen = signal(false);
  protected readonly menuPlaced = signal(false);
  protected readonly menuPlace = signal<MenuPlace>({ top: 0, start: 0, width: 0, maxHeight: null });
  protected readonly search = signal('');
  protected readonly searching = signal(false);
  protected readonly options = signal<TenantUser[]>([]);
  protected readonly resolvedSelected = signal<TenantUser | null>(null);

  private searchSeq = 0;
  private menuSeq = 0;
  private resolveSeq = 0;
  private lastResolvedId: string | null = null;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly visibleOptions = computed(() => {
    const excluded = this.excludeUserId();
    return excluded ? this.options().filter((u) => u.id !== excluded) : this.options();
  });

  protected readonly selectedUser = computed<TenantUser | null>(() => {
    const id = this.value();
    if (!id) return null;
    const resolved = this.resolvedSelected();
    if (resolved?.id === id) return resolved;
    const found =
      this.options().find((u) => u.id === id) ??
      this.knownUsers().find((u) => u.id === id) ??
      null;
    if (!found && this.lastResolvedId !== id) {
      queueMicrotask(() => void this.resolveUserById(id));
    }
    return found;
  });

  constructor() {
    const onScroll = (event: Event) => {
      if (!this.menuOpen()) return;
      const target = event.target;
      if (target instanceof Node && this.menuPanel()?.nativeElement.contains(target)) return;
      this.close();
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    this.destroyRef.onDestroy(() => {
      document.removeEventListener('scroll', onScroll, { capture: true });
      if (this.searchTimer !== null) clearTimeout(this.searchTimer);
    });
  }

  protected fullName(user: TenantUser): string {
    return userFullName(user);
  }

  protected toggle(): void {
    if (this.readonly() || this.disabled()) return;
    if (this.menuOpen()) {
      this.close();
      return;
    }
    const triggerEl = this.trigger()?.nativeElement;
    if (!triggerEl) return;

    const seq = ++this.menuSeq;
    this.search.set('');
    this.menuPlaced.set(false);
    this.menuPlace.set(this.initialPlace(triggerEl));
    this.menuOpen.set(true);
    void this.loadOptions('');
    queueMicrotask(() => this.placeMenu(seq));
    afterNextRender(
      () => {
        this.placeMenu(seq);
        this.searchInput()?.nativeElement.focus();
      },
      { injector: this.injector },
    );
  }

  close(): void {
    this.menuSeq++;
    this.menuOpen.set(false);
    this.menuPlaced.set(false);
  }

  protected closeIfOutside(event: Event): void {
    if (!this.menuOpen()) return;
    const target = event.target;
    if (!(target instanceof Node)) {
      this.close();
      return;
    }
    if (
      this.trigger()?.nativeElement.contains(target) ||
      this.menuPanel()?.nativeElement.contains(target)
    ) {
      return;
    }
    this.close();
  }

  protected onHostEscape(event: Event): void {
    if (!this.menuOpen()) return;
    event.preventDefault();
    event.stopPropagation();
    this.close();
    this.trigger()?.nativeElement.focus();
  }

  protected onSearchInput(event: Event): void {
    const term = (event.target as HTMLInputElement).value;
    this.search.set(term);
    if (this.searchTimer !== null) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
    this.searchTimer = setTimeout(() => {
      void this.loadOptions(term);
    }, SEARCH_DEBOUNCE_MS);
  }

  protected onMenuKeydown(event: KeyboardEvent): void {
    const panelEl = this.menuPanel()?.nativeElement;
    if (!panelEl) return;
    const buttons = Array.from(panelEl.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
    if (buttons.length === 0) return;

    const currentIndex = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const next = currentIndex < 0 ? 0 : (currentIndex + 1) % buttons.length;
      buttons[next]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (currentIndex <= 0) {
        this.searchInput()?.nativeElement.focus();
      } else {
        buttons[currentIndex - 1]?.focus();
      }
    }
  }

  protected select(user: TenantUser | null): void {
    if (this.readonly() || this.disabled()) return;
    this.value.set(user?.id ?? null);
    this.resolvedSelected.set(user);
    this.lastResolvedId = user?.id ?? null;
    this.close();
    this.trigger()?.nativeElement.focus();
  }

  private async resolveUserById(userId: string): Promise<void> {
    this.lastResolvedId = userId;
    const seq = ++this.resolveSeq;
    try {
      const user = await this.api.getUser(userId);
      if (seq !== this.resolveSeq || this.value() !== userId) return;
      this.resolvedSelected.set(user);
    } catch {
      // Leave fallback if user cannot be resolved.
    }
  }

  private async loadOptions(search: string): Promise<void> {
    const seq = ++this.searchSeq;
    this.searching.set(true);
    try {
      const page = await this.api.listUsers({
        status: 'ACTIVE',
        ...(search.trim() ? { search: search.trim() } : {}),
        limit: 20,
      });
      if (seq !== this.searchSeq) return;
      this.options.set(page.data);
      if (this.menuOpen()) {
        queueMicrotask(() => this.placeMenu(this.menuSeq));
      }
    } catch {
      if (seq !== this.searchSeq) return;
      this.options.set([]);
    } finally {
      if (seq === this.searchSeq) {
        this.searching.set(false);
      }
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
    if (seq !== this.menuSeq || !this.menuOpen()) return;
    const triggerEl = this.trigger()?.nativeElement;
    const panelEl = this.menuPanel()?.nativeElement;
    if (!triggerEl || !panelEl) return;

    const rect = rectInPage(triggerEl);
    const panelRect = rectInPage(panelEl);
    const { width, height } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';

    const belowTop = rect.bottom + 4;
    const spaceBelow = Math.max(8, height - 8 - belowTop);
    const spaceAbove = Math.max(8, rect.top - 12);
    const flipUp = panelRect.height > spaceBelow && spaceAbove > spaceBelow;
    const avail = flipUp ? spaceAbove : spaceBelow;
    const maxHeight = panelRect.height > avail ? avail : null;
    const finalHeight = maxHeight ?? panelRect.height;
    const top = flipUp ? Math.max(8, rect.top - 4 - finalHeight) : belowTop;

    const triggerStart = rtl ? width - rect.right : rect.left;
    const triggerEnd = rtl ? width - rect.left : rect.right;
    const alignEnd = triggerStart + panelRect.width > width - 8;
    const rawStart = alignEnd ? triggerEnd - panelRect.width : triggerStart;
    const start = Math.min(Math.max(8, rawStart), Math.max(8, width - 8 - panelRect.width));

    this.menuPlace.set({ top, start, width: rect.width, maxHeight });
    this.menuPlaced.set(true);
  }
}
