import { DOCUMENT } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthSession } from '../../../../core/auth/auth-session';
import type { TenantMe } from '../../../../core/auth/auth-session.model';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { EmailApi } from './email.api';
import type { TenantEmailConfig } from './email.model';

const config: TenantEmailConfig = {
  revision: 1,
  fromAddress: 'mail@example.test',
  fromName: 'Workspace',
  replyTo: null,
  senderDomain: 'example.test',
  providerDriver: 'smtp',
  credentialsMode: 'TENANT_ENCRYPTED_SMTP',
  providerCredentialsConfigured: true,
  providerCredentialsVersion: null,
  providerCredentialsRefFingerprint: null,
  smtpHost: 'smtp.example.test',
  smtpPort: 587,
  smtpSecure: true,
  smtpProtocol: 'smtp',
  smtpUsername: 'mail@example.test',
  smtpPasswordConfigured: true,
  feedbackProfile: 'CRM_FEEDBACK_V1',
  dkimSelector: 'mail',
  dkimVerified: false,
  verifiedAt: null,
  planDailyQuota: 1000,
  planRateLimitPerMin: 100,
  planQuotaRevision: 1,
  dailyQuota: null,
  rateLimitPerMin: null,
  effectiveDailyQuota: 1000,
  effectiveRateLimitPerMin: 100,
  status: 'SUSPENDED',
  updatedAt: '2026-11-23T00:00:00Z',
};
const user: TenantMe = {
  id: 'actor',
  email: 'manager@example.test',
  firstName: 'Manager',
  lastName: 'User',
  hasAvatar: false,
  isTenantOwner: true,
  mfaEnabled: false,
  mfaUpdatedAt: null,
  status: 'ACTIVE',
  permissions: ['workspace.email.read', 'workspace.email.manage'],
  permissionScopes: {},
  accessibleBranches: [],
  accessibleCompanies: [],
  accessibleBranchCompanies: [],
  seats: [],
  teamMemberships: [],
  accessScope: {
    mode: 'FULL',
    branchesTruncated: false,
    companiesTruncated: false,
    teamMembershipsTruncated: false,
    teamMembershipsTotal: 0,
  },
  featureEntitlements: {},
};

