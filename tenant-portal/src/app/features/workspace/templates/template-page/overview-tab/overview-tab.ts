import { DestroyRef, Component, Injector, afterNextRender, computed, effect, inject, signal, viewChild } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlarm,
  tablerCircleCheck,
  tablerCloudOff,
  tablerEdit,
  tablerInfoCircle,
  tablerPhoto,
  tablerRefresh,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import {
  TemplateDirection,
  TemplateThumbnailQuery,
  TemplateThumbnailRetryRequest,
  getTemplate,
  getTemplateThumbnail,
  retryTemplateThumbnail,
} from '../../templates.api';
import { TemplatePageService } from '../template-page.service';

@Component({
  selector: 'app-overview-tab',
  imports: [NgIcon, TranslocoPipe, Button, ConfirmDialog, Dropdown, Field],
  providers: [
    provideIcons({
      tablerInfoCircle,
      tablerCircleCheck,
      tablerEdit,
      tablerPhoto,
      tablerAlarm,
      tablerCloudOff,
      tablerRefresh,
    }),
  ],
  templateUrl: './overview-tab.html',
  host: { class: 'block min-w-0' },
})
export class OverviewTab {
  private static nextId = 0;
  protected readonly uid = `tpl-overview-${++OverviewTab.nextId}`;

  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly transloco = inject(TranslocoService);
  private readonly notify = inject(Notify);
  protected readonly language = inject(LanguageState).current;
  protected readonly service = inject(TemplatePageService);

  private readonly directionConfirm = viewChild.required<ConfirmDialog>('directionConfirm');

  protected readonly displayedDirection = signal<TemplateDirection>('AUTO');
  protected readonly thumbUrl = signal<string | null>(null);
  protected readonly thumbLoading = signal(false);
  protected readonly thumbLoadError = signal(false);
  protected readonly thumbRetrying = signal(false);

  private static readonly THUMB_POLL_INTERVAL_MS = 2000;
  private static readonly THUMB_POLL_MAX_ATTEMPTS = 10;

  private thumbObjectUrl: string | null = null;
  private thumbLoadSeq = 0;
  private thumbPollTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly directionOptions = computed<DropdownOption<TemplateDirection>[]>(() => {
    this.language();
    return [
      { value: 'AUTO', label: this.transloco.translate('templates.directions.AUTO') },
      { value: 'LTR', label: this.transloco.translate('templates.directions.LTR') },
      { value: 'RTL', label: this.transloco.translate('templates.directions.RTL') },
    ];
  });

  protected readonly scopeText = computed(() => {
    this.language();
    const def = this.service.definition();
    if (!def) return '';
    return this.service.scopeLabel(def.scope, this.transloco);
  });

  protected readonly draftRevision = computed(() => {
    const draft = this.service.draft();
    if (draft) return draft.revision;
    return this.service.definition()?.currentDraft.revision ?? 0;
  });

  protected readonly draftUpdatedAt = computed(() => {
    const draft = this.service.draft();
    return draft?.updatedAt ?? this.service.definition()?.updatedAt ?? null;
  });

  protected readonly draftValidationStatus = computed<'CHANGED' | 'PASSED' | 'FAILED' | 'NOT_VALIDATED'>(() => {
    if (this.service.dirty()) return 'CHANGED';
    const state = this.service.draft()?.validation.state ?? this.service.definition()?.currentDraft.validationState;
    if (state === 'PASSED') return 'PASSED';
    if (state === 'FAILED') return 'FAILED';
    if (state === 'STALE') return 'CHANGED';
    return 'NOT_VALIDATED';
  });

  protected readonly draftValidationBadgeClass = computed(() => {
    switch (this.draftValidationStatus()) {
      case 'PASSED':
        return 'bg-success text-on-success';
      case 'FAILED':
        return 'bg-danger text-on-danger';
      case 'CHANGED':
        return 'bg-warning text-on-warning';
      case 'NOT_VALIDATED':
      default:
        return 'bg-neutral-soft text-text-muted';
    }
  });

  protected readonly draftValidationBadgeKey = computed(() => {
    switch (this.draftValidationStatus()) {
      case 'PASSED':
        return 'templates.validationStates.PASSED';
      case 'FAILED':
        return 'templates.validationStates.FAILED';
      case 'CHANGED':
        return 'templatesPage.overview.draftCard.changedSinceCheck';
      case 'NOT_VALIDATED':
      default:
        return 'templates.validationStates.NOT_VALIDATED';
    }
  });

  constructor() {
    effect(() => {
      this.displayedDirection.set(this.service.overviewDirection());
    });

    effect((onCleanup) => {
      const def = this.service.definition();
      if (!def) {
        this.clearThumbUrl();
        this.thumbLoading.set(false);
        this.thumbLoadError.set(false);
        return;
      }

      if (def.thumbnail.state !== 'READY') {
        this.clearThumbUrl();
        this.thumbLoading.set(false);
        this.thumbLoadError.set(false);
        return;
      }

      const seq = ++this.thumbLoadSeq;
      const query = this.buildThumbnailQuery();
      if (!query) {
        this.clearThumbUrl();
        this.thumbLoading.set(false);
        this.thumbLoadError.set(true);
        return;
      }

      this.thumbLoading.set(true);
      this.thumbLoadError.set(false);

      void getTemplateThumbnail(def.templateId, query)
        .then((blob) => {
          if (seq !== this.thumbLoadSeq) return;
          this.clearThumbUrl();
          const url = URL.createObjectURL(blob);
          this.thumbObjectUrl = url;
          this.thumbUrl.set(url);
          this.thumbLoadError.set(false);
        })
        .catch(() => {
          if (seq !== this.thumbLoadSeq) return;
          this.clearThumbUrl();
          this.thumbLoadError.set(true);
        })
        .finally(() => {
          if (seq === this.thumbLoadSeq) {
            this.thumbLoading.set(false);
          }
        });

      onCleanup(() => {
        if (seq === this.thumbLoadSeq) {
          this.thumbLoadSeq++;
        }
      });
    });

    this.destroyRef.onDestroy(() => {
      this.clearThumbUrl();
      this.clearThumbPoll();
    });
  }

