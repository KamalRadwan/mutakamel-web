import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerChevronLeft,
  tablerChevronRight,
  tablerCircleX,
  tablerClock,
  tablerCloudOff,
  tablerDownload,
  tablerEye,
  tablerFileSearch,
  tablerLoader2,
  tablerLock,
  tablerRefresh,
  tablerSearch,
  tablerShieldCheck,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { Segmented, SegmentedOption } from '../../../../../shared/ui/segmented/segmented';
import { HtmlFrame } from '../../preview/html-frame/html-frame';
import { PdfFrame } from '../../preview/pdf-frame/pdf-frame';
import { PdfJobPoller } from '../../preview/pdf-job';
import {
  CachedPreviewResult,
  PreviewCache,
  PreviewFormat,
  buildPreviewCacheKey,
} from '../../preview/preview-cache';
import {
  TemplateDefinitionDetail,
  TemplateDocumentV1,
  TemplatePdfJobDto,
  TemplatePdfOutputProfile,
  TemplatePreviewSource,
  TemplateSyntheticFixture,
  TemplateVersionItem,
  getDataSourceSchema,
  getDraft,
  getTemplate,
  getVersion,
  listVersions,
  newTemplateIdempotencyKey,
  previewEmail,
  previewHtml,
  previewPdf,
} from '../../templates.api';
import { TemplatePageService, errorDetailsOf } from '../template-page.service';

type ZoomSetting = 'FIT' | '0.5' | '0.75' | '1' | '1.25' | '1.5';

type PreviewStageError =
  | { kind: 'forbidden' }
  | { kind: 'notFound' }
  | { kind: 'previewDisabled'; reasonText: string }
  | { kind: 'saveFirst' }
  | { kind: 'validation' }
  | { kind: 'compiler' }
  | { kind: 'unavailable'; correlationId: string | null };

const DEFAULT_A4_WIDTH_PX = 794;
const MM_TO_PX = 96 / 25.4;

@Component({
  selector: 'app-preview-tab',
  imports: [NgIcon, TranslocoPipe, Button, Dropdown, Field, Segmented, HtmlFrame, PdfFrame],
  providers: [
    provideTranslocoScope('templates', { scope: 'templates-preview', alias: 'tplPreview' }),
    provideIcons({
      tablerAlertTriangle,
      tablerChevronLeft,
      tablerChevronRight,
      tablerCircleX,
      tablerClock,
      tablerCloudOff,
      tablerDownload,
      tablerEye,
      tablerFileSearch,
      tablerLoader2,
      tablerLock,
      tablerRefresh,
      tablerSearch,
      tablerShieldCheck,
    }),
  ],
  templateUrl: './preview-tab.html',
  host: {
    class: 'flex min-h-0 min-w-0 flex-1 flex-col gap-8 overflow-hidden',
  },
})
export class PreviewTab implements AfterViewInit {
  private static nextId = 0;
  protected readonly uid = `tpl-preview-${++PreviewTab.nextId}`;

  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly notify = inject(Notify);
  protected readonly language = inject(LanguageState).current;
  protected readonly pageService = inject(TemplatePageService);

  private readonly stageRef = viewChild<ElementRef<HTMLElement>>('stageEl');

  private readonly cache = new PreviewCache();
  protected readonly poller = new PdfJobPoller();

  private readonly stageWidthPx = signal(960);

  protected readonly loadingInit = signal(true);
  protected readonly loadingPreview = signal(false);
  protected readonly pdfSubmitting = signal(false);

  protected readonly format = signal<PreviewFormat>('HTML');
  protected readonly selectedSource = signal<string>('DRAFT');
  protected readonly selectedFixtureKey = signal<string>('');
  protected readonly emailWidth = signal<600 | 320>(600);
  protected readonly zoomSetting = signal<ZoomSetting>('FIT');
  protected readonly pdfPage = signal(1);

  protected readonly publishedVersions = signal<TemplateVersionItem[]>([]);
  protected readonly fixtures = signal<TemplateSyntheticFixture[]>([]);
  protected readonly activeResult = signal<CachedPreviewResult | null>(null);
  protected readonly stageError = signal<PreviewStageError | null>(null);
  private readonly versionDocs = signal<Record<string, TemplateDocumentV1>>({});

  private readonly initialized = signal(false);
  private loadedTemplateId: string | null = null;
  private lastTriggeredDraftRev: number | null = null;
  private initSeq = 0;
  private runSeq = 0;
  private pendingPdfIntent: { intentKey: string; idempotencyKey: string } | null = null;
  private expiryTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly loadingVersionIds = new Set<string>();

  protected readonly definition = computed(() => this.pageService.definition());
  protected readonly isEmail = computed(() => this.definition()?.outputChannel === 'EMAIL');
  protected readonly draftRevision = computed(
    () => this.pageService.draft()?.revision ?? this.definition()?.currentDraft.revision ?? 0,
  );
  protected readonly isDraftSelected = computed(() => this.selectedSource() === 'DRAFT');
  protected readonly isDraftDirty = computed(() => this.isDraftSelected() && this.pageService.dirty());

  private readonly selectedVersionItem = computed<TemplateVersionItem | null>(() => {
    const selected = this.selectedSource();
    if (!selected.startsWith('VERSION:')) return null;
    const versionId = selected.slice('VERSION:'.length);
    return this.publishedVersions().find((v) => v.templateVersionId === versionId) ?? null;
  });

