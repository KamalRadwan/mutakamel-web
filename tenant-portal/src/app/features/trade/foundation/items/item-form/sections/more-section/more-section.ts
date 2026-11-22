import { Component, inject, input, model } from '@angular/core';
import { translationEvents } from '../../../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Field } from '../../../../../../../shared/ui/field/field';
import { RECORD_PAGE_GRID, type RecordLayout } from '../../../../../../../shared/ui/section-bar/record-layout';
import { ITEM_LIMITS } from '../../../items.model';
import type { DraftErrors, ItemDraft } from '../../item-draft';

type MoreTextField =
  | 'weightKg'
  | 'volumeM3'
  | 'quotationDescription'
  | 'salesOrderDescription'
  | 'receiptDescription'
  | 'deliveryOrderDescription'
  | 'notes';

@Component({
  selector: 'app-item-more-section',
  imports: [TranslocoPipe, Field],
  templateUrl: './more-section.html',
  host: { class: 'block min-w-0' },
})
export class MoreSection {
  private static nextId = 0;
  protected readonly uid = `item-more-${++MoreSection.nextId}`;

  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  readonly layout = input<RecordLayout>('modal');
  readonly readonly = input(false);
  readonly errors = input<DraftErrors>({});

  readonly draft = model.required<ItemDraft>();

  protected readonly limits = ITEM_LIMITS;
  protected readonly pageGrid = RECORD_PAGE_GRID;

  protected errorText(path: string): string | null {
    this.i18n();
    const err = this.errors()[path];
    if (!err) return null;
    return this.transloco.translate(err.key, err.params);
  }

  protected onInput(field: MoreTextField, event: Event): void {
    if (this.readonly()) return;
    const value = (event.target as HTMLInputElement | HTMLTextAreaElement).value;
    this.draft.update((d) => ({ ...d, [field]: value }));
  }
}
