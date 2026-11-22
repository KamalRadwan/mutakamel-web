import { Injectable } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoLoader, provideTransloco } from '@jsverse/transloco';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Notify } from '../../../../../core/notify/notify';
import {
  FAKE_TEMPLATE_IDS,
  TemplateApiError,
  getDraft,
  getTemplate,
} from '../../templates.api';
import type { TemplateDefinitionDetail, TemplateDraftDto } from '../../templates.model';
import { TemplatePageService } from '../template-page.service';
import { PreviewTab } from './preview-tab';

/*
 * The tab runs on the real templates fake (vi.mock of relative modules is not supported by the
 * Angular unit-test builder). The fake PDF worker completes a job on its first poll; the fake has no
 * route that answers PREVIEW.TOO_MANY_ACTIVE or PREVIEW.ARTIFACT_EXPIRED, so those answers are fed to
 * the tab's error handler directly, the way previewPdf()/the poller hand them over.
 */

/** Answers on a later microtask: a synchronous loader writes signals during render (NG0600). */
@Injectable()
class AsyncEmptyLoader implements TranslocoLoader {
  getTranslation() {
    return Promise.resolve({});
  }
}

const QUOTATION_ID = FAKE_TEMPLATE_IDS.corporateQuotationId;
const LEAD_EMAIL_ID = '01948100-0000-7000-8000-000000001009';

const originalCreateUrl = URL.createObjectURL;
const originalRevokeUrl = URL.revokeObjectURL;

// Protected members are reached through this view on purpose: the spec drives the tab state directly.
type Internals = Record<string, any>;

let fixture: ComponentFixture<PreviewTab>;
let c: Internals;
let notify: Notify;
let page: TemplatePageService;

async function flush(ms = 1000): Promise<void> {
  fixture.detectChanges();
  await vi.advanceTimersByTimeAsync(ms);
  fixture.detectChanges();
}

async function settle<T>(promise: Promise<T>): Promise<T> {
  const guarded = promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  await vi.advanceTimersByTimeAsync(1000);
  const result = await guarded;
  if (!result.ok) throw result.error;
  return result.value;
}

function withCapabilities(
  def: TemplateDefinitionDetail,
  preview: 'ENABLED' | 'DISABLED' | 'HIDDEN',
  previewPdf: 'ENABLED' | 'DISABLED' | 'HIDDEN',
  reason: string | null = null,
): TemplateDefinitionDetail {
  return {
    ...def,
    capabilities: {
      ...def.capabilities,
      preview: { state: preview, reason: preview === 'ENABLED' ? null : reason },
      previewPdf: { state: previewPdf, reason: previewPdf === 'ENABLED' ? null : reason },
    },
  } as TemplateDefinitionDetail;
}

interface MountOptions {
  templateId?: string;
  preview?: 'ENABLED' | 'DISABLED' | 'HIDDEN';
  previewPdf?: 'ENABLED' | 'DISABLED' | 'HIDDEN';
  reason?: string | null;
  draft?: (d: TemplateDraftDto) => TemplateDraftDto;
}

async function mount(options: MountOptions = {}): Promise<{ def: TemplateDefinitionDetail; draft: TemplateDraftDto }> {
  const templateId = options.templateId ?? QUOTATION_ID;
  const [rawDef, rawDraft] = await settle(Promise.all([getTemplate(templateId), getDraft(templateId)]));
  const def = withCapabilities(rawDef, options.preview ?? 'ENABLED', options.previewPdf ?? 'ENABLED', options.reason ?? null);
  const draft = options.draft ? options.draft(rawDraft) : rawDraft;
  page.syncFromDefinition(def);
  page.setDraft(draft);

  fixture = TestBed.createComponent(PreviewTab);
  c = fixture.componentInstance as unknown as Internals;
  await flush(2000);
  return { def, draft };
}

