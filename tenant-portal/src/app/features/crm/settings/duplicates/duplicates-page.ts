import {
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  linkedSignal,
  resource,
  signal,
  untracked,
  viewChild,
  viewChildren,
} from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerBuilding,
  tablerBuildingSkyscraper,
  tablerBuildingStore,
  tablerChevronDown,
  tablerChevronRight,
  tablerCloudOff,
  tablerCopy,
  tablerExclamationCircle,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { PluralKeyPipe } from '../../../../core/i18n/plural';
import { Notify } from '../../../../core/notify/notify';
import { Button } from '../../../../shared/ui/button/button';
import { Checkbox } from '../../../../shared/ui/checkbox/checkbox';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Field } from '../../../../shared/ui/field/field';
import { Modal } from '../../../../shared/ui/modal/modal';
import { rectInPage, viewport } from '../../../../shared/ui/overlay/zoom';
import { Switch } from '../../../../shared/ui/switch/switch';
import { ApiError, errorCodeOf, errorMessage } from '../shared/settings-api';
import { SettingsFrame } from '../../../../shared/ui/settings-frame/settings-frame';
import { getPolicy, putBranch, putCompany, putDefaults } from './duplicates.api';
import {
  BranchPatch,
  CompanyPatch,
  ContactCheckKey,
  DefaultsPatch,
  Effective,
  NodeOverrides,
  PolicyBranch,
  PolicyCompany,
  PolicyDefaults,
  PolicySwitch,
  PolicyTree,
  PolicyWriteResult,
  Reset,
  Tri,
} from './duplicates.model';
import { resetsFromDetails, resolveDefaultsEffective } from './duplicates.policy';
import { PolicyCell } from './policy-cell/policy-cell';

const CAN_MANAGE = true; // later from the session permissions

interface FilteredCompany {
  company: PolicyCompany;
  branches: PolicyBranch[];
  companyMatches: boolean;
}

type TreeRowItem =
  | {
      kind: 'workspace';
      key: 'workspace';
      defaults: PolicyDefaults;
      effective: Effective;
      overrides: NodeOverrides;
      parentEffective: Effective;
    }
  | {
      kind: 'company';
      key: string;
      company: PolicyCompany;
      expanded: boolean;
      branchCount: number;
      overrides: NodeOverrides;
      parentEffective: Effective;
    }
  | {
      kind: 'branch';
      key: string;
      branch: PolicyBranch;
      company: PolicyCompany;
      parentRowIndex: number;
      overrides: NodeOverrides;
      parentEffective: Effective;
    };

type PendingWrite =
  | { kind: 'defaults'; patch: DefaultsPatch; cellKey?: string }
  | { kind: 'company'; companyId: string; patch: CompanyPatch; cellKey: string }
  | { kind: 'branch'; branchId: string; patch: BranchPatch; cellKey: string };