const base = '/api/tenant/core/v1';
describe('EmailApi contract', () => {
  let api: EmailApi;
  let http: HttpTestingController;
  let cookie: string;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthSession, useValue: { me: signal(user) } },
      ],
    });
    const doc = TestBed.inject(DOCUMENT);
    cookie = `${doc.location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf'}=proof`;
    vi.spyOn(doc, 'cookie', 'get').mockImplementation(() => cookie);
    api = TestBed.inject(EmailApi);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  it('config read returns data and ETag', async () => {
    const pending = api.getEmailConfig();
    const req = http.expectOne(`${base}/email-config`);
    expect(req.request.withCredentials).toBe(true);
    req.flush({ success: true, data: config }, { headers: { ETag: '"custom"' } });
    await expect(pending).resolves.toEqual({ config, etag: '"custom"' });
  });
  it('malformed config → COMMON.GENERIC.INTERNAL_ERROR', async () => {
    for (const body of [
      {},
      { success: true, data: {} },
      { success: true, data: { ...config, smtpPasswordConfigured: 'yes' } },
    ]) {
      const pending = api.getEmailConfig();
      http.expectOne(`${base}/email-config`).flush(body);
      await expect(pending).rejects.toMatchObject({ code: 'COMMON.GENERIC.INTERNAL_ERROR' });
    }
  });
  it('patch sends If-Match and key and stores the new ETag', async () => {
    const key = newIdempotencyKey();
    const pending = api.patchEmailConfig({ fromName: 'Updated' }, '"1"', key);
    const req = http.expectOne(`${base}/email-config`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.headers.get('If-Match')).toBe('"1"');
    expect(req.request.headers.get('x-idempotency-key')).toBe(key);
    expect(req.request.headers.get('x-csrf-token')).toBe('proof');
    req.flush({ success: true, data: { ...config, revision: 2 } }, { headers: { ETag: '"2"' } });
    await expect(pending).resolves.toMatchObject({ etag: '"2"' });
    expect(api['queries'].getQueryData(['ws-email', user.id, 'config'])).toMatchObject({
      etag: '"2"',
    });
    expect(api['queries'].getQueryState(['ws-email', user.id, 'config'])?.isInvalidated).toBe(true);
  });
  it('patch key reuse on retry', async () => {
    const body = { fromName: 'Updated' };
    const key = newIdempotencyKey();
    for (let attempt = 0; attempt < 2; attempt++) {
      const pending = api.patchEmailConfig(body, '"1"', key);
      const req = http.expectOne(`${base}/email-config`);
      expect(req.request.body).toEqual(body);
      expect(req.request.headers.get('x-idempotency-key')).toBe(key);
      req.flush({ errorCode: 'GW.IDEM.IN_FLIGHT' }, { status: 409, statusText: 'Conflict' });
      await expect(pending).rejects.toMatchObject({ code: 'GW.IDEM.IN_FLIGHT' });
    }
  });
  it('patch without CSRF sends nothing', async () => {
    cookie = '';
    await expect(
      api.patchEmailConfig({ fromName: 'Updated' }, '"1"', newIdempotencyKey()),
    ).rejects.toMatchObject({ code: 'GW.AUTH.CSRF_INVALID' });
    http.expectNone(`${base}/email-config`);
  });
  it('verify sends no body', async () => {
    const key = newIdempotencyKey();
    const pending = api.verifyEmailDomain('"1"', key);
    const req = http.expectOne(`${base}/email-config/verify`);
    expect(req.request.body).toBeNull();
    expect(req.request.detectContentTypeHeader()).toBeNull();
    expect(req.request.headers.has('Content-Type')).toBe(false);
    expect(req.request.headers.get('If-Match')).toBe('"1"');
    expect(req.request.headers.get('x-idempotency-key')).toBe(key);
    req.flush(
      { success: true, data: { ...config, revision: 2, dkimVerified: true } },
      { status: 201, statusText: 'Created', headers: { ETag: '"2"' } },
    );
    await expect(pending).resolves.toMatchObject({
      etag: '"2"',
      config: { dkimVerified: true, status: 'SUSPENDED' },
    });
  });
  it('verify-connection sends no body and no If-Match', async () => {
    const key = newIdempotencyKey();
    const pending = api.verifySmtpConnection(key);
    const req = http.expectOne(`${base}/email-config/verify-connection`);
    expect(req.request.body).toBeNull();
    expect(req.request.detectContentTypeHeader()).toBeNull();
    expect(req.request.headers.has('If-Match')).toBe(false);
    expect(req.request.headers.get('x-idempotency-key')).toBe(key);
    req.flush({ success: true, data: { verified: true } }, { status: 201, statusText: 'Created' });
    await expect(pending).resolves.toEqual({ verified: true });
  });
  it('send-test sends no body and accepts 202', async () => {
    const key = newIdempotencyKey();
    const pending = api.sendTestEmail(key);
    const req = http.expectOne(`${base}/email-config/send-test`);
    expect(req.request.body).toBeNull();
    expect(req.request.detectContentTypeHeader()).toBeNull();
    expect(req.request.headers.has('If-Match')).toBe(false);
    expect(req.request.headers.get('x-idempotency-key')).toBe(key);
    req.flush({ success: true, data: null }, { status: 202, statusText: 'Accepted' });
    await pending;
  });
  it('lookup sends no key', async () => {
    for (const data of [
      { suppressed: false },
      {
        suppressed: true,
        reasonCode: 'COMPLAINT',
        firstOccurredAt: '2026-01-01',
        lastOccurredAt: '2026-01-02',
      },
    ]) {
      const pending = api.lookupSuppression('reader@example.test');
      const req = http.expectOne(`${base}/email-suppressions/lookup`);
      expect(req.request.body).toEqual({ address: 'reader@example.test' });
      expect(req.request.headers.has('x-idempotency-key')).toBe(false);
      req.flush({ success: true, data });
      await expect(pending).resolves.toEqual(data);
    }
  });
  it('lift sends a key', async () => {
    for (const lifted of [true, false]) {
      const key = newIdempotencyKey();
      const pending = api.liftSuppression('reader@example.test', key);
      const req = http.expectOne(`${base}/email-suppressions/lift`);
      expect(req.request.headers.get('x-idempotency-key')).toBe(key);
      req.flush({ success: true, data: { suppressed: false, lifted } });
      await expect(pending).resolves.toEqual({ suppressed: false, lifted });
    }
  });
  it('config without ETag falls back to the quoted revision', async () => {
    const pending = api.getEmailConfig();
    http.expectOne(`${base}/email-config`).flush({ success: true, data: config });
    await expect(pending).resolves.toMatchObject({ etag: '"1"' });
  });
  it('never puts write-only fields in cached config or query keys', async () => {
    const pending = api.patchEmailConfig(
      { smtpPassword: 'test-only-secret' },
      '"1"',
      newIdempotencyKey(),
    );
    http
      .expectOne(`${base}/email-config`)
      .flush({ success: true, data: { ...config, smtpPassword: 'must-not-be-cached' } });
    const result = await pending;
    expect(result.config).not.toHaveProperty('smtpPassword');
    for (const query of api['queries'].getQueryCache().getAll()) {
      expect(query.queryKey).toEqual(['ws-email', user.id, 'config']);
      expect(query.state.data).toMatchObject({ config });
      expect(query.state.data).not.toHaveProperty('config.smtpPassword');
    }
  });
});
