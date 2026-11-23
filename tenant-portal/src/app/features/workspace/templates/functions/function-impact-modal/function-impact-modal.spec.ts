import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideTransloco, provideTranslocoScope, type Translation } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import globalEn from '../../../../../../../public/i18n/en.json';
import functionsEn from '../../../../../../../public/i18n/templates-functions/en.json';
import templatesEn from '../../../../../../../public/i18n/templates/en.json';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { TenantScopeState } from '../../../../../core/scope/tenant-scope';
import type { FunctionImpactResponseDto, FunctionUsageItemDto } from '../functions.model';
import { FunctionImpactModal } from './function-impact-modal';

class Loader {
  getTranslation(lang: string) {
    if (lang.startsWith('templates-functions/')) return of(functionsEn as Translation);
    if (lang.startsWith('templates/')) return of(templatesEn as Translation);
    return of(globalEn as Translation);
  }
}

const TEMPLATES_URL = '/api/tenant/core/v1/templates';
const FUNCTIONS_URL = `${TEMPLATES_URL}/functions`;
const FUNCTION_ID = '01948100-0000-7000-8000-00000000f001';
const VERSION_ID = '01948100-0000-7000-8000-00000000v001';
const IMPACT_ID = '01948100-0000-7000-8000-00000000a001';
const TEMPLATE_ID_1 = '01948100-0000-7000-8000-000000001001';
const TEMPLATE_ID_2 = '01948100-0000-7000-8000-000000001002';
const COMPANY_ID = '01948100-0000-7000-8000-00000000c001';
const CHECKSUM = 'a'.repeat(64);
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function makeUsageItems(): FunctionUsageItemDto[] {
  return [
    {
      templateId: TEMPLATE_ID_1,
      templateName: 'Sales Quotation',
      sourceKind: 'DRAFT',
      sourceId: '01948100-0000-7000-8000-00000000d001',
      revisionOrVersionNumber: 4,
      functionVersionId: VERSION_ID,
    },
    {
      templateId: TEMPLATE_ID_1,
      templateName: 'Sales Quotation (duplicate draft row)',
      sourceKind: 'DRAFT',
      sourceId: '01948100-0000-7000-8000-00000000d001',
      revisionOrVersionNumber: 4,
      functionVersionId: VERSION_ID,
    },
    {
      templateId: TEMPLATE_ID_2,
      templateName: 'Invoice Company',
      sourceKind: 'DRAFT',
      sourceId: '01948100-0000-7000-8000-00000000d002',
      revisionOrVersionNumber: 7,
      functionVersionId: VERSION_ID,
    },
    {
      templateId: '01948100-0000-7000-8000-000000001099',
      templateName: 'Published Only Template',
      sourceKind: 'PUBLISHED',
      sourceId: '01948100-0000-7000-8000-00000000p001',
      revisionOrVersionNumber: 2,
      functionVersionId: VERSION_ID,
    },
  ];
}

function makeImpactResponse(
  overrides: Partial<FunctionImpactResponseDto> = {},
): FunctionImpactResponseDto {
  return {
    impactId: IMPACT_ID,
    functionId: FUNCTION_ID,
    versionId: VERSION_ID,
    createdAt: '2026-11-23T12:00:00.000Z',
    expiresAt: '2099-11-23T12:15:00.000Z',
    checksum: CHECKSUM,
    state: 'PASSED',
    targets: [
      {
        templateId: TEMPLATE_ID_1,
        draftRevision: 4,
        contentChecksum: CHECKSUM,
        fixtureKey: 'sales-standard-en',
        fixtureChecksum: 'b'.repeat(64),
        previousVersionIds: ['01948100-0000-7000-8000-00000000v000'],
        proposedVersionId: VERSION_ID,
        state: 'PASSED',
        comparisons: [
          {
            nodeId: 'node-total-01',
            formulaId: 'line_net',
            previous: {
              kind: 'DECIMAL',
              value: '100.000',
              dimension: 'MONEY',
              currencyCode: 'EGP',
            },
            proposed: { kind: 'DECIMAL', value: '90.000', dimension: 'MONEY', currencyCode: 'EGP' },
          },
        ],
        totalComparisons: 1,
        truncated: false,
        issueCodes: [],
      },
    ],
    ...overrides,
  };
}

