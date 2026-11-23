import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerFileDescription,
  tablerFileInvoice,
  tablerFileText,
  tablerMail,
  tablerPhoto,
  tablerReceipt,
  tablerRefresh,
  tablerShoppingCart,
} from '@ng-icons/tabler-icons';
import { ApiError, errorCodeOf, isRetryableWriteError, writeErrorMessage } from '../../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { ActionItem, ActionSelection, ActionsMenu } from '../../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../../shared/ui/button/button';
import {
  templateFamilyMeta,
  templateValidationMeta,
} from '../../shared/template-family';
import {
  TemplatesApi,
  type TemplateCapability,
  type TemplateListRow,
  type TemplateThumbnailQuery,
  type TemplateThumbnailRetryRequest,
} from '../../templates.api';

export function formatTemplateDate(iso: string, lang: 'ar' | 'en'): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(`${lang}-u-nu-latn`, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

interface ActionSpec {
  id: string;
  cap: TemplateCapability;
  titleKey: string;
  icon: string;
  tile: string;
  danger?: boolean;
}

function translateReason(reason: string | null, t: (key: string) => string): string | undefined {
  if (!reason) return undefined;
  const key = `templatesLibrary.row.actions.reasons.${reason}`;
  const translated = t(key);
  return translated === key ? reason : translated;
}

export function buildTemplateRowActions(row: TemplateListRow, t: (key: string) => string): ActionItem[] {
  const a = row.actions;
  const specs: ActionSpec[] = [
    { id: 'open', cap: a.open, titleKey: 'templatesLibrary.row.actions.open', icon: 'tablerEye', tile: 'bg-icon-blue' },
    { id: 'design', cap: a.design, titleKey: 'templatesLibrary.row.actions.design', icon: 'tablerEdit', tile: 'bg-icon-orange' },
    { id: 'preview', cap: a.preview, titleKey: 'templatesLibrary.row.actions.preview', icon: 'tablerPrinter', tile: 'bg-icon-teal' },
    {
      id: 'duplicateFromDraft',
      cap: a.duplicateFromDraft,
      titleKey: 'templatesLibrary.row.actions.duplicateFromDraft',
      icon: 'tablerCopy',
      tile: 'bg-icon-gray',
    },
    {
      id: 'duplicateFromVersion',
      cap: a.duplicateFromVersion,
      titleKey: 'templatesLibrary.row.actions.duplicateFromVersion',
      icon: 'tablerCopy',
      tile: 'bg-icon-blue',
    },
    {
      id: 'manageAssignments',
      cap: a.manageAssignments,
      titleKey: 'templatesLibrary.row.actions.manageAssignments',
      icon: 'tablerLink',
      tile: 'bg-icon-violet',
    },
    { id: 'archive', cap: a.archive, titleKey: 'templatesLibrary.row.actions.archive', icon: 'tablerArchive', tile: 'bg-icon-gray' },
    { id: 'restore', cap: a.restore, titleKey: 'templatesLibrary.row.actions.restore', icon: 'tablerArrowBackUp', tile: 'bg-icon-green' },
    {
      id: 'delete',
      cap: a.delete,
      titleKey: 'templatesLibrary.row.actions.delete',
      icon: 'tablerTrash',
      tile: 'bg-icon-red',
      danger: true,
    },
  ];

  return specs
    .filter((spec) => spec.cap.state !== 'HIDDEN')
    .map((spec) => {
      const disabled = spec.cap.state === 'DISABLED';
      return {
        id: spec.id,
        title: t(spec.titleKey),
        icon: spec.icon,
        tile: disabled ? 'bg-icon-gray' : spec.tile,
        danger: spec.danger,
        disabled,
        reason: disabled ? translateReason(spec.cap.reason, t) : undefined,
      };
    });
}

@Component({
  selector: 'app-library-card',
  imports: [NgIcon, TranslocoPipe, ActionsMenu, Button],
  providers: [
    provideIcons({
      tablerFileText,
      tablerReceipt,
      tablerShoppingCart,
      tablerFileInvoice,
      tablerFileDescription,
      tablerMail,
      tablerPhoto,
      tablerRefresh,
    }),
  ],
  templateUrl: './library-card.html',
  host: { class: 'block h-full min-w-0' },
})
export class LibraryCard {
  private readonly templatesApi = inject(TemplatesApi);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;
  private readonly notify = inject(Notify);

  private retryAttempt: { intent: string; key: string } | null = null;

  readonly row = input.required<TemplateListRow>();
  readonly open = output<TemplateListRow>();
  readonly actionSelected = output<{ row: TemplateListRow; selection: ActionSelection }>();
  readonly thumbnailRetried = output<TemplateListRow>();

  protected readonly familyLook = computed(() =>
    templateFamilyMeta(this.row().documentType, this.row().outputChannel),
  );
  protected readonly validationClass = computed(
    () => templateValidationMeta(this.row().draft.validationState).badgeClasses,
  );
  protected readonly updatedDate = computed(() => formatTemplateDate(this.row().updatedAt, this.language()));
  protected readonly actions = computed(() => {
    this.i18n();
    return buildTemplateRowActions(this.row(), (key) => this.transloco.translate(key));
  });

  protected readonly thumbState = signal<'LOADING' | 'READY' | 'PENDING' | 'UNAVAILABLE'>('LOADING');
  protected readonly thumbUrl = signal<string | null>(null);
  protected readonly retryingThumb = signal(false);

  constructor() {
    effect((onCleanup) => {
      const current = this.row();
      const thumb = current.thumbnail;
      let cancelled = false;
      let objectUrl: string | null = null;

      onCleanup(() => {
        cancelled = true;
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl);
        }
      });

      if (thumb.state !== 'READY') {
        this.thumbUrl.set(null);
        this.thumbState.set(thumb.state);
        return;
      }

      this.thumbUrl.set(null);
      this.thumbState.set('LOADING');

      const load = thumb.downloadPath
        ? this.templatesApi.getTemplateThumbnail(thumb.downloadPath)
        : this.templatesApi.getTemplateThumbnail(current.templateId, this.thumbnailSource(current));

      void load
        .then((blob) => {
          if (cancelled) return;
          objectUrl = URL.createObjectURL(blob);
          this.thumbUrl.set(objectUrl);
          this.thumbState.set('READY');
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          if (errorCodeOf(error) === 'CORE.TEMPLATE.THUMBNAIL.NOT_READY') {
            this.thumbState.set('PENDING');
          } else {
            this.thumbState.set('UNAVAILABLE');
          }
        });
    });
  }

  protected onCardKeydown(event: Event): void {
    if (event.target !== event.currentTarget) return;
    event.preventDefault();
    this.open.emit(this.row());
  }

  protected async retryThumb(event: MouseEvent): Promise<void> {
    event.stopPropagation();
    if (this.retryingThumb()) return;
    const current = this.row();
    const body: TemplateThumbnailRetryRequest = this.thumbnailSource(current);
    const intent = JSON.stringify([current.templateId, body]);
    if (this.retryAttempt?.intent !== intent) {
      this.retryAttempt = { intent, key: newIdempotencyKey() };
    }
    const key = this.retryAttempt.key;

    this.retryingThumb.set(true);
    try {
      await this.templatesApi.retryTemplateThumbnail(current.templateId, body, key);
      this.retryAttempt = null;
      this.thumbUrl.set(null);
      this.thumbState.set('PENDING');
      this.notify.info(this.transloco.translate('templatesLibrary.toasts.thumbnailQueued'));
      this.thumbnailRetried.emit(current);
    } catch (error: unknown) {
      if (!isRetryableWriteError(error) && !(error instanceof ApiError && error.status === 401)) {
        this.retryAttempt = null;
      }
      this.notify.error(writeErrorMessage(error, 'templates', this.transloco));
    } finally {
      this.retryingThumb.set(false);
    }
  }

  private thumbnailSource(current: TemplateListRow): TemplateThumbnailQuery {
    const canEditDraft = current.actions.design.state !== 'HIDDEN';
    return !canEditDraft && current.currentPublishedVersion
      ? {
          sourceKind: 'PUBLISHED',
          versionId: current.currentPublishedVersion.versionId,
          sourceChecksum: current.thumbnail.sourceChecksum,
        }
      : {
          sourceKind: 'DRAFT',
          draftRevision: current.draft.revision,
          sourceChecksum: current.thumbnail.sourceChecksum,
        };
  }
}