  protected onNameInput(event: Event): void {
    if (this.service.isReadOnly()) return;
    const value = (event.target as HTMLInputElement).value;
    this.service.overviewName.set(value);
    if (this.service.overviewNameError() && value.trim().length > 0) {
      this.service.overviewNameError.set(null);
    }
  }

  protected onDescriptionInput(event: Event): void {
    if (this.service.isReadOnly()) return;
    const value = (event.target as HTMLInputElement).value;
    this.service.overviewDescription.set(value);
  }

  protected async onDirectionPick(next: TemplateDirection): Promise<void> {
    if (this.service.isReadOnly()) {
      this.displayedDirection.set(this.service.overviewDirection());
      return;
    }
    const current = this.service.overviewDirection();
    if (next === current) return;

    if (this.service.hasDesignChanges()) {
      this.displayedDirection.set(next);
      afterNextRender(() => this.displayedDirection.set(this.service.overviewDirection()), {
        injector: this.injector,
      });
      this.notify.warning(this.transloco.translate('templatesPage.overview.directionSaveDesignFirst'));
      return;
    }

    this.displayedDirection.set(next);
    const confirmed = await this.directionConfirm().open();
    if (confirmed) {
      this.service.overviewDirection.set(next);
    } else {
      this.displayedDirection.set(current);
    }
  }

  protected async refreshPendingThumbnail(): Promise<void> {
    const def = this.service.definition();
    if (!def || this.thumbLoading()) return;
    this.thumbLoading.set(true);
    try {
      const fresh = await getTemplate(def.templateId);
      this.service.syncFromDefinition(fresh, true);
    } catch (error) {
      this.notify.error(this.service.translateError(this.transloco, error));
    } finally {
      this.thumbLoading.set(false);
    }
  }

  protected async retryThumbnail(): Promise<void> {
    const def = this.service.definition();
    if (!def || this.thumbRetrying()) return;
    const body = this.buildRetryRequest();
    if (!body) return;

    this.thumbRetrying.set(true);
    try {
      // 202 THUMBNAIL_ACCEPTED: the worker renders later, so the card shows PENDING
      // and the definition is re-read until the projection leaves PENDING.
      const accepted = await retryTemplateThumbnail(def.templateId, body);
      const latest = this.service.definition() ?? def;
      this.service.syncFromDefinition(
        { ...latest, thumbnail: { state: 'PENDING', sourceChecksum: accepted.sourceChecksum } },
        true,
      );
      this.notify.success(this.transloco.translate('templatesPage.overview.thumbnailCard.retriedToast'));
      this.pollPendingThumbnail(def.templateId);
    } catch (error) {
      this.notify.error(this.service.translateError(this.transloco, error));
    } finally {
      this.thumbRetrying.set(false);
    }
  }

  /** Re-reads the definition a bounded number of times while its thumbnail is PENDING. */
  private pollPendingThumbnail(templateId: string, attempt = 0): void {
    this.clearThumbPoll();
    if (attempt >= OverviewTab.THUMB_POLL_MAX_ATTEMPTS) return;
    this.thumbPollTimer = setTimeout(async () => {
      this.thumbPollTimer = null;
      const current = this.service.definition();
      if (!current || current.templateId !== templateId || current.thumbnail.state !== 'PENDING') return;
      try {
        const fresh = await getTemplate(templateId);
        if (this.service.definition()?.templateId !== templateId) return;
        this.service.syncFromDefinition(fresh, true);
        if (fresh.thumbnail.state === 'PENDING') this.pollPendingThumbnail(templateId, attempt + 1);
      } catch {
        // The manual Refresh action stays available on the pending card.
      }
    }, OverviewTab.THUMB_POLL_INTERVAL_MS);
  }

  private clearThumbPoll(): void {
    if (this.thumbPollTimer !== null) {
      clearTimeout(this.thumbPollTimer);
      this.thumbPollTimer = null;
    }
  }

  private buildThumbnailQuery(): TemplateThumbnailQuery | null {
    const def = this.service.definition();
    if (!def) return null;
    const checksum = def.thumbnail.sourceChecksum;
    if (def.capabilities.update.state === 'ENABLED' || !def.currentPublishedVersion) {
      return {
        sourceKind: 'DRAFT',
        draftRevision: def.currentDraft.revision,
        sourceChecksum: checksum,
      };
    }
    return {
      sourceKind: 'PUBLISHED',
      versionId: def.currentPublishedVersion.templateVersionId,
      sourceChecksum: checksum,
    };
  }

  private buildRetryRequest(): TemplateThumbnailRetryRequest | null {
    return this.buildThumbnailQuery();
  }

  private clearThumbUrl(): void {
    if (this.thumbObjectUrl) {
      URL.revokeObjectURL(this.thumbObjectUrl);
      this.thumbObjectUrl = null;
    }
    this.thumbUrl.set(null);
  }
}
