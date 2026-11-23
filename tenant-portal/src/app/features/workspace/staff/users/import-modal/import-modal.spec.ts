import { TestBed } from '@angular/core/testing';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../../core/api/api-errors';
import { Notify } from '../../../../../core/notify/notify';
import { BulkJobsTracker } from '../../../../../shared/bulk-jobs/bulk-jobs-tracker';
import { SEAT_PREVIEW } from '../../../seats/seats.api';
import { StaffUsersApi, ImportBatchRow, InviteUserBody } from '../users.api';
import { ImportModal, importRowIndex } from './import-modal';

class EmptyLoader { getTranslation() { return of({}); } }
const invitation: InviteUserBody = {
  email: 'new@example.invalid', firstName: 'New', lastName: 'User', companyId: 'company', branchId: 'branch', departmentId: 'department',
};
const validRow: ImportBatchRow = { id: 'staged-row', rowNo: 1, status: 'VALID', data: invitation, errors: {}, resultCode: null };
const page = (data: ImportBatchRow[], hasNext = false) => ({ data,
  meta: { page: 1, limit: 100, total: data.length, totalPages: hasNext ? 2 : 1, hasNext, hasPrev: false } });

describe('staged user import', () => {
  const createImportBatch = vi.fn();
  const listImportBatchRows = vi.fn();
  const submit = vi.fn();
  const previewSeats = vi.fn();
  const notify = { error: vi.fn() };
  const showModal = HTMLDialogElement.prototype.showModal;
  const close = HTMLDialogElement.prototype.close;
  const batch = () => ({ batchId: 'batch', total: 1, valid: 1, invalid: 0,
    expiresAt: new Date(Date.now() + 86400000).toISOString() });

  beforeEach(() => {
    createImportBatch.mockReset().mockResolvedValue(batch());
    listImportBatchRows.mockReset().mockResolvedValue(page([validRow]));
    submit.mockReset().mockResolvedValue({ jobId: 'job' });
    notify.error.mockReset();
    previewSeats.mockReset().mockResolvedValue({ mode: 'DERIVED', ok: true, modules: [] });
    HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    HTMLDialogElement.prototype.close = function () { this.open = false; };
    TestBed.configureTestingModule({ providers: [
      provideTransloco({ config: { availableLangs: ['en'], defaultLang: 'en', missingHandler: { logMissingKey: false } }, loader: EmptyLoader }),
      { provide: StaffUsersApi, useValue: { createImportBatch, listImportBatchRows } },
      { provide: BulkJobsTracker, useValue: { submit } },
      { provide: SEAT_PREVIEW, useValue: previewSeats },
      { provide: Notify, useValue: notify },
    ] });
    TestBed.inject(TranslocoService).setTranslation({ users: { import: {
      rowError: 'Row {{row}}: {{message}}', counts: 'Total: {{total}} · Valid: {{valid}} · Invalid: {{invalid}}',
      recheck: 'Check the file again before importing.',
    } } }, 'en');
  });
  afterEach(() => {
    HTMLDialogElement.prototype.showModal = showModal;
    HTMLDialogElement.prototype.close = close;
    vi.restoreAllMocks();
  });
  function create(rows = [invitation]) {
    const fixture = TestBed.createComponent(ImportModal);
    fixture.detectChanges();
    const modal = fixture.componentInstance;
    modal.open();
    modal['parsedRows'].set(rows);
    fixture.detectChanges();
    return fixture;
  }

  it('stages STRICT invitations without legacy row keys, then previews seats', async () => {
    const modal = create().componentInstance;
    await modal['checkImport']();
    expect(createImportBatch).toHaveBeenCalledExactlyOnceWith({ rows: [invitation], mode: 'STRICT' }, expect.any(String));
    expect(previewSeats).toHaveBeenCalledExactlyOnceWith([{ kind: 'IMPORT', rows: [invitation] }]);
    expect(modal['batch']()).toMatchObject({ batchId: 'batch', valid: 1 });
    expect(modal['canImport']()).toBe(true);
  });

  it('converts CSV rows to invitation DTOs without name or roleName keys', async () => {
    const fixture = create();
    fixture.componentRef.setInput('companies', [{ id: 'company', code: 'CO' }]);
    fixture.componentRef.setInput('branches', [{ id: 'branch', companyId: 'company', code: 'BR' }]);
    fixture.componentRef.setInput('departments', [{ id: 'department', branchId: 'branch', code: 'DP' }]);
    fixture.componentRef.setInput('roles', [{ id: 'role', name: 'Reader' }]);
    const modal = fixture.componentInstance;
    await modal['onFilePicked']({ name: 'users.csv', text: async () =>
      'email,firstName,lastName,companyCode,branchCode,departmentCode,roleName\nnew@example.invalid,New,User,CO,BR,DP,Reader',
    } as File);
    fixture.detectChanges();
    await modal['checkImport']();
    expect(createImportBatch).toHaveBeenCalledWith({ rows: [{ ...invitation, roleAssignments: [{ branchId: 'branch', roleId: 'role' }] }], mode: 'STRICT' }, expect.any(String));
  });

  it('renders counts and INVALID row field errors from every page', async () => {
    createImportBatch.mockResolvedValue({ ...batch(), total: 3, invalid: 2 });
    listImportBatchRows.mockResolvedValueOnce(page([{ ...validRow, status: 'INVALID', errors: { email: ['duplicate'] } }], true))
      .mockResolvedValueOnce(page([{ ...validRow, id: 'invalid-2', rowNo: 3, status: 'INVALID', errors: { employeeCode: ['taken'] } }]));
    const fixture = create();
    await fixture.componentInstance['checkImport']();
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent;
    expect(text).toContain('Total: 3 · Valid: 1 · Invalid: 2');
    expect(text).toContain('email: duplicate');
    expect(text).toContain('employeeCode: taken');
    expect(listImportBatchRows).toHaveBeenNthCalledWith(2, 'batch', { status: 'INVALID', page: 2, limit: 100 });
  });

  it.each(['ALL_OR_NOTHING', 'SKIP_ROLES_THAT_DONT_FIT'] as const)('submits all VALID staging ids with %s', async (mode) => {
    const fixture = create();
    const modal = fixture.componentInstance;
    modal['onModeChange'](mode);
    fixture.detectChanges();
    await modal['checkImport']();
    expect(createImportBatch).toHaveBeenCalledWith({ rows: [invitation], mode: mode === 'ALL_OR_NOTHING' ? 'STRICT' : 'SKIP_ROLES_THAT_DONT_FIT' }, expect.any(String));
    listImportBatchRows.mockResolvedValueOnce(page([validRow], true))
      .mockResolvedValueOnce(page([{ ...validRow, id: 'row-page-2' }]));
    await modal['runImport']();
    expect(listImportBatchRows).toHaveBeenNthCalledWith(1, 'batch', { status: 'VALID', page: 1, limit: 100 });
    expect(listImportBatchRows).toHaveBeenNthCalledWith(2, 'batch', { status: 'VALID', page: 2, limit: 100 });
    expect(submit).toHaveBeenCalledExactlyOnceWith('core', {
      module: 'core.users', action: 'IMPORT', scope: {}, selection: { kind: 'IDS', ids: ['staged-row', 'row-page-2'] },
      params: { batchId: 'batch', confirmAddonCascade: false, skipRolesThatDontFit: mode === 'SKIP_ROLES_THAT_DONT_FIT' },
    }, { idempotencyKey: expect.any(String) });
    expect((fixture.nativeElement as HTMLElement).querySelector('dialog')?.open).toBe(false);
  });

  it.each(['rows', 'mode', 'file'] as const)('clears the batch when %s changes', async (change) => {
    const fixture = create();
    const modal = fixture.componentInstance;
    await modal['checkImport']();
    if (change === 'rows') modal['parsedRows'].set([{ ...invitation, email: 'changed@example.invalid' }]);
    else if (change === 'mode') modal['onModeChange']('SKIP_ROLES_THAT_DONT_FIT');
    else modal['onFileRejected']('type');
    fixture.detectChanges();
    expect(modal['batch']()).toBeNull();
    expect(modal['canImport']()).toBe(false);
  });

  it.each([[410, 'IMPORT_BATCH_EXPIRED'], [404, 'IMPORT_BATCH_NOT_FOUND']] as const)('requires another check on %s', async (status, code) => {
    const fixture = create();
    const modal = fixture.componentInstance;
    await modal['checkImport']();
    listImportBatchRows.mockRejectedValue(new ApiError(status, code));
    await modal['runImport']();
    fixture.detectChanges();
    expect(modal['batch']()).toBeNull();
    expect(modal['canImport']()).toBe(false);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Check the file again');
    expect((fixture.nativeElement as HTMLElement).querySelector('dialog')?.open).toBe(true);
    expect(submit).not.toHaveBeenCalled();
  });

  it('keeps an already-submitted batch open with the specific message', async () => {
    const fixture = create();
    const modal = fixture.componentInstance;
    await modal['checkImport']();
    submit.mockRejectedValue(new ApiError(409, 'IMPORT_BATCH_ALREADY_SUBMITTED'));
    await modal['runImport']();
    expect(modal['batchError']()).toBe('users.errors.IMPORT_BATCH_ALREADY_SUBMITTED');
    expect((fixture.nativeElement as HTMLElement).querySelector('dialog')?.open).toBe(true);
    expect(modal['canImport']()).toBe(false);
  });

  it('disables import for a batch with no valid rows', async () => {
    createImportBatch.mockResolvedValue({ ...batch(), valid: 0, invalid: 1 });
    listImportBatchRows.mockResolvedValue(page([{ ...validRow, status: 'INVALID', errors: { email: ['duplicate'] } }]));
    const modal = create().componentInstance;
    await modal['checkImport']();
    await modal['runImport']();
    expect(modal['canImport']()).toBe(false);
    expect(submit).not.toHaveBeenCalled();
  });

  it('stages more than 500 rows without requesting an oversized seat preview', async () => {
    const modal = create(Array.from({ length: 501 }, (_, index) => ({ ...invitation, email: `${index}@example.invalid` }))).componentInstance;
    await modal['checkImport']();
    expect(previewSeats).not.toHaveBeenCalled();
    expect(modal['canImport']()).toBe(true);
  });
});

describe('importRowIndex', () => {
  it('reads the 0-based row from the decimal string array details.index', () => {
    expect(importRowIndex(new ApiError(409, 'TENANT_EMAIL_TAKEN', { index: ['0'] }))).toBe(0);
    expect(importRowIndex(new ApiError(409, 'TENANT_EMAIL_TAKEN', { index: ['12'] }))).toBe(12);
  });

  it('is null without a string-array index', () => {
    expect(importRowIndex(new ApiError(409, 'TENANT_EMAIL_TAKEN'))).toBeNull();
    expect(importRowIndex(new ApiError(409, 'TENANT_EMAIL_TAKEN', { index: 0 }))).toBeNull();
    expect(importRowIndex(new ApiError(409, 'TENANT_EMAIL_TAKEN', { index: ['x'] }))).toBeNull();
  });

});
