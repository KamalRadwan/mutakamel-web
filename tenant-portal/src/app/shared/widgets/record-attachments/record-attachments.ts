import { DOCUMENT } from '@angular/common';
import {
  Component,
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
  viewChildren,
} from '@angular/core';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerDownload,
  tablerFile,
  tablerFileSpreadsheet,
  tablerFileText,
  tablerFileTypePdf,
  tablerFileWord,
  tablerLock,
  tablerPaperclip,
  tablerPhoto,
  tablerTrash,
  tablerX,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../core/i18n/language';
import { Notify } from '../../../core/notify/notify';
import { Button } from '../../ui/button/button';
import { ConfirmDialog } from '../../ui/confirm-dialog/confirm-dialog';
import { FileDrop } from '../../ui/file-drop/file-drop';
import {
  deleteRecordAttachment,
  listRecordAttachments,
  recordAttachmentDownloadUrl,
  uploadRecordAttachment,
} from './record-attachments.api';
import {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_PAGE_LIMIT,
  AttachmentSourceType,
  AttachmentTypeMeta,
  RecordAttachment,
  attachmentTypeMeta,
  newAttachmentIdempotencyKey,
} from './record-attachments.model';

interface UploadQueueItem {
  id: string;
  idempotencyKey: string;
  sourceType: AttachmentSourceType;
  sourceId: string;
  branchId: string;
  file: File;
  status: 'queued' | 'uploading' | 'failed';
  progress: number;
  error: string | null;
}

