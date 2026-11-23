import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError as CoreApiError } from '../../../../core/api/api-errors';
import { bindCrmHttpForTest } from '../../../crm/shared/crm-http';
import { CrmHttpStub } from '../../../crm/shared/testing/crm-http-testing';
import { ApiError } from '../../shared/trade-api';
import { bindTradeHttpForTest } from '../../shared/trade-http';
import { TradeCoreStub, TradeHttpStub } from '../../shared/testing/trade-http-testing';
import type { DocumentKind } from '../shared/document.model';
import {
  embeddedSourceOpportunityOf,
  getBulkPrintArtifact,
  getRenderJob,
  getRenderJobArtifact,
  listOpportunityOptions,
  listPrintTemplates,
  renderPdf,
} from '../shared/documents.api';

const CTX = {
  companyId: '019a0000-0000-7000-8000-000000000001',
  branchId: '019a0000-0000-7000-8000-000000000002',
};
const IDEM_KEY = '019a0000-0000-7000-8000-000000000077';

describe('documents.api (DC-3 print, bulk-print artifact, CRM opportunities)', () => {
  let tradeStub: TradeHttpStub;
  let coreStub: TradeCoreStub;
  let crmStub: CrmHttpStub;
  let restoreTrade: () => void;
  let restoreCrm: () => void;

  beforeEach(() => {
    tradeStub = new TradeHttpStub();
    coreStub = new TradeCoreStub();
    crmStub = new CrmHttpStub({
      '/opportunities': {
        items: [
          {
            id: 'opp-1',
            title: 'Enterprise Fleet Expansion',
            stageName: 'Proposal',
            status: 'IN_PROGRESS',
          },
          {
            id: 'opp-2',
            name: 'Fallback Named Opp',
            status: 'WON',
          },
        ],
        total: 2,
        page: 1,
        limit: 100,
      },
    });
    restoreTrade = bindTradeHttpForTest(tradeStub, coreStub);
    restoreCrm = bindCrmHttpForTest(crmStub);
  });

  afterEach(() => {
    restoreTrade();
    restoreCrm();
    vi.restoreAllMocks();
  });

  describe('listPrintTemplates', () => {
    it('preserves Core permission errors as Trade errors with field details', async () => {
      coreStub.register('GET', '/api/tenant/core/v1/templates/assignments',
        new CoreApiError(403, 'FORBIDDEN', { templateVersionId: ['denied'] }));
      await expect(listPrintTemplates('quotation', CTX)).rejects.toMatchObject({
        status: 403, code: 'FORBIDDEN', details: { templateVersionId: ['denied'] },
      });
    });

    it.each([
      ['quotation', 'QUOTATION', 'TRADE_QUOTATION_PRINT_V1'],
      ['sales-order', 'SALES_ORDER', 'TRADE_SALES_ORDER_PRINT_V1'],
      ['purchase-order', 'PURCHASE_ORDER', 'TRADE_PURCHASE_ORDER_PRINT_V1'],
      ['purchase-quotation', 'PURCHASE_QUOTATION', 'TRADE_PURCHASE_QUOTATION_PRINT_V1'],
    ] as const)(
      'reads Core /templates/assignments for %s (%s / %s), enriches names from /templates, and sorts defaults first',
      async (kind: DocumentKind, documentType, adapterKey) => {
        coreStub.register('GET', '/api/tenant/core/v1/templates/assignments', {
          items: [
            {
              assignmentId: 'asg-2',
              definitionId: 'def-2',
              versionId: 'ver-2',
              versionNumber: 1,
              documentType,
              outputChannel: 'PRINT',
              adapterKey,
              locale: 'en-US',
              priority: 1,
              isDefault: false,
              status: 'ACTIVE',
            },
            {
              assignmentId: 'asg-1',
              definitionId: 'def-1',
              versionId: 'ver-1',
              versionNumber: 4,
              documentType,
              outputChannel: 'PRINT',
              adapterKey,
              locale: 'ar-EG',
              priority: 5,
              isDefault: true,
              status: 'ACTIVE',
            },
            {
              assignmentId: 'asg-inactive',
              definitionId: 'def-3',
              versionId: 'ver-3',
              versionNumber: 2,
              documentType,
              outputChannel: 'PRINT',
              adapterKey,
              locale: 'en-US',
              priority: 99,
              isDefault: false,
              status: 'INACTIVE',
            },
          ],
          pageInfo: { limit: 100, hasNextPage: false, nextCursor: null },
        });
        coreStub.register('GET', '/api/tenant/core/v1/templates', {
          items: [
            { templateId: 'def-1', name: 'Primary Print' },
            { id: 'def-2', name: 'Compact Print' },
          ],
          pageInfo: { limit: 100, hasNextPage: false, nextCursor: null },
        });

        const options = await listPrintTemplates(kind, CTX);
        expect(options).toEqual([
          { templateId: 'def-1', versionId: 'ver-1', name: 'Primary Print', locale: 'ar-EG', versionNumber: 4 },
          { templateId: 'def-2', versionId: 'ver-2', name: 'Compact Print', locale: 'en-US', versionNumber: 1 },
        ]);
        expect(coreStub.recordedReads()).toEqual([
          {
            path: '/api/tenant/core/v1/templates/assignments',
            query: {
              scopeType: 'BRANCH',
              companyId: CTX.companyId,
              branchId: CTX.branchId,
              documentType,
              outputChannel: 'PRINT',
              adapterKey,
              status: 'ACTIVE',
              limit: 100,
            },
            scope: CTX,
          },
          {
            path: '/api/tenant/core/v1/templates',
            query: {
              assignmentScopeType: 'BRANCH',
              assignmentCompanyId: CTX.companyId,
              assignmentBranchId: CTX.branchId,
              documentType,
              outputChannel: 'PRINT',
              limit: 100,
            },
            scope: CTX,
          },
        ]);
      },
    );

    it('falls back to #versionNumber (never a raw UUID) when /templates lookup fails', async () => {
      coreStub.register('GET', '/api/tenant/core/v1/templates/assignments', {
        items: [
          {
            assignmentId: 'asg-1',
            definitionId: '019a0000-0000-7000-8000-deadbeef0001',
            versionId: 'ver-1',
            versionNumber: 7,
            locale: null,
            isDefault: true,
            status: 'ACTIVE',
          },
        ],
      });
      coreStub.register('GET', '/api/tenant/core/v1/templates', new ApiError(403, 'FORBIDDEN'));

      const options = await listPrintTemplates('quotation', { companyId: CTX.companyId });
      expect(options).toEqual([
        {
          templateId: '019a0000-0000-7000-8000-deadbeef0001',
          versionId: 'ver-1',
          name: '#7',
          locale: 'en-US',
          versionNumber: 7,
        },
      ]);
    });
  });

  describe('renderPdf / getRenderJob / getRenderJobArtifact', () => {
    it.each([
      ['quotation', 'quotations'], ['sales-order', 'sales-orders'],
      ['purchase-order', 'purchase-orders'], ['purchase-quotation', 'purchase-quotations'],
    ] as const)('preserves field errors on %s render, status and binary artifact requests', async (kind, segment) => {
      const error = new ApiError(422, 'TRADE.VALIDATION_FAILED', { templateVersionId: ['invalid'] });
      const base = `/${segment}/doc%2F1`;
      tradeStub.register('POST', `${base}/render-pdf`, error);
      tradeStub.register('GET', `${base}/render-jobs/job%2F1`, error);
      tradeStub.register('GET', `${base}/render-jobs/job%2F1/artifact`, error);
      await expect(renderPdf(kind, 'doc/1', { purpose: 'CUSTOMER_QUOTATION', revisionId: 'rev-1', sourceVersion: 1 }, IDEM_KEY, CTX)).rejects.toBe(error);
      await expect(getRenderJob(kind, 'doc/1', 'job/1', CTX)).rejects.toBe(error);
      await expect(getRenderJobArtifact(kind, 'doc/1', 'job/1', CTX)).rejects.toBe(error);
      expect(tradeStub.recordedWrites()[0]).toMatchObject({ method: 'POST', path: `${base}/render-pdf`, key: IDEM_KEY, scope: CTX });
      expect(tradeStub.recordedReads()).toEqual([
        { path: `${base}/render-jobs/job%2F1`, query: undefined, scope: CTX },
        { path: `${base}/render-jobs/job%2F1/artifact`, query: undefined, scope: CTX },
      ]);
    });

    it('enforces strict DTO whitelisting for quotation vs SO/PO/PQ and sends x-idempotency-key + BRANCH scope', async () => {
      tradeStub.register('POST', '/quotations/qt%2F1/render-pdf', {
        renderJobId: 'rj-1',
        status: 'PENDING',
        attemptCount: 1,
        statusUrl: '/api/tenant/trade/v1/quotations/qt%2F1/render-jobs/rj-1',
      });
      tradeStub.register('POST', '/sales-orders/so-1/render-pdf', {
        renderJobId: 'rj-2',
        status: 'PENDING',
        attemptCount: 1,
        statusUrl: '/api/tenant/trade/v1/sales-orders/so-1/render-jobs/rj-2',
      });

      await renderPdf(
        'quotation',
        'qt/1',
        { purpose: 'CUSTOMER_QUOTATION', revisionId: 'rev-1', sourceVersion: 99, templateChoice: 'BUILT_IN', locale: 'en-US' },
        IDEM_KEY,
        CTX,
      );
      await renderPdf(
        'sales-order',
        'so-1',
        { purpose: 'SALES_ORDER', revisionId: 'ignored', sourceVersion: 3, templateChoice: 'BUILT_IN', templateVersionId: 'ver-1', locale: 'ar-EG' },
        IDEM_KEY,
        CTX,
      );

      expect(tradeStub.recordedWrites()).toEqual([
        {
          method: 'POST',
          path: '/quotations/qt%2F1/render-pdf',
          body: {
            revisionId: 'rev-1',
            purpose: 'CUSTOMER_QUOTATION',
            templateChoice: 'BUILT_IN',
            locale: 'en-US',
          },
          key: IDEM_KEY,
          ifMatch: undefined,
          query: undefined,
          scope: CTX,
        },
        {
          method: 'POST',
          path: '/sales-orders/so-1/render-pdf',
          body: {
            sourceVersion: 3,
            purpose: 'SALES_ORDER',
            templateVersionId: 'ver-1',
            locale: 'ar-EG',
          },
          key: IDEM_KEY,
          ifMatch: undefined,
          query: undefined,
          scope: CTX,
        },
      ]);
    });

    it('reads render-job status and artifact blob via BRANCH scope', async () => {
      const pdfBlob = new Blob(['%PDF-1.7'], { type: 'application/pdf' });
      tradeStub.register('GET', '/purchase-orders/po-1/render-jobs/rj-9', {
        renderJobId: 'rj-9',
        status: 'COMPLETED',
        attemptCount: 1,
        statusUrl: '/api/tenant/trade/v1/purchase-orders/po-1/render-jobs/rj-9',
      });
      tradeStub.register('GET', '/purchase-orders/po-1/render-jobs/rj-9/artifact', pdfBlob);

      const job = await getRenderJob('purchase-order', 'po-1', 'rj-9', CTX);
      const blob = await getRenderJobArtifact('purchase-order', 'po-1', 'rj-9', CTX);

      expect(job.status).toBe('COMPLETED');
      expect(blob.type).toBe('application/pdf');
      expect(tradeStub.recordedReads()).toEqual([
        { path: '/purchase-orders/po-1/render-jobs/rj-9', query: undefined, scope: CTX },
        { path: '/purchase-orders/po-1/render-jobs/rj-9/artifact', query: undefined, scope: CTX },
      ]);
    });
  });

  describe('getBulkPrintArtifact', () => {
    it('reads signed bulk ZIP artifact with BRANCH scope and no idempotency key', async () => {
      tradeStub.register('GET', '/documents/bulk-prints/bj-1/artifact', {
        downloadUrl: 'https://files.example.test/bulk.zip',
        downloadExpiresAt: '2026-11-23T23:59:00.000Z',
      });

      const artifact = await getBulkPrintArtifact('bj-1', CTX);
      expect(artifact.downloadUrl).toBe('https://files.example.test/bulk.zip');
      expect(tradeStub.recordedReads()).toEqual([
        { path: '/documents/bulk-prints/bj-1/artifact', query: undefined, scope: CTX },
      ]);
    });
  });

  describe('listOpportunityOptions & embeddedSourceOpportunityOf', () => {
    it('queries CRM /opportunities with branchId, customerProfileId, status=IN_PROGRESS, limit=100 and converts Core 403 -> ApiError(403)', async () => {
      const rows = await listOpportunityOptions('prof-1', CTX);
      expect(rows).toEqual([
        { id: 'opp-1', name: 'Enterprise Fleet Expansion', stageName: 'Proposal', status: 'IN_PROGRESS' },
        { id: 'opp-2', name: 'Fallback Named Opp', stageName: '', status: 'WON' },
      ]);
      expect(crmStub.recordedReads()).toEqual([
        {
          path: '/opportunities',
          query: {
            branchId: CTX.branchId,
            customerProfileId: 'prof-1',
            status: 'IN_PROGRESS',
            page: 1,
            limit: 100,
          },
          scope: undefined,
        },
      ]);

      vi.spyOn(crmStub, 'read').mockRejectedValueOnce(new CoreApiError(403, 'FORBIDDEN'));
      await expect(listOpportunityOptions('prof-1', CTX)).rejects.toMatchObject({
        status: 403,
        code: 'FORBIDDEN',
      });
      await expect(listOpportunityOptions('   ', CTX)).resolves.toEqual([]);
    });

    it('reads additive BE-TR-OPP sourceCrmOpportunity field cleanly', () => {
      expect(
        embeddedSourceOpportunityOf({
          sourceCrmOpportunity: { id: 'opp-1', name: 'Deal', available: true },
        }),
      ).toEqual({ id: 'opp-1', name: 'Deal', available: true });
      expect(embeddedSourceOpportunityOf({ sourceCrmOpportunity: null })).toBeNull();
    });
  });
});
