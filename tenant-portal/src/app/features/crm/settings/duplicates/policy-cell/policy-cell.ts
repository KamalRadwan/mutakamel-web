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
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerCheck,
  tablerChevronDown,
  tablerLoader2,
  tablerLock,
} from '@ng-icons/tabler-icons';
import { rectInPage, viewport } from '../../../../../shared/ui/overlay/zoom';
import { Effective, NodeOverrides, PolicySwitch, Tri } from '../duplicates.model';
import { computeDisabledChoices } from '../duplicates.policy';

interface MenuOption {
  id: 'inherit' | 'allow' | 'deny';
  value: Tri;
  label: string;
  selected: boolean;
  disabledReason: string | null;
}

interface MenuPlace {
  top: number;
  start: number;
  minWidth: number;
  maxHeight: number | null;
}

@Component({
  selector: 'app-policy-cell',
  imports: [NgIcon],
  providers: [provideIcons({ tablerLock, tablerLoader2, tablerChevronDown, tablerCheck })],
  templateUrl: './policy-cell.html',
  host: {
    class: 'relative flex h-full w-full min-w-0 flex-col items-center',
    '(document:click)': 'closeIfOutside($event)',
    '(window:resize)': 'close()',
    '(keydown)': 'onKeydown($event)',
  },
})
export class PolicyCell {
  private static nextId = 0;
  protected readonly uid = `policy-cell-${++PolicyCell.nextId}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly menuRef = viewChild<ElementRef<HTMLElement>>('menu');
  private readonly optionRows = viewChildren<ElementRef<HTMLButtonElement>>('optionRow');

  private menuSeq = 0;

  readonly mode = input<'root' | 'node'>('node');
  readonly switchKey = input.required<PolicySwitch>();
  readonly switchLabel = input.required<string>();
  readonly nodeName = input.required<string>();
  readonly parentName = input('');
  readonly parentEffective = input(false);
  readonly overrideValue = input<Tri>(null);
  readonly effectiveValue = input.required<boolean>();
  readonly nodeOverrides = input.required<NodeOverrides>();
  readonly parentNodeEffective = input<Effective>({ u: false, b: false, c: false });
  readonly triggerTabIndex = input<number>(0);
  readonly limit = input<'CHAIN' | undefined>(undefined);
  readonly subnote = input('');
  readonly saving = input(false);
  readonly canManage = input(false);
  readonly error = input<string | null>(null);

  readonly chosen = output<Tri>();

  protected readonly open = signal(false);
  protected readonly placed = signal(false);
  protected readonly place = signal<MenuPlace>({ top: 0, start: 0, minWidth: 0, maxHeight: null });

  protected readonly isExplicit = computed(
    () => this.mode() === 'root' || this.overrideValue() !== null,
  );
  protected readonly isLimited = computed(
    () => this.mode() === 'node' && this.overrideValue() === null && this.limit() === 'CHAIN',
  );

  protected readonly stateText = computed(() => {
    this.i18n();
    return this.transloco.translate(this.effectiveValue() ? 'dup.allowed' : 'dup.notAllowed');
  });

  protected readonly sourceText = computed(() => {
    this.i18n();
    if (this.isLimited()) {
      return this.transloco.translate(
        this.switchKey() === 'u' ? 'dup.source.limitedB' : 'dup.source.limitedC',
      );
    }
    if (this.isExplicit()) {
      return this.transloco.translate('dup.source.here');
    }
    return this.transloco.translate('dup.source.inherited', { parent: this.parentName() });
  });

  protected readonly ariaLabel = computed(() => {
    this.i18n();
    return this.transloco.translate(this.mode() === 'root' ? 'dup.cellLabelRoot' : 'dup.cellLabel', {
      switch: this.switchLabel(),
      node: this.nodeName(),
      state: this.stateText(),
      source: this.sourceText(),
    });
  });

  protected readonly options = computed<MenuOption[]>(() => {
    this.i18n();
    const disabled = computeDisabledChoices({
      mode: this.mode(),
      switchKey: this.switchKey(),
      overrides: this.nodeOverrides(),
      parentEffective: this.parentNodeEffective(),
    });

    const list: MenuOption[] = [];
    if (this.mode() === 'node') {
      const parentState = this.transloco.translate(
        this.parentEffective() ? 'dup.allowed' : 'dup.notAllowed',
      );
      list.push({
        id: 'inherit',
        value: null,
        label: this.transloco.translate('dup.menu.inherit', {
          state: parentState,
          parent: this.parentName(),
        }),
        selected: this.overrideValue() === null,
        disabledReason: disabled.inherit
          ? this.transloco.translate(`dup.disabled.${disabled.inherit}`)
          : null,
      });
    }

    list.push({
      id: 'allow',
      value: true,
      label: this.transloco.translate('dup.menu.allow'),
      selected:
        this.mode() === 'root' ? this.effectiveValue() === true : this.overrideValue() === true,
      disabledReason: disabled.allow
        ? this.transloco.translate(`dup.disabled.${disabled.allow}`)
        : null,
    });

    list.push({
      id: 'deny',
      value: false,
      label: this.transloco.translate('dup.menu.deny'),
      selected:
        this.mode() === 'root' ? this.effectiveValue() === false : this.overrideValue() === false,
      disabledReason: disabled.deny
        ? this.transloco.translate(`dup.disabled.${disabled.deny}`)
        : null,
    });

    return list;
  });

  constructor() {
    const onScroll = (event: Event) => {
      if (!this.open()) return;
      const target = event.target;
      if (target instanceof Node && this.host.nativeElement.contains(target)) return;
      this.close();
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    inject(DestroyRef).onDestroy(() =>
      document.removeEventListener('scroll', onScroll, { capture: true }),
    );
  }

  protected toggle(): void {
    if (!this.canManage() || this.saving()) return;
    if (this.open()) {
      this.close();
      return;
    }
    const seq = ++this.menuSeq;
    this.placed.set(false);
    this.place.set(this.initialPlace());
    this.open.set(true);
    queueMicrotask(() => this.placeMenu(seq));
    afterNextRender(() => this.placeMenu(seq), { injector: this.injector });
  }

  protected close(): void {
    this.menuSeq++;
    this.open.set(false);
    this.placed.set(false);
  }

  protected closeIfOutside(event: Event): void {
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  protected choose(option: MenuOption): void {
    if (option.disabledReason || !this.canManage()) return;
    const current = this.mode() === 'root' ? this.effectiveValue() : this.overrideValue();
    this.close();
    this.trigger().nativeElement.focus();
    if (option.value !== current) {
      this.chosen.emit(option.value);
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (!this.open()) return;
    const target = event.target as HTMLElement | null;
    if (!target) return;

    if (event.key === 'Tab') {
      this.trigger().nativeElement.focus();
      this.close();
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.close();
      this.trigger().nativeElement.focus();
      return;
    }

    const rows = this.optionRows();
    if (!rows.length) return;
    const index = rows.findIndex((row) => row.nativeElement === target);

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      event.stopPropagation();
      const nextIndex = index < 0 ? 0 : (index + 1) % rows.length;
      rows[nextIndex]?.nativeElement.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      event.stopPropagation();
      const prevIndex = index <= 0 ? rows.length - 1 : index - 1;
      rows[prevIndex]?.nativeElement.focus();
    } else if (event.key === 'Home') {
      event.preventDefault();
      event.stopPropagation();
      rows[0]?.nativeElement.focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      event.stopPropagation();
      rows[rows.length - 1]?.nativeElement.focus();
    } else if ((event.key === 'Enter' || event.key === ' ') && index >= 0) {
      event.preventDefault();
      event.stopPropagation();
      const option = this.options()[index];
      if (option) this.choose(option);
    }
  }

  private initialPlace(): MenuPlace {
    const rect = rectInPage(this.trigger().nativeElement);
    const { width } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';
    return {
      top: rect.bottom + 4,
      start: rtl ? width - rect.right : rect.left,
      minWidth: rect.width,
      maxHeight: null,
    };
  }

  private placeMenu(seq: number): void {
    if (seq !== this.menuSeq || !this.open() || this.placed()) return;
    const menuEl = this.menuRef()?.nativeElement;
    if (!menuEl) return;

    const rect = rectInPage(this.trigger().nativeElement);
    const menuRect = rectInPage(menuEl);
    const { width, height } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';

    const belowTop = rect.bottom + 4;
    const spaceBelow = Math.max(8, height - 8 - belowTop);
    const spaceAbove = Math.max(8, rect.top - 12);
    const flipUp = menuRect.height > spaceBelow && spaceAbove > spaceBelow;
    const avail = flipUp ? spaceAbove : spaceBelow;
    const maxHeight = menuRect.height > avail ? avail : null;
    const finalHeight = maxHeight ?? menuRect.height;
    const top = flipUp ? Math.max(8, rect.top - 4 - finalHeight) : belowTop;

    const triggerStart = rtl ? width - rect.right : rect.left;
    const triggerEnd = rtl ? width - rect.left : rect.right;
    const alignEnd = triggerStart + menuRect.width > width - 8;
    const rawStart = alignEnd ? triggerEnd - menuRect.width : triggerStart;
    const start = Math.min(Math.max(8, rawStart), Math.max(8, width - 8 - menuRect.width));

    this.place.set({ top, start, minWidth: rect.width, maxHeight });
    this.placed.set(true);

    menuEl.style.top = `${top}px`;
    menuEl.style.insetInlineStart = `${start}px`;
    menuEl.style.minWidth = `${rect.width}px`;
    menuEl.style.maxHeight = maxHeight !== null ? `${maxHeight}px` : '';
    menuEl.classList.remove('invisible');

    const rows = this.optionRows();
    const selectedIndex = this.options().findIndex((option) => option.selected);
    const firstEnabled = this.options().findIndex((option) => !option.disabledReason);
    const targetIndex = selectedIndex >= 0 ? selectedIndex : Math.max(0, firstEnabled);
    rows[targetIndex]?.nativeElement.focus();
  }
}
