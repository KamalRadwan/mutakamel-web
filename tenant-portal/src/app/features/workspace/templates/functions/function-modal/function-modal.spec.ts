import { Injectable } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslocoLoader, provideTransloco } from '@jsverse/transloco';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Notify } from '../../../../../core/notify/notify';
import { listFunctions } from '../functions.api';
import type {
  FunctionCompanyOption,
  FunctionDetailDto,
  FunctionParameter,
  FunctionSummaryDto,
  FunctionTestCase,
} from '../functions.model';
import { FunctionModal } from './function-modal';

/*
 * The modal runs on the real functions fake (vi.mock of relative modules is not supported by the
 * Angular unit-test builder). No translations are loaded, so every text is its own key.
 */

/** Answers on a later microtask: a synchronous loader writes signals during render (NG0600). */
@Injectable()
class AsyncEmptyLoader implements TranslocoLoader {
  getTranslation() {
    return Promise.resolve({});
  }
}

const COMPANIES: readonly FunctionCompanyOption[] = [
  { id: 'company-a', label: 'Company A' },
  { id: 'company-b', label: 'Company B' },
];

const SEED = {
  lineDiscount: 'LINE_NET_AFTER_DISCOUNT',
  vat14: 'VAT_14_AMOUNT',
  shippingFee: 'LEGACY_SHIPPING_FEE',
} as const;

const dialogProto = HTMLDialogElement.prototype as unknown as Record<string, unknown>;
const originalDialog = { showModal: dialogProto['showModal'], close: dialogProto['close'] };

// Protected members are reached through this view on purpose: the spec drives the modal state directly.
type Internals = Record<string, any>;

let fixture: ComponentFixture<FunctionModal>;
let c: Internals;
let notify: Notify;

async function flush(ms = 1000): Promise<void> {
  fixture.detectChanges();
  await vi.advanceTimersByTimeAsync(ms);
  fixture.detectChanges();
}

/** Promise-returning methods await fake timers, so the clock runs while they settle. */
async function run<T>(promise: Promise<T>, ms = 2000): Promise<T> {
  const guarded = promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  await vi.advanceTimersByTimeAsync(ms);
  const result = await guarded;
  fixture.detectChanges();
  if (!result.ok) throw result.error;
  return result.value;
}

function ev(value: string): Event {
  return { target: { value } } as unknown as Event;
}

function draft(): { code: string; scopeType: string; companyId: string; working: Internals } {
  return c['draft']();
}

function params(): FunctionParameter[] {
  return draft().working['parameters'];
}

function tests(): FunctionTestCase[] {
  return draft().working['tests'];
}

async function summaryByCode(code: string): Promise<FunctionSummaryDto> {
  const page = await run(listFunctions({ limit: 100 }));
  const found = page.items.find((f) => f.code === code);
  if (!found) throw new Error(`Seed ${code} missing`);
  return found;
}

async function openEdit(code: string): Promise<FunctionSummaryDto> {
  const summary = await summaryByCode(code);
  fixture.componentInstance.openEdit(summary);
  await flush(2000);
  return summary;
}

let codeSeq = 0;
function uniqueCode(): string {
  codeSeq += 1;
  return `SPEC_FN_${Date.now().toString(36).toUpperCase()}_${codeSeq}`;
}

beforeEach(async () => {
  vi.useFakeTimers();
  dialogProto['showModal'] = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  dialogProto['close'] = function (this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    setTimeout(() => this.dispatchEvent(new Event('close')), 0);
  };
  TestBed.configureTestingModule({
    providers: [
      provideTransloco({
        config: { availableLangs: ['ar', 'en'], defaultLang: 'en', missingHandler: { logMissingKey: false } },
        loader: AsyncEmptyLoader,
      }),
    ],
  });
  notify = TestBed.inject(Notify);
  fixture = TestBed.createComponent(FunctionModal);
  fixture.componentRef.setInput('companyOptions', COMPANIES);
  c = fixture.componentInstance as unknown as Internals;
  await flush();
});