describe('FunctionImpactModal', () => {
  let fixture: ComponentFixture<FunctionImpactModal>;
  let component: FunctionImpactModal;
  let http: HttpTestingController;
  let cookieValue = 'mutakamel-http-tenant-csrf=csrf-proof';

  const notify = { info: vi.fn(), success: vi.fn(), warning: vi.fn(), error: vi.fn() };
  const me = signal({
    id: 'actor-1',
    isTenantOwner: true,
    permissions: ['templates.read', 'templates.functions.read', 'templates.functions.manage'],
    permissionScopes: {},
    accessibleCompanies: [COMPANY_ID],
    accessibleBranches: [],
    accessibleBranchCompanies: [],
  });
  const selection = signal<{ companyId: string; branchId: string | null } | null>(null);

  beforeEach(() => {
    cookieValue = 'mutakamel-http-tenant-csrf=csrf-proof';
    notify.info.mockClear();
    notify.success.mockClear();
    notify.warning.mockClear();
    notify.error.mockClear();

    vi.spyOn(document, 'cookie', 'get').mockImplementation(() => cookieValue);
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.open = true;
      },
    });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.open = false;
      },
    });

    TestBed.configureTestingModule({
      imports: [FunctionImpactModal],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslocoScope('templates', { scope: 'templates-functions', alias: 'tplFunctions' }),
        provideTransloco({
          config: {
            availableLangs: ['en'],
            defaultLang: 'en',
            missingHandler: { logMissingKey: false },
          },
          loader: Loader,
        }),
        { provide: TenantScopeState, useValue: { me, selection } },
        { provide: LanguageState, useValue: { current: signal('en') } },
        { provide: Notify, useValue: notify },
      ],
    });

    fixture = TestBed.createComponent(FunctionImpactModal);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture?.destroy();
    http.verify();
    vi.restoreAllMocks();
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
  });

  async function tick(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  }

  function openModal(usageItems: readonly FunctionUsageItemDto[] = makeUsageItems()): void {
    component.open({
      functionId: FUNCTION_ID,
      functionName: 'Line Net After Discount',
      versionId: VERSION_ID,
      versionNumber: 3,
      usageItems,
    });
    fixture.detectChanges();
  }

  async function hydrateTarget(): Promise<void> {
    http.expectOne(`${TEMPLATES_URL}/${TEMPLATE_ID_1}`).flush({
      success: true,
      data: {
        templateId: TEMPLATE_ID_1,
        dataSourceKey: 'TRADE_QUOTATION_PRINT_V1',
        dataSourceSchemaVersion: 1,
        scope: { type: 'TENANT' },
        locale: 'en-US',
        etag: '"4"',
      },
    });
    await tick();
    http
      .expectOne((r) => r.url === `${TEMPLATES_URL}/data-sources/TRADE_QUOTATION_PRINT_V1/schema`)
      .flush({
        success: true,
        data: {
          syntheticFixtures: [
            {
              fixtureKey: 'sales-standard-en',
              locale: 'en-US',
              labelKey: 'salesStandardEn',
              fixtureChecksum: CHECKSUM,
            },
          ],
        },
      });
    await tick();
  }

  it('hydrates draft target fixtures through TemplatesApi and skips non-draft or failing rows', async () => {
    openModal();
    await tick();

    expect(component['targetRows']().map((r) => r.templateId)).toEqual([
      TEMPLATE_ID_1,
      TEMPLATE_ID_2,
    ]);

    const tplReq1 = http.expectOne(`${TEMPLATES_URL}/${TEMPLATE_ID_1}`);
    const tplReq2 = http.expectOne(`${TEMPLATES_URL}/${TEMPLATE_ID_2}`);
    expect(tplReq1.request.method).toBe('GET');
    expect(tplReq2.request.method).toBe('GET');

    tplReq1.flush({
      success: true,
      data: {
        templateId: TEMPLATE_ID_1,
        dataSourceKey: 'TRADE_QUOTATION_PRINT_V1',
        dataSourceSchemaVersion: 1,
        scope: { type: 'TENANT' },
        etag: '"4"',
      },
    });
    tplReq2.flush(
      { errorCode: 'CORE.TEMPLATE.NOT_FOUND' },
      { status: 404, statusText: 'Not Found' },
    );
    await tick();

    const schemaReq = http.expectOne(
      (r) => r.url === `${TEMPLATES_URL}/data-sources/TRADE_QUOTATION_PRINT_V1/schema`,
    );
    expect(schemaReq.request.params.get('scopeType')).toBe('TENANT');
    expect(schemaReq.request.params.get('companyId')).toBeNull();
    expect(schemaReq.request.params.get('schemaVersion')).toBe('1');
    schemaReq.flush({
      success: true,
      data: {
        syntheticFixtures: [
          {
            fixtureKey: 'sales-standard-en',
            locale: 'en-US',
            labelKey: 'salesStandardEn',
            fixtureChecksum: CHECKSUM,
          },
          {
            fixtureKey: 'sales-long-48-en',
            locale: 'en-US',
            labelKey: 'salesLong48En',
            fixtureChecksum: CHECKSUM,
          },
        ],
      },
    });
    await tick();

    const rows = component['targetRows']();
    expect(rows[0].fixtureKey).toBe('sales-standard-en');
    expect(rows[0].fixtureOptions).toEqual([
      { value: 'sales-standard-en', label: templatesEn.fixtures.salesStandardEn },
      { value: 'sales-long-48-en', label: templatesEn.fixtures.salesLong48En },
    ]);
    expect(rows[1].fixtureKey).toBe('');
    expect(rows[1].selected).toBe(false);
    expect(notify.error).toHaveBeenCalled();
    expect(rows[1].fixtureOptions).toEqual([]);
    expect(component['loadingFixtures']()).toBe(false);
  });

  it('forwards COMPANY scope and schemaVersion 2 when hydrating data-source fixtures', async () => {
    openModal([
      {
        templateId: TEMPLATE_ID_2,
        templateName: 'Company Invoice',
        sourceKind: 'DRAFT',
        sourceId: '01948100-0000-7000-8000-00000000d002',
        revisionOrVersionNumber: 7,
        functionVersionId: VERSION_ID,
      },
    ]);
    await tick();

    http.expectOne(`${TEMPLATES_URL}/${TEMPLATE_ID_2}`).flush({
      success: true,
      data: {
        templateId: TEMPLATE_ID_2,
        dataSourceKey: 'TRADE_INVOICE_PRINT_V1',
        dataSourceSchemaVersion: 2,
        scope: { type: 'COMPANY', companyId: COMPANY_ID },
        etag: '"7"',
      },
    });
    await tick();

    const schemaReq = http.expectOne(
      (r) => r.url === `${TEMPLATES_URL}/data-sources/TRADE_INVOICE_PRINT_V1/schema`,
    );
    expect(schemaReq.request.params.get('scopeType')).toBe('COMPANY');
    expect(schemaReq.request.params.get('companyId')).toBe(COMPANY_ID);
    expect(schemaReq.request.params.get('schemaVersion')).toBe('2');
    schemaReq.flush({ success: true, data: { syntheticFixtures: [] } });
    await tick();
  });

  it('evaluates impact and applies to drafts via real endpoints with CSRF and UUIDv7 keys', async () => {
    openModal([makeUsageItems()[0]]);
    await tick();
    await hydrateTarget();

    const appliedEvents: unknown[] = [];
    component.applied.subscribe((res) => appliedEvents.push(res));

    const impactPromise = component['runImpactCheck']();
    const impactReq = http.expectOne(`${FUNCTIONS_URL}/${FUNCTION_ID}/impact`);
    expect(impactReq.request.method).toBe('POST');
    expect(impactReq.request.withCredentials).toBe(true);
    expect(impactReq.request.headers.get('x-csrf-token')).toBe('csrf-proof');
    expect(impactReq.request.headers.get('x-idempotency-key')).toMatch(UUID_V7);
    expect(impactReq.request.headers.has('If-Match')).toBe(false);
    expect(impactReq.request.body).toEqual({
      versionId: VERSION_ID,
      targets: [{ templateId: TEMPLATE_ID_1, draftRevision: 4, fixtureKey: 'sales-standard-en' }],
    });

    const impactDto = makeImpactResponse();
    impactReq.flush({ success: true, data: impactDto });
    await impactPromise;
    fixture.detectChanges();

    expect(component['step']()).toBe('results');
    expect(component['impactResult']()).toEqual(impactDto);

    component['goToApplyStep']();
    expect(component['step']()).toBe('apply');

    component['reason'].set('  Adopt v3 discount rounding  ');
    const applyPromise = component['submitApply']();
    const applyReq = http.expectOne(`${FUNCTIONS_URL}/${FUNCTION_ID}/apply-to-drafts`);
    expect(applyReq.request.method).toBe('POST');
    expect(applyReq.request.withCredentials).toBe(true);
    expect(applyReq.request.headers.get('x-csrf-token')).toBe('csrf-proof');
    expect(applyReq.request.headers.get('x-idempotency-key')).toMatch(UUID_V7);
    expect(applyReq.request.headers.has('If-Match')).toBe(false);
    expect(applyReq.request.body).toEqual({
      versionId: VERSION_ID,
      impactId: IMPACT_ID,
      targets: [{ templateId: TEMPLATE_ID_1, draftRevision: 4 }],
      reason: 'Adopt v3 discount rounding',
    });

    const applyDto = {
      functionId: FUNCTION_ID,
      versionId: VERSION_ID,
      updated: [
        {
          templateId: TEMPLATE_ID_1,
          draftRevision: 5,
          contentChecksum: CHECKSUM,
          validationState: 'STALE',
        },
      ],
    };
    applyReq.flush({ success: true, data: applyDto });
    await applyPromise;

    expect(notify.success).toHaveBeenCalledWith(
      '1 drafts updated. Check them again before publishing.',
    );
    expect(appliedEvents).toEqual([applyDto]);
    expect(component['isOpen']()).toBe(false);
  });

  it('rejects null and malformed receipts on /impact and /apply-to-drafts', async () => {
    openModal([makeUsageItems()[0]]);
    await tick();
    await hydrateTarget();

    for (const badBody of [
      { success: true, data: null },
      {
        success: true,
        data: makeImpactResponse({
          targets: [
            {
              ...makeImpactResponse().targets[0],
              comparisons: [
                {
                  nodeId: 'n1',
                  formulaId: 'f1',
                  previous: { kind: 'DECIMAL', value: '1', dimension: 'MONEY' },
                  proposed: {
                    kind: 'INVALID_KIND',
                    value: '2',
                  } as unknown as FunctionImpactResponseDto['targets'][0]['comparisons'][0]['proposed'],
                },
              ],
            },
          ],
        }),
      },
    ]) {
      const pending = component['runImpactCheck']();
      http.expectOne(`${FUNCTIONS_URL}/${FUNCTION_ID}/impact`).flush(badBody);
      await pending;
      expect(component['step']()).toBe('targets');
      expect(notify.error).toHaveBeenCalledWith(globalEn.apiErrors.generic);
    }

    const validImpact = component['runImpactCheck']();
    http
      .expectOne(`${FUNCTIONS_URL}/${FUNCTION_ID}/impact`)
      .flush({ success: true, data: makeImpactResponse() });
    await validImpact;
    component['goToApplyStep']();
    component['reason'].set('Apply reason');

    const appliedSpy = vi.fn();
    component.applied.subscribe(appliedSpy);

    for (const badApply of [
      { success: true, data: null },
      {
        success: true,
        data: {
          functionId: FUNCTION_ID,
          versionId: VERSION_ID,
          updated: [
            {
              templateId: TEMPLATE_ID_1,
              draftRevision: 5,
              contentChecksum: CHECKSUM,
              validationState: 'PASSED',
            },
          ],
        },
      },
    ]) {
      const pendingApply = component['submitApply']();
      http.expectOne(`${FUNCTIONS_URL}/${FUNCTION_ID}/apply-to-drafts`).flush(badApply);
      await pendingApply;
      expect(appliedSpy).not.toHaveBeenCalled();
      expect(component['isOpen']()).toBe(true);
      expect(notify.error).toHaveBeenCalledWith(globalEn.apiErrors.generic);
    }
  });

  it('retains idempotency keys across retryable failures and rotates after terminal errors or intent changes', async () => {
    openModal([makeUsageItems()[0]]);
    await tick();
    await hydrateTarget();

    let impactKey: string | null = null;
    for (const [status, code] of [
      [0, 'NETWORK_ERROR'],
      [503, 'CORE.TEMPLATE.DEPENDENCY.UNAVAILABLE'],
      [409, 'CORE.TEMPLATE.IDEMPOTENCY.IN_FLIGHT'],
      [401, 'COMMON.GENERIC.UNAUTHORIZED'],
    ] as const) {
      const pending = component['runImpactCheck']();
      const req = http.expectOne(`${FUNCTIONS_URL}/${FUNCTION_ID}/impact`);
      const key = req.request.headers.get('x-idempotency-key');
      expect(key).toMatch(UUID_V7);
      if (impactKey) expect(key).toBe(impactKey);
      impactKey = key;
      if (status === 0) req.error(new ProgressEvent('error'));
      else req.flush({ errorCode: code }, { status, statusText: 'Error' });
      await pending;
    }

    const terminalImpact = component['runImpactCheck']();
    const terminalImpactReq = http.expectOne(`${FUNCTIONS_URL}/${FUNCTION_ID}/impact`);
    expect(terminalImpactReq.request.headers.get('x-idempotency-key')).toBe(impactKey);
    terminalImpactReq.flush(
      { errorCode: 'FUNCTION_NOT_REFERENCED' },
      { status: 422, statusText: 'Unprocessable' },
    );
    await terminalImpact;
    expect(notify.error).toHaveBeenCalledWith(functionsEn.errors.FUNCTION_NOT_REFERENCED);

    const nextImpact = component['runImpactCheck']();
    const rotatedImpactReq = http.expectOne(`${FUNCTIONS_URL}/${FUNCTION_ID}/impact`);
    expect(rotatedImpactReq.request.headers.get('x-idempotency-key')).not.toBe(impactKey);
    rotatedImpactReq.flush({ success: true, data: makeImpactResponse() });
    await nextImpact;

    component['goToApplyStep']();
    component['reason'].set('First apply reason');

    let applyKey: string | null = null;
    for (const [status, code] of [
      [0, 'NETWORK_ERROR'],
      [503, 'CORE.TEMPLATE.FUNCTION.IMPACT.TIMEOUT'],
      [409, 'GW.IDEM.IN_FLIGHT'],
    ] as const) {
      const pending = component['submitApply']();
      const req = http.expectOne(`${FUNCTIONS_URL}/${FUNCTION_ID}/apply-to-drafts`);
      const key = req.request.headers.get('x-idempotency-key');
      expect(key).toMatch(UUID_V7);
      if (applyKey) expect(key).toBe(applyKey);
      applyKey = key;
      if (status === 0) req.error(new ProgressEvent('error'));
      else req.flush({ errorCode: code }, { status, statusText: 'Error' });
      await pending;
    }

    component['reason'].set('Changed apply reason');
    const changedIntent = component['submitApply']();
    const changedReq = http.expectOne(`${FUNCTIONS_URL}/${FUNCTION_ID}/apply-to-drafts`);
    const changedKey = changedReq.request.headers.get('x-idempotency-key');
    expect(changedKey).not.toBe(applyKey);
    changedReq.flush(
      { errorCode: 'FUNCTION_IMPACT_STALE' },
      { status: 409, statusText: 'Conflict' },
    );
    await changedIntent;
    expect(notify.error).toHaveBeenCalledWith(functionsEn.errors.FUNCTION_IMPACT_STALE);

    const afterTerminalApply = component['submitApply']();
    const rotatedAfterTerminal = http.expectOne(`${FUNCTIONS_URL}/${FUNCTION_ID}/apply-to-drafts`);
    expect(rotatedAfterTerminal.request.headers.get('x-idempotency-key')).not.toBe(changedKey);
    rotatedAfterTerminal.flush({
      success: true,
      data: {
        functionId: FUNCTION_ID,
        versionId: VERSION_ID,
        updated: [
          {
            templateId: TEMPLATE_ID_1,
            draftRevision: 5,
            contentChecksum: CHECKSUM,
            validationState: 'STALE',
          },
        ],
      },
    });
    await afterTerminalApply;
  });

  it('maps domain, template, rate-limit, and missing-CSRF errors through existing i18n handling', async () => {
    openModal([makeUsageItems()[0]]);
    await tick();
    await hydrateTarget();

    for (const [status, body, headers, expectedMsg] of [
      [
        412,
        { errorCode: 'CORE.TEMPLATE.CONCURRENCY.STALE_REVISION' },
        {},
        functionsEn.errors.STALE,
      ],
      [
        409,
        { errorCode: 'CORE.TEMPLATE.DEFINITION.ARCHIVED' },
        {},
        templatesEn.errors['CORE.TEMPLATE.DEFINITION.ARCHIVED'],
      ],
      [
        503,
        { errorCode: 'CORE.TEMPLATE.FUNCTION.IMPACT.TIMEOUT' },
        {},
        functionsEn.errors.CORE_TEMPLATE_FUNCTION_IMPACT_TIMEOUT,
      ],
      [
        429,
        { code: 'GW.RATE.LIMIT_EXCEEDED' },
        { 'Retry-After': '15' },
        'Too many requests. Try again in 15 s.',
      ],
    ] as const) {
      const pending = component['runImpactCheck']();
      http
        .expectOne(`${FUNCTIONS_URL}/${FUNCTION_ID}/impact`)
        .flush(body, { status, statusText: 'Error', headers });
      await pending;
      expect(notify.error).toHaveBeenCalledWith(expectedMsg);
    }

    cookieValue = '';
    const missingCsrf = component['runImpactCheck']();
    http.expectNone(() => true);
    await missingCsrf;
    expect(notify.error).toHaveBeenCalledWith(globalEn.apiErrors.permission);
  });
  it('blocks checks while fixtures load and when no compatible fixtures are available', async () => {
    openModal([makeUsageItems()[0]]);
    await tick();
    await component['runImpactCheck']();
    http.expectNone(`${FUNCTIONS_URL}/${FUNCTION_ID}/impact`);
    http.expectOne(`${TEMPLATES_URL}/${TEMPLATE_ID_1}`).flush({
      success: true,
      data: {
        templateId: TEMPLATE_ID_1,
        dataSourceKey: 'TRADE_QUOTATION_PRINT_V1',
        dataSourceSchemaVersion: 1,
        scope: { type: 'TENANT' },
        locale: 'ar-EG',
        etag: '"4"',
      },
    });
    await tick();
    http
      .expectOne((r) => r.url.endsWith('/schema'))
      .flush({
        success: true,
        data: {
          syntheticFixtures: [
            {
              fixtureKey: 'sales-standard-en',
              locale: 'en-US',
              labelKey: 'salesStandardEn',
            },
          ],
        },
      });
    await tick();
    component['toggleTarget'](TEMPLATE_ID_1, true);
    expect(component['selectedCount']()).toBe(0);
    expect(component['targetRows']()[0].fixtureOptions).toEqual([]);
    await component['runImpactCheck']();
    http.expectNone(`${FUNCTIONS_URL}/${FUNCTION_ID}/impact`);
    expect(notify.error).toHaveBeenCalledWith(globalEn.apiErrors.validation);
  });

  it('ignores responses from a prior modal session', async () => {
    openModal([makeUsageItems()[0]]);
    await tick();
    await hydrateTarget();
    const pending = component['runImpactCheck']();
    const req = http.expectOne(`${FUNCTIONS_URL}/${FUNCTION_ID}/impact`);
    component['close']();
    openModal([]);
    req.flush({ success: true, data: makeImpactResponse() });
    await pending;
    expect(component['step']()).toBe('targets');
    expect(component['impactResult']()).toBeNull();
    expect(component['isOpen']()).toBe(true);
    expect(notify.error).not.toHaveBeenCalled();
  });

  it('rejects receipts for different targets and blocks failed or expired proof application', async () => {
    openModal([makeUsageItems()[0]]);
    await tick();
    await hydrateTarget();
    const pending = component['runImpactCheck']();
    http.expectOne(`${FUNCTIONS_URL}/${FUNCTION_ID}/impact`).flush({
      success: true,
      data: makeImpactResponse({
        targets: [{ ...makeImpactResponse().targets[0], templateId: TEMPLATE_ID_2 }],
      }),
    });
    await pending;
    expect(component['impactResult']()).toBeNull();
    expect(notify.error).toHaveBeenCalledWith(globalEn.apiErrors.generic);

    component['reason'].set('Adopt new version');
    component['impactResult'].set(makeImpactResponse({ state: 'FAILED' }));
    component['goToApplyStep']();
    await component['submitApply']();
    expect(component['step']()).toBe('targets');
    component['impactResult'].set(
      makeImpactResponse({ expiresAt: new Date(Date.now() - 1).toISOString() }),
    );
    await component['submitApply']();
    http.expectNone(`${FUNCTIONS_URL}/${FUNCTION_ID}/apply-to-drafts`);
  });

  it('rejects an apply receipt that did not update all reviewed targets', async () => {
    openModal([makeUsageItems()[0]]);
    await tick();
    await hydrateTarget();
    const pending = component['runImpactCheck']();
    http
      .expectOne(`${FUNCTIONS_URL}/${FUNCTION_ID}/impact`)
      .flush({ success: true, data: makeImpactResponse() });
    await pending;
    component['reason'].set('Adopt new version');
    const emitted = vi.fn();
    component.applied.subscribe(emitted);
    const applying = component['submitApply']();
    http.expectOne(`${FUNCTIONS_URL}/${FUNCTION_ID}/apply-to-drafts`).flush({
      success: true,
      data: { functionId: FUNCTION_ID, versionId: VERSION_ID, updated: [] },
    });
    await applying;
    expect(component['isOpen']()).toBe(true);
    expect(emitted).not.toHaveBeenCalled();
    expect(notify.success).not.toHaveBeenCalled();
    expect(notify.error).toHaveBeenCalledWith(globalEn.apiErrors.generic);
  });
});
