import { Component, DestroyRef, ElementRef, computed, inject, output, signal, viewChild, viewChildren } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerArrowsMove,
  tablerCategory,
  tablerCheck,
  tablerChevronRight,
  tablerSearch,
  tablerX,
} from '@ng-icons/tabler-icons';
import { Notify } from '../../../../../core/notify/notify';
import { errorKey } from '../../../shared/trade-api';
import { Button } from '../../../../../shared/ui/button/button';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { getCategory, searchCategories } from '../categories.api';
import {
  CATEGORY_MAX_DEPTH,
  CATEGORY_NAME_MAX,
  type CategoryDetail,
  type CategorySummary,
  categoryNodeTile,
} from '../categories.model';

export interface CategoryMoveConfirmEvent {
  source: CategoryDetail;
  targetParentId: string | null;
}

type MoveTargetOption =
  | {
      kind: 'root';
      id: '__root__';
      parentId: null;
      disabled: false;
      reason: null;
    }
  | {
      kind: 'node';
      id: string;
      parentId: string;
      node: CategorySummary;
      disabled: boolean;
      reason: string | null;
    };

const SEARCH_DEBOUNCE_MS = 300;

@Component({
  selector: 'app-category-move-dialog',
  imports: [NgIcon, TranslocoPipe, Button, Field, Modal],
  providers: [
    provideIcons({
      tablerArrowsMove,
      tablerCategory,
      tablerCheck,
      tablerChevronRight,
      tablerSearch,
      tablerX,
    }),
  ],
  templateUrl: './category-move-dialog.html',
})
export class CategoryMoveDialog {
  private static nextId = 0;
  protected readonly uid = `category-move-${++CategoryMoveDialog.nextId}`;

  private readonly destroyRef = inject(DestroyRef);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly modal = viewChild.required(Modal);

  readonly confirmed = output<CategoryMoveConfirmEvent>();
  readonly treeVersionSeen = output<number>();

  protected readonly searchMax = CATEGORY_NAME_MAX;
  protected readonly source = signal<CategorySummary | null>(null);
  protected readonly sourceDetail = signal<CategoryDetail | null>(null);
  protected readonly search = signal('');
  protected readonly candidates = signal<CategorySummary[]>([]);
  protected readonly loading = signal(false);
  protected readonly submitting = signal(false);
  protected readonly selection = signal<{ chosen: false } | { chosen: true; parentId: string | null }>({ chosen: false });

  private fetchSeq = 0;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly options = computed<MoveTargetOption[]>(() => {
    this.i18n();
    const src = this.source();
    const detail = this.sourceDetail();
    if (!src || !detail) return [];

    const result: MoveTargetOption[] = [];
    const term = this.search().trim().toLowerCase();
    const topLabel = this.transloco.translate('tradeCategories.modal.topLevel').toLowerCase();

    if (src.parentId !== null && (!term || topLabel.includes(term))) {
      result.push({
        kind: 'root',
        id: '__root__',
        parentId: null,
        disabled: false,
        reason: null,
      });
    }

    for (const candidate of this.candidates()) {
      const tooDeep = candidate.depth + detail.subtreeHeight > CATEGORY_MAX_DEPTH;
      const inactive = !candidate.effectiveActive;
      let reason: string | null = null;
      if (tooDeep) {
        reason = this.transloco.translate('tradeCategories.move.tooDeep');
      } else if (inactive) {
        reason = this.transloco.translate('tradeCategories.move.inactive');
      }
      result.push({
        kind: 'node',
        id: candidate.id,
        parentId: candidate.id,
        node: candidate,
        disabled: tooDeep || inactive,
        reason,
      });
    }

    return result;
  });

  protected readonly canConfirm = computed(() => {
    const sel = this.selection();
    if (!sel.chosen || this.loading() || this.submitting()) return false;
    const match = this.options().find((opt) => opt.parentId === sel.parentId);
    return Boolean(match && !match.disabled);
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.clearDebounce());
  }

  open(node: CategorySummary): void {
    this.clearDebounce();
    this.source.set(node);
    this.sourceDetail.set(null);
    this.search.set('');
    this.candidates.set([]);
    this.submitting.set(false);
    this.selection.set({ chosen: false });
    this.modal().open();
    void this.loadInitial(node.id);
  }