  private readonly activeDocument = computed<TemplateDocumentV1 | null>(() => {
    const selected = this.selectedSource();
    if (selected.startsWith('VERSION:')) {
      const versionId = selected.slice('VERSION:'.length);
      return this.versionDocs()[versionId] ?? null;
    }
    return this.pageService.draft()?.editorDocument ?? null;
  });

  protected readonly pdfCapability = computed(
    () => this.definition()?.capabilities.previewPdf ?? { state: 'HIDDEN' as const, reason: null },
  );

  protected readonly pdfDisabledReason = computed(() => {
    this.i18n();
    this.language();
    const cap = this.pdfCapability();
    if (cap.state !== 'DISABLED' || !cap.reason) return null;
    const key = `templatesPage.header.capabilities.${cap.reason}`;
    const text = this.transloco.translate(key);
    return text && text !== key ? text : null;
  });

  protected readonly formatOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    this.language();
    const pdfCap = this.pdfCapability();
    const options: SegmentedOption[] = this.isEmail()
      ? [
          { value: 'EMAIL', label: this.transloco.translate('tplPreview.format.email') },
          { value: 'TEXT', label: this.transloco.translate('tplPreview.format.text') },
        ]
      : [{ value: 'HTML', label: this.transloco.translate('tplPreview.format.html') }];