@Component({
  selector: 'app-duplicates-page',
  imports: [
    TranslocoPipe,
    PluralKeyPipe,
    NgIcon,
    Button,
    Checkbox,
    ConfirmDialog,
    Field,
    Modal,
    Switch,
    SettingsFrame,
    PolicyCell,
  ],
  providers: [
    provideTranslocoScope('settings', { scope: 'settings-duplicates', alias: 'dup' }),
    provideIcons({
      tablerCopy,
      tablerBuildingSkyscraper,
      tablerBuilding,
      tablerBuildingStore,
      tablerChevronDown,
      tablerChevronRight,
      tablerCloudOff,
      tablerAlertTriangle,
      tablerExclamationCircle,
    }),
  ],
  templateUrl: './duplicates-page.html',
  host: { class: 'flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto p-12' },
})
export class DuplicatesPage {
  private static nextId = 0;
  protected readonly uid = `duplicates-page-${++DuplicatesPage.nextId}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;

  private readonly resetsConfirm = viewChild.required<ConfirmDialog>('resetsConfirm');
  private readonly conflictModal = viewChild.required<Modal>('conflictModal');
  private readonly treeRows = viewChildren<ElementRef<HTMLElement>>('treeRow');

  protected readonly canManage = CAN_MANAGE;
  protected readonly skeletonRows = [1, 2, 3, 4, 5, 6];
  protected readonly policyColumns: readonly PolicySwitch[] = ['u', 'b', 'c'];

  protected readonly search = signal('');
  protected readonly onlyOverrides = signal(false);
  protected readonly expandedIds = signal<ReadonlySet<string>>(new Set());
  protected readonly savingTypes = signal(false);
  protected readonly savingCells = signal<ReadonlySet<string>>(new Set());
  protected readonly conflictBusy = signal(false);
  protected readonly pendingResets = signal<Reset[]>([]);
  protected readonly pendingStaleWrite = signal<PendingWrite | null>(null);

  protected readonly activeHintCol = signal<PolicySwitch | null>(null);
  protected readonly hintPlace = signal({ top: 0, start: 0 });

  private readonly loaded = resource({ loader: () => getPolicy() });
  private readonly localTree = signal<PolicyTree | null>(null);
  private initializedExpand = false;
  private writeQueue: Promise<void> = Promise.resolve();

  protected readonly tree = computed(() =>
    this.localTree() ?? (this.loaded.hasValue() ? this.loaded.value() : null),
  );
  protected readonly loading = this.loaded.isLoading;
  protected readonly loadFailed = computed(() => !this.loading() && !!this.loaded.error());
  protected readonly isSearching = computed(() => this.search().trim().length > 0);

  protected readonly workspaceEffective = computed<Effective>(() => {
    const current = this.tree();
    return current ? resolveDefaultsEffective(current.defaults) : { u: false, b: false, c: false };
  });

  protected readonly visibleCompanies = computed<FilteredCompany[]>(() => {
    const current = this.tree();
    if (!current) return [];
    const term = this.search().trim().toLowerCase();
    const overridesOnly = this.onlyOverrides();
    const result: FilteredCompany[] = [];

    for (const company of current.companies) {
      const companyMatches =
        !term ||
        company.name.toLowerCase().includes(term) ||
        company.code.toLowerCase().includes(term);

      const candidateBranches = overridesOnly
        ? company.branches.filter(hasBranchOverride)
        : company.branches;

      const branches = term && !companyMatches
        ? candidateBranches.filter((branch) => branchMatches(branch, term))
        : candidateBranches;

      const includeCompany = overridesOnly
        ? (companyMatches && hasCompanyOverride(company)) || branches.length > 0
        : companyMatches || branches.length > 0;

      if (includeCompany) {
        result.push({ company, branches, companyMatches });
      }
    }

    return result;
  });

  protected readonly flatRows = computed<TreeRowItem[]>(() => {
    const current = this.tree();
    if (!current || this.loading()) return [];

    const filtered = this.visibleCompanies();
    if (this.isSearching() && filtered.length === 0) {
      return [];
    }

    const workspaceEff = this.workspaceEffective();
    const rows: TreeRowItem[] = [
      {
        kind: 'workspace',
        key: 'workspace',
        defaults: current.defaults,
        effective: workspaceEff,
        overrides: {
          u: current.defaults.allowAcrossUsers,
          b: current.defaults.allowAcrossBranches,
          c: current.defaults.allowAcrossCompanies,
        },
        parentEffective: { u: false, b: false, c: false },
      },
    ];

    const expandedSet = this.expandedIds();
    for (const item of filtered) {
      const expanded = expandedSet.has(item.company.companyId);
      const companyRowIndex = rows.length;
      rows.push({
        kind: 'company',
        key: `company:${item.company.companyId}`,
        company: item.company,
        expanded,
        branchCount: item.branches.length,
        overrides: {
          u: item.company.override.allowAcrossUsers,
          b: item.company.override.allowAcrossBranches,
          c: item.company.override.allowAcrossCompanies,
        },
        parentEffective: workspaceEff,
      });

      if (expanded) {
        for (const branch of item.branches) {
          rows.push({
            kind: 'branch',
            key: `branch:${branch.branchId}`,
            branch,
            company: item.company,
            parentRowIndex: companyRowIndex,
            overrides: {
              u: branch.override.allowAcrossUsers,
              b: branch.override.allowAcrossBranches,
              c: null,
            },
            parentEffective: item.company.effective,
          });
        }
      }
    }

    return rows;
  });

  protected readonly activeRowKey = linkedSignal<TreeRowItem[], string>({
    source: this.flatRows,
    computation: (rows, previous) => {
      const prev = previous?.value;
      if (prev && rows.some((row) => row.key === prev)) return prev;
      return rows[0]?.key ?? '';
    },
  });

  protected readonly resetsDialogText = computed(() => {
    this.i18n();
    const resets = this.pendingResets();
    const intro = this.transloco.translate('dup.resets.text');
    if (!resets.length) return intro;

    const maxShown = 8;
    const shown = resets.slice(0, maxShown).map((item) => {
      const switchLabel = this.transloco.translate(`dup.cols.${item.switch}`);
      return `${item.name} · ${switchLabel}`;
    });

    const remaining = resets.length - shown.length;
    if (remaining > 0) {
      shown.push(this.transloco.translate('dup.resets.more', { n: remaining }));
    }

    return `${intro} ${shown.join(' • ')}`;
  });

  constructor() {
    effect(() => {
      const current = this.tree();
      if (!current || this.initializedExpand) return;
      this.initializedExpand = true;
      untracked(() => {
        if (current.companies.length <= 5) {
          this.expandedIds.set(new Set(current.companies.map((company) => company.companyId)));
        } else {
          this.expandedIds.set(new Set());
        }
      });
    });

    effect(() => {
      const term = this.search().trim().toLowerCase();
      const overridesOnly = this.onlyOverrides();
      const current = untracked(() => this.tree());
      if (!current || (!term && !overridesOnly)) return;

      untracked(() => {
        const next = new Set(this.expandedIds());
        let changed = false;
        for (const company of current.companies) {
          const companyMatches =
            !term ||
            company.name.toLowerCase().includes(term) ||
            company.code.toLowerCase().includes(term);

          const candidates = overridesOnly ? company.branches.filter(hasBranchOverride) : company.branches;
          const hasMatchedChild = term && !companyMatches
            ? candidates.some((branch) => branchMatches(branch, term))
            : overridesOnly && candidates.length > 0;

          if (hasMatchedChild && !next.has(company.companyId)) {
            next.add(company.companyId);
            changed = true;
          }
        }
        if (changed) {
          this.expandedIds.set(next);
        }
      });
    });
  }

  protected reload(): void {
    this.localTree.set(null);
    this.loaded.reload();
  }

  protected clearSearch(): void {
    this.search.set('');
  }

  protected expandAll(): void {
    const current = this.tree();
    if (!current) return;
    this.expandedIds.set(new Set(current.companies.map((company) => company.companyId)));
  }

  protected collapseAll(): void {
    this.expandedIds.set(new Set());
  }

  protected toggleCompany(companyId: string): void {
    this.setCompanyExpanded(companyId, !this.expandedIds().has(companyId));
  }

  protected setCompanyExpanded(companyId: string, expanded: boolean): void {
    this.expandedIds.update((prev) => {
      const next = new Set(prev);
      if (expanded) {
        next.add(companyId);
      } else {
        next.delete(companyId);
      }
      return next;
    });
  }

  protected isCellSaving(cellKey: string): boolean {
    return this.savingCells().has(cellKey);
  }

  protected showColumnHint(col: PolicySwitch, triggerEl: HTMLElement): void {
    const rect = rectInPage(triggerEl);
    const { width } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';
    const maxTipWidth = 280;

    let start = (rtl ? width - rect.left : rect.right) + 6;
    if (start + maxTipWidth > width - 8) {
      const altStart = (rtl ? width - rect.right : rect.left) - 6 - maxTipWidth;
      start = altStart >= 8 ? altStart : Math.max(8, width - 8 - maxTipWidth);
    }

    const top = Math.max(8, rect.bottom + 4);
    this.hintPlace.set({ top, start });
    this.activeHintCol.set(col);
  }

  protected hideColumnHint(): void {
    this.activeHintCol.set(null);
  }

  protected onToggleContactType(key: ContactCheckKey, checked: boolean): void {
    const current = this.tree();
    if (!this.canManage || !current || this.savingTypes() || current.defaults[key] === checked) {
      return;
    }
    void this.enqueueWrite({ kind: 'defaults', patch: { [key]: checked } });
  }

  protected onWorkspaceChoice(
    field: 'allowAcrossUsers' | 'allowAcrossBranches' | 'allowAcrossCompanies',
    value: Tri,
    cellKey: string,
  ): void {
    const current = this.tree();
    if (!this.canManage || !current || value === null || current.defaults[field] === value) {
      return;
    }
    void this.enqueueWrite({ kind: 'defaults', patch: { [field]: value }, cellKey });
  }

  protected onCompanyChoice(
    companyId: string,
    field: 'allowAcrossUsers' | 'allowAcrossBranches' | 'allowAcrossCompanies',
    value: Tri,
    cellKey: string,
  ): void {
    const current = this.tree();
    const company = current?.companies.find((item) => item.companyId === companyId);
    if (!this.canManage || !company || company.override[field] === value) {
      return;
    }
    void this.enqueueWrite({
      kind: 'company',
      companyId,
      patch: { [field]: value },
      cellKey,
    });
  }

  protected onBranchChoice(
    branchId: string,
    field: 'allowAcrossUsers' | 'allowAcrossBranches',
    value: Tri,
    cellKey: string,
  ): void {
    const current = this.tree();
    const branch = current?.companies
      .flatMap((company) => company.branches)
      .find((item) => item.branchId === branchId);
    if (!this.canManage || !branch || branch.override[field] === value) {
      return;
    }
    void this.enqueueWrite({
      kind: 'branch',
      branchId,
      patch: { [field]: value },
      cellKey,
    });
  }

  protected async reloadOnConflict(): Promise<void> {
    if (this.conflictBusy()) return;
    this.conflictBusy.set(true);
    try {
      const fresh = await getPolicy();
      this.localTree.set(fresh);
      this.pendingStaleWrite.set(null);
      this.conflictModal().close();
    } catch (error) {
      this.notify.error(errorMessage(error, 'dup', this.transloco));
    } finally {
      this.conflictBusy.set(false);
    }
  }

  protected async keepChangeOnConflict(): Promise<void> {
    const write = this.pendingStaleWrite();
    if (this.conflictBusy()) return;
    if (!write) {
      this.conflictModal().close();
      return;
    }

    this.conflictBusy.set(true);
    try {
      const fresh = await getPolicy();
      this.localTree.set(fresh);
      this.pendingStaleWrite.set(null);
      this.conflictModal().close();
    } catch (error) {
      this.notify.error(errorMessage(error, 'dup', this.transloco));
      return;
    } finally {
      this.conflictBusy.set(false);
    }

    await this.enqueueWrite(write, false);
  }

  protected onTreeRowFocusIn(rowKey: string): void {
    if (this.activeRowKey() !== rowKey) {
      this.activeRowKey.set(rowKey);
    }
  }

  protected onTreeRowKeydown(event: KeyboardEvent, row: TreeRowItem, rowIndex: number): void {
    const target = event.target as HTMLElement | null;
    const currentRowEl = event.currentTarget as HTMLElement | null;
    if (!target || !currentRowEl) return;
    if (target.closest('[role="menu"]') || currentRowEl.querySelector('[role="menu"]')) return;

    const rows = this.treeRows().map((ref) => ref.nativeElement);
    if (!rows.length) return;

    const flat = this.flatRows();
    const cellButtons = Array.from(currentRowEl.querySelectorAll<HTMLButtonElement>('app-policy-cell > button'));
    const cellIndex = cellButtons.indexOf(target as HTMLButtonElement);
    const onRow = target === currentRowEl;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const targetIndex =
        event.key === 'ArrowDown'
          ? Math.min(rows.length - 1, rowIndex + 1)
          : Math.max(0, rowIndex - 1);
      if (targetIndex === rowIndex) return;
      const nextItem = flat[targetIndex];
      if (nextItem) {
        this.activeRowKey.set(nextItem.key);
      }
      this.focusRowOrMatchingColumn(rows[targetIndex], currentRowEl, target);
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      if (onRow || event.ctrlKey) {
        const first = flat[0];
        if (first) this.activeRowKey.set(first.key);
        rows[0]?.focus();
      } else {
        currentRowEl.focus();
      }
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      if (onRow || event.ctrlKey) {
        const last = flat[flat.length - 1];
        if (last) this.activeRowKey.set(last.key);
        rows[rows.length - 1]?.focus();
      } else if (cellButtons.length > 0) {
        cellButtons[cellButtons.length - 1]?.focus();
      }
      return;
    }

    if (event.key === 'Escape' && !onRow) {
      event.preventDefault();
      currentRowEl.focus();
      return;
    }

    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';
      const nextKey = rtl ? 'ArrowLeft' : 'ArrowRight';

      if (cellIndex >= 0) {
        event.preventDefault();
        if (event.key === nextKey) {
          cellButtons[cellIndex + 1]?.focus();
        } else if (cellIndex > 0) {
          cellButtons[cellIndex - 1]?.focus();
        } else {
          currentRowEl.focus();
        }
        return;
      }

      if (!onRow) {
        event.preventDefault();
        if (event.key === nextKey) {
          cellButtons[0]?.focus();
        } else {
          currentRowEl.focus();
        }
        return;
      }

      if (event.key === nextKey) {
        event.preventDefault();
        if (row.kind === 'company' && !row.expanded) {
          this.setCompanyExpanded(row.company.companyId, true);
        } else {
          cellButtons[0]?.focus();
        }
      } else if (row.kind === 'company' && row.expanded) {
        event.preventDefault();
        this.setCompanyExpanded(row.company.companyId, false);
      } else if (row.kind === 'branch') {
        event.preventDefault();
        const parentItem = flat[row.parentRowIndex];
        if (parentItem) {
          this.activeRowKey.set(parentItem.key);
        }
        rows[row.parentRowIndex]?.focus();
      }
      return;
    }

    if (
      (event.key === 'Enter' || event.key === ' ') &&
      onRow &&
      row.kind === 'company'
    ) {
      event.preventDefault();
      this.toggleCompany(row.company.companyId);
    }
  }

  private focusRowOrMatchingColumn(
    nextRowEl: HTMLElement | undefined,
    currentRowEl: HTMLElement,
    activeTarget: HTMLElement,
  ): void {
    if (!nextRowEl) return;
    const currentCell = activeTarget.closest('[role="gridcell"]');
    if (currentCell && activeTarget !== currentRowEl) {
      const currentCells = Array.from(currentRowEl.querySelectorAll<HTMLElement>('[role="gridcell"]'));
      const colIndex = currentCells.indexOf(currentCell as HTMLElement);
      if (colIndex > 0) {
        const nextCells = Array.from(nextRowEl.querySelectorAll<HTMLElement>('[role="gridcell"]'));
        const nextBtn = nextCells[colIndex]?.querySelector<HTMLButtonElement>('app-policy-cell > button:not(:disabled)');
        if (nextBtn) {
          nextBtn.focus();
          return;
        }
      }
    }
    nextRowEl.focus();
  }

  private enqueueWrite(write: PendingWrite, allowStaleReapply = true): Promise<void> {
    this.setWriteBusy(write, true);
    const run = this.writeQueue.then(() => this.runWrite(write, false, allowStaleReapply));
    this.writeQueue = run.catch(() => {});
    return run;
  }

  private async runWrite(
    write: PendingWrite,
    confirmResets: boolean,
    allowStaleReapply: boolean,
  ): Promise<void> {
    const current = this.tree();
    if (!current) {
      this.setWriteBusy(write, false);
      return;
    }

    let retryConfirmed = false;
    try {
      const result = await this.sendWrite(write, current.revision, confirmResets);
      const { resets, ...nextTree } = result;
      this.localTree.set(nextTree);
      this.notify.success(this.transloco.translate('dup.saved'));
      if (resets.length > 0) {
        this.notify.info(this.transloco.translate('dup.resetsDone', { n: resets.length }));
      }
    } catch (error) {
      const code = errorCodeOf(error);
      if (code === 'CRM_DUPLICATE_POLICY_RESETS_REQUIRED' && error instanceof ApiError) {
        const resets = resetsFromDetails(error.details);
        this.setWriteBusy(write, false);
        this.pendingResets.set(resets);
        const confirmed = await this.resetsConfirm().open();
        this.pendingResets.set([]);
        if (confirmed) {
          retryConfirmed = true;
          this.setWriteBusy(write, true);
          await this.runWrite(write, true, allowStaleReapply);
        }
        return;
      }

      if (code === 'CRM_DUPLICATE_POLICY_STALE' && allowStaleReapply) {
        this.pendingStaleWrite.set(write);
        this.conflictModal().open();
        return;
      }

      this.notify.error(errorMessage(error, 'dup', this.transloco));
    } finally {
      if (!retryConfirmed) {
        this.setWriteBusy(write, false);
      }
    }
  }

  private sendWrite(
    write: PendingWrite,
    expectedRevision: number,
    confirmResets: boolean,
  ): Promise<PolicyWriteResult> {
    switch (write.kind) {
      case 'defaults':
        return putDefaults(write.patch, expectedRevision, confirmResets);
      case 'company':
        return putCompany(write.companyId, write.patch, expectedRevision, confirmResets);
      case 'branch':
        return putBranch(write.branchId, write.patch, expectedRevision, confirmResets);
    }
  }

  private setWriteBusy(write: PendingWrite, busy: boolean): void {
    if (!write.cellKey) {
      this.savingTypes.set(busy);
      return;
    }
    const key = write.cellKey;
    this.savingCells.update((prev) => {
      const next = new Set(prev);
      if (busy) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  }
}

function hasBranchOverride(branch: PolicyBranch): boolean {
  return branch.override.allowAcrossUsers !== null || branch.override.allowAcrossBranches !== null;
}

function hasCompanyOverride(company: PolicyCompany): boolean {
  return (
    company.override.allowAcrossUsers !== null ||
    company.override.allowAcrossBranches !== null ||
    company.override.allowAcrossCompanies !== null
  );
}

function branchMatches(branch: PolicyBranch, term: string): boolean {
  return branch.name.toLowerCase().includes(term) || branch.code.toLowerCase().includes(term);
}
