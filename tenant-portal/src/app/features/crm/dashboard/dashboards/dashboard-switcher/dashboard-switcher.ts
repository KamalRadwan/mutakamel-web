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
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerCheck, tablerChevronDown, tablerSearch } from '@ng-icons/tabler-icons';
import { tablerStarFill } from '@ng-icons/tabler-icons/fill';
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';
import { Button } from '../../../../../shared/ui/button/button';
import { Badge } from '../../../../../shared/ui/badge/badge';
import { rectInPage, viewport } from '../../../../../shared/ui/overlay/zoom';
import { getNavigation } from '../dashboards.api';
import type { NavigationItem } from '../dashboards.model';

interface SwitcherPlace {
  top: number;
  start: number;
}

@Component({
  selector: 'app-dashboard-switcher',
  imports: [RouterLink, NgIcon, TranslocoPipe, Button, Badge],
  viewProviders: [
    provideTranslocoScope({ scope: 'crm-dash-page', alias: 'dashPage' }),
    provideIcons({ tablerChevronDown, tablerSearch, tablerCheck, tablerStarFill }),
  ],
  templateUrl: './dashboard-switcher.html',
  host: {
    class: 'relative inline-flex min-w-0 max-w-full',
    '(document:click)': 'closeIfOutside($event)',
    '(window:resize)': 'close()',
    '(keydown)': 'onKeydown($event)',
  },
})
export class DashboardSwitcher {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly triggerRef = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly panelRef = viewChild<ElementRef<HTMLElement>>('panel');
  private readonly searchInputRef = viewChild<ElementRef<HTMLInputElement>>('searchInput');
  private readonly rowBtns = viewChildren<ElementRef<HTMLButtonElement>>('rowBtn');

  readonly currentId = input<string | null>(null);
  readonly currentName = input.required<string>();
  readonly refreshTrigger = input(0);

  readonly switchTo = output<string>();

  protected readonly open = signal(false);
  protected readonly placed = signal(false);
  protected readonly loading = signal(false);
  protected readonly items = signal<NavigationItem[]>([]);
  protected readonly search = signal('');
  protected readonly place = signal<SwitcherPlace>({ top: 0, start: 0 });
  protected readonly skeletonRows = [0, 1, 2, 3] as const;

  private panelSeq = 0;
  private loadSeq = 0;

  protected readonly showSearch = computed(() => this.items().length > 8);

  protected readonly filtered = computed<NavigationItem[]>(() => {
    const q = this.search().trim().toLowerCase();
    const list = this.items();
    if (!q) return list;
    return list.filter((item) => item.name.toLowerCase().includes(q));
  });

  protected readonly favouriteItems = computed<NavigationItem[]>(() =>
    this.filtered().filter((item) => item.isFavorite),
  );

  protected readonly mineItems = computed<NavigationItem[]>(() =>
    this.filtered().filter((item) => !item.isFavorite && item.accessLevel === 'OWNER'),
  );

  protected readonly sharedItems = computed<NavigationItem[]>(() =>
    this.filtered().filter((item) => !item.isFavorite && item.accessLevel !== 'OWNER'),
  );

  protected readonly hasAnyVisible = computed(
    () =>
      this.favouriteItems().length > 0 ||
      this.mineItems().length > 0 ||
      this.sharedItems().length > 0,
  );