    if (pdfCap.state !== 'HIDDEN') {
      options.push({
        value: 'PDF',
        label: this.transloco.translate('tplPreview.format.pdf'),
        disabled: pdfCap.state === 'DISABLED',
      });
    }
    return options;
  });

  protected readonly sourceOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const lang = this.language();
    const dirty = this.pageService.dirty();
    const rev = this.draftRevision();
    const options: DropdownOption<string>[] = [];

    if (!this.pageService.draftAccessForbidden()) {
      options.push({
        value: 'DRAFT',
        label: this.transloco.translate(
          dirty ? 'tplPreview.source.draftSaveFirst' : 'tplPreview.source.draft',
          { rev },
        ),
        disabled: dirty,
      });
    }

    for (const ver of this.publishedVersions()) {
      options.push({
        value: `VERSION:${ver.templateVersionId}`,
        label: this.transloco.translate('tplPreview.source.version', {
          n: ver.versionNumber,
          date: this.pageService.formatDate(ver.publishedAt, lang),
        }),
      });
    }

    return options;
  });

  protected readonly sourceTooltip = computed(() => {
    this.i18n();
    this.language();
    return this.pageService.dirty() ? this.transloco.translate('tplPreview.source.saveFirst') : null;
  });

  protected readonly fixtureOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    this.language();
    const list = this.fixtures();
    if (list.length === 0) {
      return [
        {
          value: '',
          label: this.transloco.translate('tplPreview.fixture.empty'),
          disabled: true,
        },
      ];
    }
    return list.map((fixture) => ({
      value: fixture.fixtureKey,
      label: this.formatFixtureLabel(fixture),
    }));
  });

  protected readonly emailWidthOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    this.language();
    return [
      { value: '600', label: this.transloco.translate('tplPreview.status.widthPx', { w: 600 }) },
      { value: '320', label: this.transloco.translate('tplPreview.status.widthPx', { w: 320 }) },
    ];
  });

  protected readonly emailWidthValue = computed(() => String(this.emailWidth()));

  protected readonly zoomOptions = computed<DropdownOption<ZoomSetting>[]>(() => {
    this.i18n();
    this.language();
    return [
      { value: 'FIT', label: this.transloco.translate('tplPreview.zoom.fit') },
      { value: '0.5', label: this.transloco.translate('tplPreview.zoom.pct', { n: 50 }) },
      { value: '0.75', label: this.transloco.translate('tplPreview.zoom.pct', { n: 75 }) },
      { value: '1', label: this.transloco.translate('tplPreview.zoom.pct', { n: 100 }) },
      { value: '1.25', label: this.transloco.translate('tplPreview.zoom.pct', { n: 125 }) },
      { value: '1.5', label: this.transloco.translate('tplPreview.zoom.pct', { n: 150 }) },
    ];
  });

  protected readonly printWidthPx = computed<number | null>(() => {
    const doc = this.activeDocument();
    if (!doc || doc.outputChannel === 'EMAIL') return null;
    const widthMm = doc.canvasPages?.[0]?.page.widthMm ?? doc.page?.widthMm;
    if (!widthMm) return null;
    return Math.round(widthMm * MM_TO_PX);
  });

  protected readonly effectiveHtmlZoom = computed(() => {
    const setting = this.zoomSetting();
    if (setting !== 'FIT') {
      return Number(setting);
    }
    const availW = Math.max(240, this.stageWidthPx() - 32);
    const baseW = this.isEmail() ? this.emailWidth() : (this.printWidthPx() ?? DEFAULT_A4_WIDTH_PX);
    const fit = Math.min(1, availW / baseW);
    return Math.min(2, Math.max(0.25, Math.round(fit * 100) / 100));
  });

  protected readonly emailScaledWidthPx = computed(() =>
    Math.round(this.emailWidth() * this.effectiveHtmlZoom()),
  );

  protected readonly effectivePdfZoom = computed<number | 'FIT'>(() => {
    const setting = this.zoomSetting();
    return setting === 'FIT' ? 'FIT' : Number(setting);
  });

  protected readonly isPdfInProgress = computed(() => {
    if (this.format() !== 'PDF') return false;
    if (this.pdfSubmitting()) return true;
    const st = this.poller.status();
    return st === 'PENDING' || st === 'RESOLVING_SOURCE' || st === 'RETRYING';
  });

  protected readonly isPdfSlow = computed(() => this.format() === 'PDF' && this.poller.status() === 'SLOW');
  protected readonly isPdfFailed = computed(() => this.format() === 'PDF' && this.poller.status() === 'FAILED');
  protected readonly isPdfExpired = computed(() => this.format() === 'PDF' && this.poller.status() === 'EXPIRED');

  protected readonly activePdfResult = computed(() => {
    if (this.format() !== 'PDF') return null;
    if (this.isPdfInProgress() || this.isPdfSlow() || this.isPdfFailed() || this.isPdfExpired()) return null;
    const res = this.activeResult();
    return res?.kind === 'PDF' ? res : null;
  });

  protected readonly activeHtmlResult = computed(() => {
    if (this.format() !== 'HTML') return null;
    const res = this.activeResult();
    return res?.kind === 'HTML' ? res : null;
  });

  protected readonly activeEmailResult = computed(() => {
    const fmt = this.format();
    if (fmt !== 'EMAIL' && fmt !== 'TEXT') return null;
    const res = this.activeResult();
    return res?.kind === 'EMAIL' ? res : null;
  });

  protected readonly canDownloadPdf = computed(() => !!this.activePdfResult());

  protected readonly generateAgainDisabled = computed(() => {
    const def = this.definition();
    if (!def || def.capabilities.preview.state !== 'ENABLED') return true;
    if (this.format() === 'PDF' && this.pdfCapability().state !== 'ENABLED') return true;
    if (this.loadingInit() || this.loadingPreview() || this.pdfSubmitting()) return true;
    if (this.isDraftDirty()) return true;
    if (!this.selectedSource() || !this.selectedFixtureKey()) return true;
    return false;
  });

  protected readonly generateAgainTooltip = computed(() => {
    this.i18n();
    this.language();
    return this.isDraftDirty() ? this.transloco.translate('tplPreview.source.saveFirst') : '';
  });

  protected readonly templateDir = computed<'ltr' | 'rtl'>(() =>
    this.definition()?.resolvedDirection === 'RTL' ? 'rtl' : 'ltr',
  );

  protected readonly statusBadge = computed<{
    labelKey: string;
    classes: string;
  } | null>(() => {
    if (this.isPdfExpired()) {
      return { labelKey: 'tplPreview.badge.expired', classes: 'bg-neutral-soft text-on-neutral-soft' };
    }
    const err = this.stageError();
    if (
      err &&
      (err.kind === 'validation' ||
        err.kind === 'compiler' ||
        err.kind === 'unavailable' ||
        err.kind === 'forbidden' ||
        err.kind === 'notFound' ||
        err.kind === 'previewDisabled')
    ) {
      return { labelKey: 'tplPreview.badge.failed', classes: 'bg-danger text-on-danger' };
    }
    if (this.isPdfFailed()) {
      return { labelKey: 'tplPreview.badge.failed', classes: 'bg-danger text-on-danger' };
    }
    if (this.loadingInit() || this.loadingPreview() || this.isPdfInProgress() || this.isPdfSlow()) {
      return { labelKey: 'tplPreview.badge.generating', classes: 'bg-warning text-on-warning' };
    }
    if (this.activePdfResult() || this.activeHtmlResult() || this.activeEmailResult()) {
      return { labelKey: 'tplPreview.badge.ready', classes: 'bg-success text-on-success' };
    }
    return null;
  });

  protected readonly statusTimestampText = computed(() => {
    this.i18n();
    const lang = this.language();

    const pdf = this.activePdfResult();
    if (pdf) {
      const createdIso = pdf.artifact.createdAt || pdf.job.createdAt;
      const at = this.pageService.formatDateTime(createdIso, lang);
      const until = this.formatUntil(pdf.artifact.downloadUrlExpiresAt, createdIso, lang);
      return this.transloco.translate('tplPreview.status.generated', { at, until });
    }

    const nonPdf = this.activeHtmlResult() ?? this.activeEmailResult();
    if (nonPdf) {
      return this.transloco.translate('tplPreview.status.generatedHtml', {
        at: this.formatTime(nonPdf.generatedAt, lang),
      });
    }

    return '';
  });

  protected readonly layoutFactsText = computed(() => {
    this.i18n();
    this.language();
    const def = this.definition();
    if (!def) return '';

    const layoutMode = this.selectedVersionItem()?.layoutMode ?? def.layoutMode;
    const parts: string[] = [this.transloco.translate(`templates.layouts.${layoutMode}`)];
    const pdf = this.activePdfResult();
    if (pdf) {
      const count = Math.max(1, pdf.artifact.pageCount);
      parts.push(
        count === 1
          ? this.transloco.translate('tplPreview.status.onePage')
          : this.transloco.translate('tplPreview.status.manyPages', { count }),
      );
      if (layoutMode === 'FIXED_CANVAS') {
        parts.push(this.transloco.translate('tplPreview.status.overflowReject'));
      }
      return parts.join(' · ');
    }

    if (this.isEmail()) {
      parts.push(this.transloco.translate('tplPreview.status.widthPx', { w: this.emailWidth() }));
      return parts.join(' · ');
    }

    const doc = this.activeDocument();
    const page = doc?.canvasPages?.[0]?.page ?? doc?.page;
    if (page) {
      const paper =
        page.preset === 'CUSTOM'
          ? this.transloco.translate('tplPreview.status.customPaper', {
              w: page.widthMm,
              h: page.heightMm,
            })
          : page.preset === 'LETTER'
            ? this.transloco.translate('tplPreview.status.paperLetter')
            : page.preset;
      parts.push(paper);
    }
    return parts.join(' · ');
  });

  protected readonly pdfPageCount = computed(() => {
    const pdf = this.activePdfResult();
    return pdf ? Math.max(1, pdf.artifact.pageCount) : 1;
  });

  protected readonly canPrevPage = computed(
    () => !!this.activePdfResult() && this.pdfPageCount() > 1 && this.pdfPage() > 1,
  );

  protected readonly canNextPage = computed(
    () => !!this.activePdfResult() && this.pdfPageCount() > 1 && this.pdfPage() < this.pdfPageCount(),
  );

  constructor() {
    effect(() => {
      const def = this.definition();
      if (!def) return;
      if (def.templateId !== this.loadedTemplateId) {
        this.loadedTemplateId = def.templateId;
        void this.initForTemplate(def);
      }
    });

    // Re-run draft preview automatically after saving (revision bump or undo/save clearing dirty while on saveFirst).
    effect(() => {
      if (!this.initialized()) return;
      const rev = this.draftRevision();
      const dirty = this.pageService.dirty();
      const source = this.selectedSource();
      if (dirty) {
        if (source === 'DRAFT' && !this.activeResult() && !this.stageError()) {
          this.stageError.set({ kind: 'saveFirst' });
        }
        return;
      }
      if (source !== 'DRAFT') return;

      const revChanged = this.lastTriggeredDraftRev !== null && rev !== this.lastTriggeredDraftRev;
      const clearedSaveFirst = this.stageError()?.kind === 'saveFirst';
      if (revChanged || clearedSaveFirst) {
        this.lastTriggeredDraftRev = rev;
        void this.triggerPreview(false);
      }
    });

    this.destroyRef.onDestroy(() => {
      this.initSeq += 1;
      this.runSeq += 1;
      this.clearExpiryTimer();
      this.loadingVersionIds.clear();
      this.poller.destroy();
      this.cache.clear();
    });
  }

  ngAfterViewInit(): void {
    const stage = this.stageRef()?.nativeElement;
    if (stage) {
      const measureStage = () => {
        const w = stage.clientWidth;
        if (w > 0) this.stageWidthPx.set(w);
      };
      measureStage();
      const stageObserver = new ResizeObserver(measureStage);
      stageObserver.observe(stage);
      this.destroyRef.onDestroy(() => stageObserver.disconnect());
    }
  }

  protected onFormatChange(value: string | null): void {
    if (value !== 'HTML' && value !== 'EMAIL' && value !== 'TEXT' && value !== 'PDF') return;
    if (value === this.format()) return;
    if (value === 'PDF' && this.pdfCapability().state !== 'ENABLED') return;

    const prev = this.format();
    this.runSeq += 1;
    this.pendingPdfIntent = null;
    this.clearExpiryTimer();
    this.format.set(value);
    if (value !== 'PDF') {
      this.poller.reset();
      this.pdfSubmitting.set(false);
    }
    this.pdfPage.set(1);

    // Switching between Email HTML and Plain Text uses the exact same cached email response.
    if ((prev === 'EMAIL' || prev === 'TEXT') && (value === 'EMAIL' || value === 'TEXT')) {
      const current = this.activeResult();
      if (current?.kind === 'EMAIL') {
        this.loadingPreview.set(false);
        this.stageError.set(null);
        return;
      }
    }

    void this.triggerPreview(false);
  }

  protected onSourceChange(value: string): void {
    if (!value || value === this.selectedSource()) return;
    this.selectedSource.set(value);
    this.pdfPage.set(1);
    void this.triggerPreview(false);
  }

  protected onFixtureChange(value: string): void {
    if (!value || value === this.selectedFixtureKey()) return;
    this.selectedFixtureKey.set(value);
    this.pdfPage.set(1);
    void this.triggerPreview(false);
  }

  protected onEmailWidthChange(value: string | null): void {
    if (value !== '600' && value !== '320') return;
    this.emailWidth.set(value === '320' ? 320 : 600);
  }

  protected onZoomChange(value: ZoomSetting): void {
    this.zoomSetting.set(value);
  }

  protected generateAgain(): void {
    if (this.generateAgainDisabled()) return;
    void this.triggerPreview(true);
  }

  protected checkAgain(): void {
    if (this.poller.status() !== 'SLOW') return;
    this.poller.resume();
  }

  protected retryUnavailable(): void {
    const def = this.definition();
    if (!this.initialized() && def) {
      void this.initForTemplate(def);
      return;
    }
    const pollerStatus = this.poller.status();
    const isTerminal =
      pollerStatus === 'IDLE' ||
      pollerStatus === 'COMPLETED' ||
      pollerStatus === 'FAILED' ||
      pollerStatus === 'EXPIRED';
    if (this.format() === 'PDF' && this.poller.jobId() && !isTerminal) {
      this.stageError.set(null);
      this.poller.resume();
      return;
    }
    void this.triggerPreview(false, { reuseIdempotencyKey: true });
  }

  protected openOverview(): void {
    const def = this.definition();
    if (!def) return;
    void this.router.navigate(['/workspace/operations/template-platform', def.templateId, 'overview']);
  }

  protected openDesign(): void {
    const def = this.definition();
    if (!def) return;
    void this.router.navigate(['/workspace/operations/template-platform', def.templateId, 'design']);
  }

  protected previewLatestVersion(): void {
    const latest = this.publishedVersions()[0];
    if (!latest) return;
    this.onSourceChange(`VERSION:${latest.templateVersionId}`);
  }

  protected openValidation(): void {
    const def = this.definition();
    if (!def) return;
    void this.router.navigate(['/workspace/operations/template-platform', def.templateId, 'validation']);
  }

  protected downloadPdf(): void {
    const pdf = this.activePdfResult();
    const def = this.definition();
    if (!pdf || !def) return;

    const expMs = Date.parse(pdf.artifact.downloadUrlExpiresAt);
    if (!Number.isNaN(expMs) && expMs <= Date.now()) {
      this.clearExpiryTimer();
      const source = this.resolveSource();
      if (source) {
        this.cache.delete(buildPreviewCacheKey(def.templateId, 'PDF', source, this.selectedFixtureKey()));
      }
      this.activeResult.set(null);
      this.poller.markExpired();
      return;
    }

    const link = document.createElement('a');
    link.href = pdf.objectUrl;
    link.download = `${def.code}-preview.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  protected prevPdfPage(): void {
    if (!this.canPrevPage()) return;
    this.pdfPage.update((p) => Math.max(1, p - 1));
  }

  protected nextPdfPage(): void {
    if (!this.canNextPage()) return;
    this.pdfPage.update((p) => Math.min(this.pdfPageCount(), p + 1));
  }

  private async initForTemplate(def: TemplateDefinitionDetail): Promise<void> {
    const seq = ++this.initSeq;
    this.runSeq += 1;
    this.clearExpiryTimer();
    this.initialized.set(false);
    this.loadingInit.set(true);
    this.stageError.set(null);
    this.activeResult.set(null);
    this.versionDocs.set({});
    this.loadingVersionIds.clear();
    this.poller.reset();
    this.cache.clear();
    this.pdfSubmitting.set(false);
    this.pendingPdfIntent = null;
    this.pdfPage.set(1);

    const defaultFmt: PreviewFormat = def.outputChannel === 'EMAIL' ? 'EMAIL' : 'HTML';
    this.format.set(defaultFmt);
    this.emailWidth.set(600);
    this.zoomSetting.set('FIT');

    try {
      const schemaVersion = (def.dataSourceSchemaVersion === 2 ? 2 : 1) as 1 | 2;
      const companyId = def.scope.type === 'COMPANY' ? def.scope.companyId : undefined;

      const [schema, versions] = await Promise.all([
        getDataSourceSchema(def.dataSourceKey, {
          scopeType: def.scope.type,
          companyId,
          schemaVersion,
        }),
        this.fetchAllPublishedVersions(def.templateId),
      ]);
      if (seq !== this.initSeq) return;

      this.fixtures.set(schema.syntheticFixtures);
      this.publishedVersions.set(versions);

      const defaultFixture =
        schema.syntheticFixtures.find((f) => f.locale === def.locale)?.fixtureKey ??
        schema.syntheticFixtures[0]?.fixtureKey ??
        '';
      this.selectedFixtureKey.set(defaultFixture);

      if (this.pageService.draftAccessForbidden()) {
        if (versions.length > 0) {
          this.selectedSource.set(`VERSION:${versions[0].templateVersionId}`);
        } else {
          this.selectedSource.set('');
          this.initialized.set(true);
          this.stageError.set({
            kind: 'previewDisabled',
            reasonText: this.transloco.translate('tplPreview.state.previewDisabled'),
          });
          return;
        }
      } else {
        this.selectedSource.set('DRAFT');
      }
      this.lastTriggeredDraftRev = this.draftRevision();
      this.initialized.set(true);

      await this.triggerPreview(false);
    } catch (error) {
      if (seq !== this.initSeq) return;
      this.handlePreviewError(error, seq, false);
    } finally {
      if (seq === this.initSeq) {
        this.loadingInit.set(false);
      }
    }
  }

  private async fetchAllPublishedVersions(templateId: string): Promise<TemplateVersionItem[]> {
    const items: TemplateVersionItem[] = [];
    let cursor: string | null = null;
    for (let guard = 0; guard < 10; guard++) {
      const page = await listVersions(templateId, {
        lifecycleStatus: 'PUBLISHED',
        cursor,
        limit: 100,
      });
      items.push(...page.items);
      if (!page.pageInfo.hasNextPage || !page.pageInfo.nextCursor) break;
      cursor = page.pageInfo.nextCursor;
    }
    return items;
  }

  private resolveSource(): TemplatePreviewSource | null {
    const selected = this.selectedSource();
    if (selected === 'DRAFT') {
      return { kind: 'DRAFT', draftRevision: this.draftRevision() };
    }
    if (selected.startsWith('VERSION:')) {
      return { kind: 'VERSION', versionId: selected.slice('VERSION:'.length) };
    }
    return null;
  }

  private async triggerPreview(
    forceRefresh: boolean,
    options: { reuseIdempotencyKey?: boolean; staleRetried?: boolean } = {},
  ): Promise<void> {
    const def = this.definition();
    if (!def) return;

    if (def.capabilities.preview.state === 'HIDDEN') {
      this.runSeq += 1;
      this.clearExpiryTimer();
      this.poller.stop();
      this.activeResult.set(null);
      this.stageError.set({ kind: 'forbidden' });
      return;
    }
    if (def.capabilities.preview.state === 'DISABLED') {
      this.runSeq += 1;
      this.clearExpiryTimer();
      this.poller.stop();
      this.activeResult.set(null);
      const reason = def.capabilities.preview.reason;
      const reasonKey = reason ? `templatesPage.header.capabilities.${reason}` : '';
      const translated = reasonKey ? this.transloco.translate(reasonKey) : '';
      this.stageError.set({
        kind: 'previewDisabled',
        reasonText:
          translated && translated !== reasonKey
            ? translated
            : this.transloco.translate('tplPreview.state.previewDisabled'),
      });
      return;
    }

    const fmt = this.format();
    const source = this.resolveSource();
    const fixtureKey = this.selectedFixtureKey();
    if (!source || !fixtureKey) return;

    if (fmt === 'PDF' && this.pdfCapability().state !== 'ENABLED') {
      return;
    }

    const seq = ++this.runSeq;
    this.poller.stop();
    this.clearExpiryTimer();

    if (source.kind === 'VERSION') {
      this.ensureVersionDocument(def.templateId, source.versionId);
    }

    const cacheKey = buildPreviewCacheKey(def.templateId, fmt, source, fixtureKey);

    if (source.kind === 'DRAFT') {
      this.lastTriggeredDraftRev = source.draftRevision;
    }

    if (!forceRefresh) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        if (cached.kind === 'PDF') {
          const expMs = Date.parse(cached.artifact.downloadUrlExpiresAt);
          if (!Number.isNaN(expMs) && expMs <= Date.now()) {
            this.cache.delete(cacheKey);
          } else {
            this.poller.reset();
            this.pdfSubmitting.set(false);
            this.loadingPreview.set(false);
            this.stageError.set(null);
            this.activeResult.set(cached);
            this.pdfPage.set(1);
            this.scheduleExpiryTimer(cached, cacheKey, seq);
            return;
          }
        } else {
          this.poller.reset();
          this.pdfSubmitting.set(false);
          this.loadingPreview.set(false);
          this.stageError.set(null);
          this.activeResult.set(cached);
          return;
        }
      }

      // When dirty on Draft with no cached result for this combination, do not execute a draft preview.
      if (this.isDraftDirty()) {
        this.pdfSubmitting.set(false);
        this.loadingPreview.set(false);
        if (!this.activeResult()) {
          this.stageError.set({ kind: 'saveFirst' });
        }
        return;
      }
    }

    if (this.isDraftDirty()) {
      this.pdfSubmitting.set(false);
      this.loadingPreview.set(false);
      return;
    }

    this.stageError.set(null);
    this.pdfPage.set(1);

    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const selectedVer = this.selectedVersionItem();
    const locale = selectedVer?.locale ?? def.locale;

    if (fmt === 'PDF') {
      this.loadingPreview.set(false);
      await this.runPdfPreview(def, source, fixtureKey, locale, timeZone, cacheKey, seq, {
        forceNewKey: forceRefresh || !options.reuseIdempotencyKey,
        staleRetried: options.staleRetried ?? false,
      });
      return;
    }

    this.pdfSubmitting.set(false);
    this.loadingPreview.set(true);
    try {
      if (fmt === 'HTML') {
        const res = await previewHtml(def.templateId, {
          source,
          fixtureKey,
          locale,
          timeZone,
          viewport: 'DESKTOP',
        });
        if (seq !== this.runSeq) return;
        const entry: CachedPreviewResult = {
          kind: 'HTML',
          response: res,
          generatedAt: new Date().toISOString(),
        };
        this.cache.set(cacheKey, entry);
        this.activeResult.set(entry);
        this.notifyPreviewWarnings(res.warnings.length);
      } else {
        const res = await previewEmail(def.templateId, {
          source,
          fixtureKey,
          locale,
          timeZone,
          viewport: this.emailWidth() === 320 ? 'MOBILE' : 'DESKTOP',
        });
        if (seq !== this.runSeq) return;
        const entry: CachedPreviewResult = {
          kind: 'EMAIL',
          response: res,
          generatedAt: new Date().toISOString(),
        };
        this.cache.set(cacheKey, entry);
        this.activeResult.set(entry);
        this.notifyPreviewWarnings(res.warnings.length);
      }
    } catch (error) {
      if (seq !== this.runSeq) return;
      this.handlePreviewError(error, seq, options.staleRetried ?? false);
    } finally {
      if (seq === this.runSeq) {
        this.loadingPreview.set(false);
      }
    }
  }

  private async runPdfPreview(
    def: TemplateDefinitionDetail,
    source: TemplatePreviewSource,
    fixtureKey: string,
    locale: TemplateDefinitionDetail['locale'],
    timeZone: string,
    cacheKey: string,
    seq: number,
    opts: { forceNewKey: boolean; staleRetried: boolean },
  ): Promise<void> {
    const intentKey = `${cacheKey}`;
    if (opts.forceNewKey || !this.pendingPdfIntent || this.pendingPdfIntent.intentKey !== intentKey) {
      this.pendingPdfIntent = {
        intentKey,
        idempotencyKey: newTemplateIdempotencyKey(),
      };
    }

    const outputProfile: TemplatePdfOutputProfile =
      def.outputChannel === 'EMAIL' ? 'EMAIL_PRINT_PROJECTION' : 'DOCUMENT_PRINT';

    this.pdfSubmitting.set(true);
    try {
      const accepted = await previewPdf(
        def.templateId,
        {
          source,
          dataSource: { kind: 'SYNTHETIC', fixtureKey },
          outputProfile,
          locale,
          timeZone,
        },
        this.pendingPdfIntent.idempotencyKey,
      );
      if (seq !== this.runSeq) return;
      this.pendingPdfIntent = null;
      this.pdfSubmitting.set(false);

      this.poller.start(accepted, {
        onCompleted: (job: TemplatePdfJobDto, blob: Blob) => {
          if (seq !== this.runSeq || !job.artifact) return;
          const objectUrl = URL.createObjectURL(blob);
          const entry: CachedPreviewResult = {
            kind: 'PDF',
            job,
            artifact: job.artifact,
            blob,
            objectUrl,
            generatedAt: job.artifact.createdAt || job.createdAt,
          };
          this.cache.set(cacheKey, entry);
          this.activeResult.set(entry);
          this.pdfPage.set(1);
          this.scheduleExpiryTimer(entry, cacheKey, seq);
        },
        onExpired: () => {
          if (seq !== this.runSeq) return;
          this.clearExpiryTimer();
          this.cache.delete(cacheKey);
          this.activeResult.set(null);
        },
        onFailed: () => {
          if (seq !== this.runSeq) return;
          this.clearExpiryTimer();
          this.activeResult.set(null);
        },
        onError: (pollErr) => {
          if (seq !== this.runSeq) return;
          this.handlePreviewError(pollErr, seq, opts.staleRetried);
        },
      });
    } catch (error) {
      if (seq !== this.runSeq) return;
      this.pdfSubmitting.set(false);
      this.handlePreviewError(error, seq, opts.staleRetried);
    }
  }

  private handlePreviewError(error: unknown, seq: number, staleRetried: boolean): void {
    const { status, code, correlationId } = errorDetailsOf(error);
    const short = code?.replace(/^CORE\.TEMPLATE\./, '') ?? '';

    if (status === 409 && short === 'PREVIEW.SOURCE_STALE') {
      this.pendingPdfIntent = null;
      this.notify.warning(this.transloco.translate('tplPreview.toast.stale'));
      if (!staleRetried) {
        void this.reloadDraftAndRerun(seq);
      }
      return;
    }

    if (status === 422 && short === 'VALIDATION.FAILED') {
      this.pendingPdfIntent = null;
      this.activeResult.set(null);
      this.stageError.set({ kind: 'validation' });
      return;
    }

    if (status === 422 && short === 'COMPILER.FAILED') {
      this.pendingPdfIntent = null;
      this.activeResult.set(null);
      this.stageError.set({ kind: 'compiler' });
      return;
    }

    if (status === 422 && short === 'PREVIEW.OUTPUT_LIMIT') {
      this.pendingPdfIntent = null;
      this.notify.error(this.transloco.translate('tplPreview.toast.tooLarge'));
      return;
    }

    if (status === 422 && (short === 'PAGE.MISSING' || short === 'LAYOUT.OUT_OF_BOUNDS')) {
      this.pendingPdfIntent = null;
      this.notify.error(this.transloco.translate('tplPreview.toast.outOfPage'));
      return;
    }

    if (status === 422 && short === 'LAYOUT.INCOMPATIBLE') {
      this.pendingPdfIntent = null;
      this.notify.error(this.transloco.translate('tplPreview.toast.incompatible'));
      return;
    }

    if (status === 429 && short === 'PREVIEW.TOO_MANY_ACTIVE') {
      this.pendingPdfIntent = null;
      this.notify.warning(this.transloco.translate('tplPreview.toast.tooMany'));
      return;
    }

    if (status === 410 || short === 'PREVIEW.ARTIFACT_EXPIRED' || short === 'PREVIEW.EXPIRED') {
      this.pendingPdfIntent = null;
      this.activeResult.set(null);
      this.poller.markExpired();
      return;
    }

    if (status === 403 || short === 'PERMISSION.DENIED' || short === 'FEATURE.DISABLED') {
      this.pendingPdfIntent = null;
      this.activeResult.set(null);
      this.stageError.set({ kind: 'forbidden' });
      return;
    }

    if (status === 404 || short === 'NOT_FOUND') {
      this.pendingPdfIntent = null;
      this.activeResult.set(null);
      this.stageError.set({ kind: 'notFound' });
      return;
    }

    if (
      status === 503 ||
      short === 'PDF.ARTIFACT_INTEGRITY_FAILED' ||
      short === 'DEPENDENCY.UNAVAILABLE' ||
      short === 'PREVIEW.BUNDLE_UNAVAILABLE' ||
      short === 'PREVIEW.BUNDLE_INTEGRITY_FAILED' ||
      short === 'PREVIEW.AUTHORITY_UNAVAILABLE' ||
      (status === 503 && short.startsWith('PREVIEW.'))
    ) {
      // Keep pendingPdfIntent so "Try again" retries with the same idempotency key.
      this.activeResult.set(null);
      this.stageError.set({ kind: 'unavailable', correlationId });
      return;
    }

    this.notify.error(this.pageService.translateError(this.transloco, error));
  }

  private async reloadDraftAndRerun(expectedSeq: number): Promise<void> {
    const def = this.definition();
    if (!def) return;
    try {
      const [freshDef, freshDraft] = await Promise.all([
        getTemplate(def.templateId),
        getDraft(def.templateId),
      ]);
      if (expectedSeq !== this.runSeq) return;
      this.pageService.syncFromDefinition(freshDef, this.pageService.overviewDirty());
      if (!this.pageService.dirty()) {
        this.pageService.syncExternalDraft(freshDraft);
      } else {
        this.pageService.setDraft(freshDraft);
      }
      this.lastTriggeredDraftRev = freshDraft.revision;
      await this.triggerPreview(true, { staleRetried: true });
    } catch (error) {
      if (expectedSeq !== this.runSeq) return;
      this.notify.error(this.pageService.translateError(this.transloco, error));
    }
  }

  private ensureVersionDocument(templateId: string, versionId: string): void {
    if (this.versionDocs()[versionId] || this.loadingVersionIds.has(versionId)) return;
    this.loadingVersionIds.add(versionId);
    const expectedInitSeq = this.initSeq;
    void getVersion(templateId, versionId)
      .then((ver) => {
        if (expectedInitSeq !== this.initSeq || this.loadedTemplateId !== templateId) return;
        this.versionDocs.update((map) => ({ ...map, [versionId]: ver.editorDocument }));
      })
      .catch(() => {
        // Fallback to definition layoutMode when version detail fetch fails.
      })
      .finally(() => {
        this.loadingVersionIds.delete(versionId);
      });
  }

  private clearExpiryTimer(): void {
    if (this.expiryTimer !== null) {
      clearTimeout(this.expiryTimer);
      this.expiryTimer = null;
    }
  }

  private scheduleExpiryTimer(
    entry: Extract<CachedPreviewResult, { kind: 'PDF' }>,
    cacheKey: string,
    expectedSeq: number,
  ): void {
    this.clearExpiryTimer();
    const expMs = Date.parse(entry.artifact.downloadUrlExpiresAt);
    if (Number.isNaN(expMs)) return;

    const remaining = expMs - Date.now();
    if (remaining <= 0) {
      if (expectedSeq === this.runSeq) {
        this.cache.delete(cacheKey);
        if (this.activeResult() === entry) {
          this.activeResult.set(null);
        }
        this.poller.markExpired();
      }
      return;
    }

    const delay = Math.min(remaining, 2_147_483_647);
    this.expiryTimer = setTimeout(() => {
      this.expiryTimer = null;
      if (expectedSeq !== this.runSeq) return;
      if (expMs > Date.now()) {
        this.scheduleExpiryTimer(entry, cacheKey, expectedSeq);
        return;
      }
      this.cache.delete(cacheKey);
      if (this.activeResult() === entry) {
        this.activeResult.set(null);
      }
      this.poller.markExpired();
    }, delay);
  }

  private notifyPreviewWarnings(count: number): void {
    if (count === 1) {
      this.notify.warning(this.transloco.translate('tplPreview.toast.warningOne'));
    } else if (count > 1) {
      this.notify.warning(this.transloco.translate('tplPreview.toast.warnings', { n: count }));
    }
  }

  private formatFixtureLabel(fixture: TemplateSyntheticFixture): string {
    const candidates = [`tplPreview.fixtures.${fixture.labelKey}`];
    const leaf = fixture.labelKey.includes('.') ? fixture.labelKey.split('.').pop() : null;
    if (leaf) {
      candidates.push(`tplPreview.fixtures.${leaf}`);
    }
    candidates.push(fixture.labelKey);

    let base = fixture.fixtureKey;
    for (const key of candidates) {
      const translated = this.transloco.translate(key);
      if (translated && translated !== key) {
        base = translated;
        break;
      }
    }

    const localeKey = `templates.locales.${fixture.locale}`;
    const localeLabel = this.transloco.translate(localeKey);
    const language = localeLabel && localeLabel !== localeKey ? localeLabel : fixture.locale;
    return `${base} (${language})`;
  }

  private formatTime(iso: string, lang: 'en' | 'ar'): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    const locale = lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US';
    return new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(date);
  }

  private formatUntil(expiresIso: string, createdIso: string, lang: 'en' | 'ar'): string {
    const exp = new Date(expiresIso);
    const crt = new Date(createdIso);
    if (Number.isNaN(exp.getTime())) return expiresIso;
    const sameDay =
      !Number.isNaN(crt.getTime()) &&
      exp.getFullYear() === crt.getFullYear() &&
      exp.getMonth() === crt.getMonth() &&
      exp.getDate() === crt.getDate();
    return sameDay ? this.formatTime(expiresIso, lang) : this.pageService.formatDateTime(expiresIso, lang);
  }
}
