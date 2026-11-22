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
} from '@angular/core';
import { translationEvents } from '../../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerBuildingStore, tablerCopy } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../../core/i18n/language';
import { Button } from '../../../../../../shared/ui/button/button';
import { Dropdown, DropdownOption } from '../../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../../shared/ui/field/field';
import { rectInPage, viewport } from '../../../../../../shared/ui/overlay/zoom';
import { PermissionTree } from '../../permission-tree/permission-tree';
import {
  TreeEntry,
  buildPermissionHierarchy,
  computeProfileChip,
  countEffectivePermissions,
} from '../../permission-tree/permission-tree.model';

export interface CopyBranchSource {
  branchId: string;
  label: string;
  count: number;
}

interface MenuPlace {
  top: number;
  start: number;
  width: number;
  maxHeight: number | null;
}

@Component({
  selector: 'app-assign-step-permissions',
  imports: [NgIcon, TranslocoPipe, Button, Dropdown, Field, PermissionTree],
  providers: [provideIcons({ tablerBuildingStore, tablerCopy })],
  templateUrl: './step-permissions.html',
  host: {
    class: 'flex min-h-0 flex-1 flex-col gap-8',
    '(document:click)': 'closeCopyIfOutside($event)',
    '(window:resize)': 'closeCopyMenu()',
    '(keydown.escape)': 'onEscape($event)',
  },
})
export class AssignStepPermissions {
  private static nextId = 0;
  protected readonly uid = `assign-step-perm-${++AssignStepPermissions.nextId}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;

  private readonly copyTrigger = viewChild<Button, ElementRef<HTMLButtonElement>>('copyTrigger', {
    read: ElementRef,
  });
  private readonly copyListRef = viewChild<ElementRef<HTMLElement>>('copyList');

  readonly branchOptions = input.required<DropdownOption<string>[]>();
  readonly currentBranchId = input.required<string>();
  readonly isCurrentBranchIncluded = input.required<boolean>();
  readonly entries = input.required<TreeEntry[]>();
  readonly currentSelectedIds = input.required<string[]>();
  readonly otherBranches = input.required<CopyBranchSource[]>();
  readonly maxPerBranch = input(200);
  readonly readonly = input(false);

  readonly currentBranchChange = output<string>();
  readonly selectedChange = output<string[]>();
  readonly copyFromBranch = output<string>();
  readonly editBranches = output<void>();

  protected readonly copyMenuOpen = signal(false);
  protected readonly copyPlaced = signal(false);
  protected readonly copyPlace = signal<MenuPlace>({ top: 0, start: 0, width: 220, maxHeight: null });
  private menuSeq = 0;

  protected readonly hierarchy = computed(() => buildPermissionHierarchy(this.entries(), 'BRANCH'));

  protected readonly effectiveCount = computed(() =>
    countEffectivePermissions(this.hierarchy(), new Set(this.currentSelectedIds())),
  );

  protected readonly profileChip = computed(() => {
    this.i18n();
    return computeProfileChip(this.entries(), new Set(this.currentSelectedIds()), this.language(), {
      full: (moduleName) => this.transloco.translate('perm.chip.full', { module: moduleName }),
      viewOnly: this.transloco.translate('perm.chip.viewOnly'),
      none: this.transloco.translate('perm.chip.none'),
      custom: this.transloco.translate('perm.chip.custom'),
    });
  });

  constructor() {
    const onScroll = (event: Event) => {
      if (!this.copyMenuOpen()) return;
      const target = event.target;
      if (target instanceof Node && this.copyListRef()?.nativeElement.contains(target)) return;
      this.closeCopyMenu();
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    inject(DestroyRef).onDestroy(() => document.removeEventListener('scroll', onScroll, { capture: true }));
  }

  protected toggleCopyMenu(): void {
    if (this.readonly() || this.otherBranches().length === 0) return;
    if (this.copyMenuOpen()) {
      this.closeCopyMenu();
      return;
    }
    const triggerEl = this.copyTrigger()?.nativeElement;
    if (!triggerEl) return;

    const seq = ++this.menuSeq;
    this.copyPlaced.set(false);
    this.copyPlace.set(this.initialPlace(triggerEl));
    this.copyMenuOpen.set(true);
    queueMicrotask(() => this.placeCopyMenu(seq));
    afterNextRender(() => this.placeCopyMenu(seq), { injector: this.injector });
  }

  protected chooseCopySource(source: CopyBranchSource): void {
    this.closeCopyMenu();
    this.copyFromBranch.emit(source.branchId);
  }

  protected closeCopyMenu(): void {
    this.menuSeq++;
    this.copyMenuOpen.set(false);
    this.copyPlaced.set(false);
  }

  protected closeCopyIfOutside(event: Event): void {
    if (!this.copyMenuOpen()) return;
    const target = event.target as Node | null;
    if (!target) return;
    const triggerEl = this.copyTrigger()?.nativeElement;
    const listEl = this.copyListRef()?.nativeElement;
    if (triggerEl?.contains(target) || listEl?.contains(target)) return;
    this.closeCopyMenu();
  }

  protected onEscape(event: Event): void {
    if (!this.copyMenuOpen()) return;
    event.preventDefault();
    event.stopPropagation();
    this.closeCopyMenu();
    this.copyTrigger()?.nativeElement.focus();
  }

  private initialPlace(triggerEl: HTMLElement): MenuPlace {
    const rect = rectInPage(triggerEl);
    const { width } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';
    return {
      top: rect.bottom + 4,
      start: rtl ? width - rect.right : rect.left,
      width: Math.max(rect.width, 220),
      maxHeight: null,
    };
  }

  private placeCopyMenu(seq: number): void {
    if (seq !== this.menuSeq || !this.copyMenuOpen() || this.copyPlaced()) return;
    const triggerEl = this.copyTrigger()?.nativeElement;
    const listEl = this.copyListRef()?.nativeElement;
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

    this.copyPlace.set({ top, start, width: Math.max(rect.width, 220), maxHeight });
    this.copyPlaced.set(true);

    listEl.style.top = `${top}px`;
    listEl.style.insetInlineStart = `${start}px`;
    listEl.style.minWidth = `${Math.max(rect.width, 220)}px`;
    listEl.style.maxHeight = maxHeight !== null ? `${maxHeight}px` : '';
    listEl.classList.remove('invisible');
  }
}
