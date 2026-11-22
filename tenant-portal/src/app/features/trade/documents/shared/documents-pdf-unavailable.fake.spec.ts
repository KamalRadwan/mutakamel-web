import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../shared/trade-api';
import { fakeListDocuments, fakeRenderPdf, fakeSimulatePdfRenderUnavailable } from './documents.fake';

describe('documents.fake quotation PDF worker unavailable', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    fakeSimulatePdfRenderUnavailable(0);
    vi.useRealTimers();
  });

  it('returns 503 TRADE.QUOTE.PDF_RENDER_UNAVAILABLE once, then lets the retry through', async () => {
    const listing = fakeListDocuments('quotation', { page: 1, limit: 50 });
    await vi.advanceTimersByTimeAsync(350);
    const sent = (await listing).items.find((row) => ['SENT', 'ACCEPTED'].includes(row.lifecycleStatus));
    expect(sent).toBeDefined();
    const body = { purpose: 'QUOTATION_PRINT', revisionId: 'rev' } as never;

    fakeSimulatePdfRenderUnavailable(1);
    const first = fakeRenderPdf('quotation', sent!.id, body, { skipDelay: true });
    await expect(first).rejects.toBeInstanceOf(ApiError);
    await expect(
      (async () => {
        fakeSimulatePdfRenderUnavailable(1);
        return fakeRenderPdf('quotation', sent!.id, body, { skipDelay: true });
      })(),
    ).rejects.toMatchObject({ status: 503, code: 'TRADE.QUOTE.PDF_RENDER_UNAVAILABLE' });

    const retry = await fakeRenderPdf('quotation', sent!.id, body, { skipDelay: true });
    expect(retry.status).toBe('PENDING');
  });
});
