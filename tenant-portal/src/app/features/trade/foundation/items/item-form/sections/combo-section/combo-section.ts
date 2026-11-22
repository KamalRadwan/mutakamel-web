import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
  untracked,
} from '@angular/core';
import { translationEvents } from '../../../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerCircleX, tablerPlus, tablerTrash } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../../../core/i18n/language';
import { Button } from '../../../../../../../shared/ui/button/button';
import { Field } from '../../../../../../../shared/ui/field/field';
import type { RecordLayout } from '../../../../../../../shared/ui/section-bar/record-layout';
import { TradeItemPicker } from '../../../../../shared/pickers/item-picker/item-picker';
import { getItem, itemName } from '../../../../../shared/trade-foundation.api';
import { ITEM_LIMITS } from '../../../items.model';
import {
  newComboComponentRow,
  newOptionalProductRow,
  type DraftErrors,
  type ItemDraft,
} from '../../item-draft';

@Component({
  selector: 'app-item-combo-section',
  imports: [NgIcon, TranslocoPipe, Button, Field, TradeItemPicker],
  providers: [provideIcons({ tablerPlus, tablerTrash, tablerCircleX })],
  templateUrl: './combo-section.html',
  host: { class: 'block min-w-0' },
})
export class ComboSection {
  private static nextId = 0;
  protected readonly uid = `item-combo-${++ComboSection.nextId}`;

  private readonly transloco = inject(TranslocoService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;

  readonly layout = input<RecordLayout>('modal');
  readonly readonly = input(false);
  readonly errors = input<DraftErrors>({});
  readonly selfId = input<string | null>(null);

  readonly draft = model.required<ItemDraft>();

  protected readonly maxComponents = ITEM_LIMITS.components;
  private readonly resolvedNames = signal<ReadonlyMap<string, string>>(new Map());
  private readonly loadingIds = new Set<string>();

  protected readonly comboGridClass = computed(
    () => 'grid grid-cols-1 items-start gap-x-10 gap-y-8 desktop:grid-cols-12',
  );

  constructor() {
    effect(() => {
      const readonly = this.readonly();
      const lang = this.language();
      const d = this.draft();
      if (!readonly) return;

      const ids = new Set<string>();
      for (const row of d.comboComponents) {
        if (row.componentItemId) ids.add(row.componentItemId);
      }
      for (const row of d.optionalProducts) {
        if (row.optionalProductItemId) ids.add(row.optionalProductItemId);
      }

      const cached = untracked(() => this.resolvedNames());
      for (const id of ids) {
        const cacheKey = `${lang}:${id}`;
        if (cached.has(cacheKey) || this.loadingIds.has(cacheKey)) continue;
        this.loadingIds.add(cacheKey);
        void getItem({}, id)
          .then((detail) => {
            const label = `${itemName(detail, lang)} (${detail.canonicalCode})`;
            this.resolvedNames.update((prev) => {
              const next = new Map(prev);
              next.set(cacheKey, label);
              return next;
            });
          })
          .catch(() => {
            // Keep raw id fallback when item lookup fails.
          })
          .finally(() => {
            this.loadingIds.delete(cacheKey);
          });
      }
    });
  }

  protected errorText(path: string): string | null {
    this.i18n();
    const err = this.errors()[path];
    if (!err) return null;
    return this.transloco.translate(err.key, err.params);
  }

  protected describedBy(path: string, controlId: string): string {
    return this.errorText(path) ? `${controlId}-hint ${controlId}-error` : `${controlId}-hint`;
  }

  protected excludeForComponent(index: number): string[] {
    const excluded: string[] = [];
    const self = this.selfId();
    if (self) excluded.push(self);
    const rows = this.draft().comboComponents;
    for (let i = 0; i < rows.length; i += 1) {
      if (i === index) continue;
      const id = rows[i].componentItemId;
      if (id) excluded.push(id);
    }
    return excluded;
  }

  protected excludeForOptional(index: number): string[] {
    const excluded: string[] = [];
    const self = this.selfId();
    if (self) excluded.push(self);
    const rows = this.draft().optionalProducts;
    for (let i = 0; i < rows.length; i += 1) {
      if (i === index) continue;
      const id = rows[i].optionalProductItemId;
      if (id) excluded.push(id);
    }
    return excluded;
  }

  protected itemLabel(id: string | null): string {
    if (!id) return '—';
    return this.resolvedNames().get(`${this.language()}:${id}`) ?? id;
  }

  protected addComponent(): void {
    if (this.readonly() || this.draft().comboComponents.length >= this.maxComponents) return;
    this.draft.update((d) => ({
      ...d,
      comboComponents: [...d.comboComponents, newComboComponentRow(d.comboComponents)],
    }));
  }

  protected removeComponent(index: number): void {
    if (this.readonly()) return;
    this.draft.update((d) => ({
      ...d,
      comboComponents: d.comboComponents.filter((_, i) => i !== index),
    }));
    this.focusAfterRemove('components', index, this.draft().comboComponents.length);
  }

  protected setComponentItem(index: number, componentItemId: string | null): void {
    if (this.readonly()) return;
    this.draft.update((d) => ({
      ...d,
      comboComponents: d.comboComponents.map((row, i) => (i === index ? { ...row, componentItemId } : row)),
    }));
  }

  protected setComponentField(index: number, field: 'quantity' | 'sortOrder', event: Event): void {
    if (this.readonly()) return;
    const value = (event.target as HTMLInputElement).value;
    this.draft.update((d) => ({
      ...d,
      comboComponents: d.comboComponents.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    }));
  }

  protected addOptional(): void {
    if (this.readonly() || this.draft().optionalProducts.length >= this.maxComponents) return;
    this.draft.update((d) => ({
      ...d,
      optionalProducts: [...d.optionalProducts, newOptionalProductRow(d.optionalProducts)],
    }));
  }

  protected removeOptional(index: number): void {
    if (this.readonly()) return;
    this.draft.update((d) => ({
      ...d,
      optionalProducts: d.optionalProducts.filter((_, i) => i !== index),
    }));
    this.focusAfterRemove('optionals', index, this.draft().optionalProducts.length);
  }

  /** The removed row's button is gone: focus the next row's remove button, else the previous, else "Add". */
  private focusAfterRemove(list: 'components' | 'optionals', index: number, remaining: number): void {
    afterNextRender(
      () => {
        const root = this.host.nativeElement;
        const target =
          remaining > 0
            ? root.querySelector<HTMLElement>(`[data-combo-remove="${list}-${Math.min(index, remaining - 1)}"]`)
            : root.querySelector<HTMLElement>(`[data-combo-add="${list}"]`);
        target?.focus();
      },
      { injector: this.injector },
    );
  }

  protected setOptionalItem(index: number, optionalProductItemId: string | null): void {
    if (this.readonly()) return;
    this.draft.update((d) => ({
      ...d,
      optionalProducts: d.optionalProducts.map((row, i) =>
        i === index ? { ...row, optionalProductItemId } : row,
      ),
    }));
  }

  protected setOptionalOrder(index: number, event: Event): void {
    if (this.readonly()) return;
    const sortOrder = (event.target as HTMLInputElement).value;
    this.draft.update((d) => ({
      ...d,
      optionalProducts: d.optionalProducts.map((row, i) => (i === index ? { ...row, sortOrder } : row)),
    }));
  }
}