/** Switches to PDF and lets the fake accept, poll once and download the artifact. */
async function runPdfToCompletion(): Promise<void> {
  c['onFormatChange']('PDF');
  fixture.detectChanges();
  expect(c['pdfSubmitting']()).toBe(true);
  expect(c['isPdfInProgress']()).toBe(true);
  await flush(500);
  expect(c['poller'].status()).toBe('PENDING');
  expect(c['poller'].jobId()).toMatch(/^[0-9a-f-]{36}$/);
  await flush(2000);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  let urlSeq = 0;
  URL.createObjectURL = vi.fn(() => `blob:pdf-${++urlSeq}`);
  URL.revokeObjectURL = vi.fn();

  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideTransloco({
        config: { availableLangs: ['ar', 'en'], defaultLang: 'en', missingHandler: { logMissingKey: false } },
        loader: AsyncEmptyLoader,
      }),
    ],
  });
  notify = TestBed.inject(Notify);
  page = TestBed.inject(TemplatePageService);
});

afterEach(() => {
  fixture?.destroy();
  TestBed.resetTestingModule();
  URL.createObjectURL = originalCreateUrl;
  URL.revokeObjectURL = originalRevokeUrl;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('PreviewTab: initial load', () => {
  it('loads fixtures and versions, picks the draft and the fixture for the template locale, and renders HTML', async () => {
    const { def } = await mount();

    expect(c['loadingInit']()).toBe(false);
    expect(c['format']()).toBe('HTML');
    expect(c['selectedSource']()).toBe('DRAFT');
    expect(c['fixtures']().length).toBeGreaterThan(0);
    const chosen = c['fixtures']().find((f: { fixtureKey: string }) => f.fixtureKey === c['selectedFixtureKey']());
    expect(chosen.locale).toBe(def.locale);
    expect(c['stageError']()).toBeNull();
    expect(c['activeHtmlResult']()?.response.templateId).toBe(def.templateId);
    expect(c['statusBadge']()?.labelKey).toBe('tplPreview.badge.ready');
    expect(c['generateAgainDisabled']()).toBe(false);
  });

  it('a HIDDEN preview capability shows the forbidden state and calls nothing', async () => {
    await mount({ preview: 'HIDDEN', previewPdf: 'HIDDEN' });

    expect(c['stageError']()).toEqual({ kind: 'forbidden' });
    expect(c['activeResult']()).toBeNull();
    expect(c['formatOptions']().map((o: { value: string }) => o.value)).toEqual(['HTML']);
  });

  it('a DISABLED preview capability shows previewDisabled with the fallback text', async () => {
    await mount({ preview: 'DISABLED', previewPdf: 'DISABLED', reason: 'ARCHIVED' });

    expect(c['stageError']()).toEqual({ kind: 'previewDisabled', reasonText: 'tplPreview.state.previewDisabled' });
    expect(c['statusBadge']()?.labelKey).toBe('tplPreview.badge.failed');
  });

  it('an email template previews as EMAIL; switching to TEXT reuses the same response', async () => {
    await mount({ templateId: LEAD_EMAIL_ID });

    expect(c['format']()).toBe('EMAIL');
    const first = c['activeEmailResult']();
    expect(first?.kind).toBe('EMAIL');

    c['onFormatChange']('TEXT');
    expect(c['loadingPreview']()).toBe(false);
    expect(c['activeEmailResult']()).toBe(first);
  });
});

describe('PreviewTab: PDF job start and polling', () => {
  it('starts a job, polls it to COMPLETED and shows the downloaded artifact', async () => {
    await mount();

    await runPdfToCompletion();

    expect(c['poller'].status()).toBe('COMPLETED');
    expect(c['pdfSubmitting']()).toBe(false);
    const pdf = c['activePdfResult']();
    expect(pdf?.kind).toBe('PDF');
    expect(pdf.objectUrl).toMatch(/^blob:pdf-/);
    expect(pdf.artifact.pageCount).toBe(1);
    expect(c['canDownloadPdf']()).toBe(true);
    expect(c['statusBadge']()?.labelKey).toBe('tplPreview.badge.ready');
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  });

  it('PDF is not selectable when its capability is DISABLED', async () => {
    await mount({ previewPdf: 'DISABLED', reason: 'ARCHIVED' });

    c['onFormatChange']('PDF');

    expect(c['format']()).toBe('HTML');
    expect(c['formatOptions']().find((o: { value: string }) => o.value === 'PDF')?.disabled).toBe(true);
  });

  it('returning to PDF serves the cached artifact without a new job; Generate again starts a fresh one', async () => {
    await mount();
    await runPdfToCompletion();
    const firstJob = c['poller'].jobId();
    const firstPdf = c['activePdfResult']();

    c['onFormatChange']('HTML');
    await flush();
    c['onFormatChange']('PDF');
    fixture.detectChanges();

    expect(c['pdfSubmitting']()).toBe(false);
    expect(c['poller'].status()).toBe('IDLE');
    expect(c['activePdfResult']()).toBe(firstPdf);

    c['generateAgain']();
    fixture.detectChanges();
    expect(c['pdfSubmitting']()).toBe(true);
    await flush(3000);
    expect(c['poller'].jobId()).not.toBe(firstJob);
    expect(c['activePdfResult']()).not.toBe(firstPdf);
  });

  it('the artifact link expiry turns the result into the expired state', async () => {
    await mount();
    await runPdfToCompletion();
    expect(c['activePdfResult']()).not.toBeNull();

    await flush(60 * 60 * 1000 + 1000);

    expect(c['poller'].status()).toBe('EXPIRED');
    expect(c['activeResult']()).toBeNull();
    expect(c['isPdfExpired']()).toBe(true);
    expect(c['statusBadge']()?.labelKey).toBe('tplPreview.badge.expired');
  });

  it('downloading an artifact whose link already expired marks it expired instead of downloading', async () => {
    await mount();
    await runPdfToCompletion();
    const pdf = c['activePdfResult']();
    c['activeResult'].set({ ...pdf, artifact: { ...pdf.artifact, downloadUrlExpiresAt: new Date(Date.now() - 1).toISOString() } });

    c['downloadPdf']();

    expect(c['poller'].status()).toBe('EXPIRED');
    expect(c['activeResult']()).toBeNull();
  });
});

describe('PreviewTab: PDF errors', () => {
  it('429 PREVIEW.TOO_MANY_ACTIVE warns, drops the pending idempotency key and keeps the current result', async () => {
    await mount();
    c['onFormatChange']('PDF');
    const pending = c['pendingPdfIntent'];
    expect(pending).not.toBeNull();
    const current = c['activeResult']();
    const warning = vi.spyOn(notify, 'warning');
    const error = vi.spyOn(notify, 'error');

    c['handlePreviewError'](new TemplateApiError(429, 'CORE.TEMPLATE.PREVIEW.TOO_MANY_ACTIVE'), c['runSeq'], false);

    expect(warning).toHaveBeenCalledWith('tplPreview.toast.tooMany');
    expect(error).not.toHaveBeenCalled();
    expect(c['pendingPdfIntent']).toBeNull();
    expect(c['stageError']()).toBeNull();
    expect(c['activeResult']()).toBe(current);
    await flush(3000);
  });

  it('410 PREVIEW.ARTIFACT_EXPIRED clears the result and shows the expired state', async () => {
    await mount();
    await runPdfToCompletion();

    c['handlePreviewError'](new TemplateApiError(410, 'CORE.TEMPLATE.PREVIEW.ARTIFACT_EXPIRED'), c['runSeq'], false);
    fixture.detectChanges();

    expect(c['activeResult']()).toBeNull();
    expect(c['poller'].status()).toBe('EXPIRED');
    expect(c['isPdfExpired']()).toBe(true);
    expect(c['activePdfResult']()).toBeNull();
    expect(c['statusBadge']()?.labelKey).toBe('tplPreview.badge.expired');
  });

  it('the ARTIFACT_EXPIRED code alone (no 410) is also treated as expired', async () => {
    await mount();
    await runPdfToCompletion();

    c['handlePreviewError']({ code: 'CORE.TEMPLATE.PREVIEW.ARTIFACT_EXPIRED' }, c['runSeq'], false);

    expect(c['poller'].status()).toBe('EXPIRED');
    expect(c['activeResult']()).toBeNull();
  });

  it('503 keeps the pending idempotency key so Try again reuses it', async () => {
    await mount();
    c['pendingPdfIntent'] = { intentKey: 'k', idempotencyKey: 'idem-1' };

    c['handlePreviewError'](
      new TemplateApiError(503, 'CORE.TEMPLATE.DEPENDENCY.UNAVAILABLE', 'corr-spec-503'),
      c['runSeq'],
      false,
    );

    expect(c['stageError']()).toEqual({ kind: 'unavailable', correlationId: 'corr-spec-503' });
    expect(c['pendingPdfIntent']).toEqual({ intentKey: 'k', idempotencyKey: 'idem-1' });
  });

  it('maps 422 VALIDATION.FAILED, COMPILER.FAILED, 403 and 404 to stage states; OUTPUT_LIMIT to a toast', async () => {
    await mount();
    const error = vi.spyOn(notify, 'error');
    const handle = (e: TemplateApiError) => c['handlePreviewError'](e, c['runSeq'], false);

    handle(new TemplateApiError(422, 'CORE.TEMPLATE.VALIDATION.FAILED'));
    expect(c['stageError']()).toEqual({ kind: 'validation' });
    handle(new TemplateApiError(422, 'CORE.TEMPLATE.COMPILER.FAILED'));
    expect(c['stageError']()).toEqual({ kind: 'compiler' });
    handle(new TemplateApiError(403, 'CORE.TEMPLATE.PERMISSION.DENIED'));
    expect(c['stageError']()).toEqual({ kind: 'forbidden' });
    handle(new TemplateApiError(404, 'CORE.TEMPLATE.NOT_FOUND'));
    expect(c['stageError']()).toEqual({ kind: 'notFound' });

    handle(new TemplateApiError(422, 'CORE.TEMPLATE.PREVIEW.OUTPUT_LIMIT'));
    expect(error).toHaveBeenCalledWith('tplPreview.toast.tooLarge');
  });
});

describe('PreviewTab: draft source', () => {
  it('a stale draft revision warns, reloads the draft and previews the fresh revision', async () => {
    const warning = vi.spyOn(TestBed.inject(Notify), 'warning');

    const { draft } = await mount({ draft: (d) => ({ ...d, revision: d.revision + 1 }) });
    await flush(2000);

    expect(warning).toHaveBeenCalledWith('tplPreview.toast.stale');
    expect(page.draft()?.revision).toBe(draft.revision - 1);
    expect(c['stageError']()).toBeNull();
    expect(c['activeHtmlResult']()?.response.source).toEqual(
      expect.objectContaining({ kind: 'DRAFT', draftRevision: draft.revision - 1 }),
    );
  });

  it('with unsaved design changes a new combination asks to save first and Generate again is disabled', async () => {
    await mount();
    const other = c['fixtures']().find((f: { fixtureKey: string }) => f.fixtureKey !== c['selectedFixtureKey']());
    page.setDirty(true);
    fixture.detectChanges();

    c['activeResult'].set(null);
    c['onFixtureChange'](other.fixtureKey);
    await flush();

    expect(c['stageError']()).toEqual({ kind: 'saveFirst' });
    expect(c['generateAgainDisabled']()).toBe(true);
    expect(c['generateAgainTooltip']()).toBe('tplPreview.source.saveFirst');
  });
});
