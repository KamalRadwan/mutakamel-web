import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from '../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { FAKE_ADDON_HOMES, FAKE_ADDON_WHATSAPP } from '../../billing/shared/addon-catalogue.fake';
import type { Me } from '../../staff/shared/staff.model';
import { setFakeActorOverride } from '../shared/fake-actor';
import {
  fakeGetAddonCommand,
  fakeGetBranchAddon,
  fakeGetCompanyAddon,
  fakeListCompanyActivations,
  fakeSetBranchOverride,
  fakeSetCompanyAddon,
  fakeSetCompanyApplication,
  resetActivationFake,
  setFakeAddonCommandRejection,
} from './activation.fake';
import { ActivationWriteReceipt, AddonCommandStatusResponse, SetCompanyAddonResponse } from './activation.model';

const HOMES = FAKE_ADDON_HOMES.key;
const WHATSAPP = FAKE_ADDON_WHATSAPP.key;
const REASON = 'Owner request';

async function failure(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error('expected an ApiError');
}

function actor(id: string, scopes: Me['permissionScopes']): Me {
  return { id, firstName: 'Test', lastName: 'Actor', isTenantOwner: false, permissions: Object.keys(scopes), permissionScopes: scopes };
}

const companyScope = (companyIds: string[]) => ({ tenantWide: false, companyIds, branchIds: [] });

function receipt(result: SetCompanyAddonResponse | AddonCommandStatusResponse): ActivationWriteReceipt {
  if (result.state !== 'COMMITTED') throw new Error(`expected COMMITTED, got ${result.state}`);
  return result;
}

