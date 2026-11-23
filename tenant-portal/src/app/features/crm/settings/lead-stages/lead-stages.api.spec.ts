import { DOCUMENT } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { CrmHttp, bindCrmHttpForTest, crmQueries } from '../../shared/crm-http';
import {
  LEAD_STAGE_SETTINGS_READER,
  beginLeadStageEdit,
  createLeadStage,
  deleteLeadStage,
  listLeadStages,
  reorderLeadStages,
  setDefaultLeadStage,
  updateLeadStage,
} from './lead-stages.api';
import { getCrmSettings } from '../general/general.api';
import type { CreateLeadStageInput } from './lead-stages.model';

const base = '/api/tenant/crm/v1/lead-stages';
const uuidV7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const input: CreateLeadStageInput = {
  nameAr: 'متابعة',
  nameEn: 'Follow up',
  flag: 'CONTACTED',
  category: 'IN_PROGRESS',
};

describe('LeadStagesApi', () => {
  let http: HttpTestingController;
  let dispose: () => void;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    vi.spyOn(TestBed.inject(DOCUMENT), 'cookie', 'get').mockReturnValue(
      'mutakamel-http-tenant-csrf=csrf-proof',
    );
    dispose = bindCrmHttpForTest(TestBed.inject(CrmHttp));
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    crmQueries().clear();
    dispose();
    vi.restoreAllMocks();
  });

  it('reads bare stages and invalidates the list after all six calls', async () => {
    const rows = [{ id: 'stage', ...input }];
    const read = listLeadStages();
    http.expectOne(base).flush(rows);
    await expect(read).resolves.toEqual(rows);
    const cancel = vi.spyOn(crmQueries(), 'cancelQueries');
    const invalidate = vi.spyOn(crmQueries(), 'invalidateQueries');
    const writes = [
      { run: () => createLeadStage(input), method: 'POST', path: base, body: input, status: 201 },
      {
        run: () => updateLeadStage('stage', { isActive: false }),
        method: 'PATCH',
        path: `${base}/stage`,
        body: { isActive: false },
        status: 200,
      },
      {
        run: () => setDefaultLeadStage('stage'),
        method: 'POST',
        path: `${base}/stage/default`,
        body: null,
        status: 201,
      },
      {
        run: () => reorderLeadStages(['stage'], newIdempotencyKey()),
        method: 'PATCH',
        path: `${base}/reorder`,
        body: { orderedIds: ['stage'] },
        status: 200,
      },
      {
        run: () => deleteLeadStage('stage'),
        method: 'DELETE',
        path: `${base}/stage`,
        body: null,
        status: 204,
      },
    ];
    for (const write of writes) {
      const pending = write.run();
      const request = http.expectOne(write.path);
      expect(request.request.method).toBe(write.method);
      expect(request.request.body).toEqual(write.body);
      expect(request.request.headers.get('x-idempotency-key')).toMatch(uuidV7);
      expect(request.request.headers.get('x-csrf-token')).toBe('csrf-proof');
      expect(request.request.headers.has('x-mutakamel-company-id')).toBe(false);
      expect(request.request.headers.has('x-mutakamel-branch-id')).toBe(false);
      request.flush(write.status === 204 ? null : rows[0], {
        status: write.status,
        statusText: 'Success',
      });
      await pending;
    }
    expect(cancel).toHaveBeenCalledTimes(5);
    expect(invalidate).toHaveBeenCalledTimes(5);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['crm-settings', 'lead-stages'] });
  });

  it('set default accepts 201', async () => {
    for (const body of [{ id: 'stage', ...input, isDefault: true }, null]) {
      const pending = setDefaultLeadStage('stage');
      http.expectOne(`${base}/stage/default`).flush(body, { status: 201, statusText: 'Created' });
      await expect(pending).resolves.toEqual(body);
    }
  });

  it('uses the shared general API for the optional warning', () => {
    expect(TestBed.inject(LEAD_STAGE_SETTINGS_READER)).toBe(getCrmSettings);
  });

  it('opening another form starts a new action after a lost response', async () => {
    const failed = createLeadStage(input);
    const outcome = expect(failed).rejects.toBeDefined();
    const first = http.expectOne(base);
    const key = first.request.headers.get('x-idempotency-key');
    first.error(new ProgressEvent('error'));
    await outcome;
    beginLeadStageEdit(null);
    const next = createLeadStage(input);
    const request = http.expectOne(base);
    expect(request.request.headers.get('x-idempotency-key')).not.toBe(key);
    request.flush({ id: 'stage', ...input }, { status: 201, statusText: 'Created' });
    await next;
  });

  it('reorder sends and reuses the key', async () => {
    const key = newIdempotencyKey();
    for (const status of [0, 503, 409, 200]) {
      const pending = reorderLeadStages(['a', 'b'], status === 0 ? key : newIdempotencyKey());
      const outcome =
        status === 200
          ? expect(pending).resolves.toEqual([])
          : expect(pending).rejects.toBeDefined();
      const request = http.expectOne(`${base}/reorder`);
      expect(request.request.headers.get('x-idempotency-key')).toBe(key);
      expect(request.request.headers.get('x-idempotency-key')).toMatch(uuidV7);
      expect(request.request.body).toEqual({ orderedIds: ['a', 'b'] });
      if (status === 0) request.error(new ProgressEvent('error'));
      else
        request.flush(
          status === 200 ? [] : { code: status === 409 ? 'GW.IDEM.IN_FLIGHT' : 'INTERNAL_ERROR' },
          { status, statusText: 'Result' },
        );
      await outcome;
      http.expectNone(`${base}/reorder`);
    }
  });

  it('every write retains a retry key and rotates it on body changes and other outcomes', async () => {
    for (const operation of ['create', 'update', 'default', 'delete'] as const) {
      const path =
        operation === 'create'
          ? base
          : operation === 'default'
            ? `${base}/stage/default`
            : `${base}/stage`;
      const run = (changed = false) =>
        operation === 'create'
          ? createLeadStage({ ...input, nameEn: changed ? 'Changed' : input.nameEn })
          : operation === 'update'
            ? updateLeadStage('stage', { nameEn: changed ? 'Changed' : input.nameEn })
            : operation === 'default'
              ? setDefaultLeadStage('stage')
              : deleteLeadStage('stage');
      let retainedKey: string | null = null;
      for (const status of [0, 503, 401, 409, 422]) {
        const pending = run();
        const outcome = expect(pending).rejects.toBeDefined();
        const request = http.expectOne(path);
        const key = request.request.headers.get('x-idempotency-key');
        if (retainedKey) expect(key).toBe(retainedKey);
        retainedKey = key;
        if (status === 0) request.error(new ProgressEvent('error'));
        else
          request.flush(
            { code: status === 409 ? 'GW.IDEM.IN_FLIGHT' : 'FAILURE' },
            { status, statusText: 'Failure' },
          );
        await outcome;
        http.expectNone(path);
      }
      const next = run();
      const request = http.expectOne(path);
      expect(request.request.headers.get('x-idempotency-key')).not.toBe(retainedKey);
      request.flush(null, { status: 204, statusText: 'Success' });
      await next;
      if (operation !== 'create' && operation !== 'update') continue;
      const failed = run();
      const outcome = expect(failed).rejects.toBeDefined();
      const previous = http.expectOne(path);
      const previousKey = previous.request.headers.get('x-idempotency-key');
      previous.error(new ProgressEvent('error'));
      await outcome;
      const changed = run(true);
      const changedRequest = http.expectOne(path);
      expect(changedRequest.request.headers.get('x-idempotency-key')).not.toBe(previousKey);
      expect(changedRequest.request.body.nameEn).toBe('Changed');
      changedRequest.flush({ id: 'stage' });
      await changed;
    }
  });

  it('a changed reorder body gets a new key after a lost response', async () => {
    const key = newIdempotencyKey();
    const failed = reorderLeadStages(['a', 'b'], key);
    const outcome = expect(failed).rejects.toBeDefined();
    http.expectOne(`${base}/reorder`).error(new ProgressEvent('error'));
    await outcome;
    const changed = reorderLeadStages(['b', 'a'], key);
    const request = http.expectOne(`${base}/reorder`);
    expect(request.request.headers.get('x-idempotency-key')).not.toBe(key);
    expect(request.request.body).toEqual({ orderedIds: ['b', 'a'] });
    request.flush([]);
    await changed;
  });
});
