import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { TranslocoService, provideTransloco, type Translation } from '@jsverse/transloco';
import { firstValueFrom, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import globalEn from '../../../../../../../public/i18n/en.json';
import designerEn from '../../../../../../../public/i18n/templates-designer/en.json';
import fieldsEn from '../../../../../../../public/i18n/templates-designer-fields/en.json';
import toolsEn from '../../../../../../../public/i18n/templates-designer-tools/en.json';
import templatesPageEn from '../../../../../../../public/i18n/templates-page/en.json';
import templatesEn from '../../../../../../../public/i18n/templates/en.json';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { ScopeState } from '../../../../../core/scope/scope';
import { TenantScopeState } from '../../../../../core/scope/tenant-scope';
import { TemplatePageService } from '../../template-page/template-page.service';
import type {
  TemplateCapabilityState,
  TemplateDefinitionDetail,
  TemplateDraftDto,
} from '../../templates.model';
import { DesignerState } from '../designer-state';
import { Ribbon } from './ribbon';

class TestTranslocoLoader {
  getTranslation(lang: string) {
    if (lang.startsWith('templates-designer-tools/')) return of(toolsEn as unknown as Translation);
    if (lang.startsWith('templates-designer-fields/')) return of(fieldsEn as unknown as Translation);
    if (lang.startsWith('templates-designer/')) return of(designerEn as unknown as Translation);
    if (lang.startsWith('templates-page/')) return of(templatesPageEn as unknown as Translation);
    if (lang.startsWith('templates/')) return of(templatesEn as unknown as Translation);
    return of({
      ...globalEn,
      templates: templatesEn,
      templatesPage: templatesPageEn,
      tplDesigner: designerEn,
      tplFields: fieldsEn,
      tplTools: toolsEn,
    } as unknown as Translation);
  }
}

const TEMPLATES_BASE = '/api/tenant/core/v1/templates';
const TEMPLATE_ID = '01948100-0000-7000-8000-000000001001';
const DRAFT_ID = '01948100-0000-7000-8000-000000002001';
const CHECKSUM = 'a'.repeat(64);

function cap(state: TemplateCapabilityState = 'ENABLED') {
  return { state, reason: null };
}

function makeDefinition(): TemplateDefinitionDetail {
  return {
    templateId: TEMPLATE_ID,
    thumbnail: { state: 'PENDING', sourceChecksum: CHECKSUM },
    code: 'SALES_QUOTE',
    name: 'Sales Quotation',
    description: null,
    documentType: 'QUOTATION',
    outputChannel: 'PRINT',
    layoutMode: 'HYBRID_DOCUMENT',
    dataSourceKey: 'TRADE_QUOTATION_PRINT_V1',
    dataSourceSchemaVersion: 1,
    dataSourceSchemaChecksum: CHECKSUM,
    locale: 'en-US',
    direction: 'LTR',
    resolvedDirection: 'LTR',
    scope: { type: 'TENANT' },
    lifecycleStatus: 'ACTIVE',
    systemProtected: false,
    revision: 1,
    etag: '"1"',
    currentDraft: {
      draftId: DRAFT_ID,
      revision: 1,
      contentChecksum: CHECKSUM,
      validationState: 'PASSED',
      etag: '"1"',
    },
    currentPublishedVersion: null,
    createdAt: '2026-11-20T10:00:00Z',
    createdBy: { kind: 'USER', actorId: 'actor-1', displayName: 'User' },
    updatedAt: '2026-11-22T10:00:00Z',
    updatedBy: { kind: 'USER', actorId: 'actor-1', displayName: 'User' },
    archivedAt: null,
    capabilities: {
      update: cap('ENABLED'),
      validate: cap('ENABLED'),
      publish: cap('ENABLED'),
      preview: cap('ENABLED'),
      previewPdf: cap('ENABLED'),
      restoreVersion: cap('HIDDEN'),
      manageRecovery: cap('ENABLED'),
      restoreRecovery: cap('ENABLED'),
      manageAssets: cap('ENABLED'),
      retireVersion: cap('HIDDEN'),
      archive: cap('ENABLED'),
      restore: cap('HIDDEN'),
      delete: cap('ENABLED'),
      manageAssignments: cap('ENABLED'),
    },
  };
}

function makeDraft(): TemplateDraftDto {
  return {
    draftId: DRAFT_ID,
    templateId: TEMPLATE_ID,
    editorDocument: {
      schemaVersion: 1,
      documentType: 'QUOTATION',
      outputChannel: 'PRINT',
      layoutMode: 'HYBRID_DOCUMENT',
      dataSourceKey: 'TRADE_QUOTATION_PRINT_V1',
      locale: 'en-US',
      direction: 'LTR',
      page: {
        unit: 'MM',
        preset: 'A4',
        widthMm: 210,
        heightMm: 297,
        orientation: 'PORTRAIT',
        marginMm: { top: 12, end: 12, bottom: 12, start: 12 },
      },
      theme: {
        fontFamilyToken: 'SYSTEM_SANS',
        baseFontSizePx: 12,
        textColor: '#12141c',
        lineHeight: 1.4,
      },
      rootNodeIds: [],
      nodes: {},
    },
    schemaVersion: 1,
    contentChecksum: CHECKSUM,
    baseVersionId: null,
    restoreSourceVersionId: null,
    validation: {
      state: 'PASSED',
      lastValidationRunId: null,
      validatedDraftRevision: 1,
      errorCount: 0,
      warningCount: 0,
    },
    revision: 1,
    etag: '"1"',
    updatedAt: '2026-11-22T10:00:00Z',
    updatedBy: { kind: 'USER', actorId: 'actor-1', displayName: 'User' },
  };
}

describe('Ribbon', () => {
  let fixture: ComponentFixture<Ribbon>;
  let state: DesignerState;
  let http: HttpTestingController;

  beforeEach(async () => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );

    TestBed.configureTestingModule({
      imports: [Ribbon],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTransloco({
          config: { availableLangs: ['en'], defaultLang: 'en', missingHandler: { logMissingKey: false } },
          loader: TestTranslocoLoader,
        }),
        TemplatePageService,
        DesignerState,
        {
          provide: TenantScopeState,
          useValue: {
            me: signal({ id: 'actor-1', isTenantOwner: true, permissions: ['templates.read', 'templates.update'], permissionScopes: {} }),
            selection: signal(null),
          },
        },
        { provide: ScopeState, useValue: { companies: signal([]) } },
        { provide: LanguageState, useValue: { current: signal('en') } },
        { provide: Notify, useValue: { info: vi.fn(), success: vi.fn(), warning: vi.fn(), error: vi.fn() } },
      ],
    });

    await firstValueFrom(TestBed.inject(TranslocoService).load('en'));
    state = TestBed.inject(DesignerState);
    http = TestBed.inject(HttpTestingController);

    const initPromise = state.init(TEMPLATE_ID);
    http.expectOne(`${TEMPLATES_BASE}/${TEMPLATE_ID}`).flush({ success: true, data: makeDefinition() });
    await Promise.resolve();
    await new Promise<void>((r) => setTimeout(r, 0));
    http.expectOne(`${TEMPLATES_BASE}/${TEMPLATE_ID}/draft`).flush({ success: true, data: makeDraft() });
    await Promise.resolve();
    await new Promise<void>((r) => setTimeout(r, 0));
    http
      .expectOne((req) => req.url === `${TEMPLATES_BASE}/data-sources/TRADE_QUOTATION_PRINT_V1/schema`)
      .flush({
        success: true,
        data: {
          adapterKey: 'TRADE_QUOTATION_PRINT_V1',
          productionAssignmentEnabled: true,
          productionDisabledReason: null,
          schemaVersion: 1,
          schemaChecksum: CHECKSUM,
          documentType: 'QUOTATION',
          allowedOutputChannels: ['PRINT'],
          allowedLayoutModes: ['HYBRID_DOCUMENT'],
          supportedLocales: ['en-US'],
          fieldCount: 0,
          fields: [],
          syntheticFixtures: [],
        },
      });
    await initPromise;

    fixture = TestBed.createComponent(Ribbon);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture?.destroy();
    http.verify();
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('starts at 100% MANUAL zoom, keeps Fit width and Fit page in the zoom menu, and toggles fit from MANUAL', () => {
    const el = fixture.nativeElement as HTMLElement;
    const zoomBtn = el.querySelector<HTMLButtonElement>('[data-ribbon-tool="zoom"]');
    expect(zoomBtn?.textContent).toContain('100%');
    expect(state.zoomMode()).toBe('MANUAL');
    expect(state.zoom()).toBe(1);

    zoomBtn?.click();
    fixture.detectChanges();

    const menuItems = Array.from(el.querySelectorAll<HTMLButtonElement>('[role="menu"] button'));
    const labels = menuItems.map((btn) => btn.textContent?.trim());
    expect(labels).toContain('Fit width');
    expect(labels).toContain('Fit page');
    const selected = menuItems.find((btn) => btn.getAttribute('aria-checked') === 'true');
    expect(selected?.textContent?.trim()).toBe('100%');

    // Close zoom menu and test ribbon fit toggle starting from MANUAL
    zoomBtn?.click();
    fixture.detectChanges();

    const fitBtn = el.querySelector<HTMLButtonElement>('[data-ribbon-tool="fit"]');
    expect(fitBtn).not.toBeNull();
    expect(fitBtn?.getAttribute('aria-pressed')).toBe('false');

    fitBtn?.click();
    fixture.detectChanges();
    expect(state.zoomMode()).toBe('FIT_WIDTH');
    expect(fitBtn?.getAttribute('aria-pressed')).toBe('true');

    fitBtn?.click();
    fixture.detectChanges();
    expect(state.zoomMode()).toBe('FIT_PAGE');
  });

  it('merges the right group into one compact segment and toggles fullscreen state', () => {
    const el = fixture.nativeElement as HTMLElement;
    const fullscreenBtn = el.querySelector<HTMLButtonElement>('[data-ribbon-tool="fullscreen"]');
    expect(fullscreenBtn).not.toBeNull();
    expect(fullscreenBtn?.getAttribute('aria-pressed')).toBe('false');
    expect(fullscreenBtn?.getAttribute('aria-label')).toBe('Fullscreen');

    const fullscreenWrapper = fullscreenBtn?.closest('[data-fit-item]');
    expect(fullscreenWrapper?.classList.contains('bg-neutral-soft')).toBe(true);
    expect(fullscreenWrapper?.classList.contains('rounded-e-8')).toBe(true);

    fullscreenBtn?.click();
    fixture.detectChanges();
    expect(state.fullscreen()).toBe(true);
    expect(fullscreenBtn?.getAttribute('aria-pressed')).toBe('true');
    expect(fullscreenBtn?.getAttribute('aria-label')).toBe('Exit fullscreen');

    fullscreenBtn?.click();
    fixture.detectChanges();
    expect(state.fullscreen()).toBe(false);
    expect(fullscreenBtn?.getAttribute('aria-pressed')).toBe('false');
  });
});
