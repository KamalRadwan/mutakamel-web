import { DOCUMENT } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../core/api/api-errors';
import { bindSeatPreviewApi, previewSeats, SEAT_PREVIEW, SeatPreviewApi } from './seats.api';
import type { SeatChange, SeatPreview } from './seats.model';

const path = '/api/tenant/core/v1/seats/preview';
const change: SeatChange = { kind: 'USER_STATUS', userId: '019af3c0-0000-7000-8000-000000000001', status: 'ACTIVE' };
const preview: SeatPreview = { mode: 'DERIVED', ok: true, modules: [] };

describe('seat preview HTTP', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const doc = TestBed.inject(DOCUMENT);
    const name = doc.location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf';
    vi.spyOn(doc, 'cookie', 'get').mockReturnValue(`${name}=csrf-proof`);
    bindSeatPreviewApi(() => TestBed.inject(SeatPreviewApi));
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => { http.verify(); vi.restoreAllMocks(); });

  it.each(['function', 'token'] as const)('%s posts changes without an idempotency key and unwraps Core', async (caller) => {
    const pending = (caller === 'token' ? TestBed.inject(SEAT_PREVIEW) : previewSeats)([change]);
    const req = http.expectOne(path);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ changes: [change] });
    expect(req.request.headers.has('x-idempotency-key')).toBe(false);
    expect(req.request.withCredentials).toBe(true);
    req.flush({ success: true, data: preview });
    await expect(pending).resolves.toEqual(preview);
  });

  it('sends 100 changes in one request', async () => {
    const changes = Array.from({ length: 100 }, () => change);
    const pending = previewSeats(changes);
    const req = http.expectOne(path);
    expect(req.request.body).toEqual({ changes });
    req.flush({ success: true, data: preview });
    await expect(pending).resolves.toEqual(preview);
  });

  it('preserves the server 422 limit error at 101 changes', async () => {
    const changes = Array.from({ length: 101 }, () => change);
    const pending = previewSeats(changes);
    const rejection = expect(pending).rejects.toMatchObject({ name: 'ApiError', status: 422, code: 'SEAT_PREVIEW_TOO_LARGE' });
    const req = http.expectOne(path);
    expect(req.request.body).toEqual({ changes });
    req.flush({ errorCode: 'SEAT_PREVIEW_TOO_LARGE' }, { status: 422, statusText: 'Unprocessable Entity' });
    await rejection;
  });

  it('turns a server failure into ApiError without retry', async () => {
    const pending = previewSeats([change]);
    const rejection = expect(pending).rejects.toBeInstanceOf(ApiError);
    http.expectOne(path).flush({}, { status: 503, statusText: 'Unavailable' });
    await rejection;
    http.expectNone(path);
  });

  it('keeps the modal token replaceable without constructing HTTP', async () => {
    const fake = vi.fn().mockResolvedValue(preview);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: SEAT_PREVIEW, useValue: fake }] });
    await expect(TestBed.inject(SEAT_PREVIEW)([change])).resolves.toEqual(preview);
    expect(fake).toHaveBeenCalledExactlyOnceWith([change]);
    // afterEach verifies the original testing backend, which has no pending requests.
  });
});
