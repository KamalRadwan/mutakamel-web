import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { provideIcons } from '@ng-icons/core';
import { tablerAlertTriangle, tablerTag, tablerTrash } from '@ng-icons/tabler-icons';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { ActionItem, ActionSelection, ActionsMenu } from '../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Modal } from '../../../../shared/ui/modal/modal';
import { errorCodeOf } from '../shared/settings-api';
import { SettingsFrame } from '../../../../shared/ui/settings-frame/settings-frame';
import { presetOf } from './tag-colors';
import { TagModal } from './tag-modal/tag-modal';
import { deleteTag, detachLimitCount, listTags, tagErrorMessage } from './tags.api';
import { MAX_TAGS, Tag } from './tags.model';

const CAN_MANAGE = true; // later from the session permissions

@Component({
  selector: 'app-tags-page',
  imports: [TranslocoPipe, ActionsMenu, Button, ConfirmDialog, Modal, SettingsFrame, TagModal],
  providers: [
    provideTranslocoScope('settings', { scope: 'settings-tags', alias: 'tags' }),
    provideIcons({ tablerAlertTriangle, tablerTag, tablerTrash }),
  ],
  templateUrl: './tags-page.html',
  host: { class: 'flex min-h-0 flex-1 flex-col' },
})
export class TagsPage {
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;

  private readonly tagModal = viewChild.required(TagModal);
  private readonly deleteDialog = viewChild.required<ConfirmDialog>('deleteDialog');
  private readonly detachWarningModal = viewChild.required<Modal>('detachWarningModal');

  protected readonly canManage = CAN_MANAGE;
  protected readonly maxTags = MAX_TAGS;
  protected readonly skeletonRows = [0, 1, 2, 3, 4];

  protected readonly tags = signal<Tag[]>([]);
  protected readonly search = signal('');
  protected readonly loading = signal(false);
  protected readonly loadError = signal(false);
  protected readonly deleting = signal(false);
  protected readonly pendingDeleteTag = signal<Tag | null>(null);
  protected readonly detachWarningCount = signal<number | null>(null);

  private loadSeq = 0;

  protected readonly atLimit = computed(() => this.tags().length >= MAX_TAGS);

  protected readonly filteredTags = computed(() => {
    const query = this.search().trim().toLowerCase();
    const list = this.tags();
    return query ? list.filter((tag) => tag.name.toLowerCase().includes(query)) : list;
  });

  protected readonly gridColumnsClass = computed(() =>
    this.canManage
      ? 'grid-cols-[minmax(0,1.6fr)_minmax(0,2fr)_minmax(0,1fr)_var(--table-head-h)]'
      : 'grid-cols-[minmax(0,1.6fr)_minmax(0,2fr)_minmax(0,1fr)]',
  );

  protected readonly rowActionItems = computed<ActionItem[]>(() => {
    this.i18n();
    return [
      {
        id: 'open',
        title: this.transloco.translate('tags.actions.open'),
        icon: 'tablerEye',
        tile: 'bg-icon-blue',
      },
      {
        id: 'edit',
        title: this.transloco.translate('tags.actions.edit'),
        icon: 'tablerEdit',
        tile: 'bg-icon-orange',
      },
      {
        id: 'delete',
        title: this.transloco.translate('settings.common.delete'),
        icon: 'tablerTrash',
        tile: 'bg-icon-red',
        danger: true,
      },
    ];
  });

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.loadError.set(false);
    try {
      const items = await listTags();
      if (seq !== this.loadSeq) return;
      this.tags.set(items);
    } catch {
      if (seq !== this.loadSeq) return;
      this.loadError.set(true);
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  protected openNew(): void {
    if (!this.canManage || this.atLimit()) return;
    this.tagModal().openCreate();
  }

  protected openTag(tag: Tag): void {
    this.tagModal().openEdit(tag);
  }

  protected presetKey(tag: Tag): string | null {
    return presetOf(tag.backgroundColor, tag.textColor);
  }

  protected formatDate(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return new Intl.DateTimeFormat(`${this.language()}-u-nu-latn`, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  }

  protected onRowAction(tag: Tag, selection: ActionSelection): void {
    if (selection.id === 'open' || selection.id === 'edit') {
      this.openTag(tag);
      return;
    }
    if (selection.id === 'delete') {
      void this.requestDelete(tag);
    }
  }

  protected onTagSaved(): void {
    void this.refreshList();
  }

  protected onTagDeletedRemotely(): void {
    void this.refreshList();
  }

  protected async requestDelete(tag: Tag): Promise<void> {
    if (!this.canManage || this.deleting()) return;
    this.pendingDeleteTag.set(tag);
    const confirmed = await this.deleteDialog().open();
    if (!confirmed) {
      this.pendingDeleteTag.set(null);
      return;
    }

    this.deleting.set(true);
    try {
      await deleteTag(tag.id);
      this.notify.success(this.transloco.translate('tags.toasts.deleted'));
      if (this.tagModal().editingId() === tag.id) {
        this.tagModal().close();
      }
      await this.refreshList();
    } catch (error) {
      const code = errorCodeOf(error);
      if (code === 'CRM_TAG_DETACH_LIMIT_EXCEEDED') {
        this.detachWarningCount.set(detachLimitCount(error));
        this.detachWarningModal().open();
        return;
      }
      this.notify.error(tagErrorMessage(this.transloco, error));
      if (code === 'CRM_TAG_NOT_FOUND') {
        if (this.tagModal().editingId() === tag.id) {
          this.tagModal().close();
        }
        await this.refreshList();
      }
    } finally {
      this.deleting.set(false);
      this.pendingDeleteTag.set(null);
    }
  }

  protected closeDetachWarning(): void {
    this.detachWarningModal().close();
  }

  private async refreshList(): Promise<void> {
    const seq = ++this.loadSeq;
    try {
      const items = await listTags();
      if (seq !== this.loadSeq) return;
      this.tags.set(items);
      this.loadError.set(false);
    } catch (error) {
      if (seq === this.loadSeq) {
        this.notify.error(tagErrorMessage(this.transloco, error));
      }
    }
  }
}