describe('activation fake (core-app tenant/application-access)', () => {
  beforeEach(() => {
    setFakeActorOverride(null);
    resetActivationFake();
  });

  afterEach(() => setFakeActorOverride(null));

  describe('gateway idempotency key', () => {
    it('is GW.IDEM.MISSING without a key and GW.IDEM.BAD_VALUE for a non-UUIDv7 key', async () => {
      const body = { expectedActivationRevision: '3', enabled: false, reason: REASON };
      expect(await failure(fakeSetCompanyApplication('co-eg', 'crm', body, ''))).toMatchObject({ status: 400, code: 'GW.IDEM.MISSING' });
      const v4 = '3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
      expect(await failure(fakeSetCompanyApplication('co-eg', 'crm', body, v4))).toMatchObject({ status: 400, code: 'GW.IDEM.BAD_VALUE' });
    });
  });

  describe('permissions', () => {
    it('writes need applications.activation.manage: {permissions:[...]}', async () => {
      setFakeActorOverride(actor('u-read', { 'applications.activation.read': companyScope(['co-eg']) }));
      const error = await failure(
        fakeSetCompanyApplication('co-eg', 'crm', { expectedActivationRevision: '3', enabled: false, reason: REASON }, newIdempotencyKey()),
      );
      expect(error).toMatchObject({ status: 403, code: 'MISSING_REQUIRED_PERMISSIONS' });
      expect(error.details).toEqual({ permissions: ['applications.activation.manage'] });
    });

    it('reads need ANY read/manage: {anyPermissions:[...]}', async () => {
      setFakeActorOverride(actor('u-none', {}));
      const error = await failure(fakeListCompanyActivations('co-eg'));
      expect(error).toMatchObject({ status: 403, code: 'MISSING_REQUIRED_PERMISSIONS' });
      expect(error.details).toEqual({ anyPermissions: ['applications.activation.read', 'applications.activation.manage'] });
    });

    it('authority held for another company is 403 ACCESS_POLICY_BLOCKED', async () => {
      setFakeActorOverride(actor('u-sa', { 'applications.activation.manage': companyScope(['co-sa']) }));
      const error = await failure(
        fakeSetCompanyApplication('co-eg', 'crm', { expectedActivationRevision: '3', enabled: false, reason: REASON }, newIdempotencyKey()),
      );
      expect(error).toMatchObject({ status: 403, code: 'ACCESS_POLICY_BLOCKED' });
      expect(error.details).toBeUndefined();
    });
  });

  describe('closed body codec', () => {
    it('answers 400 CORE_VALIDATION_FAILED without details', async () => {
      const short = await failure(
        fakeSetCompanyApplication('co-eg', 'crm', { expectedActivationRevision: '3', enabled: false, reason: 'no' }, newIdempotencyKey()),
      );
      expect(short).toMatchObject({ status: 400, code: 'CORE_VALIDATION_FAILED' });
      expect(short.details).toBeUndefined();

      const extra = { expectedActivationRevision: '3', enabled: false, reason: REASON, note: 'x' };
      expect(await failure(fakeSetCompanyApplication('co-eg', 'crm', extra as never, newIdempotencyKey()))).toMatchObject({
        status: 400,
        code: 'CORE_VALIDATION_FAILED',
      });

      const padded = { expectedOverrideRevision: '0', mode: 'DISABLED' as const, reason: ' padded ' };
      expect(await failure(fakeSetBranchOverride('br-cai', 'crm', HOMES, padded, newIdempotencyKey()))).toMatchObject({
        code: 'CORE_VALIDATION_FAILED',
      });
    });
  });

  describe('receipts and replay', () => {
    it('replays the same receipt for the same key and body; another request under the key is 422', async () => {
      const key = newIdempotencyKey();
      const body = { expectedActivationRevision: '3', enabled: false, reason: REASON };
      const first = await fakeSetCompanyApplication('co-eg', 'crm', body, key);
      expect(first).toMatchObject({ state: 'COMMITTED', operationKind: 'SET_APPLICATION_ACTIVATION', operationRevision: '1', changed: true, resourceRevision: '4' });

      expect(await fakeSetCompanyApplication('co-eg', 'crm', body, key)).toEqual(first);
      expect(await failure(fakeSetCompanyApplication('co-eg', 'crm', { ...body, reason: 'Another reason' }, key))).toMatchObject({
        status: 422,
        code: 'IDEMPOTENCY_BODY_MISMATCH',
      });
      // The receipt key is global across the activation routes.
      const branchBody = { expectedOverrideRevision: '0', mode: 'DISABLED' as const, reason: REASON };
      expect(await failure(fakeSetBranchOverride('br-cai', 'crm', HOMES, branchBody, key))).toMatchObject({ code: 'IDEMPOTENCY_BODY_MISMATCH' });
    });

    it('an unchanged value commits changed:false at the current revision', async () => {
      const result = await fakeSetCompanyApplication('co-eg', 'crm', { expectedActivationRevision: '3', enabled: true, reason: REASON }, newIdempotencyKey());
      expect(result).toMatchObject({ changed: false, resourceRevision: '3' });
    });
  });

  describe('company application', () => {
    it('stale revision is 409 APPLICATION_ACTIVATION_REVISION_STALE; an unknown application is 409 not ready', async () => {
      expect(
        await failure(fakeSetCompanyApplication('co-eg', 'crm', { expectedActivationRevision: '2', enabled: false, reason: REASON }, newIdempotencyKey())),
      ).toMatchObject({ status: 409, code: 'APPLICATION_ACTIVATION_REVISION_STALE' });
      expect(
        await failure(fakeSetCompanyApplication('co-eg', 'hr', { expectedActivationRevision: '0', enabled: true, reason: REASON }, newIdempotencyKey())),
      ).toMatchObject({ status: 409, code: 'APPLICATION_ALLOWANCE_NOT_READY' });
    });
  });

  describe('company addon', () => {
    const homesBody = (overrides: Partial<{ expectedActivationRevision: string; enabled: boolean; definitionVersionId: string }> = {}) => ({
      expectedActivationRevision: '0',
      enabled: true,
      reason: REASON,
      definitionVersionId: FAKE_ADDON_HOMES.definitionVersionId,
      ...overrides,
    });

    it('disabling an absent binding is 409 APPLICATION_ALLOWANCE_NOT_READY', async () => {
      expect(await failure(fakeSetCompanyAddon('co-sa', 'crm', HOMES, homesBody({ enabled: false }), newIdempotencyKey()))).toMatchObject({
        status: 409,
        code: 'APPLICATION_ALLOWANCE_NOT_READY',
      });
    });

    it('enabling without the required configuration is 409 not ready, not 422', async () => {
      expect(await failure(fakeSetCompanyAddon('co-sa', 'crm', HOMES, homesBody(), newIdempotencyKey()))).toMatchObject({
        status: 409,
        code: 'APPLICATION_ALLOWANCE_NOT_READY',
      });
    });

    it('a stored binding with another definition is 409 ADDON_REVISION_STALE', async () => {
      const body = homesBody({ expectedActivationRevision: '2', enabled: false, definitionVersionId: FAKE_ADDON_WHATSAPP.definitionVersionId });
      expect(await failure(fakeSetCompanyAddon('co-eg', 'crm', HOMES, body, newIdempotencyKey()))).toMatchObject({
        status: 409,
        code: 'ADDON_REVISION_STALE',
      });
    });

    it('an unknown addon is 409 not ready (no 404 on writes)', async () => {
      expect(await failure(fakeSetCompanyAddon('co-eg', 'crm', 'crm.unknown', homesBody(), newIdempotencyKey()))).toMatchObject({
        status: 409,
        code: 'APPLICATION_ALLOWANCE_NOT_READY',
      });
    });
  });

  describe('202 activation command', () => {
    const enableWhatsapp = {
      expectedActivationRevision: '4',
      enabled: true,
      reason: REASON,
      definitionVersionId: FAKE_ADDON_WHATSAPP.definitionVersionId,
    };

    it('uses the idempotency key as commandId and string counters, then commits through the status route', async () => {
      const key = newIdempotencyKey();
      const pending = await fakeSetCompanyAddon('co-eg', 'crm', WHATSAPP, enableWhatsapp, key);
      expect(pending).toEqual({
        commandId: key,
        revision: '1',
        state: 'PENDING',
        operationKind: 'SET_ADDON_ACTIVATION',
        progress: { pageNumber: '0', validatedBranchCount: '0' },
        operationalUse: 'NOT_EVALUATED',
      });
      expect(await fakeSetCompanyAddon('co-eg', 'crm', WHATSAPP, enableWhatsapp, key)).toEqual(pending);

      expect(await fakeGetAddonCommand('co-eg', 'crm', WHATSAPP, key)).toMatchObject({
        state: 'PENDING',
        revision: '2',
        progress: { pageNumber: '1', validatedBranchCount: '100' },
      });
      expect(await fakeGetAddonCommand('co-eg', 'crm', WHATSAPP, key)).toMatchObject({
        revision: '3',
        progress: { pageNumber: '2', validatedBranchCount: '142' },
      });
      const committed = receipt(await fakeGetAddonCommand('co-eg', 'crm', WHATSAPP, key));
      expect(committed).toMatchObject({ operationKind: 'SET_ADDON_ACTIVATION', operationRevision: '1', changed: true, resourceRevision: '5' });

      expect(await fakeSetCompanyAddon('co-eg', 'crm', WHATSAPP, enableWhatsapp, key)).toEqual(committed);
      const read = await fakeGetCompanyAddon('co-eg', 'crm', WHATSAPP);
      expect(read.resource).toMatchObject({ enabled: true, revision: '5' });
    });

    it('a rejected command reads REJECTED and its key then answers 409 ADDON_REVISION_STALE', async () => {
      setFakeAddonCommandRejection('SOURCE_CHANGED');
      const key = newIdempotencyKey();
      await fakeSetCompanyAddon('co-eg', 'crm', WHATSAPP, enableWhatsapp, key);
      await fakeGetAddonCommand('co-eg', 'crm', WHATSAPP, key);
      await fakeGetAddonCommand('co-eg', 'crm', WHATSAPP, key);
      expect(await fakeGetAddonCommand('co-eg', 'crm', WHATSAPP, key)).toMatchObject({ state: 'REJECTED', revision: '4', reason: 'SOURCE_CHANGED' });
      expect(await failure(fakeSetCompanyAddon('co-eg', 'crm', WHATSAPP, enableWhatsapp, key))).toMatchObject({
        status: 409,
        code: 'ADDON_REVISION_STALE',
      });
    });

    it('only the original actor may poll; anything unknown is 403, a bad id 400', async () => {
      const key = newIdempotencyKey();
      await fakeSetCompanyAddon('co-eg', 'crm', WHATSAPP, enableWhatsapp, key);
      expect(await failure(fakeGetAddonCommand('co-eg', 'crm', WHATSAPP, newIdempotencyKey()))).toMatchObject({
        status: 403,
        code: 'ACCESS_POLICY_BLOCKED',
      });
      expect(await failure(fakeGetAddonCommand('co-eg', 'crm', HOMES, key))).toMatchObject({ code: 'ACCESS_POLICY_BLOCKED' });
      expect(await failure(fakeGetAddonCommand('co-eg', 'crm', WHATSAPP, 'not-a-uuid'))).toMatchObject({
        status: 400,
        code: 'CORE_VALIDATION_FAILED',
      });

      setFakeActorOverride(actor('u-other', { 'applications.activation.read': { tenantWide: true, companyIds: [], branchIds: [] } }));
      expect(await failure(fakeGetAddonCommand('co-eg', 'crm', WHATSAPP, key))).toMatchObject({ status: 403, code: 'ACCESS_POLICY_BLOCKED' });
    });
  });

  describe('branch override', () => {
    const branchBody = (mode: 'INHERIT' | 'DISABLED', expectedOverrideRevision: string) => ({ expectedOverrideRevision, mode, reason: REASON });

    it('an absent row reads NOT_CREATED with revision 0 and no pins', async () => {
      const read = await fakeGetBranchAddon('br-cai', 'crm', HOMES);
      expect(read.resource).toEqual({
        kind: 'BRANCH_OVERRIDE',
        state: 'NOT_CREATED',
        id: null,
        revision: '0',
        mode: null,
        definitionVersionId: null,
        configVersionId: null,
        companyApplicationEnabled: true,
        companyAddonEnabled: true,
      });
    });

    it('DISABLED creates the row with the Company definition and no configuration', async () => {
      const result = await fakeSetBranchOverride('br-cai', 'crm', HOMES, branchBody('DISABLED', '0'), newIdempotencyKey());
      expect(result).toMatchObject({ operationKind: 'SET_BRANCH_OVERRIDE', changed: true, resourceRevision: '1' });
      const read = await fakeGetBranchAddon('br-cai', 'crm', HOMES);
      expect(read.resource).toMatchObject({
        state: 'STORED',
        mode: 'DISABLED',
        revision: '1',
        definitionVersionId: FAKE_ADDON_HOMES.definitionVersionId,
        configVersionId: null,
      });
      const again = await fakeSetBranchOverride('br-cai', 'crm', HOMES, branchBody('DISABLED', '1'), newIdempotencyKey());
      expect(again).toMatchObject({ changed: false, resourceRevision: '1' });
    });

    it('INHERIT checks the revision first, then needs the Company Application and Addon on', async () => {
      expect(await failure(fakeSetBranchOverride('br-mns', 'crm', WHATSAPP, branchBody('INHERIT', '9'), newIdempotencyKey()))).toMatchObject({
        status: 409,
        code: 'ADDON_REVISION_STALE',
      });
      expect(await failure(fakeSetBranchOverride('br-mns', 'crm', WHATSAPP, branchBody('INHERIT', '1'), newIdempotencyKey()))).toMatchObject({
        status: 409,
        code: 'APPLICATION_ALLOWANCE_NOT_READY',
      });
      await fakeSetCompanyApplication('co-eg', 'crm', { expectedActivationRevision: '3', enabled: false, reason: REASON }, newIdempotencyKey());
      expect(await failure(fakeSetBranchOverride('br-alx', 'crm', HOMES, branchBody('INHERIT', '2'), newIdempotencyKey()))).toMatchObject({
        code: 'APPLICATION_ALLOWANCE_NOT_READY',
      });
      // Narrowing still works while the Company Application is off.
      expect(await fakeSetBranchOverride('br-mns', 'crm', HOMES, branchBody('DISABLED', '1'), newIdempotencyKey())).toMatchObject({ changed: true });
    });

    it('DISABLED without a Company Addon binding is 409 not ready', async () => {
      expect(await failure(fakeSetBranchOverride('br-ruh', 'crm', HOMES, branchBody('DISABLED', '0'), newIdempotencyKey()))).toMatchObject({
        status: 409,
        code: 'APPLICATION_ALLOWANCE_NOT_READY',
      });
    });

    it('an unknown branch is 403 ACCESS_POLICY_BLOCKED', async () => {
      expect(await failure(fakeSetBranchOverride('br-missing', 'crm', HOMES, branchBody('DISABLED', '0'), newIdempotencyKey()))).toMatchObject({
        status: 403,
        code: 'ACCESS_POLICY_BLOCKED',
      });
    });
  });
});
