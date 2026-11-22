import { Injectable } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { type Translation, TranslocoLoader, provideTransloco } from '@jsverse/transloco';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Notify } from '../../../../../core/notify/notify';
import { TemplateApiError } from '../../templates.api';
import type { CreateTemplateResponse } from '../../templates.model';
import { TemplateCreateWizard } from './create-wizard';

/*
 * The wizard runs on the real templates fake (vi.mock of relative modules is not supported by the
 * Angular unit-test builder). Every fake call waits on a timer, so the clock is driven by hand.
 */

const SCOPED: Record<string, Translation> = {
  'templates-create/en': {
    details: {
      errors: {
        nameRequired: 'Name required',
        nameTooLong: 'Name too long',
        codeRequired: 'Code required',
        codeTooLong: 'Code too long',
        codePattern: 'Code pattern',
        scopeRequired: 'Scope required',
        descriptionTooLong: 'Description too long',
      },
    },
    page: {
      errors: {
        widthRange: 'Width range',
        heightRange: 'Height range',
        marginRange: 'Margin range',
        printableAreaInvalid: 'Printable area invalid',
      },
    },
    errors: { 'CORE.TEMPLATE.PAGE.MISSING': 'Page missing (local)' },
  },
  'templates/en': {
    errors: {
      generic: 'Generic error',
      network: 'Network error',
      'CORE.TEMPLATE.CODE.CONFLICT': 'Code already in use',
    },
  },
};

/** Answers on a later microtask: a synchronous loader writes signals during render (NG0600). */
@Injectable()
class AsyncLoader implements TranslocoLoader {
  getTranslation(path: string) {
    return Promise.resolve(SCOPED[path] ?? {});
  }
}

const dialogProto = HTMLDialogElement.prototype as unknown as Record<string, unknown>;
const originalDialog = { showModal: dialogProto['showModal'], close: dialogProto['close'] };
const originalCreateUrl = URL.createObjectURL;
const originalRevokeUrl = URL.revokeObjectURL;

// Protected members are reached through this view on purpose: the spec drives the wizard state directly.
type Internals = Record<string, any>;

let fixture: ComponentFixture<TemplateCreateWizard>;
let c: Internals;
let notify: Notify;
let router: Router;

async function flush(ms = 1000): Promise<void> {
  fixture.detectChanges();
  await vi.advanceTimersByTimeAsync(ms);
  fixture.detectChanges();
}

async function openWizard(): Promise<void> {
  fixture.componentInstance.open();
  await flush();
}

function fillValidDetails(code = 'TPL-SPEC-NEW'): void {
  c['onNameInput']('Spec quotation');
  c['onCodeInput'](code);
  c['onDescriptionInput']('  Written by the spec  ');
}

async function goNext(): Promise<void> {
  c['goNext']();
  await flush();
}

let codeSeq = 0;
function uniqueCode(): string {
  codeSeq += 1;
  return `TPL-SPEC-${Date.now().toString(36).toUpperCase()}-${codeSeq}`;
}

beforeEach(async () => {
  vi.useFakeTimers();
  dialogProto['showModal'] = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  dialogProto['close'] = function (this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    // Browsers fire `close` as a queued task, after the caller has settled its own choice.
    setTimeout(() => this.dispatchEvent(new Event('close')), 0);
  };
  let urlSeq = 0;
  URL.createObjectURL = vi.fn(() => `blob:starter-${++urlSeq}`);
  URL.revokeObjectURL = vi.fn();

  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideTransloco({
        config: { availableLangs: ['ar', 'en'], defaultLang: 'en', missingHandler: { logMissingKey: false } },
        loader: AsyncLoader,
      }),
    ],
  });
  notify = TestBed.inject(Notify);
  router = TestBed.inject(Router);
  vi.spyOn(router, 'navigate').mockResolvedValue(true);
  fixture = TestBed.createComponent(TemplateCreateWizard);
  c = fixture.componentInstance as unknown as Internals;
  await flush();
});

