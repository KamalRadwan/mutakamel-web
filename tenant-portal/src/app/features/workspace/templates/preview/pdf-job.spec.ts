import { DOCUMENT } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import {
  TemplateApiError,
  TemplatesApi,
  type TemplatePdfJobDto,
  type TemplatePdfPreviewAcceptedDto,
} from '../templates.api';
import {
  PDF_POLL_FAST_MS,
  PDF_POLL_MEDIUM_MS,
  PDF_POLL_SLOW_MS,
  PDF_POLL_WINDOW_MS,
  PdfJobPoller,
  pollDelayForElapsedMs,
} from './pdf-job';

const BASE = '/api/tenant/core/v1/templates';
const TEMPLATE_ID = '01948100-0000-7000-8000-000000001001';
const DRAFT_ID = '01948100-0000-7000-8000-000000003001';
const JOB_ID = '01948100-0000-7000-8000-000000009001';
const CHECKSUM = 'a'.repeat(64);
const JOB_URL = `${BASE}/preview-jobs/${JOB_ID}`;
const ARTIFACT_URL = `${JOB_URL}/artifact`;

function makeAccepted(status: 'PENDING' | 'RESOLVING_SOURCE' = 'PENDING'): TemplatePdfPreviewAcceptedDto {
  return {
    templateId: TEMPLATE_ID,
    source: { kind: 'DRAFT', draftId: DRAFT_ID, draftRevision: 3 },
    templateContentChecksum: CHECKSUM,
    compiledArtifactChecksum: CHECKSUM,
    kind: 'PDF_ACCEPTED',
    renderTarget: 'PDF',
    outputProfile: 'DOCUMENT_PRINT',
    renderJobId: JOB_ID,
    status,
    location: JOB_URL,
    createdAt: '2026-11-23T12:00:00.000Z',
    expiresAt: '2026-11-23T13:00:00.000Z',
  };
}

function makeJob(overrides: Partial<TemplatePdfJobDto> = {}): TemplatePdfJobDto {
  return {
    templateId: TEMPLATE_ID,
    source: { kind: 'DRAFT', draftId: DRAFT_ID, draftRevision: 3 },
    templateContentChecksum: CHECKSUM,
    compiledArtifactChecksum: CHECKSUM,
    renderJobId: JOB_ID,
    renderTarget: 'PDF',
    attemptCount: 1,
    createdAt: '2026-11-23T12:00:00.000Z',
    expiresAt: '2026-11-23T13:00:00.000Z',
    lifecycleRevision: 1,
    status: 'PENDING',
    nextRetryAt: null,
    failure: null,
    artifact: null,
    outputProfile: 'DOCUMENT_PRINT',
    ...overrides,
  };
}

