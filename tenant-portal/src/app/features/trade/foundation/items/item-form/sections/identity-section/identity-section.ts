import { Component, ElementRef, computed, inject, input, model, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Field } from '../../../../../../../shared/ui/field/field';
import { RECORD_PAGE_GRID, type RecordLayout } from '../../../../../../../shared/ui/section-bar/record-layout';
import { ITEM_CODE_PATTERN, ITEM_LIMITS } from '../../../items.model';
import { normalizeCode, type DraftErrors, type ItemDraft } from '../../item-draft';

@Component({
  selector: 'app-item-identity-section',
  imports: [TranslocoPipe, Field],
  templateUrl: './identity-section.html',
  host: { class: 'block min-w-0' },
})
export class IdentitySection {
  private static nextId = 0;
  protected readonly uid = `item-id-${++IdentitySection.nextId}`;

  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  private readonly codeInput = viewChild<ElementRef<HTMLInputElement>>('codeInput');
  private readonly nameEnInput = viewChild<ElementRef<HTMLInputElement>>('nameEnInput');

  readonly layout = input<RecordLayout>('modal');
  readonly mode = input<'create' | 'edit'>('create');
  readonly readonly = input(false);
  readonly errors = input<DraftErrors>({});

  readonly draft = model.required<ItemDraft>();

  protected readonly limits = ITEM_LIMITS;
  protected readonly pageGrid = RECORD_PAGE_GRID;

  protected readonly codePreview = computed<string | null>(() => {
    this.i18n();
    if (this.mode() !== 'create') return null;
    const normalized = normalizeCode(this.draft().canonicalCode);
    if (!normalized || !ITEM_CODE_PATTERN.test(normalized)) return null;
    return this.transloco.translate('itemForm.codePreview', { code: normalized });
  });

  protected readonly codeReadonly = computed(() => this.readonly() || this.mode() === 'edit');
  protected readonly nameEnRequired = computed(() => !this.draft().nameAr.trim());
  protected readonly nameArRequired = computed(() => !this.draft().nameEn.trim());

  focusPrimary(): void {
    const target =
      this.mode() === 'create' && !this.readonly()
        ? this.codeInput()?.nativeElement
        : this.nameEnInput()?.nativeElement;
    if (!target) return;
    target.scrollIntoView({ block: 'nearest' });
    target.focus();
  }

  protected errorText(path: string): string | null {
    this.i18n();
    const err = this.errors()[path];
    if (!err) return null;
    return this.transloco.translate(err.key, err.params);
  }

  protected onTextInput(field: 'canonicalCode' | 'nameEn' | 'nameAr' | 'barcode', event: Event): void {
    if (this.readonly()) return;
    if (field === 'canonicalCode' && this.mode() === 'edit') return;
    const value = (event.target as HTMLInputElement).value;
    this.draft.update((d) => ({ ...d, [field]: value }));
  }
}