afterEach(() => {
  fixture.destroy();
  TestBed.resetTestingModule();
  dialogProto['showModal'] = originalDialog.showModal;
  dialogProto['close'] = originalDialog.close;
  URL.createObjectURL = originalCreateUrl;
  URL.revokeObjectURL = originalRevokeUrl;
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('TemplateCreateWizard: opening and initial data', () => {
  it('opens on Details, loads the creation scopes and the data sources, and is not dirty', async () => {
    await openWizard();

    expect(c['isOpen']()).toBe(true);
    expect(c['step']()).toBe('details');
    expect(c['loading']()).toBe(false);
    expect(c['loadFailed']()).toBe(false);
    expect(c['creationScopes']()[0]).toEqual({ type: 'TENANT' });
    expect(c['creationScopes']().length).toBeGreaterThan(1);
    expect(c['scopeKey']()).toBe('TENANT');
    expect(c['dataSourcesLoaded']()).toBe(true);
    expect(c['documentType']()).toBe('QUOTATION');
    expect(c['dataSourceKey']()).toBe('TRADE_QUOTATION_PRINT_V1');
    expect(c['outputChannel']()).toBe('PRINT');
    expect(c['dirty']()).toBe(false);
  });

  it('keeps a preferred company scope passed to open()', async () => {
    fixture.componentInstance.open();
    await flush();
    const company = c['creationScopes']().find((s: { type: string }) => s.type === 'COMPANY');

    fixture.componentInstance.open({ type: 'COMPANY', companyId: company.companyId });
    await flush();

    expect(c['scopeKey']()).toBe(`COMPANY:${company.companyId}`);
    expect(c['selectedScope']()).toEqual({ type: 'COMPANY', companyId: company.companyId });
  });
});

describe('TemplateCreateWizard: step 1 (details) validation', () => {
  it('blocks Next with empty fields and shows the required errors', async () => {
    await openWizard();

    expect(c['nameError']()).toBeNull();
    await goNext();

    expect(c['step']()).toBe('details');
    expect(c['step1Attempted']()).toBe(true);
    expect(c['nameError']()).toBe('Name required');
    expect(c['codeError']()).toBe('Code required');
    expect(c['isStepInvalid']('details')).toBe(true);
  });

  it('upper-cases the code and rejects a pattern, length and description violation', async () => {
    await openWizard();
    c['onCodeInput']('tpl-lower');
    expect(c['code']()).toBe('TPL-LOWER');

    c['onNameInput']('x'.repeat(201));
    c['onCodeInput']('-BAD');
    c['onDescriptionInput']('d'.repeat(1001));
    await goNext();

    expect(c['step']()).toBe('details');
    expect(c['nameError']()).toBe('Name too long');
    expect(c['codeError']()).toBe('Code pattern');
    expect(c['descriptionError']()).toBe('Description too long');

    c['onCodeInput']('A'.repeat(101));
    expect(c['codeError']()).toBe('Code too long');
  });

  it('moves to Document once the details are valid', async () => {
    await openWizard();
    fillValidDetails();

    expect(c['step1Valid']()).toBe(true);
    expect(c['dirty']()).toBe(true);
    await goNext();

    expect(c['step']()).toBe('document');
    expect(c['isStepDone'](0, 'details')).toBe(true);
  });

  it('goToStep to a later step with invalid details lands back on Details', async () => {
    await openWizard();

    c['goToStep']('review');
    await flush();

    expect(c['step']()).toBe('details');
    expect(c['step1Attempted']()).toBe(true);
  });
});

describe('TemplateCreateWizard: step 2 (document type and data source)', () => {
  it('choosing the outbound email type switches to EMAIL, EMAIL_FLOW and the first email adapter', async () => {
    await openWizard();
    fillValidDetails();
    await goNext();

    c['selectDocumentType']('CRM_OUTBOUND_EMAIL');

    expect(c['isEmail']()).toBe(true);
    expect(c['outputChannel']()).toBe('EMAIL');
    expect(c['layoutMode']()).toBe('EMAIL_FLOW');
    expect(c['dataSourceKey']()).toBe('CRM_LEAD_OUTBOUND_EMAIL_V1');
    expect(c['emailSourceOptions']().map((o: { value: string }) => o.value)).toEqual([
      'CRM_LEAD_OUTBOUND_EMAIL_V1',
      'CRM_CUSTOMER_OUTBOUND_EMAIL_V1',
      'CRM_OPPORTUNITY_OUTBOUND_EMAIL_V1',
    ]);
    expect(c['isLayoutDisabled']('HYBRID_DOCUMENT')).toBe(true);
    expect(c['isLayoutDisabled']('EMAIL_FLOW')).toBe(false);
    expect(c['isStepSkipped']('page')).toBe(true);

    c['onDataSourceChange']('CRM_CUSTOMER_OUTBOUND_EMAIL_V1');
    expect(c['dataSourceKey']()).toBe('CRM_CUSTOMER_OUTBOUND_EMAIL_V1');
  });

  it('choosing a print type picks its adapter and keeps an allowed layout; EMAIL_FLOW is disabled for print', async () => {
    await openWizard();
    fillValidDetails();
    await goNext();
    c['selectLayoutMode']('FIXED_CANVAS');

    c['selectDocumentType']('LETTER');

    expect(c['dataSourceKey']()).toBe('CORE_BUSINESS_LETTER_PRINT_V1');
    expect(c['layoutMode']()).toBe('FIXED_CANVAS');
    expect(c['outputChannel']()).toBe('PRINT');
    expect(c['isLayoutDisabled']('EMAIL_FLOW')).toBe(true);

    // Selecting a disabled layout is ignored.
    c['selectLayoutMode']('EMAIL_FLOW');
    expect(c['layoutMode']()).toBe('FIXED_CANVAS');
  });

  it('AUTO direction resolves from the locale', async () => {
    await openWizard();

    c['onLocaleChange']('ar-EG');
    expect(c['resolvedDirection']()).toBe('RTL');
    c['onLocaleChange']('en-US');
    expect(c['resolvedDirection']()).toBe('LTR');
    c['onDirectionChange']('RTL');
    expect(c['resolvedDirection']()).toBe('RTL');
  });

  it('an email template skips the Page step on Next and Back', async () => {
    await openWizard();
    fillValidDetails();
    await goNext();
    c['selectDocumentType']('CRM_OUTBOUND_EMAIL');

    await goNext();
    expect(c['step']()).toBe('starter');

    c['goPrevious']();
    expect(c['step']()).toBe('document');
  });
});

describe('TemplateCreateWizard: step 3 (page) validation', () => {
  async function toPageStep(): Promise<void> {
    await openWizard();
    fillValidDetails();
    await goNext();
    await goNext();
    expect(c['step']()).toBe('page');
  }

  it('landscape swaps the preset dimensions', async () => {
    await toPageStep();

    expect([c['diagramWidthMm'](), c['diagramHeightMm']()]).toEqual([210, 297]);
    c['onOrientationChange']('LANDSCAPE');
    expect([c['diagramWidthMm'](), c['diagramHeightMm']()]).toEqual([297, 210]);
    c['onPresetChange']('A5');
    expect([c['diagramWidthMm'](), c['diagramHeightMm']()]).toEqual([210, 148]);
  });

  it('a custom size out of range blocks Next with width and height errors', async () => {
    await toPageStep();
    c['onPresetChange']('CUSTOM');
    c['onNumericInput']('width', '40');
    c['onNumericInput']('height', '');

    await goNext();

    expect(c['step']()).toBe('page');
    expect(c['step3Attempted']()).toBe(true);
    expect(c['widthError']()).toBe('Width range');
    expect(c['heightError']()).toBe('Height range');
    expect(c['isStepInvalid']('page')).toBe(true);
  });

  it('margins out of range or leaving no printable area block Next', async () => {
    await toPageStep();
    c['onNumericInput']('top', '101');

    await goNext();
    expect(c['step']()).toBe('page');
    expect(c['marginTopError']()).toBe('Margin range');

    c['onNumericInput']('top', '100');
    c['onPresetChange']('CUSTOM');
    c['onNumericInput']('height', '150');
    c['onNumericInput']('bottom', '60');
    expect(c['step3Valid']()).toBe(false);
    expect(c['marginBottomError']()).toBe('Printable area invalid');
  });

  it('valid page settings move on to the starter step and load starters for the tuple', async () => {
    await toPageStep();
    c['onLocaleChange']('en-US');

    await goNext();

    expect(c['step']()).toBe('starter');
    expect(c['startersLoading']()).toBe(false);
    expect(c['startersFailed']()).toBe(false);
    expect(c['starters']().length).toBeGreaterThan(0);
    for (const s of c['starters']()) {
      expect(s.documentType).toBe('QUOTATION');
      expect(s.locale).toBe('en-US');
    }
  });
});

describe('TemplateCreateWizard: step 4 (starter)', () => {
  it('changing the tuple clears a chosen starter and tells the user', async () => {
    await openWizard();
    fillValidDetails();
    await goNext();
    c['onLocaleChange']('en-US');
    await goNext();
    await goNext();
    const starterKey = c['starters']()[0].starterKey;
    c['selectStarter'](starterKey);
    expect(c['selectedStarter']()?.starterKey).toBe(starterKey);
    const info = vi.spyOn(notify, 'info');

    c['onLocaleChange']('ar-EG');

    expect(c['selectedStarterKey']()).toBeNull();
    expect(info).toHaveBeenCalledTimes(1);
  });
});

describe('TemplateCreateWizard: create call', () => {
  async function toReview(code: string): Promise<void> {
    await openWizard();
    fillValidDetails(code);
    await goNext();
    c['onLocaleChange']('en-US');
    await goNext();
    await goNext();
    await goNext();
    expect(c['step']()).toBe('review');
  }

  it('creates a print template with page and starter, emits created, closes and navigates to the designer', async () => {
    const code = uniqueCode();
    await toReview(code);
    const starterKey = c['starters']()[0].starterKey;
    c['selectStarter'](starterKey);
    const created: CreateTemplateResponse[] = [];
    fixture.componentInstance.created.subscribe((r) => created.push(r));
    const success = vi.spyOn(notify, 'success');

    await goNext();

    expect(created).toHaveLength(1);
    const def = created[0].definition;
    expect(def.code).toBe(code);
    expect(def.name).toBe('Spec quotation');
    expect(def.description).toBe('Written by the spec');
    expect(def.outputChannel).toBe('PRINT');
    expect(def.scope).toEqual({ type: 'TENANT' });
    expect(created[0].draft.editorDocument.page).toEqual(
      expect.objectContaining({ preset: 'A4', orientation: 'PORTRAIT', marginMm: { top: 12, end: 12, bottom: 12, start: 12 } }),
    );
    expect(created[0].draft.editorDocument.metadata).toEqual({ starterKey });
    expect(success).toHaveBeenCalledTimes(1);
    expect(c['isOpen']()).toBe(false);
    expect(c['saving']()).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith([
      '/workspace/operations/template-platform',
      def.templateId,
      'design',
    ]);
  });

  it('does not navigate when navigateOnCreate is false, and an email template carries no page', async () => {
    fixture.componentRef.setInput('navigateOnCreate', false);
    const code = uniqueCode();
    await openWizard();
    fillValidDetails(code);
    await goNext();
    c['selectDocumentType']('CRM_OUTBOUND_EMAIL');
    await goNext();
    await goNext();
    const created: CreateTemplateResponse[] = [];
    fixture.componentInstance.created.subscribe((r) => created.push(r));

    await goNext();

    expect(created).toHaveLength(1);
    expect(created[0].definition.outputChannel).toBe('EMAIL');
    expect(created[0].definition.layoutMode).toBe('EMAIL_FLOW');
    expect(created[0].draft.editorDocument.page).toBeUndefined();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('a 409 CODE.CONFLICT puts the message on the code field and returns to Details', async () => {
    await toReview('TPL-QT-CORP');
    const created = vi.fn();
    fixture.componentInstance.created.subscribe(created);
    const error = vi.spyOn(notify, 'error');

    await goNext();

    expect(created).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    expect(c['isOpen']()).toBe(true);
    expect(c['step']()).toBe('details');
    expect(c['codeError']()).toBe('Code already in use');
    expect(c['step1Valid']()).toBe(false);
    expect(c['saving']()).toBe(false);

    c['onCodeInput']('TPL-QT-CORP-2');
    expect(c['codeConflictError']()).toBeNull();
    expect(c['codeError']()).toBeNull();
  });
});

describe('TemplateCreateWizard: error mapping', () => {
  it('prefers the local key, then the shared key, then network for status 0, then generic', async () => {
    await openWizard();
    const map = (e: unknown) => c['translateErrorMessage'](e) as string;

    expect(map(new TemplateApiError(422, 'CORE.TEMPLATE.PAGE.MISSING'))).toBe('Page missing (local)');
    expect(map(new TemplateApiError(409, 'CORE.TEMPLATE.CODE.CONFLICT'))).toBe('Code already in use');
    expect(map({ code: 'CORE.TEMPLATE.CODE.CONFLICT' })).toBe('Code already in use');
    expect(map(new TemplateApiError(0, 'UNKNOWN.CODE'))).toBe('Network error');
    expect(map(new TemplateApiError(500, 'UNKNOWN.CODE'))).toBe('Generic error');
    expect(map(new Error('boom'))).toBe('Generic error');
  });
});

describe('TemplateCreateWizard: closing', () => {
  it('closing a dirty wizard reopens it behind the unsaved dialog; Discard closes it', async () => {
    await openWizard();
    fillValidDetails();
    const closed = vi.fn();
    fixture.componentInstance.closed.subscribe(closed);

    c['onModalClosed']();
    await flush(0);

    expect(c['isOpen']()).toBe(true);
    expect(c['guardBusy']()).toBe(true);
    expect(closed).not.toHaveBeenCalled();

    const unsaved = c['unsavedDialog']() as Internals;
    unsaved['close']('discard');
    await flush(10);

    expect(c['isOpen']()).toBe(false);
    expect(closed).toHaveBeenCalled();
  });

  it('a programmatic close (Discard, successful create) emits closed once', async () => {
    // closeImmediately() calls modal.close(), whose synchronous (closed) output runs onModalClosed() ->
    // finalizeClose(); closeImmediately() then calls finalizeClose() a second time.
    await openWizard();
    fillValidDetails();
    const closed = vi.fn();
    fixture.componentInstance.closed.subscribe(closed);

    c['onModalClosed']();
    await flush(0);
    (c['unsavedDialog']() as Internals)['close']('discard');
    await flush(10);

    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('closing a clean wizard closes at once', async () => {
    await openWizard();
    const closed = vi.fn();
    fixture.componentInstance.closed.subscribe(closed);

    c['onModalClosed']();

    expect(c['isOpen']()).toBe(false);
    expect(closed).toHaveBeenCalledTimes(1);
  });
});
