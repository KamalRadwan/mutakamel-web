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
import { pluralKey } from '../../../../../../core/i18n/plural';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerCheck, tablerChevronDown, tablerX } from '@ng-icons/tabler-icons';
import { Button } from '../../../../../../shared/ui/button/button';
import { Checkbox } from '../../../../../../shared/ui/checkbox/checkbox';
import { Field } from '../../../../../../shared/ui/field/field';
import { rectInPage, viewport } from '../../../../../../shared/ui/overlay/zoom';
import { Branch, Company } from '../../../shared/staff.model';

interface ListPlace {
  top: number;
  start: number;
  width: number;
  maxHeight: number | null;
}

interface CompanyBranchGroup {
  company: Company;
  branches: Branch[];
  activeBranches: Branch[];
  allActiveSelected: boolean;
}

@Component({
  selector: 'app-assign-step-scope',
  imports: [NgIcon, TranslocoPipe, Button, Checkbox, Field],
  providers: [provideIcons({ tablerCheck, tablerChevronDown, tablerX })],
  templateUrl: './step-scope.html',
  host: {
    class: 'flex flex-col gap-10',
    '(document:click)': 'closeIfOutside($event)',
    '(window:resize)': 'closeMenu()',
    '(keydown.escape)': 'onEscape($event)',
  },
})
export class AssignStepScope {
  private static nextId = 0;
  protected readonly uid = `assign-step-scope-${++AssignStepScope.nextId}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  private readonly companyTrigger = viewChild<ElementRef<HTMLElement>>('companyTrigger');
  private readonly companyListRef = viewChild<ElementRef<HTMLElement>>('companyList');

  readonly companies = input.required<Company[]>();
  readonly branches = input.required<Branch[]>();
  readonly selectedCompanyIds = input.required<string[]>();
  readonly selectedBranchIds = input.required<string[]>();
  readonly autoSelectedCompanyIds = input<ReadonlySet<string>>(new Set());
  readonly invalidBranchIds = input<ReadonlySet<string>>(new Set());
  readonly showRequiredError = input(false);
  readonly readonly = input(false);
  readonly maxBranches = input(100);

  readonly addCompany = output<string>();
  readonly removeCompany = output<string>();
  readonly toggleBranch = output<string>();
  readonly selectAllCompanyBranches = output<string>();

  protected readonly companyMenuOpen = signal(false);
  protected readonly menuPlaced = signal(false);
  protected readonly menuPlace = signal<ListPlace>({ top: 0, start: 0, width: 0, maxHeight: null });
  private menuSeq = 0;

  protected readonly selectedCompanySet = computed(() => new Set(this.selectedCompanyIds()));
  protected readonly selectedBranchSet = computed(() => new Set(this.selectedBranchIds()));
  protected readonly companyById = computed(() => new Map(this.companies().map((c) => [c.id, c])));

  protected readonly selectedCompanies = computed<Company[]>(() => {
    const byId = this.companyById();
    return this.selectedCompanyIds()
      .map((id) => byId.get(id))
      .filter((company): company is Company => company !== undefined);
  });

  protected readonly companyGroups = computed<CompanyBranchGroup[]>(() => {
    const branchSet = this.selectedBranchSet();
    const invalidSet = this.invalidBranchIds();
    const allBranches = this.branches();

    return this.selectedCompanies().map((company) => {
      const companyBranches = allBranches.filter((branch) => branch.companyId === company.id);
      const activeBranches = companyBranches.filter(
        (branch) => branch.status === 'ACTIVE' && !invalidSet.has(branch.id),
      );
      const allActiveSelected =
        activeBranches.length > 0 && activeBranches.every((branch) => branchSet.has(branch.id));
      return {
        company,
        branches: companyBranches,
        activeBranches,
        allActiveSelected,
      };
    });
  });

  protected readonly atBranchLimit = computed(
    () => this.selectedBranchIds().length >= this.maxBranches(),
  );

  protected readonly branchError = computed<string | null>(() => {
    this.i18n();
    if (!this.showRequiredError() || this.readonly()) return null;
    if (this.selectedBranchIds().length > 0) return null;
    return this.transloco.translate('perm.s1.required');
  });

  protected readonly branchCountText = computed(() => {
    this.i18n();
    const n = this.selectedBranchIds().length;
    if (n === 0) return this.transloco.translate('perm.s1.none');
    if (n === 1) return this.transloco.translate('perm.s1.countOne');
    return this.transloco.translate(pluralKey('perm.s1.countPlural', n, this.transloco.getActiveLang()), { n });
  });

  constructor() {
    const onScroll = (event: Event) => {
      if (!this.companyMenuOpen()) return;
      const target = event.target;
      if (target instanceof Node && this.companyListRef()?.nativeElement.contains(target)) return;
      this.closeMenu();
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    inject(DestroyRef).onDestroy(() => document.removeEventListener('scroll', onScroll, { capture: true }));
  }

  protected isCompanySelected(companyId: string): boolean {
    return this.selectedCompanySet().has(companyId);
  }

  protected isCompanyOptionDisabled(company: Company): boolean {
    return company.status !== 'ACTIVE' && !this.isCompanySelected(company.id);
  }

  protected isBranchSelected(branchId: string): boolean {
    return this.selectedBranchSet().has(branchId);
  }

  protected isBranchInactive(branch: Branch): boolean {
    return branch.status !== 'ACTIVE' || this.invalidBranchIds().has(branch.id);
  }

  protected isBranchDisabled(branch: Branch): boolean {
    if (this.readonly()) return true;
    const selected = this.isBranchSelected(branch.id);
    if (this.isBranchInactive(branch) && !selected) return true;
    if (!selected && this.atBranchLimit()) return true;
    return false;
  }

  protected toggleCompanyMenu(): void {
    if (this.readonly()) return;
    if (this.companyMenuOpen()) {
      this.closeMenu();
      return;
    }
    const triggerEl = this.companyTrigger()?.nativeElement;
    if (!triggerEl) return;

    const seq = ++this.menuSeq;
    this.menuPlaced.set(false);
    this.menuPlace.set(this.initialPlace(triggerEl));
    this.companyMenuOpen.set(true);
    queueMicrotask(() => this.placeMenu(seq));
    afterNextRender(() => this.placeMenu(seq), { injector: this.injector });
  }

  protected onCompanyOptionClick(company: Company): void {
    if (this.readonly() || this.isCompanyOptionDisabled(company)) return;
    if (this.isCompanySelected(company.id)) {
      this.removeCompany.emit(company.id);
    } else {
      this.addCompany.emit(company.id);
    }
  }

  protected onCompanyChipRemove(companyId: string): void {
    if (this.readonly()) return;
    this.removeCompany.emit(companyId);
  }

  protected closeMenu(): void {
    this.menuSeq++;
    this.companyMenuOpen.set(false);
    this.menuPlaced.set(false);
  }

  protected closeIfOutside(event: Event): void {
    if (!this.companyMenuOpen()) return;
    const target = event.target as Node | null;
    if (!target) return;
    const triggerEl = this.companyTrigger()?.nativeElement;
    const listEl = this.companyListRef()?.nativeElement;
    if (triggerEl?.contains(target) || listEl?.contains(target)) return;
    this.closeMenu();
  }

  protected onEscape(event: Event): void {
    if (!this.companyMenuOpen()) return;
    event.preventDefault();
    event.stopPropagation();
    this.closeMenu();
    this.companyTrigger()?.nativeElement.focus();
  }

  private initialPlace(triggerEl: HTMLElement): ListPlace {
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
    if (seq !== this.menuSeq || !this.companyMenuOpen() || this.menuPlaced()) return;
    const triggerEl = this.companyTrigger()?.nativeElement;
    const listEl = this.companyListRef()?.nativeElement;
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
  }
}
