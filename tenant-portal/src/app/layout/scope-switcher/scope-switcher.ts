import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  inject,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerBuilding, tablerCheck, tablerChevronDown, tablerMapPin } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../core/i18n/language';
import { ScopeBranch, ScopeCompany, ScopeState } from '../../core/scope/scope';
import { rectInPage, viewport } from '../../shared/ui/overlay/zoom';

interface Place {
  top: number;
  end: number;
}

const VIEWPORT_GAP = 4;

@Component({
  selector: 'app-scope-switcher',
  imports: [TranslocoPipe, NgIcon],
  providers: [provideIcons({ tablerBuilding, tablerMapPin, tablerCheck, tablerChevronDown })],
  templateUrl: './scope-switcher.html',
  host: {
    class: 'relative me-8 inline-flex shrink-0',
    '[class.hidden]': '!scope.hasChoice()',
    '(document:click)': 'closeIfOutside($event)',
    '(document:keydown.escape)': 'onEscape($event)',
    '(window:resize)': 'open.set(false)',
    '(keydown)': 'onKeydown($event)',
  },
})
export class ScopeSwitcher {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly language = inject(LanguageState);
  protected readonly scope = inject(ScopeState);

  private readonly triggerBtn = viewChild<ElementRef<HTMLButtonElement>>('triggerBtn');
  private readonly menuEl = viewChild<ElementRef<HTMLElement>>('menuEl');
  private readonly companyRows = viewChildren<ElementRef<HTMLButtonElement>>('companyRow');
  private readonly branchRows = viewChildren<ElementRef<HTMLButtonElement>>('branchRow');

  protected readonly open = signal(false);
  protected readonly place = signal<Place>({ top: 0, end: 0 });

  constructor() {
    const close = () => this.open.set(false);
    document.addEventListener('scroll', close, { capture: true, passive: true });
    inject(DestroyRef).onDestroy(() => document.removeEventListener('scroll', close, { capture: true }));
  }

  protected nameOf(item: ScopeCompany | ScopeBranch): string {
    return this.language.current() === 'ar' ? item.nameAr : item.nameEn;
  }

  protected toggle() {
    if (this.open()) {
      this.open.set(false);
      return;
    }
    this.place.set(this.measure());
    this.open.set(true);
    afterNextRender(
      () => {
        this.place.set(this.measure());
      },
      { injector: this.injector },
    );
  }

  protected chooseCompany(id: string) {
    this.scope.selectCompany(id);
    queueMicrotask(() => {
      this.branchRows()[0]?.nativeElement.focus();
    });
    afterNextRender(
      () => {
        this.place.set(this.measure());
        this.branchRows()[0]?.nativeElement.focus();
      },
      { injector: this.injector },
    );
  }

  protected chooseBranch(id: string) {
    this.scope.selectBranch(id);
    this.open.set(false);
  }

  protected onRowEnter(event: Event, kind: 'company' | 'branch', id: string) {
    event.preventDefault();
    if (kind === 'company') this.chooseCompany(id);
    else this.chooseBranch(id);
  }

  protected onEscape(event: Event) {
    if (!this.open()) return;
    event.preventDefault();
    this.open.set(false);
    this.triggerBtn()?.nativeElement.focus();
  }

  protected onKeydown(event: KeyboardEvent) {
    if (!this.open()) return;
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const rows = [...this.companyRows(), ...this.branchRows()].map((item) => item.nativeElement);
    if (!rows.length) return;
    const current = rows.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      event.key === 'ArrowDown'
        ? current < 0 || current >= rows.length - 1
          ? 0
          : current + 1
        : current <= 0
          ? rows.length - 1
          : current - 1;
    rows[next]?.focus();
  }

  protected closeIfOutside(event: Event) {
    if (!this.host.nativeElement.contains(event.target as Node)) this.open.set(false);
  }

  private measure(): Place {
    const element = this.triggerBtn()?.nativeElement ?? this.host.nativeElement;
    const rect = rectInPage(element);
    const { width, height } = viewport();
    const rtl = getComputedStyle(element).direction === 'rtl';
    const rawEnd = rtl ? rect.left : width - rect.right;
    const rawTop = rect.bottom + VIEWPORT_GAP;
    const panel = this.menuEl()?.nativeElement;
    if (!panel) {
      return { top: Math.max(VIEWPORT_GAP, rawTop), end: Math.max(VIEWPORT_GAP, rawEnd) };
    }
    const panelRect = rectInPage(panel);
    const maxEnd = Math.max(VIEWPORT_GAP, width - panelRect.width - VIEWPORT_GAP);
    const maxTop = Math.max(VIEWPORT_GAP, height - panelRect.height - VIEWPORT_GAP);
    return {
      top: Math.min(Math.max(VIEWPORT_GAP, rawTop), maxTop),
      end: Math.min(Math.max(VIEWPORT_GAP, rawEnd), maxEnd),
    };
  }
}
