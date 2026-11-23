import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideTransloco, type Translation } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../../../../public/i18n/templates-assignments/en.json';
import globalEn from '../../../../../../../public/i18n/en.json';
import { Notify } from '../../../../../core/notify/notify';
import { TenantScopeState } from '../../../../../core/scope/tenant-scope';
import { TestSelectionModal } from './test-selection-modal';

class Loader { getTranslation(lang: string) { return of((lang.startsWith('templates-assignments/') ? en : globalEn) as Translation); } }
const path = '/api/tenant/core/v1/templates/assignments/resolve';
const result = { evaluatedAt: '2026-11-23T00:00:00Z', selector: { documentType: 'QUOTATION', outputChannel: 'PRINT', adapterKey: 'TRADE_QUOTATION_PRINT_V1', locale: 'en-US', scope: { type: 'TENANT' } },
  chosen: null, eligibleCandidateCount: 0, orderedSelectorEpochs: [], receiptChecksum: 'receipt' };

describe('TestSelectionModal', () => {
  let fixture: ComponentFixture<TestSelectionModal>; let modal: TestSelectionModal; let http: HttpTestingController;
  beforeEach(async () => {
    vi.spyOn(document, 'cookie', 'get').mockReturnValue('mutakamel-http-tenant-csrf=csrf; __Host-mutakamel-tenant-csrf=csrf');
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.open = true; } });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.open = false; } });
    TestBed.configureTestingModule({ imports: [TestSelectionModal], providers: [provideHttpClient(), provideHttpClientTesting(),
      provideTransloco({ config: { availableLangs: ['en'], defaultLang: 'en', missingHandler: { logMissingKey: false } }, loader: Loader }),
      { provide: TenantScopeState, useValue: { me: signal({ id: 'actor' }), selection: signal(null) } },
      { provide: Notify, useValue: { success: vi.fn(), error: vi.fn() } }] });
    fixture = TestBed.createComponent(TestSelectionModal); modal = fixture.componentInstance;
    fixture.componentRef.setInput('definitions', []); fixture.componentRef.setInput('scopeOptions', [{ key: 'TENANT', scope: { type: 'TENANT' }, icon: 'tablerWorld', tile: 'bg-icon-blue', label: 'Workspace' }]);
    http = TestBed.inject(HttpTestingController); fixture.detectChanges(); await fixture.whenStable(); modal.open('TENANT');
  });
  afterEach(() => { fixture?.destroy(); http.verify(); vi.restoreAllMocks();
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal'); Reflect.deleteProperty(HTMLDialogElement.prototype, 'close'); });
  it('shows the chosen template', async () => {
    const pending = modal['runTest']();
    http.expectOne(path).flush({ success: true, data: { ...result, eligibleCandidateCount: 1, chosen: { assignmentId: 'assignment', matchedScope: { type: 'TENANT' }, localeMatch: 'EXACT', priority: 100,
      version: { templateDefinitionId: 'definition-id', templateVersionId: 'version', versionNumber: 3 } } } });
    await pending; fixture.detectChanges(); expect(fixture.nativeElement.textContent).toContain('definition-id');
    expect(modal['chosenTemplateInfo']()?.versionNumber).toBe(3); http.expectNone((r) => r.method === 'GET');
  });
  it('no candidate message', async () => {
    const pending = modal['runTest'](); http.expectOne(path).flush({ success: true, data: result }); await pending;
    fixture.detectChanges(); expect(fixture.nativeElement.textContent).toContain(en.testModal.noMatchTitle);
  });
  it('validation errors land on the fields', async () => {
    const pending = modal['runTest'](); http.expectOne(path).flush({ errorCode: 'SCHEMA.INVALID', details: { adapterKey: ['invalid'], locale: ['invalid'], 'scope.companyId': ['invalid'], businessTime: ['invalid'] } }, { status: 400, statusText: 'Invalid' });
    await pending; fixture.detectChanges(); expect(Object.keys(modal['serverErrors']()).sort()).toEqual(['businessTime', 'document', 'locale', 'scope']);
    expect(fixture.nativeElement.textContent).toContain(en.modal.fieldInvalid);
  });
});