afterEach(() => {
  fixture.destroy();
  TestBed.resetTestingModule();
  dialogProto['showModal'] = originalDialog.showModal;
  dialogProto['close'] = originalDialog.close;
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('FunctionModal: create mode defaults', () => {
  it('opens with one DECIMAL parameter, one test and only the Definition and Tests tabs', async () => {
    fixture.componentInstance.openCreate();
    await flush();

    expect(c['isOpen']()).toBe(true);
    expect(c['mode']()).toBe('create');
    expect(c['activeTab']()).toBe('definition');
    expect(c['tabs']().map((t: { id: string }) => t.id)).toEqual(['definition', 'tests']);
    expect(draft().scopeType).toBe('TENANT');
    expect(draft().companyId).toBe('company-a');
    expect(params()).toEqual([{ name: 'amount', type: 'DECIMAL', nullable: false, dimension: 'SCALAR' }]);
    expect(tests()).toHaveLength(1);
    expect(tests()[0].arguments).toEqual([{ name: 'amount', value: { kind: 'DECIMAL', value: '0', dimension: 'SCALAR' } }]);
    expect(c['isReadOnly']()).toBe(false);
    // Create mode is never "dirty": closing a fresh form does not ask.
    expect(c['dirty']()).toBe(false);
    expect(c['validateDisabled']()).toBe(true);
    expect(c['publishDisabled']()).toBe(true);
  });
});

describe('FunctionModal: definition validation', () => {
  beforeEach(async () => {
    fixture.componentInstance.openCreate();
    await flush();
  });

  it('shows no errors before the first save attempt', () => {
    expect(c['codeError']()).toBeNull();
    expect(c['nameError']()).toBeNull();
  });

  it('Save with an empty code and name fails and stays on Definition with the required errors', async () => {
    const ok = await run(c['save']());

    expect(ok).toBe(false);
    expect(c['attemptedSave']()).toBe(true);
    expect(c['activeTab']()).toBe('definition');
    expect(c['codeError']()).toBe('tplFunctions.validation.codeRequired');
    expect(c['nameError']()).toBe('tplFunctions.validation.nameRequired');
    expect(c['saving']()).toBe(false);
  });

  it('upper-cases the code and rejects a bad pattern, a long name and a long description', async () => {
    c['onCodeInput'](ev('-bad code'));
    expect(draft().code).toBe('-BAD CODE');
    c['onNameInput'](ev('n'.repeat(201)));
    c['onDescriptionInput'](ev('d'.repeat(1001)));

    expect(await run(c['save']())).toBe(false);

    expect(c['codeError']()).toBe('tplFunctions.validation.codePattern');
    expect(c['nameError']()).toBe('tplFunctions.validation.nameTooLong');
    expect(c['descriptionError']()).toBe('tplFunctions.validation.descriptionTooLong');
  });

  it('a COMPANY scope needs a company; switching to COMPANY fills the first one', async () => {
    c['onScopeTypeChange']('COMPANY');
    expect(draft().companyId).toBe('company-a');

    c['onCompanyChange']('');
    await run(c['save']());
    expect(c['companyError']()).toBe('tplFunctions.validation.companyRequired');

    c['onCompanyChange']('company-b');
    expect(c['companyError']()).toBeNull();
  });

  it('parameter names must be present, match the pattern and be unique', async () => {
    c['addParameter']();
    c['addParameter']();
    c['onParamNameInput'](0, ev(''));
    c['onParamNameInput'](1, ev('Bad'));
    c['onParamNameInput'](2, ev('dup'));
    c['addParameter']();
    c['onParamNameInput'](3, ev('dup'));

    await run(c['save']());

    expect(c['paramNameError'](0)).toBe('tplFunctions.validation.paramNameRequired');
    expect(c['paramNameError'](1)).toBe('tplFunctions.validation.paramNamePattern');
    expect(c['paramNameError'](2)).toBe('tplFunctions.validation.paramNameUnique');
    expect(c['paramNameError'](3)).toBe('tplFunctions.validation.paramNameUnique');
  });

  it('with a valid definition but a bad test value, Save jumps to the Tests tab', async () => {
    c['onCodeInput'](ev(uniqueCode()));
    c['onNameInput'](ev('Spec function'));
    const test = tests()[0];
    c['onTestArgDecimalInput'](test.id, params()[0], ev('abc'));

    expect(await run(c['save']())).toBe(false);

    expect(c['activeTab']()).toBe('tests');
    expect(c['valueFieldError'](tests()[0].arguments[0].value, 'DECIMAL')).toBe('tplFunctions.validation.decimalInvalid');
  });

  it('from the Tests tab with only definition errors, Save jumps back to Definition', async () => {
    c['selectTab']('tests');

    await run(c['save']());

    expect(c['activeTab']()).toBe('definition');
  });

  it('flags empty and long test names, bad dates and long strings', async () => {
    const test = tests()[0];
    c['onTestNameInput'](test.id, ev('  '));
    await run(c['save']());

    expect(c['testNameError'](tests()[0])).toBe('tplFunctions.validation.testNameRequired');
    expect(c['testNameError']({ ...tests()[0], name: 't'.repeat(101) })).toBe('tplFunctions.validation.testNameTooLong');
    expect(c['valueFieldError']({ kind: 'DATE', value: '04/11/2026' }, 'DATE')).toBe('tplFunctions.validation.dateRequired');
    expect(c['valueFieldError']({ kind: 'STRING', value: 's'.repeat(1001) }, 'STRING')).toBe(
      'tplFunctions.validation.stringTooLong',
    );
    expect(c['valueFieldError']({ kind: 'NULL' }, 'DECIMAL')).toBeNull();
  });
});

describe('FunctionModal: parameters, result and tests editing', () => {
  beforeEach(async () => {
    fixture.componentInstance.openCreate();
    await flush();
  });

  it('adding a parameter adds an argument to every test; removing it drops the argument; the last one stays', () => {
    c['addTest']();
    c['addParameter']();

    expect(params().map((p) => p.name)).toEqual(['amount', 'param1']);
    for (const t of tests()) expect(t.arguments.map((a) => a.name)).toEqual(['amount', 'param1']);

    c['removeParameter'](0);
    expect(params().map((p) => p.name)).toEqual(['param1']);
    for (const t of tests()) expect(t.arguments.map((a) => a.name)).toEqual(['param1']);

    c['removeParameter'](0);
    expect(params()).toHaveLength(1);
  });

  it('caps parameters at 16 and tests at 20; the last test cannot be removed', () => {
    for (let i = 0; i < 20; i++) c['addParameter']();
    expect(params()).toHaveLength(16);

    for (let i = 0; i < 25; i++) c['addTest']();
    expect(tests()).toHaveLength(20);

    for (const t of [...tests()]) c['removeTest'](t.id);
    expect(tests()).toHaveLength(1);
  });

  it('renaming a parameter renames its test arguments', () => {
    c['onParamNameInput'](0, ev('price'));

    expect(params()[0].name).toBe('price');
    expect(tests()[0].arguments[0].name).toBe('price');
  });

  it('a non-DECIMAL parameter type resets the dimension to SCALAR and the argument to the new default', () => {
    c['onParamDimensionChange'](0, 'MONEY');
    expect(tests()[0].arguments[0].value).toEqual({ kind: 'DECIMAL', value: '0', dimension: 'MONEY', currencyCode: 'EGP' });

    c['onParamTypeChange'](0, 'STRING');

    expect(params()[0]).toEqual(expect.objectContaining({ type: 'STRING', dimension: 'SCALAR' }));
    expect(tests()[0].arguments[0].value).toEqual({ kind: 'STRING', value: '' });

    // A dimension only applies to DECIMAL.
    c['onParamDimensionChange'](0, 'QUANTITY');
    expect(params()[0].dimension).toBe('SCALAR');
  });

  it('QUANTITY keeps the decimal value and adds a unit', () => {
    c['onTestArgDecimalInput'](tests()[0].id, params()[0], ev('12.5'));
    c['onParamDimensionChange'](0, 'QUANTITY');

    expect(tests()[0].arguments[0].value).toEqual({ kind: 'DECIMAL', value: '12.5', dimension: 'QUANTITY', unitCode: 'pcs' });
  });

  it('a nullable parameter accepts NULL arguments; making it required replaces NULL with the default', () => {
    const testId = tests()[0].id;
    c['onTestArgNullChange'](testId, params()[0], true);
    expect(tests()[0].arguments[0].value).toEqual(expect.objectContaining({ kind: 'DECIMAL' }));

    c['onParamNullableChange'](0, true);
    c['onTestArgNullChange'](testId, params()[0], true);
    expect(tests()[0].arguments[0].value).toEqual({ kind: 'NULL' });

    c['onParamNullableChange'](0, false);
    expect(tests()[0].arguments[0].value).toEqual({ kind: 'DECIMAL', value: '0', dimension: 'SCALAR' });
  });

  it('changing the result type resets each expected value; BOOLEAN and DATE inputs store typed values', () => {
    c['onResultTypeChange']('BOOLEAN');
    expect(draft().working['result']).toEqual({ type: 'BOOLEAN', nullable: false, dimension: 'SCALAR' });
    expect(tests()[0].expected).toEqual({ kind: 'BOOLEAN', value: true });

    c['onTestExpectedBoolChange'](tests()[0].id, 'false');
    expect(tests()[0].expected).toEqual({ kind: 'BOOLEAN', value: false });

    c['onResultTypeChange']('DATE');
    c['onTestExpectedDateChange'](tests()[0].id, null);
    expect(tests()[0].expected).toEqual({ kind: 'DATE', value: '' });
  });

  it('a result made required replaces NULL expectations', () => {
    c['onResultNullableChange'](true);
    c['onTestExpectedNullChange'](tests()[0].id, true);
    expect(tests()[0].expected).toEqual({ kind: 'NULL' });

    c['onResultNullableChange'](false);
    expect(tests()[0].expected).toEqual({ kind: 'DECIMAL', value: '0', dimension: 'SCALAR' });
  });
});

describe('FunctionModal: create call', () => {
  beforeEach(async () => {
    fixture.componentInstance.openCreate();
    await flush();
  });

  it('creates the function, switches to edit mode and emits saved with isNew', async () => {
    const code = uniqueCode();
    c['onCodeInput'](ev(code.toLowerCase()));
    c['onNameInput'](ev('  Spec function  '));
    c['onDescriptionInput'](ev('   '));
    const saved: { detail: FunctionDetailDto; isNew: boolean }[] = [];
    fixture.componentInstance.saved.subscribe((e) => saved.push(e));
    const success = vi.spyOn(notify, 'success');

    expect(await run(c['save']())).toBe(true);

    expect(saved).toHaveLength(1);
    expect(saved[0].isNew).toBe(true);
    expect(saved[0].detail.code).toBe(code);
    expect(saved[0].detail.name).toBe('Spec function');
    expect(saved[0].detail.description).toBeNull();
    expect(saved[0].detail.scope).toEqual({ scopeType: 'TENANT' });
    expect(c['mode']()).toBe('edit');
    expect(c['attemptedSave']()).toBe(false);
    expect(c['tabs']().map((t: { id: string }) => t.id)).toEqual(['definition', 'tests', 'versions', 'usage']);
    expect(c['dirty']()).toBe(false);
    expect(success).toHaveBeenCalledWith('tplFunctions.toasts.created');
  });

  it('creates a COMPANY-scoped function with the chosen company', async () => {
    c['onCodeInput'](ev(uniqueCode()));
    c['onNameInput'](ev('Company function'));
    c['onScopeTypeChange']('COMPANY');
    c['onCompanyChange']('company-b');
    const saved = vi.fn();
    fixture.componentInstance.saved.subscribe(saved);

    expect(await run(c['save']())).toBe(true);

    expect(saved.mock.calls[0][0].detail.scope).toEqual({ scopeType: 'COMPANY', companyId: 'company-b' });
  });

  it('a 409 FUNCTION_CODE_CONFLICT is shown on the code field, not as a toast', async () => {
    c['onCodeInput'](ev(SEED.vat14));
    c['onNameInput'](ev('Duplicate'));
    c['selectTab']('tests');
    const error = vi.spyOn(notify, 'error');

    expect(await run(c['save']())).toBe(false);

    expect(c['mode']()).toBe('create');
    expect(c['codeError']()).toBe('tplFunctions.errors.FUNCTION_CODE_CONFLICT');
    expect(c['activeTab']()).toBe('definition');
    expect(error).not.toHaveBeenCalled();

    c['onCodeInput'](ev(uniqueCode()));
    expect(c['codeServerError']()).toBeNull();
  });
});

describe('FunctionModal: edit mode', () => {
  it('loads the record and versions, emits the published version number and is clean', async () => {
    const resolved = vi.fn();
    fixture.componentInstance.versionResolved.subscribe(resolved);

    const summary = await openEdit(SEED.lineDiscount);

    expect(c['mode']()).toBe('edit');
    expect(c['loading']()).toBe(false);
    expect(c['detail']().id).toBe(summary.id);
    expect(c['detail']().working).toBeDefined();
    expect(c['versions']().length).toBeGreaterThan(0);
    expect(resolved).toHaveBeenCalledWith(expect.objectContaining({ versionId: summary.publishedVersionId }));
    expect(c['dirty']()).toBe(false);
    expect(c['lockedScopeLabel']()).toBe('tplFunctions.scopes.tenant');
  });

  it('editing makes it dirty, blocks Validate and Publish with "save first", and Undo restores it', async () => {
    await openEdit(SEED.lineDiscount);
    const original = draft().working['name'];

    c['onNameInput'](ev('Renamed by spec'));

    expect(c['dirty']()).toBe(true);
    expect(c['validateDisabled']()).toBe(true);
    expect(c['publishDisabled']()).toBe(true);
    expect(c['validateTooltip']()).toBe('tplFunctions.actions.saveFirst');
    expect(c['publishTooltip']()).toBe('tplFunctions.actions.saveFirst');

    c['undoChanges']();
    expect(draft().working['name']).toBe(original);
    expect(c['dirty']()).toBe(false);
  });

  it('code and scope cannot change in edit mode', async () => {
    await openEdit(SEED.lineDiscount);

    c['onCodeInput'](ev('OTHER'));
    c['onScopeTypeChange']('COMPANY');

    expect(draft().code).toBe(SEED.lineDiscount);
    expect(draft().scopeType).toBe('TENANT');
  });

  it('Save patches the working body, bumps the revision and emits saved', async () => {
    const before = await openEdit(SEED.vat14);
    c['onNameInput'](ev('VAT 14% (spec)'));
    const saved: { detail: FunctionDetailDto; isNew: boolean }[] = [];
    fixture.componentInstance.saved.subscribe((e) => saved.push(e));
    const success = vi.spyOn(notify, 'success');

    expect(await run(c['save']())).toBe(true);

    expect(saved).toHaveLength(1);
    expect(saved[0].isNew).toBe(false);
    expect(saved[0].detail.revision).toBe(before.revision + 1);
    expect(saved[0].detail.name).toBe('VAT 14% (spec)');
    expect(saved[0].detail.validation).toBeNull();
    expect(c['dirty']()).toBe(false);
    expect(success).toHaveBeenCalledWith('tplFunctions.toasts.saved');
  });

  it('a 412 stale revision on Save opens the conflict dialog instead of a toast', async () => {
    await openEdit(SEED.vat14);
    c['detail'].update((d: FunctionDetailDto) => ({ ...d, etag: '"1"' }));
    c['onNameInput'](ev('Stale edit'));
    const error = vi.spyOn(notify, 'error');

    expect(await run(c['save']())).toBe(false);

    expect(c['conflictOpen']()).toBe(true);
    expect(c['childModalOpen']()).toBe(true);
    expect(error).not.toHaveBeenCalled();

    c['keepChangesAfterConflict']();
    expect(c['conflictOpen']()).toBe(false);
    expect(draft().working['name']).toBe('Stale edit');
  });

  it('Validate on a clean record stores the run and enables Publish when it passes', async () => {
    await openEdit(SEED.lineDiscount);
    const success = vi.spyOn(notify, 'success');
    const warning = vi.spyOn(notify, 'warning');

    await run(c['runValidate']());

    const run1 = c['lastValidationRun']();
    expect(run1).not.toBeNull();
    expect(c['validationSummary']().id).toBe(run1.validationId);
    expect(c['validating']()).toBe(false);
    if (run1.state === 'PASSED') {
      expect(success).toHaveBeenCalledWith('tplFunctions.toasts.validatedPassed');
      expect(c['publishDisabled']()).toBe(false);
    } else {
      expect(warning).toHaveBeenCalledWith('tplFunctions.toasts.validatedFailed');
      expect(c['publishDisabled']()).toBe(true);
    }
  });

  it('an expired validation (older than 30 minutes) blocks Publish', async () => {
    await openEdit(SEED.lineDiscount);
    await run(c['runValidate']());
    if (c['lastValidationRun']().state !== 'PASSED') return;

    c['nowTick'].set(Date.now() + 31 * 60 * 1000);

    expect(c['validationExpired']()).toBe(true);
    expect(c['publishDisabled']()).toBe(true);
    expect(c['publishTooltip']()).toBe('tplFunctions.modal.publishValidationExpired');
  });

  it('an archived function is read-only: inputs are ignored and Save does nothing', async () => {
    await openEdit(SEED.shippingFee);
    const name = draft().working['name'];

    expect(c['isArchived']()).toBe(true);
    expect(c['isReadOnly']()).toBe(true);
    c['onNameInput'](ev('Changed'));
    c['addParameter']();

    expect(draft().working['name']).toBe(name);
    expect(await run(c['save']())).toBe(false);
    expect(c['attemptedSave']()).toBe(false);
    expect(c['validateTooltip']()).toBe('tplFunctions.errors.FUNCTION_ARCHIVED');
  });

  it('canManage=false makes the form read-only', async () => {
    fixture.componentRef.setInput('canManage', false);
    await openEdit(SEED.lineDiscount);

    expect(c['isReadOnly']()).toBe(true);
    expect(c['dirty']()).toBe(false);
  });

  it('the Versions tab loads and the Usage tab loads usage rows', async () => {
    await openEdit(SEED.vat14);
    c['versions'].set([]);

    c['selectTab']('versions');
    await flush(2000);
    expect(c['versions']().length).toBeGreaterThan(0);

    c['selectTab']('usage');
    await flush(2000);
    expect(c['usageLoading']()).toBe(false);
    expect(c['usageItems']().length).toBeGreaterThan(0);
  });
});
