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
import { translationEvents } from '../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerCheck, tablerChevronDown, tablerSearch } from '@ng-icons/tabler-icons';
import { Badge } from '../../../../shared/ui/badge/badge';
import { rectInPage, viewport } from '../../../../shared/ui/overlay/zoom';
import { TabItem, Tabs, tabButtonId, tabPanelId } from '../../../../shared/ui/tabs/tabs';
import type { NavItem } from '../trade-dashboard.model';

type SwitcherTab = 'favourites' | 'mine' | 'shared';

interface SwitcherPlace {
  top: number;
  start: number;
}

const VIEWPORT_MARGIN = 8;
const POPOVER_GAP = 4;

@Component({
  selector: 'app-trade-dashboard-switcher',
  imports: [NgIcon, TranslocoPipe, Badge, Tabs],
  providers: [provideIcons({ tablerChevronDown, tablerSearch, tablerCheck })],
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
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  private readonly chevronBtn = viewChild.required<ElementRef<HTMLButtonElement>>('chevronBtn');
  private readonly panelRef = viewChild<ElementRef<HTMLElement>>('panel');
  private readonly searchInputRef = viewChild<ElementRef<HTMLInputElement>>('searchInput');
  private readonly rowBtns = viewChildren<ElementRef<HTMLButtonElement>>('rowBtn');

  readonly items = input.required<readonly NavItem[]>();
  readonly currentId = input<string | null>(null);
  readonly currentName = input.required<string>();

  readonly selected = output<string>();

  protected readonly open = signal(false);
  protected readonly placed = signal(false);
  protected readonly activeTab = signal<SwitcherTab>('mine');
  protected readonly search = signal('');
  protected readonly place = signal<SwitcherPlace>({ top: 0, start: 0 });
  protected readonly tabButtonId = tabButtonId;
  protected readonly tabPanelId = tabPanelId;

  private panelSeq = 0;

  protected readonly showSearch = computed(() => this.items().length > 8);

  protected readonly favouriteItems = computed<readonly NavItem[]>(() =>
    this.items().filter((item) => item.isFavorite),
  );

  protected readonly mineItems = computed<readonly NavItem[]>(() =>
    this.items().filter((item) => item.accessLevel === 'OWNER'),
  );

  protected readonly sharedItems = computed<readonly NavItem[]>(() =>
    this.items().filter((item) => item.accessLevel !== 'OWNER'),
  );

  protected readonly tabs = computed<TabItem[]>(() => {
    this.i18n();
    return [
      {
        id: 'favourites',
        label: this.transloco.translate('tradeDashboard.switcher.tabs.favourites'),
        count: this.favouriteItems().length,
      },
      {
        id: 'mine',
        label: this.transloco.translate('tradeDashboard.switcher.tabs.mine'),
        count: this.mineItems().length,
      },
      {
        id: 'shared',
        label: this.transloco.translate('tradeDashboard.switcher.tabs.shared'),
        count: this.sharedItems().length,
      },
    ];
  });

  protected readonly visibleItems = computed<readonly NavItem[]>(() => {
    const tab = this.activeTab();
    const base =
      tab === 'favourites'
        ? this.favouriteItems()
        : tab === 'shared'
          ? this.sharedItems()
          : this.mineItems();

    const q = this.search().trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (item) =>
        item.name.toLowerCase().includes(q) || (item.ownerName ?? '').toLowerCase().includes(q),
    );
  });

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
    });
  }

  protected toggle(): void {
    if (this.open()) {
      this.close();
      return;
    }
    const seq = ++this.panelSeq;
    this.search.set('');
    this.activeTab.set(this.initialTab());
    this.placed.set(false);
    this.place.set(this.initialPlace());
    this.open.set(true);
    queueMicrotask(() => this.placePanel(seq, true));
    afterNextRender(() => this.placePanel(seq, true), { injector: this.injector });
  }

  protected close(): void {
    this.panelSeq++;
    this.open.set(false);
    this.placed.set(false);
  }

  protected selectItem(id: string): void {
    this.close();
    this.chevronBtn().nativeElement.focus({ preventScroll: true });
    if (id !== this.currentId()) {
      this.selected.emit(id);
    }
  }

  protected onTabChange(nextId: string): void {
    if (nextId !== 'favourites' && nextId !== 'mine' && nextId !== 'shared') return;
    this.activeTab.set(nextId);
    const seq = this.panelSeq;
    afterNextRender(() => this.placePanel(seq, false), { injector: this.injector });
  }

  protected onSearchInput(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
    const seq = this.panelSeq;
    afterNextRender(() => this.placePanel(seq, false), { injector: this.injector });
  }

  protected closeIfOutside(event: Event): void {
    if (!this.open()) return;
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
      this.chevronBtn().nativeElement.focus({ preventScroll: true });
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

  private initialTab(): SwitcherTab {
    const curId = this.currentId();
    const cur = curId ? this.items().find((item) => item.id === curId) : undefined;
    if (cur?.isFavorite) return 'favourites';
    if (cur?.accessLevel === 'OWNER') return 'mine';
    if (cur) return 'shared';
    if (this.mineItems().length > 0) return 'mine';
    if (this.favouriteItems().length > 0) return 'favourites';
    if (this.sharedItems().length > 0) return 'shared';
    return 'mine';
  }

  private initialPlace(): SwitcherPlace {
    const rect = rectInPage(this.host.nativeElement);
    const { width } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';
    return {
      top: rect.bottom + POPOVER_GAP,
      start: rtl ? width - rect.right : rect.left,
    };
  }

  private placePanel(seq: number, moveFocus: boolean): void {
    if (seq !== this.panelSeq || !this.open()) return;
    const panelEl = this.panelRef()?.nativeElement;
    if (!panelEl) return;

    const rect = rectInPage(this.host.nativeElement);
    const panelRect = rectInPage(panelEl);
    const { width, height } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';

    const belowTop = rect.bottom + POPOVER_GAP;
    const spaceBelow = Math.max(VIEWPORT_MARGIN, height - VIEWPORT_MARGIN - belowTop);
    const spaceAbove = Math.max(VIEWPORT_MARGIN, rect.top - POPOVER_GAP - VIEWPORT_MARGIN);
    const flipUp = panelRect.height > spaceBelow && spaceAbove > spaceBelow;
    const top = flipUp
      ? Math.max(VIEWPORT_MARGIN, rect.top - POPOVER_GAP - panelRect.height)
      : belowTop;

    const rawStart = rtl ? width - rect.right : rect.left;
    const maxStart = Math.max(VIEWPORT_MARGIN, width - VIEWPORT_MARGIN - panelRect.width);
    const start = Math.min(Math.max(VIEWPORT_MARGIN, rawStart), maxStart);

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
