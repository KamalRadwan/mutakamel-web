import { Component, Injector, computed, effect, inject, runInInjectionContext, signal, untracked, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { provideIcons } from '@ng-icons/core';
import { tablerTag, tablerTrash } from '@ng-icons/tabler-icons';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { ActionItem, ActionSelection, ActionsMenu } from '../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Badge } from '../../../../shared/ui/badge/badge';
import { BulkJobsTracker } from '../../../../shared/bulk-jobs/bulk-jobs-tracker';
import { BulkJob, isBulkJobActive } from '../../../../shared/bulk-jobs/bulk-jobs.model';
import { ApiError } from '../shared/settings-api';
import { tenantWide } from '../shared/settings-access';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { contrastInkFor } from '../../../../shared/ui/color/contrast-ink';
import { SettingsFrame } from '../../../../shared/ui/settings-frame/settings-frame';
import { presetOf } from './tag-colors';
import { TagModal } from './tag-modal/tag-modal';
import { deleteTagJob, listTags, tagErrorMessage, tagErrorState } from './tags.api';
import { tagDeleteJob } from './tags-bulk';
import { MAX_TAGS, Tag } from './tags.model';

@Component({
  selector: 'app-tags-page',
  imports: [TranslocoPipe, ActionsMenu, Badge, Button, ConfirmDialog, FullState, SettingsFrame, TagModal],
  providers: [
    provideTranslocoScope('settings', { scope: 'settings-tags', alias: 'tags' }),
    provideIcons({ tablerTag, tablerTrash }),
  ],
  templateUrl: './tags-page.html',
  host: { class: 'flex flex-1 shrink-0 flex-col' },
})
export class TagsPage {
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;
  private readonly injector = inject(Injector);
  private readonly router = inject(Router);
  private readonly tracker = inject(BulkJobsTracker);

  private readonly tagModal = viewChild(TagModal);
  private readonly deleteDialog = viewChild.required<ConfirmDialog>('deleteDialog');

  protected readonly readOnly = signal(false);
  protected readonly canRead = computed(() => runInInjectionContext(this.injector, () => tenantWide('crm.tags.read')));
  protected readonly canManage = computed(() => !this.readOnly() && this.canRead()
    && runInInjectionContext(this.injector, () => tenantWide('crm.tags.manage')));
  protected readonly contrastInkFor = contrastInkFor;
  protected readonly maxTags = MAX_TAGS;
  protected readonly skeletonRows = [0, 1, 2, 3, 4];

  protected readonly tags = signal<Tag[]>([]);
  protected readonly search = signal('');
  protected readonly loading = signal(false);
  protected readonly loadError = signal<unknown | null>(null);
  protected readonly loadState = computed(() => {
    this.i18n();
    return !this.canRead()
      ? tagErrorState(this.transloco, new ApiError(403, 'CRM_PERMISSION_DENIED'))
      : this.loadError() ? tagErrorState(this.transloco, this.loadError()) : null;
  });
  protected readonly loadErrorText = computed(() => {
    const state = this.loadState();
    return state?.correlationId
      ? `${state.message} ${this.transloco.translate('settings.common.correlationId', { id: state.correlationId })}`
      : state?.message ?? '';
  });
  protected readonly deleting = signal(false);
  protected readonly pendingDeleteTag = signal<Tag | null>(null);
  protected readonly isBulkJobActive = isBulkJobActive;
  protected readonly deleteJobs = computed(() => {
    const jobs = new Map<string, BulkJob>();
    for (const job of this.tracker.jobs()) {
      const tagId = job.paramsSummary['tagId'];
      if (job.app !== 'crm' || job.module !== 'crm.tags' || job.action !== 'DELETE'
        || typeof tagId !== 'string' || jobs.has(tagId)) continue;
      jobs.set(tagId, job);
    }
    return jobs;
  });

  private loadSeq = 0;
  private readonly refreshedJobs = new Set<string>();

  protected readonly atLimit = computed(() => this.tags().length >= MAX_TAGS);

  protected readonly filteredTags = computed(() => {
    const query = this.search().trim().toLowerCase();
    const list = this.tags();
    return query ? list.filter((tag) => tag.name.toLowerCase().includes(query)) : list;
  });

  protected readonly gridColumnsClass = computed(() =>
    this.canManage()
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
    effect(() => {
      if (this.loading()) return;
      const completed = [...this.deleteJobs().values()].filter((job) =>
        !isBulkJobActive(job.status) && !this.refreshedJobs.has(job.id));
      if (!completed.length) return;
      untracked(() => {
        for (const job of completed) {
          this.refreshedJobs.add(job.id);
          if (job.status === 'COMPLETED') this.dropTag(String(job.paramsSummary['tagId']));
        }
        void this.refreshList();
      });
    });
  }

  protected async load(): Promise<void> {
    const seq = ++this.loadSeq;
    if (!this.canRead()) {
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.loadError.set(null);
    try {
      const items = await listTags();
      if (seq !== this.loadSeq) return;
      this.tags.set(items.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      if (seq !== this.loadSeq) return;
      if (error instanceof ApiError && error.status === 401) return;
      this.loadError.set(error);
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  protected openNew(): void {
    if (!this.canManage() || this.atLimit()) return;
    this.tagModal()?.openCreate();
  }

  protected openTag(tag: Tag): void {
    if (!this.canRead()) return;
    const job = this.deleteJobs().get(tag.id);
    if (job && isBulkJobActive(job.status)) {
      this.openDeleteReport(job);
      return;
    }
    this.tagModal()?.openEdit(tag);
  }

  protected openDeleteReport(job: BulkJob): void {
    this.tracker.openReport('crm', job.id);
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

  protected onTagSaved(tag: Tag): void {
    this.tags.update((items) => [...items.filter((item) => item.id !== tag.id), tag]
      .sort((a, b) => a.name.localeCompare(b.name)));
  }

  protected onTagDeletedRemotely(): void {
    void this.refreshList();
  }

  protected async requestDelete(tag: Tag): Promise<void> {
    if (!this.canManage() || this.deleting()) return;
    const active = this.deleteJobs().get(tag.id);
    if (active && isBulkJobActive(active.status)) {
      this.openDeleteReport(active);
      return;
    }
    this.pendingDeleteTag.set(tag);
    const confirmed = await this.deleteDialog().open();
    if (!confirmed) {
      this.pendingDeleteTag.set(null);
      return;
    }
    if (!this.canManage()) {
      this.pendingDeleteTag.set(null);
      return;
    }

    this.deleting.set(true);
    try {
      const result = await deleteTagJob(tag.id);
      if (result) {
        const job = this.tracker.jobs().find((job) => job.app === 'crm' && job.id === result.jobId)
          ?? tagDeleteJob(tag.id, result);
        this.tracker.syncExternalJob(job);
        const modal = this.tagModal();
        if (modal?.editingId() === tag.id) modal.close();
        this.openDeleteReport(job);
        return;
      }
      this.dropTag(tag.id);
      this.notify.success(this.transloco.translate('tags.toasts.deleted'));
      await this.refreshList();
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        this.dropTag(tag.id);
        await this.refreshList();
        return;
      }
      if (tagErrorState(this.transloco, error).readOnly) this.readOnly.set(true);
      this.notify.error(tagErrorMessage(this.transloco, error));
    } finally {
      this.deleting.set(false);
      this.pendingDeleteTag.set(null);
    }
  }

  private dropTag(id: string): void {
    this.tags.update((items) => items.filter((item) => item.id !== id));
    const modal = this.tagModal();
    if (modal?.editingId() === id) modal.close();
  }

  protected onLoadAction(): void {
    if (this.loadState()?.kind === 'forbidden') {
      void this.router.navigateByUrl('/workspace/home');
    } else {
      void this.load();
    }
  }

  private async refreshList(): Promise<void> {
    const seq = ++this.loadSeq;
    if (!this.canRead()) return;
    try {
      const items = await listTags();
      if (seq !== this.loadSeq) return;
      this.tags.set(items.sort((a, b) => a.name.localeCompare(b.name)));
      this.loadError.set(null);
    } catch (error) {
      if (seq === this.loadSeq) {
        if (!(error instanceof ApiError && error.status === 401)) this.loadError.set(error);
      }
    }
  }
}