  setSubmitting(busy: boolean): void {
    this.submitting.set(busy);
  }

  close(): void {
    this.clearDebounce();
    this.submitting.set(false);
    this.modal().close();
  }

  protected onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value.slice(0, this.searchMax);
    this.search.set(value);
    this.clearDebounce();
    const src = this.source();
    if (!src) return;
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      void this.fetchTargets(src.id, value);
    }, SEARCH_DEBOUNCE_MS);
  }

  protected clearSearch(): void {
    this.search.set('');
    this.clearDebounce();
    const src = this.source();
    if (src) {
      void this.fetchTargets(src.id, '');
    }
  }

  private readonly optionButtons = viewChildren<ElementRef<HTMLButtonElement>>('optionButton');
  private readonly activeOptionId = signal<string | null>(null);

  /** Roving tabindex: the one option in the tab order (focused, else selected, else first). */
  protected readonly rovingId = computed<string | null>(() => {
    const options = this.options();
    const active = this.activeOptionId();
    if (active && options.some((option) => option.id === active)) return active;
    return options.find((option) => this.isSelected(option))?.id ?? options[0]?.id ?? null;
  });

  protected onOptionFocus(option: MoveTargetOption): void {
    this.activeOptionId.set(option.id);
  }

  protected onListKeydown(event: KeyboardEvent): void {
    const options = this.options();
    if (options.length === 0) return;
    const current = Math.max(0, options.findIndex((option) => option.id === this.rovingId()));
    let next: number;
    switch (event.key) {
      case 'ArrowDown':
        next = Math.min(options.length - 1, current + 1);
        break;
      case 'ArrowUp':
        next = Math.max(0, current - 1);
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = options.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const id = options[next].id;
    this.activeOptionId.set(id);
    this.optionButtons()
      .find((ref) => ref.nativeElement.dataset['optionId'] === id)
      ?.nativeElement.focus();
  }

  protected isSelected(option: MoveTargetOption): boolean {
    const sel = this.selection();
    return sel.chosen && sel.parentId === option.parentId;
  }

  protected selectOption(option: MoveTargetOption): void {
    if (option.disabled || this.submitting()) return;
    this.selection.set({ chosen: true, parentId: option.parentId });
  }

  protected tileClass(node: CategorySummary): string {
    return categoryNodeTile(node);
  }

  protected confirm(): void {
    const sel = this.selection();
    const detail = this.sourceDetail();
    if (!sel.chosen || !detail || !this.canConfirm()) return;
    this.confirmed.emit({ source: detail, targetParentId: sel.parentId });
  }

  protected onClosed(): void {
    this.clearDebounce();
  }

  private async loadInitial(sourceId: string): Promise<void> {
    const seq = ++this.fetchSeq;
    this.loading.set(true);
    try {
      const [detail, page] = await Promise.all([
        getCategory(sourceId),
        searchCategories({ moveSourceId: sourceId, limit: 100 }),
      ]);
      if (seq !== this.fetchSeq) return;
      this.treeVersionSeen.emit(Math.max(detail.treeVersion, page.treeVersion));
      this.sourceDetail.set(detail);
      this.candidates.set(page.items);
    } catch (error) {
      if (seq !== this.fetchSeq) return;
      this.notify.error(this.transloco.translate(errorKey(error)));
      this.modal().close();
    } finally {
      if (seq === this.fetchSeq) {
        this.loading.set(false);
      }
    }
  }

  private async fetchTargets(sourceId: string, query: string): Promise<void> {
    const seq = ++this.fetchSeq;
    const trimmed = query.trim();
    this.loading.set(true);
    try {
      const page = await searchCategories({
        moveSourceId: sourceId,
        ...(trimmed ? { search: trimmed } : {}),
        limit: 100,
      });
      if (seq !== this.fetchSeq) return;
      this.treeVersionSeen.emit(page.treeVersion);
      this.candidates.set(page.items);
    } catch (error) {
      if (seq !== this.fetchSeq) return;
      this.notify.error(this.transloco.translate(errorKey(error)));
    } finally {
      if (seq === this.fetchSeq) {
        this.loading.set(false);
      }
    }
  }

  private clearDebounce(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }
}
