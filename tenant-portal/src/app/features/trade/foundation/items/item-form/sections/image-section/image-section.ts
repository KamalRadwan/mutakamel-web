import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { translationEvents } from '../../../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerPhoto, tablerTrash } from '@ng-icons/tabler-icons';
import { Button } from '../../../../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Field } from '../../../../../../../shared/ui/field/field';
import { FileDrop } from '../../../../../../../shared/ui/file-drop/file-drop';
import type { RecordLayout } from '../../../../../../../shared/ui/section-bar/record-layout';
import type { ItemImageSummary } from '../../../../../shared/trade-foundation.model';
import { itemThumbUrl, releaseThumbUrl } from '../../../../../shared/trade-image';
import { ITEM_IMAGE_RULES } from '../../../items.model';
import { validateImageFile, type FieldError } from '../../item-draft';

@Component({
  selector: 'app-item-image-section',
  imports: [NgIcon, TranslocoPipe, Button, ConfirmDialog, Field, FileDrop],
  providers: [provideIcons({ tablerPhoto, tablerTrash })],
  templateUrl: './image-section.html',
  host: { class: 'block min-w-0' },
})
export class ImageSection {
  private static nextId = 0;
  protected readonly uid = `item-img-${++ImageSection.nextId}`;

  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly removeDialog = viewChild.required<ConfirmDialog>('removeDialog');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  /** Set when a removal was confirmed here: the remove button disappears, so focus moves to the picker. */
  private removalPending: { sawBusy: boolean } | null = null;

  readonly layout = input<RecordLayout>('modal');
  readonly mode = input<'create' | 'edit'>('create');
  readonly readonly = input(false);
  readonly itemId = input<string | null>(null);
  readonly image = input<ItemImageSummary | null>(null);
  readonly pendingFile = input<File | null>(null);
  readonly uploading = input(false);
  readonly error = input<FieldError | null>(null);

  readonly imagePicked = output<File>();
  readonly imageRemove = output<void>();
  readonly clientError = output<FieldError | null>();
  readonly dialogBusyChange = output<boolean>();

  protected readonly rules = ITEM_IMAGE_RULES;
  protected readonly accept = ITEM_IMAGE_RULES.types.join(',');

  private readonly previewUrlSignal = signal<string | null>(null);
  protected readonly previewUrl = this.previewUrlSignal.asReadonly();
  private readonly removeDialogBusy = signal(false);

  protected readonly hasImage = computed(() => Boolean(this.pendingFile() || this.image()));

  protected readonly errorText = computed<string | null>(() => {
    this.i18n();
    const err = this.error();
    return err ? this.transloco.translate(err.key, err.params) : null;
  });

  protected readonly describedBy = computed(() =>
    this.errorText() ? `${this.uid}-image-hint ${this.uid}-image-error` : `${this.uid}-image-hint`,
  );

  constructor() {
    let seq = 0;
    let activeUrl: string | null = null;
    const setPreview = (next: string | null) => {
      if (activeUrl && activeUrl !== next) {
        releaseThumbUrl(activeUrl);
      }
      activeUrl = next;
      this.previewUrlSignal.set(next);
    };

    effect(() => {
      const pending = this.pendingFile();
      const id = this.itemId();
      const img = this.image();
      const loadSeq = ++seq;

      if (pending) {
        setPreview(URL.createObjectURL(pending));
        return;
      }

      if (!id || !img) {
        setPreview(null);
        return;
      }

      void itemThumbUrl(id, img).then((url) => {
        if (loadSeq !== seq) {
          releaseThumbUrl(url);
          return;
        }
        setPreview(url);
      });
    });

    effect(() => {
      const has = this.hasImage();
      const busy = this.uploading();
      const pending = this.removalPending;
      if (!pending) return;
      if (!has) {
        this.removalPending = null;
        afterNextRender(() => this.focusPicker(), { injector: this.injector });
      } else if (busy) {
        pending.sawBusy = true;
      } else if (pending.sawBusy) {
        this.removalPending = null;
      }
    });

    inject(DestroyRef).onDestroy(() => {
      seq += 1;
      releaseThumbUrl(activeUrl);
      activeUrl = null;
    });
  }

  protected async onFilePicked(file: File): Promise<void> {
    if (this.readonly() || this.uploading()) return;
    const err = await validateImageFile(file);
    if (err) {
      this.clientError.emit(err);
      return;
    }
    this.clientError.emit(null);
    this.imagePicked.emit(file);
  }

  protected onFileRejected(reason: 'type' | 'size'): void {
    this.clientError.emit({
      key: reason === 'size' ? 'itemForm.validation.imageSize' : 'itemForm.validation.imageType',
    });
  }

  private focusPicker(): void {
    const field = this.host.nativeElement.querySelector<HTMLElement>(`[id="${this.uid}-image"]`);
    const target = field?.matches('input') ? field : field?.querySelector<HTMLElement>('button, input');
    target?.focus();
  }

  protected async confirmRemove(): Promise<void> {
    if (this.readonly() || this.uploading() || !this.hasImage() || this.removeDialogBusy()) return;
    this.removeDialogBusy.set(true);
    this.dialogBusyChange.emit(true);
    try {
      const confirmed = await this.removeDialog().open();
      if (!confirmed) return;
      this.clientError.emit(null);
      this.removalPending = { sawBusy: false };
      this.imageRemove.emit();
    } finally {
      this.removeDialogBusy.set(false);
      this.dialogBusyChange.emit(false);
    }
  }
}
