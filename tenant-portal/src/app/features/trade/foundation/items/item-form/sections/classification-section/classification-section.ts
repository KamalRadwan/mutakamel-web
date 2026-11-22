import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { translationEvents } from '../../../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerBox, tablerPackages, tablerTool } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../../../core/i18n/language';
import { ConfirmDialog } from '../../../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Dropdown, type DropdownOption } from '../../../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../../../shared/ui/field/field';
import { RECORD_PAGE_GRID, type RecordLayout } from '../../../../../../../shared/ui/section-bar/record-layout';
import { itemName } from '../../../../../shared/trade-foundation.api';
import type { ItemKind, ItemStatus, Owner, Uom } from '../../../../../shared/trade-foundation.model';
import {
  ALLOWED_ITEM_STATUS_MOVES,
  ITEM_KIND_KEY,
  ITEM_KIND_TILE,
  ITEM_STATUS_KEY,
} from '../../../../../shared/trade-labels';
import { TradeCategoryPicker } from '../../../../../shared/pickers/category-picker/category-picker';
import { TradeUomPicker } from '../../../../../shared/pickers/uom-picker/uom-picker';
import { ITEM_KINDS } from '../../../items.model';
import type { DraftErrors, FieldError, ItemDraft } from '../../item-draft';

interface KindOption {
  value: ItemKind;
  labelKey: string;
  icon: string;
  tileClass: string;
}

const KIND_OPTIONS: readonly KindOption[] = ITEM_KINDS.map((kind) => ({
  value: kind,
  labelKey: ITEM_KIND_KEY[kind],
  icon: ITEM_KIND_TILE[kind].icon,
  tileClass: ITEM_KIND_TILE[kind].tile,
}));

@Component({
  selector: 'app-item-classification-section',
  imports: [
    NgIcon,
    TranslocoPipe,
    ConfirmDialog,
    Dropdown,
    Field,
    TradeCategoryPicker,
    TradeUomPicker,
  ],
  providers: [provideIcons({ tablerBox, tablerTool, tablerPackages })],
  templateUrl: './classification-section.html',
  host: {
    '[class]':
      "layout() === 'page' ? pageGrid : 'grid grid-cols-1 gap-y-8 min-w-0'",
  },
})
export class ClassificationSection {
  private static nextId = 0;
  protected readonly uid = `item-cls-${++ClassificationSection.nextId}`;
  protected readonly pageGrid = RECORD_PAGE_GRID;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;

  private readonly kindButtons = viewChildren<ElementRef<HTMLButtonElement>>('kindBtn');
  private readonly kindChangeDialog = viewChild.required<ConfirmDialog>('kindChangeDialog');
  private readonly statusDropdown = viewChild<Dropdown<string>>('statusDropdown');

  readonly layout = input<RecordLayout>('modal');
  readonly mode = input<'create' | 'edit'>('create');
  readonly readonly = input(false);
  readonly errors = input<DraftErrors>({});
  readonly owners = input<readonly Owner[]>([]);
  readonly updatingStatus = input(false);
  readonly baseUom = input<Uom | null>(null);
  readonly categoryLabel = input('');

  readonly draft = model.required<ItemDraft>();
  readonly statusChange = output<ItemStatus>();
  readonly dialogBusyChange = output<boolean>();

  protected readonly kindOptions = KIND_OPTIONS;
  protected readonly kindKey = ITEM_KIND_KEY;
  protected readonly statusKey = ITEM_STATUS_KEY;

  private readonly kindDialogBusy = signal(false);

  protected readonly canEditKind = computed(() => this.mode() === 'create' && !this.readonly());
  protected readonly canEditBaseUom = computed(() => this.mode() === 'create' && !this.readonly());
  protected readonly currentKindTile = computed(() => ITEM_KIND_TILE[this.draft().itemKind]);

  protected readonly legalStatusMoves = computed<readonly ItemStatus[]>(() => {
    if (this.mode() !== 'edit' || this.readonly()) return [];
    return ALLOWED_ITEM_STATUS_MOVES[this.draft().status];
  });