  constructor() {
    const onScroll = (event: Event) => {
      if (!this.open()) return;
      const target = event.target;
      const panelEl = this.panelRef()?.nativeElement;
      if (panelEl && target instanceof Node && panelEl.contains(target)) return;
      this.close();
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('scroll', onScroll, { capture: true });
      this.loadSeq++;
    });
  }

  protected toggle(): void {
    if (this.open()) {
      this.close();
      return;
    }
    const seq = ++this.panelSeq;
    this.search.set('');
    this.placed.set(false);
    this.place.set(this.initialPlace());
    this.open.set(true);
    void this.loadItems(seq);
    queueMicrotask(() => this.placePanel(seq, true));
    afterNextRender(() => this.placePanel(seq, true), { injector: this.injector });
  }

  protected close(): void {
    this.panelSeq++;
    this.open.set(false);
    this.placed.set(false);
  }

  protected select(id: string): void {
    this.close();
    if (id !== this.currentId()) {
      this.switchTo.emit(id);
    }
  }

  protected onSearchInput(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
    const seq = this.panelSeq;
    afterNextRender(() => this.placePanel(seq, false), { injector: this.injector });
  }

  protected closeIfOutside(event: Event): void {
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (!this.open()) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.close();
      this.triggerRef().nativeElement.focus();
      return;
    }

    const target = event.target as HTMLElement | null;
    if (!target) return;

    const searchEl = this.searchInputRef()?.nativeElement;
    const buttons = this.rowBtns().map((ref) => ref.nativeElement);

    if (searchEl && target === searchEl) {
      if (event.key === 'ArrowDown' && buttons.length > 0) {
        event.preventDefault();
        buttons[0]?.focus();
      } else if (event.key === 'ArrowUp' && buttons.length > 0) {
        event.preventDefault();
        buttons[buttons.length - 1]?.focus();
      }
      return;
    }

    const index = buttons.indexOf(target as HTMLButtonElement);
    if (index < 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (index === buttons.length - 1 && searchEl) {
        searchEl.focus();
      } else {
        buttons[(index + 1) % buttons.length]?.focus();
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (index === 0 && searchEl) {
        searchEl.focus();
      } else {
        buttons[(index - 1 + buttons.length) % buttons.length]?.focus();
      }
    } else if (event.key === 'Home') {
      event.preventDefault();
      buttons[0]?.focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      buttons[buttons.length - 1]?.focus();
    }
  }

  private async loadItems(panelSeq: number): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(this.items().length === 0);
    try {
      const res = await getNavigation();
      if (seq !== this.loadSeq) return;
      this.items.set(res.items);
      if (panelSeq === this.panelSeq && this.open()) {
        afterNextRender(() => this.placePanel(panelSeq, this.items().length <= 8), {
          injector: this.injector,
        });
      }
    } catch {
      // Keep existing cached items if refresh fails.
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  private initialPlace(): SwitcherPlace {
    const rect = rectInPage(this.triggerRef().nativeElement);
    const { width } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';
    return {
      top: rect.bottom + 4,
      start: rtl ? width - rect.right : rect.left,
    };
  }

  private placePanel(seq: number, moveFocus: boolean): void {
    if (seq !== this.panelSeq || !this.open()) return;
    const panelEl = this.panelRef()?.nativeElement;
    if (!panelEl) return;

    const rect = rectInPage(this.triggerRef().nativeElement);
    const panelRect = rectInPage(panelEl);
    const { width, height } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';

    const belowTop = rect.bottom + 4;
    const spaceBelow = Math.max(8, height - 8 - belowTop);
    const spaceAbove = Math.max(8, rect.top - 12);
    const flipUp = panelRect.height > spaceBelow && spaceAbove > spaceBelow;
    const top = flipUp ? Math.max(8, rect.top - 4 - panelRect.height) : belowTop;

    const rawStart = rtl ? width - rect.right : rect.left;
    const maxStart = Math.max(8, width - 8 - panelRect.width);
    const start = Math.min(Math.max(8, rawStart), maxStart);

    this.place.set({ top, start });
    this.placed.set(true);
    panelEl.style.top = `${top}px`;
    panelEl.style.insetInlineStart = `${start}px`;
    panelEl.classList.remove('invisible');

    if (moveFocus) {
      const searchEl = this.searchInputRef()?.nativeElement;
      if (searchEl) {
        searchEl.focus();
      } else {
        const buttons = this.rowBtns().map((ref) => ref.nativeElement);
        const currentBtn = buttons.find((btn) => btn.getAttribute('aria-current') === 'true');
        (currentBtn ?? buttons[0])?.focus();
      }
    }
  }
}