describe('PdfJobPoller', () => {
  let http: HttpTestingController;
  let api: TemplatesApi;
  let poller: PdfJobPoller;
  const me = signal({ id: 'actor-1', isTenantOwner: true, permissions: ['templates.preview'], permissionScopes: {} });
  const selection = signal<{ companyId: string; branchId: string | null } | null>(null);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-23T12:00:00.000Z'));

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: TenantScopeState, useValue: { me, selection } },
      ],
    });
    const doc = TestBed.inject(DOCUMENT);
    const csrfName = doc.location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf';
    vi.spyOn(doc, 'cookie', 'get').mockReturnValue(`${csrfName}=csrf-proof`);

    http = TestBed.inject(HttpTestingController);
    api = TestBed.inject(TemplatesApi);
    poller = TestBed.runInInjectionContext(() => new PdfJobPoller());
  });

  afterEach(() => {
    poller.destroy();
    http.verify();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('computes stepped backoff intervals at 1s, 2s and 5s', () => {
    expect(pollDelayForElapsedMs(0)).toBe(PDF_POLL_FAST_MS);
    expect(pollDelayForElapsedMs(9_999)).toBe(PDF_POLL_FAST_MS);
    expect(pollDelayForElapsedMs(10_000)).toBe(PDF_POLL_MEDIUM_MS);
    expect(pollDelayForElapsedMs(59_999)).toBe(PDF_POLL_MEDIUM_MS);
    expect(pollDelayForElapsedMs(60_000)).toBe(PDF_POLL_SLOW_MS);
    expect(pollDelayForElapsedMs(120_000)).toBe(PDF_POLL_SLOW_MS);
  });

  it('polls job transitions via TemplatesApi and downloads the completed PDF artifact with v2 layout proof metadata', async () => {
    const onCompleted = vi.fn<(job: TemplatePdfJobDto, blob: Blob) => void>();
    const onError = vi.fn<(error: unknown) => void>();

    poller.start(makeAccepted('RESOLVING_SOURCE'), { onCompleted, onError });
    expect(poller.status()).toBe('RESOLVING_SOURCE');
    expect(poller.jobId()).toBe(JOB_ID);

    await vi.advanceTimersByTimeAsync(PDF_POLL_FAST_MS);
    const req1 = http.expectOne(JOB_URL);
    expect(req1.request.method).toBe('GET');
    expect(req1.request.withCredentials).toBe(true);
    req1.flush({ success: true, data: makeJob({ status: 'RETRYING', attemptCount: 2 }) });
    await vi.advanceTimersByTimeAsync(0);

    expect(poller.status()).toBe('RETRYING');
    expect(poller.attemptCount()).toBe(2);

    await vi.advanceTimersByTimeAsync(PDF_POLL_FAST_MS);
    const completedJob = makeJob({
      status: 'COMPLETED',
      attemptCount: 2,
      lifecycleRevision: 3,
      artifact: {
        downloadUrl: ARTIFACT_URL,
        downloadUrlExpiresAt: '2026-11-23T12:30:00.000Z',
        checksum: CHECKSUM,
        sizeBytes: 4096,
        pageCount: 3,
        rendererVersion: '1.0.0',
        browserBuildFingerprint: 'chromium-1',
        createdAt: '2026-11-23T12:00:02.000Z',
        layoutReceiptChecksum: CHECKSUM,
        layoutProof: {
          checksum: CHECKSUM,
          pageCount: 3,
          downloadPath: `${JOB_URL}/layout-receipt`,
        },
        pdfPackagingPolicyVersion: 'top-aligned-boxes-v1',
        pdfPackagingFingerprint: 'pkg-1',
      },
    });
    http.expectOne(JOB_URL).flush({ success: true, data: completedJob });
    await vi.advanceTimersByTimeAsync(0);

    const artifactReq = http.expectOne(ARTIFACT_URL);
    expect(artifactReq.request.method).toBe('GET');
    expect(artifactReq.request.responseType).toBe('blob');
    expect(artifactReq.request.withCredentials).toBe(true);
    const pdfBlob = new Blob(['%PDF-1.7'], { type: 'application/pdf' });
    artifactReq.flush(pdfBlob);
    await vi.advanceTimersByTimeAsync(0);

    expect(poller.status()).toBe('COMPLETED');
    expect(poller.expiresAt()).toBe('2026-11-23T12:30:00.000Z');
    expect(poller.artifact()?.layoutProof?.pageCount).toBe(3);
    expect(onCompleted).toHaveBeenCalledTimes(1);
    expect(onCompleted).toHaveBeenCalledWith(completedJob, pdfBlob);
    expect(onError).not.toHaveBeenCalled();
  });

  it('retries when artifact download returns 409 PREVIEW.ARTIFACT_NOT_READY and completes on next poll', async () => {
    const onCompleted = vi.fn<(job: TemplatePdfJobDto, blob: Blob) => void>();
    const pollerWithApi = new PdfJobPoller(api);

    const completedJob = makeJob({
      status: 'COMPLETED',
      artifact: {
        downloadUrl: ARTIFACT_URL,
        downloadUrlExpiresAt: '2026-11-23T12:30:00.000Z',
        checksum: CHECKSUM,
        sizeBytes: 1024,
        pageCount: 1,
        rendererVersion: '1.0.0',
        browserBuildFingerprint: 'chromium-1',
      },
    });

    pollerWithApi.start(makeAccepted(), { onCompleted });
    await vi.advanceTimersByTimeAsync(PDF_POLL_FAST_MS);
    http.expectOne(JOB_URL).flush({ success: true, data: completedJob });
    await vi.advanceTimersByTimeAsync(0);

    http.expectOne(ARTIFACT_URL).flush(
      new Blob([JSON.stringify({ errorCode: 'CORE.TEMPLATE.PREVIEW.ARTIFACT_NOT_READY' })], {
        type: 'application/json',
      }),
      { status: 409, statusText: 'Conflict' },
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(pollerWithApi.status()).toBe('PENDING');
    expect(onCompleted).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(PDF_POLL_FAST_MS);
    http.expectOne(JOB_URL).flush({ success: true, data: completedJob });
    await vi.advanceTimersByTimeAsync(0);
    const pdfBlob = new Blob(['%PDF-1.7'], { type: 'application/pdf' });
    http.expectOne(ARTIFACT_URL).flush(pdfBlob);
    await vi.advanceTimersByTimeAsync(0);

    expect(pollerWithApi.status()).toBe('COMPLETED');
    expect(onCompleted).toHaveBeenCalledTimes(1);
    pollerWithApi.destroy();
  });

  it('records FAILED jobs without requesting the artifact', async () => {
    const onCompleted = vi.fn<(job: TemplatePdfJobDto, blob: Blob) => void>();
    const onFailed = vi.fn<(job: TemplatePdfJobDto) => void>();

    poller.start(makeAccepted(), { onCompleted, onFailed });
    await vi.advanceTimersByTimeAsync(PDF_POLL_FAST_MS);

    const failedJob = makeJob({
      status: 'FAILED',
      failure: {
        code: 'RENDER_TIMEOUT',
        failedAt: '2026-11-23T12:00:05.000Z',
        retryable: false,
        phase: 'WORKER',
      },
    });
    http.expectOne(JOB_URL).flush({ success: true, data: failedJob });
    await vi.advanceTimersByTimeAsync(0);

    expect(poller.status()).toBe('FAILED');
    expect(poller.failure()).toEqual(failedJob.failure);
    expect(onFailed).toHaveBeenCalledWith(failedJob);
    expect(onCompleted).not.toHaveBeenCalled();
  });

  it('marks EXPIRED on 410 PREVIEW.ARTIFACT_EXPIRED from either job status or artifact stream', async () => {
    const onExpired = vi.fn<() => void>();
    poller.start(makeAccepted(), { onCompleted: vi.fn(), onExpired });

    await vi.advanceTimersByTimeAsync(PDF_POLL_FAST_MS);
    http.expectOne(JOB_URL).flush(
      { errorCode: 'CORE.TEMPLATE.PREVIEW.ARTIFACT_EXPIRED', correlationId: 'corr-410' },
      { status: 410, statusText: 'Gone' },
    );
    await vi.advanceTimersByTimeAsync(0);

    expect(poller.status()).toBe('EXPIRED');
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it('stops polling on 503 while preserving jobId and non-terminal status so resume() polls the same job', async () => {
    const onCompleted = vi.fn<(job: TemplatePdfJobDto, blob: Blob) => void>();
    const onError = vi.fn<(error: unknown) => void>();

    poller.start(makeAccepted(), { onCompleted, onError });
    await vi.advanceTimersByTimeAsync(PDF_POLL_FAST_MS);
    http.expectOne(JOB_URL).flush(
      { errorCode: 'CORE.TEMPLATE.PREVIEW.BUNDLE_UNAVAILABLE', correlationId: 'corr-503' },
      { status: 503, statusText: 'Service Unavailable' },
    );
    await vi.advanceTimersByTimeAsync(0);

    expect(poller.status()).toBe('PENDING');
    expect(poller.jobId()).toBe(JOB_ID);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 503,
        code: 'CORE.TEMPLATE.PREVIEW.BUNDLE_UNAVAILABLE',
        correlationId: 'corr-503',
      }),
    );

    poller.resume();
    await vi.advanceTimersByTimeAsync(0);
    const completedJob = makeJob({
      status: 'COMPLETED',
      artifact: {
        downloadUrl: ARTIFACT_URL,
        downloadUrlExpiresAt: '2026-11-23T12:30:00.000Z',
        checksum: CHECKSUM,
        sizeBytes: 2048,
        pageCount: 1,
        rendererVersion: '1.0.0',
        browserBuildFingerprint: 'chromium-1',
      },
    });
    http.expectOne(JOB_URL).flush({ success: true, data: completedJob });
    await vi.advanceTimersByTimeAsync(0);
    http.expectOne(ARTIFACT_URL).flush(new Blob(['%PDF-1.7'], { type: 'application/pdf' }));
    await vi.advanceTimersByTimeAsync(0);

    expect(poller.status()).toBe('COMPLETED');
    expect(onCompleted).toHaveBeenCalledTimes(1);
  });

  it('enters SLOW after the 3-minute polling window and rejects COMPLETED payloads missing an artifact', async () => {
    const onError = vi.fn<(error: unknown) => void>();
    poller.start(makeAccepted(), { onCompleted: vi.fn(), onError });

    await vi.advanceTimersByTimeAsync(PDF_POLL_FAST_MS);
    vi.setSystemTime(new Date(Date.now() + PDF_POLL_WINDOW_MS));
    http.expectOne(JOB_URL).error(new ProgressEvent('error'));
    await vi.advanceTimersByTimeAsync(0);

    expect(poller.status()).toBe('SLOW');

    poller.resume();
    await vi.advanceTimersByTimeAsync(0);
    http.expectOne(JOB_URL).flush({ success: true, data: makeJob({ status: 'COMPLETED', artifact: null }) });
    await vi.advanceTimersByTimeAsync(0);

    expect(poller.status()).toBe('FAILED');
    expect(onError).toHaveBeenCalledWith(expect.any(TemplateApiError));
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ status: 502, code: 'COMMON.GENERIC.INTERNAL_ERROR' }),
    );
  });
});
