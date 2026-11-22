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
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { ActionItem, ActionSelection, ActionsMenu } from '../../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../../shared/ui/button/button';
import {
  templateFamilyMeta,
  templateValidationMeta,
} from '../../shared/template-family';
import {
  TemplateApiError,
  TemplateCapability,
  TemplateListRow,
  TemplateThumbnailRetryRequest,
  getTemplateThumbnail,
  retryTemplateThumbnail,
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
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;
  private readonly notify = inject(Notify);

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

      void getTemplateThumbnail(thumb.downloadPath)
        .then((blob) => {
          if (cancelled) return;
          objectUrl = URL.createObjectURL(blob);
          this.thumbUrl.set(objectUrl);
          this.thumbState.set('READY');
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          if (error instanceof TemplateApiError && error.code === 'CORE.TEMPLATE.THUMBNAIL.NOT_READY') {
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
    this.retryingThumb.set(true);
    try {
      const canEditDraft = current.actions.design.state !== 'HIDDEN';
      const body: TemplateThumbnailRetryRequest =
        !canEditDraft && current.currentPublishedVersion
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
      await retryTemplateThumbnail(current.templateId, body);
      this.notify.info(this.transloco.translate('templatesLibrary.toasts.thumbnailQueued'));
      this.thumbnailRetried.emit(current);
    } catch (error: unknown) {
      const code = error instanceof TemplateApiError ? error.code : null;
      const key = code ? `templates.errors.${code}` : 'templates.errors.generic';
      const translated = this.transloco.translate(key);
      this.notify.error(translated === key ? this.transloco.translate('templates.errors.generic') : translated);
    } finally {
      this.retryingThumb.set(false);
    }
  }
}