  protected readonly statusOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const current = this.draft().status;
    const list: ItemStatus[] = [current, ...this.legalStatusMoves()];
    return list.map((status) => ({
      value: status,
      label: this.transloco.translate(ITEM_STATUS_KEY[status]),
    }));
  });

  protected readonly ownerOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const options: DropdownOption<string>[] = [
      { value: '', label: this.transloco.translate('itemForm.states.noOwner') },
    ];
    for (const owner of this.owners()) {
      options.push({ value: owner.id, label: owner.name });
    }
    return options;
  });

  protected readonly ownerLabel = computed(() => {
    this.i18n();
    const ownerId = this.draft().ownerUserId;
    if (!ownerId) return this.transloco.translate('itemForm.states.noOwner');
    return this.owners().find((owner) => owner.id === ownerId)?.name ?? ownerId;
  });

  protected readonly baseUnitLabel = computed(() => {
    const lang = this.language();
    const uom = this.baseUom();
    if (!uom) return this.draft().baseUomId ?? '—';
    return `${uom.code} — ${itemName(uom, lang) || uom.displayName}`;
  });

  protected readonly activeKindTabIndex = computed(() => {
    const current = this.draft().itemKind;
    const idx = KIND_OPTIONS.findIndex((item) => item.value === current);
    return idx >= 0 ? idx : 0;
  });

  protected errorText(path: string): string | null {
    this.i18n();
    const err: FieldError | undefined = this.errors()[path];
    if (!err) return null;
    return this.transloco.translate(err.key, err.params);
  }

  protected describedBy(path: string, controlId: string): string {
    return this.errorText(path) ? `${controlId}-hint ${controlId}-error` : `${controlId}-hint`;
  }

  protected async selectKind(nextKind: ItemKind): Promise<void> {
    if (!this.canEditKind() || this.kindDialogBusy()) return;
    const current = this.draft();
    if (current.itemKind === nextKind) return;

    if (current.itemKind === 'COMBO' && current.comboComponents.length > 0) {
      this.kindDialogBusy.set(true);
      this.dialogBusyChange.emit(true);
      try {
        const confirmed = await this.kindChangeDialog().open();
        if (!confirmed) return;
      } finally {
        this.kindDialogBusy.set(false);
        this.dialogBusyChange.emit(false);
      }
      this.draft.update((d) => ({ ...d, itemKind: nextKind, comboComponents: [] }));
      return;
    }

    this.draft.update((d) => ({ ...d, itemKind: nextKind }));
  }

  protected onKindKeydown(event: KeyboardEvent, index: number): void {
    if (!this.canEditKind()) return;
    const rtl = this.isRtl();
    const nextKey = rtl ? 'ArrowLeft' : 'ArrowRight';
    const prevKey = rtl ? 'ArrowRight' : 'ArrowLeft';
    const count = KIND_OPTIONS.length;

    let targetIndex = -1;
    if (event.key === nextKey || event.key === 'ArrowDown') {
      targetIndex = (index + 1) % count;
    } else if (event.key === prevKey || event.key === 'ArrowUp') {
      targetIndex = (index - 1 + count) % count;
    } else if (event.key === 'Home') {
      targetIndex = 0;
    } else if (event.key === 'End') {
      targetIndex = count - 1;
    } else {
      return;
    }

    event.preventDefault();
    const target = KIND_OPTIONS[targetIndex];
    afterNextRender(() => this.kindButtons()[targetIndex]?.nativeElement.focus(), { injector: this.injector });
    void this.selectKind(target.value);
  }

  protected onStatusSelected(nextStatus: string): void {
    if (this.mode() !== 'edit' || this.readonly() || this.updatingStatus()) {
      this.statusDropdown()?.value.set(this.draft().status);
      return;
    }
    const target = nextStatus as ItemStatus;
    if (target === this.draft().status) return;
    // Revert dropdown value until the parent confirms and persists the instant status change.
    this.statusDropdown()?.value.set(this.draft().status);
    if (!this.legalStatusMoves().includes(target)) return;
    this.statusChange.emit(target);
  }

  protected onCategoryChange(categoryId: string | null): void {
    if (this.readonly()) return;
    this.draft.update((d) => ({ ...d, categoryId }));
  }

  protected onOwnerChange(ownerId: string): void {
    if (this.readonly()) return;
    this.draft.update((d) => ({ ...d, ownerUserId: ownerId || null }));
  }

  protected onBaseUomChange(baseUomId: string | null): void {
    if (!this.canEditBaseUom()) return;
    this.draft.update((d) => ({ ...d, baseUomId }));
  }

  private isRtl(): boolean {
    const element = this.host.nativeElement;
    const dirAttr = element.closest('[dir]')?.getAttribute('dir')?.toLowerCase();
    if (dirAttr === 'rtl' || dirAttr === 'ltr') {
      return dirAttr === 'rtl';
    }
    return getComputedStyle(element).direction === 'rtl';
  }
}
