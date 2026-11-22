import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  linkedSignal,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { tablerBox, tablerCategory, tablerNote, tablerPackages, tablerPhoto } from '@ng-icons/tabler-icons';
import type { RecordLayout } from '../../../../../shared/ui/section-bar/record-layout';
import { SectionBar } from '../../../../../shared/ui/section-bar/section-bar';
import type { ItemImageSummary, ItemStatus, Owner, Uom } from '../../../shared/trade-foundation.model';
import type { DraftErrors, FieldError, ItemDraft } from './item-draft';
import { ClassificationSection } from './sections/classification-section/classification-section';
import { ComboSection } from './sections/combo-section/combo-section';
import { IdentitySection } from './sections/identity-section/identity-section';
import { ImageSection } from './sections/image-section/image-section';
import { MoreSection } from './sections/more-section/more-section';
import { smoothScrollBehavior } from '../../../../../shared/ui/scroll/scroll-into-view';

const MORE_ERROR_KEYS: ReadonlySet<string> = new Set([
  'weightKg',
  'volumeM3',
  'quotationDescription',
  'salesOrderDescription',
  'receiptDescription',
  'deliveryOrderDescription',
  'notes',
]);

export const ITEM_PAGE_SECTION_ERRORS: Record<string, readonly string[]> = {
  'item-classification': ['status', 'categoryId', 'ownerUserId', 'baseUomId'],
  'item-identity': ['canonicalCode', 'nameEn', 'nameAr', 'barcode'],
  'item-image': ['image'],
  'item-combo': ['comboComponents', 'optionalProducts'],
  'item-more': [
    'weightKg',
    'volumeM3',
    'quotationDescription',
    'salesOrderDescription',
    'receiptDescription',
    'deliveryOrderDescription',
    'notes',
  ],
};

const PAGE_SECTION_ORDER = [
  'item-classification',
  'item-identity',
  'item-image',
  'item-combo',
  'item-more',
] as const;

@Component({
  selector: 'app-item-form',
  imports: [
    TranslocoPipe,
    SectionBar,
    ClassificationSection,
    IdentitySection,
    ImageSection,
    ComboSection,
    MoreSection,
  ],
  providers: [
    provideIcons({
      tablerCategory,
      tablerBox,
      tablerPhoto,
      tablerPackages,
      tablerNote,
    }),
  ],
  templateUrl: './item-form.html',
  host: {
    '[class]': "layout() === 'modal' ? 'flex h-full min-h-0 flex-1 overflow-hidden' : 'block'",
    '(keydown)': 'onHostKeydown($event)',
  },
})
export class ItemForm {
  private static nextId = 0;
  protected readonly uid = `item-form-${++ItemForm.nextId}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly identitySection = viewChild(IdentitySection);

  readonly layout = input<RecordLayout>('modal');
  readonly mode = input<'create' | 'edit'>('create');
  readonly readonly = input(false);
  readonly errors = input<DraftErrors>({});
  readonly itemId = input<string | null>(null);
  readonly image = input<ItemImageSummary | null>(null);
  readonly pendingImage = input<File | null>(null);
  readonly uploadingImage = input(false);
  readonly updatingStatus = input(false);
  readonly owners = input<readonly Owner[]>([]);
  readonly baseUom = input<Uom | null>(null);
  readonly categoryLabel = input('');
  readonly showMore = input(false);

  readonly draft = model.required<ItemDraft>();

  readonly statusChange = output<ItemStatus>();
  readonly imagePicked = output<File>();
  readonly imageRemove = output<void>();
  readonly imageClientError = output<FieldError | null>();
  readonly dialogBusyChange = output<boolean>();
  readonly submitRequest = output<void>();

  protected readonly moreOpen = linkedSignal(() => this.showMore() || this.layout() === 'page');
  private readonly localImageError = signal<FieldError | null>(null);
  private classificationDialogBusy = false;
  private imageDialogBusy = false;

  protected readonly imageError = computed<FieldError | null>(
    () => this.errors()['image'] ?? this.localImageError(),
  );

  focusPrimary(): void {
    this.identitySection()?.focusPrimary();
  }

  focusFirstError(): void {
    if (this.layout() === 'modal' && !this.moreOpen() && this.hasMoreErrors()) {
      this.moreOpen.set(true);
      afterNextRender(() => this.focusInvalidElement(), { injector: this.injector });
      return;
    }

    const focused = this.focusInvalidElement();
    if (!focused && this.layout() === 'modal' && !this.moreOpen()) {
      this.moreOpen.set(true);
      afterNextRender(() => this.focusInvalidElement(), { injector: this.injector });
    }
  }

  scrollToFirstError(): void {
    if (this.layout() === 'modal') return;
    const errKeys = Object.keys(this.errors());
    if (errKeys.length === 0) return;

    for (const sectionId of PAGE_SECTION_ORDER) {
      if (!this.sectionHasError(sectionId, errKeys)) continue;
      const sectionEl = this.host.nativeElement.querySelector<HTMLElement>(`#${sectionId}`);
      if (!sectionEl) continue;
      sectionEl.scrollIntoView({ block: 'start', behavior: smoothScrollBehavior() });
      this.focusFirstInvalidIn(sectionEl, true);
      return;
    }
  }

  protected onImagePicked(file: File): void {
    this.localImageError.set(null);
    this.imagePicked.emit(file);
  }

  protected onImageClientError(err: FieldError | null): void {
    this.localImageError.set(err);
    this.imageClientError.emit(err);
  }

  protected onChildDialogBusy(source: 'classification' | 'image', busy: boolean): void {
    if (source === 'classification') {
      this.classificationDialogBusy = busy;
    } else {
      this.imageDialogBusy = busy;
    }
    this.dialogBusyChange.emit(this.classificationDialogBusy || this.imageDialogBusy);
  }

  protected onHostKeydown(event: KeyboardEvent): void {
    if (this.readonly()) return;
    if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key === 'Enter') {
      event.preventDefault();
      this.submitRequest.emit();
    }
  }

  private hasMoreErrors(): boolean {
    return Object.keys(this.errors()).some((key) => MORE_ERROR_KEYS.has(key));
  }

  private sectionHasError(sectionId: string, errKeys: readonly string[]): boolean {
    const prefixes = ITEM_PAGE_SECTION_ERRORS[sectionId];
    if (!prefixes) return false;
    return errKeys.some((key) => prefixes.some((prefix) => key === prefix || key.startsWith(`${prefix}.`)));
  }

  private focusInvalidElement(): boolean {
    return this.focusFirstInvalidIn(this.host.nativeElement, false);
  }

  private focusFirstInvalidIn(container: HTMLElement, preventScroll: boolean): boolean {
    const target = container.querySelector<HTMLElement>('[aria-invalid="true"]');
    if (!target) return false;
    const focusTarget = (el: HTMLElement) => {
      if (!preventScroll) {
        el.scrollIntoView({ block: 'nearest' });
      }
      el.focus({ preventScroll });
    };
    if (target.matches('input, textarea, select, button, [tabindex]')) {
      focusTarget(target);
      return true;
    }
    const inner = target.querySelector<HTMLElement>('input, textarea, select, button, [tabindex]');
    if (inner) {
      focusTarget(inner);
      return true;
    }
    if (!preventScroll) {
      target.scrollIntoView({ block: 'nearest' });
    }
    return true;
  }
}
