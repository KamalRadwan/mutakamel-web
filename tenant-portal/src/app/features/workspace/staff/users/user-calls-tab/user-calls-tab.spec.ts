import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from '../../../../../core/api/api-errors';
import type { StaffUserCallLog } from '../../shared/staff-phone.model';
import type { TenantUser } from '../../shared/staff.model';
import { UserCallsTab } from './user-calls-tab';

const path = '/api/tenant/webphone/v1/users';
const stamp = '2026-11-23T00:00:00.000Z';
const user: TenantUser = { id: 'target', firstName: 'Test', lastName: 'User', email: 'test@example.invalid',
  companyId: 'company', branchId: 'branch', departmentId: 'department', teamId: null, managerId: null,
  employeeCode: null, jobTitle: null, status: 'ACTIVE', isTenantOwner: false, seats: [], createdAt: stamp, updatedAt: stamp };
const log: StaffUserCallLog = {
  id: 'call', tenantId: 'tenant', extensionId: null, ownerId: 'target', ownerName: 'Owner',
  type: 'IN_NOANS', displayName: null, phoneNumber: '+201001234567', phoneDigits: '201001234567',
  startedAt: null, answeredAt: null, endedAt: null, durationSeconds: null, cause: 'Timeout', createdAt: stamp,
  sourceType: 'LEAD', sourceId: 'lead', sourceLabel: 'Lead', transferKind: null, conferenceId: null,
  extension: { id: 'extension', ownerType: 'TENANT_USER' },
};

describe('UserCallsTab live API', () => {
  let fixture: ComponentFixture<UserCallsTab>;
  let tab: UserCallsTab;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
      { provide: TranslocoService, useValue: { events$: new Subject(), translate: (key: string) => key } },
    ] });
    TestBed.overrideComponent(UserCallsTab, { set: { template: '', imports: [] } });
    fixture = TestBed.createComponent(UserCallsTab); tab = fixture.componentInstance;
    fixture.componentRef.setInput('user', user); fixture.detectChanges();
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('maps the nested API page into shared table rows and preserves comma-list filters', async () => {
    const pending = tab['loader']({ page: 3, limit: 10, types: ['IN_NOANS', 'OUT_BUSY'], q: 'Lead' });
    const req = http.expectOne((r) => r.url === `${path}/target/call-logs`);
    expect(req.request.params.get('type')).toBe('IN_NOANS,OUT_BUSY');
    expect(req.request.params.get('types')).toBeNull();
    expect(req.request.params.get('page')).toBe('3');
    const meta = { page: 3, limit: 10, total: 21 };
    req.flush({ success: true, data: { data: [log], meta } });
    await expect(pending).resolves.toEqual({ data: [{ id: 'call', type: 'IN_NOANS', number: log.phoneNumber,
      name: 'Lead', startedAt: stamp, durationSeconds: null, ownerName: 'Owner',
      record: { type: 'LEAD', id: 'lead', label: 'Lead' }, linkKind: null }], meta });
  });

  it('leaves incomplete record references unlinked and retains non-lead labels as plain text', async () => {
    const pending = tab['loader']({ page: 1, limit: 10 });
    http.expectOne(`${path}/target/call-logs?page=1&limit=10`).flush({ success: true, data: {
      data: [{ ...log, sourceId: null }, { ...log, sourceType: 'PARTY', sourceLabel: 'Party' }],
      meta: { page: 1, limit: 10, total: 2 },
    } });
    const result = await pending;
    expect(result.data.map((row) => row.record)).toEqual([null, null]);
    expect(result.data.map((row) => row.name)).toEqual(['Lead', 'Party']);
  });

  it('propagates permission errors to the existing translated table state', async () => {
    const pending = tab['loader']({ page: 1, limit: 10 });
    const assertion = expect(pending).rejects.toBeInstanceOf(ApiError);
    http.expectOne(`${path}/target/call-logs?page=1&limit=10`).flush({ code: 'COMMON.GENERIC.FORBIDDEN' },
      { status: 403, statusText: 'Forbidden' });
    await assertion; expect(tab['errorText']()(403)).toBe('users.calls.noAccess');
  });

  it('keeps backend failures visible through the shared error/i18n resolver', async () => {
    const pending = tab['loader']({ page: 1, limit: 10 });
    const assertion = expect(pending).rejects.toMatchObject({ status: 429, code: 'GW.RATE.LIMIT_EXCEEDED' });
    http.expectOne(`${path}/target/call-logs?page=1&limit=10`).flush({ code: 'GW.RATE.LIMIT_EXCEEDED' },
      { status: 429, statusText: 'Throttled' });
    await assertion; expect(tab['errorText']()(429)).toBeTruthy();
  });

  it('reloads when switching users and requests the new owner logs', async () => {
    fixture.componentRef.setInput('user', { ...user, id: 'next' }); fixture.detectChanges();
    expect(tab['reloadToken']()).toBe(1);
    const pending = tab['loader']({ page: 1, limit: 10 });
    http.expectOne(`${path}/next/call-logs?page=1&limit=10`).flush({ success: true,
      data: { data: [], meta: { page: 1, limit: 10, total: 0 } } });
    await expect(pending).resolves.toEqual({ data: [], meta: { page: 1, limit: 10, total: 0 } });
  });
});