function initialsOf(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

@Component({
  selector: 'app-record-attachments',
  imports: [NgIcon, TranslocoPipe, Button, ConfirmDialog, FileDrop],
  viewProviders: [
    provideTranslocoScope({ scope: 'record-attachments', alias: 'recordAttachments' }),
  ],
  providers: [
    provideIcons({
      tablerDownload,
      tablerFile,
      tablerFileSpreadsheet,
      tablerFileText,
      tablerFileTypePdf,
      tablerFileWord,
      tablerLock,
      tablerPaperclip,
      tablerPhoto,
      tablerTrash,
      tablerX,
    }),
  ],
  templateUrl: './record-attachments.html',
  host: { class: 'block' },
})
export class RecordAttachments {
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  protected readonly language = inject(LanguageState).current;

  private readonly confirmDialog = viewChild.required(ConfirmDialog);
  private readonly fileButtons = viewChildren<ElementRef<HTMLButtonElement>>('fileBtn');
  private readonly fileDropEl = viewChild(FileDrop, { read: ElementRef });

  readonly sourceType = input.required<AttachmentSourceType>();
  readonly sourceId = input.required<string>();
  readonly branchId = input<string | null>(null);
  readonly canEdit = input<boolean | undefined>(undefined);
  readonly canUpload = input<boolean | undefined>(undefined);
  readonly canDelete = input<boolean | undefined>(undefined);
  readonly uploaderName = input<((userId: string) => string | null | undefined) | undefined>(undefined);
  readonly countChange = output<number>();

  protected readonly allowUpload = computed(() => this.canUpload() ?? this.canEdit() ?? true);
  protected readonly allowDelete = computed(() => this.canDelete() ?? this.canEdit() ?? true);

  protected readonly accept = ATTACHMENT_ACCEPT;
  protected readonly maxBytes = ATTACHMENT_MAX_BYTES;
  protected readonly skeletonRows = [1, 2, 3, 4];

  protected readonly items = signal<RecordAttachment[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly hasNext = signal(false);
  protected readonly loading = signal(true);
  protected readonly loadingMore = signal(false);
  protected readonly denied = signal(false);
  protected readonly loadFailed = signal(false);

  protected readonly uploads = signal<UploadQueueItem[]>([]);
  protected readonly deletingName = signal('');
  protected readonly deletingId = signal<string | null>(null);
  protected readonly downloadingId = signal<string | null>(null);

  protected readonly showSkeleton = computed(
    () =>
      !this.denied() &&
      !this.loadFailed() &&
      (this.branchId() === null || (this.loading() && this.items().length === 0)),
  );

  private lastRecordKey: string | null = null;
  private loadSeq = 0;
  private queueSeq = 0;
  private uploadingSeq: number | null = null;
  private uploadCounter = 0;

  constructor() {
    effect(() => {
      const sourceType = this.sourceType();
      const sourceId = this.sourceId();
      const branchId = this.branchId();
      const key = `${sourceType}:${sourceId}`;

      if (this.lastRecordKey !== null && this.lastRecordKey !== key) {
        this.resetForRecordChange();
      }
      this.lastRecordKey = key;

      if (!branchId || !sourceId) {
        this.loadSeq++;
        this.loading.set(true);
        this.denied.set(false);
        this.loadFailed.set(false);
        return;
      }

      void this.loadPage(sourceType, branchId, sourceId, 1, false);
    });
  }

  protected onPicked(file: File): void {
    const branchId = this.branchId();
    const sourceId = this.sourceId();
    const sourceType = this.sourceType();
    if (!branchId || !sourceId || !this.allowUpload() || this.denied()) return;

    const item: UploadQueueItem = {
      id: `upload-${++this.uploadCounter}`,
      idempotencyKey: newAttachmentIdempotencyKey(),
      sourceType,
      sourceId,
      branchId,
      file,
      status: 'queued',
      progress: 0,
      error: null,
    };
    this.uploads.update((list) => [...list, item]);
    void this.processQueue();
  }

  protected onRejected(reason: 'type' | 'size'): void {
    const key =
      reason === 'size'
        ? 'recordAttachments.errors.CRM_ATTACHMENT_FILE_TOO_LARGE'
        : 'recordAttachments.errors.CRM_ATTACHMENT_FILE_TYPE_UNSUPPORTED';
    this.notify.error(this.transloco.translate(key));
  }

  protected cancelUpload(id: string): void {
    this.uploads.update((list) => list.filter((item) => !(item.id === id && item.status === 'queued')));
  }

  protected dismissUpload(id: string): void {
    this.uploads.update((list) => list.filter((item) => item.id !== id));
  }

  protected retryUpload(id: string): void {
    this.uploads.update((list) =>
      list.map((item) =>
        item.id === id && item.status === 'failed'
          ? { ...item, status: 'queued', progress: 0, error: null }
          : item,
      ),
    );
    void this.processQueue();
  }

  protected reload(): void {
    const branchId = this.branchId();
    const sourceId = this.sourceId();
    if (!branchId || !sourceId) return;
    void this.loadPage(this.sourceType(), branchId, sourceId, 1, false);
  }

  protected loadMore(): void {
    const branchId = this.branchId();
    const sourceId = this.sourceId();
    if (!branchId || !sourceId || this.loadingMore() || !this.hasNext()) return;
    void this.loadPage(this.sourceType(), branchId, sourceId, this.page() + 1, true);
  }

  protected async download(row: RecordAttachment): Promise<void> {
    if (this.downloadingId() === row.id) return;
    this.downloadingId.set(row.id);
    try {
      const url = await recordAttachmentDownloadUrl(row.id);
      const link = this.document.createElement('a');
      link.href = url;
      link.download = row.fileName;
      link.rel = 'noopener';
      this.document.body.appendChild(link);
      link.click();
      link.remove();
      if (url.startsWith('blob:')) {
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (error) {
      this.notify.error(this.translateError(error));
    } finally {
      if (this.downloadingId() === row.id) {
        this.downloadingId.set(null);
      }
    }
  }

  protected async remove(row: RecordAttachment): Promise<void> {
    if (!this.allowDelete() || this.deletingId() === row.id) return;
    const seq = this.queueSeq;
    this.deletingName.set(row.fileName);
    if (!(await this.confirmDialog().open())) return;
    if (seq !== this.queueSeq) return;

    this.deletingId.set(row.id);
    try {
      await deleteRecordAttachment(row.id);
      if (seq !== this.queueSeq) return;
      const prevList = this.items();
      const removedIndex = prevList.findIndex((item) => item.id === row.id);
      this.items.set(prevList.filter((item) => item.id !== row.id));
      const nextTotal = Math.max(0, this.total() - 1);
      this.total.set(nextTotal);
      this.countChange.emit(nextTotal);
      this.notify.success(this.transloco.translate('recordAttachments.deleted'));
      afterNextRender(
        () => {
          if (seq !== this.queueSeq) return;
          const buttons = this.fileButtons();
          if (buttons.length > 0) {
            const targetIdx = removedIndex >= 0 ? Math.min(removedIndex, buttons.length - 1) : 0;
            buttons[targetIdx]?.nativeElement.focus();
            return;
          }
          (this.fileDropEl()?.nativeElement.querySelector('button:not(:disabled)') as HTMLButtonElement | null)?.focus();
        },
        { injector: this.injector },
      );
    } catch (error) {
      if (seq === this.queueSeq) {
        this.notify.error(this.translateError(error));
      }
    } finally {
      if (this.deletingId() === row.id) {
        this.deletingId.set(null);
      }
    }
  }

  protected metaOf(mimeType: string, fileName: string): AttachmentTypeMeta {
    return attachmentTypeMeta(mimeType, fileName);
  }

  protected resolveUploaderName(userId: string): string | null {
    return this.uploaderName()?.(userId)?.trim() || null;
  }

  protected uploaderInitials(name: string): string {
    return initialsOf(name);
  }

  protected formatSize(bytes: number): string {
    const locale = `${this.language()}-u-nu-latn`;
    const fmt = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
    if (bytes >= 1024 * 1024) {
      return `${fmt.format(bytes / (1024 * 1024))} MB`;
    }
    return `${fmt.format(bytes / 1024)} KB`;
  }

  protected formatAdded(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    const locale = `${this.language()}-u-nu-latn`;
    const dateFmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' });
    const timeFmt = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    return `${dateFmt.format(date)} · ${timeFmt.format(date)}`;
  }

  private resetForRecordChange(): void {
    this.queueSeq++;
    this.uploadingSeq = null;
    this.uploads.set([]);
    this.items.set([]);
    this.total.set(0);
    this.page.set(1);
    this.hasNext.set(false);
    this.denied.set(false);
    this.loadFailed.set(false);
    this.deletingId.set(null);
    this.downloadingId.set(null);
  }

  private async loadPage(
    sourceType: AttachmentSourceType,
    branchId: string,
    sourceId: string,
    pageNumber: number,
    append: boolean,
  ): Promise<void> {
    const seq = ++this.loadSeq;
    if (append) {
      this.loadingMore.set(true);
    } else {
      this.loading.set(true);
      this.denied.set(false);
      this.loadFailed.set(false);
    }

    try {
      const result = await listRecordAttachments(sourceType, branchId, sourceId, pageNumber, ATTACHMENT_PAGE_LIMIT);
      if (seq !== this.loadSeq) return;
      this.items.update((current) => {
        if (!append) return result.items;
        const seen = new Set(current.map((item) => item.id));
        return [...current, ...result.items.filter((item) => !seen.has(item.id))];
      });
      this.total.set(result.total);
      this.page.set(result.page);
      this.hasNext.set(result.hasNext);
      this.countChange.emit(result.total);
    } catch (error) {
      if (seq !== this.loadSeq) return;
      if (this.errorStatusOf(error) === 403) {
        this.denied.set(true);
      } else if (append) {
        this.notify.error(this.translateError(error));
      } else {
        this.loadFailed.set(true);
      }
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
        this.loadingMore.set(false);
      }
    }
  }

  private async processQueue(): Promise<void> {
    const seq = this.queueSeq;
    if (this.uploadingSeq === seq) return;

    const next = this.uploads().find((item) => item.status === 'queued');
    if (!next) return;

    this.uploadingSeq = seq;
    this.uploads.update((list) =>
      list.map((item) => (item.id === next.id ? { ...item, status: 'uploading', progress: 0, error: null } : item)),
    );

    try {
      const created = await uploadRecordAttachment(
        next.sourceType,
        next.branchId,
        next.sourceId,
        next.file,
        (percent) => {
          if (seq !== this.queueSeq) return;
          this.uploads.update((list) =>
            list.map((item) => (item.id === next.id ? { ...item, progress: percent } : item)),
          );
        },
        next.idempotencyKey,
      );
      if (seq !== this.queueSeq) return;

      this.uploads.update((list) => list.filter((item) => item.id !== next.id));
      this.items.update((list) => [created, ...list.filter((item) => item.id !== created.id)]);
      const nextTotal = this.total() + 1;
      this.total.set(nextTotal);
      this.countChange.emit(nextTotal);
      this.notify.success(this.transloco.translate('recordAttachments.uploaded'));
    } catch (error) {
      if (seq !== this.queueSeq) return;
      const message = this.translateError(error);
      this.uploads.update((list) =>
        list.map((item) =>
          item.id === next.id ? { ...item, status: 'failed', progress: 0, error: message } : item,
        ),
      );
      this.notify.error(message);
    } finally {
      if (this.uploadingSeq === seq) {
        this.uploadingSeq = null;
        void this.processQueue();
      }
    }
  }

  private errorStatusOf(error: unknown): number | null {
    if (typeof error === 'object' && error !== null && 'status' in error) {
      const status = (error as { status: unknown }).status;
      if (typeof status === 'number') return status;
    }
    return null;
  }

  private errorCodeOf(error: unknown): string | null {
    if (typeof error === 'object' && error !== null && 'code' in error) {
      const code = (error as { code: unknown }).code;
      if (typeof code === 'string') return code;
    }
    return null;
  }

  private translateError(error: unknown): string {
    const code = this.errorCodeOf(error);
    if (code) {
      const key = `recordAttachments.errors.${code}`;
      const translated = this.transloco.translate(key);
      if (translated && translated !== key) {
        return translated;
      }
    }
    const status = this.errorStatusOf(error);
    if (status === 413) {
      return this.transloco.translate('recordAttachments.errors.CRM_ATTACHMENT_FILE_TOO_LARGE');
    }
    if (status === 415) {
      return this.transloco.translate('recordAttachments.errors.CRM_ATTACHMENT_FILE_TYPE_UNSUPPORTED');
    }
    if (status === 507) {
      return this.transloco.translate('recordAttachments.errors.STORAGE_CAPACITY_EXCEEDED');
    }
    if (status === 403) {
      return this.transloco.translate('recordAttachments.errors.CRM_SCOPED_PERMISSION_DENIED');
    }
    const settingsGeneric = this.transloco.translate('settings.errors.generic');
    if (settingsGeneric && settingsGeneric !== 'settings.errors.generic') {
      return settingsGeneric;
    }
    return this.transloco.translate('recordAttachments.errors.generic');
  }
}
