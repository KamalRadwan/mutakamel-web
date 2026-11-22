import { Injectable, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TranslocoLoader, type Translation, provideTransloco } from '@jsverse/transloco';
import { map, timer } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import enGlobal from '../../../../../../public/i18n/en.json';
import enPricing from '../../../../../../public/i18n/trade-gov-pricing/en.json';
import enGovernance from '../../../../../../public/i18n/trade-governance/en.json';
import enShared from '../../../../../../public/i18n/trade-shared/en.json';
import { Notify } from '../../../../core/notify/notify';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { FAKE_COLLEAGUE, FAKE_ME, setFakeActor } from '../governance-fake-actors';
import { ConflictDialog } from '../governance-shared/conflict-dialog/conflict-dialog';
import type { PriceLineRow } from '../price-lines-table/price-lines-table';
import { setFakeSoloOwnerEligible } from '../pricing.fake';
import {
  createPriceBook,
  createVersion,
  getPriceVersion,
  publishVersion,
  testVersion,
  updateVersion,
} from '../pricing.api';
import type { EntryInput, GovernanceAuditEntry, PriceEntry, PriceVersionDetailHead } from '../pricing.model';
import { PublishPriceDialog } from '../publish-price-dialog/publish-price-dialog';
import { PriceVersionPage } from './price-version-page';

/** Real translation files, served asynchronously like the HTTP loader (a sync loader triggers NG0600). */
const FILES: Record<string, Translation> = {
  en: enGlobal,
  'trade-gov-pricing/en': enPricing,
  'trade-governance/en': enGovernance,
  'trade-shared/en': enShared,
};

@Injectable()
class AsyncFileLoader implements TranslocoLoader {
  getTranslation(path: string) {
    return timer(0).pipe(map(() => FILES[path] ?? {}));
  }
}

/** The protected surface the template drives, as the spec calls it. */
interface PriceVersionView {
  loading(): boolean;
  notFound(): boolean;
  loadFailed(): boolean;
  detail(): {
    version: PriceVersionDetailHead;
    entryCount: number;
    soloOwnerGovernanceEligible: boolean;
    auditTrail: GovernanceAuditEntry[];
  } | null;
  currentIfMatch(): number;
  status(): string;
  editable(): boolean;
  dirty(): boolean;
  activeTab(): string;
  serverEntries(): readonly PriceEntry[];
  serverTotal(): number;
  effectiveEntryCount(): number;
  allNewLines(): PriceLineRow[];
  showLineErrors(): boolean;
  serverOverlapErrors(): ReadonlyMap<string, number>;
  publishBlocked(): boolean;
  makerCheckerCaption(): string | null;
  toError(): string | null;
  toDate: WritableSignal<string | null>;
  toTime: WritableSignal<string | null>;
  onEntryChange(row: PriceLineRow): void;
  onEntryRemove(rowId: string): void;
  onAddLine(): void;
  save(): Promise<boolean>;
  undoChanges(): void;
  openPublishDialog(): void;
  returnToDraftDialog(): ConfirmDialog;
}

interface PublishDialogView {
  supersedesId: WritableSignal<string>;
  soloOwnerAttestation: WritableSignal<boolean>;
  submit(): Promise<void>;
}

const dialogProto = HTMLDialogElement.prototype as unknown as Record<string, unknown>;
const originalDialog = { showModal: dialogProto['showModal'], close: dialogProto['close'] };

const NOW = '2026-11-21T12:00:00.000Z';
const ITEM = 'item-22';
const UOM = 'uom-pack';
const FROM = '2026-12-01T10:00:00.000Z';

let notify: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>; warning: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn> };
let harness: RouterTestingHarness;
let bookSeq = 0;

async function run<T>(promise: Promise<T>): Promise<T> {
  const settled = promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  await vi.advanceTimersByTimeAsync(400);
  const result = await settled;
  if (!result.ok) throw result.error;
  return result.value;
}

async function tick(ms = 1000): Promise<void> {
  harness.detectChanges();
  await vi.advanceTimersByTimeAsync(ms);
  harness.detectChanges();
  await vi.advanceTimersByTimeAsync(0);
  harness.detectChanges();
}

const entry = (minimumQuantity: string, maximumQuantity: string | null, unitPrice: string): EntryInput => ({
  itemId: ITEM,
  uomId: UOM,
  currencyCode: 'EGP',
  minimumQuantity,
  maximumQuantity,
  unitPrice,
});

async function newBook(): Promise<string> {
  bookSeq += 1;
  return (await run(createPriceBook({ code: `SPEC-PVP-${bookSeq}`, purpose: 'SALES', currencyCode: 'EGP' }))).id;
}

/** A draft with two tiers of one item: [1, 10) and [20, ∞). */
async function newDraft(bookId: string, from = FROM, actor = FAKE_ME): Promise<string> {
  setFakeActor(actor);
  const saved = await run(
    createVersion(bookId, { effectiveFrom: from, effectiveTo: null, entries: [entry('1', '10', '10.000'), entry('20', null, '8.000')] }),
  );
  setFakeActor(FAKE_ME);
  return saved.id;
}

async function tested(bookId: string, from = FROM, actor = FAKE_ME): Promise<string> {
  const id = await newDraft(bookId, from, actor);
  setFakeActor(actor);
  await run(testVersion(id));
  setFakeActor(FAKE_ME);
  return id;
}

/** Tested by FAKE_ME, published by the colleague (maker-checker satisfied). */
async function published(bookId: string, from: string): Promise<string> {
  const id = await tested(bookId, from);
  setFakeActor(FAKE_COLLEAGUE);
  await run(publishVersion(id));
  setFakeActor(FAKE_ME);
  return id;
}

async function head(id: string): Promise<PriceVersionDetailHead> {
  return (await run(getPriceVersion(id, { include: 'none' }))).versionHead;
}

async function stored(id: string) {
  return run(getPriceVersion(id));
}

async function openPage(bookId: string, versionId: string, query = ''): Promise<PriceVersionView> {
  const page = await harness.navigateByUrl(`/trade/governance/price-books/${bookId}/versions/${versionId}${query}`, PriceVersionPage);
  await tick();
  await tick();
  return page as unknown as PriceVersionView;
}

function conflictOpen(): boolean {
  const el = harness.fixture.debugElement.query(By.directive(ConflictDialog)).nativeElement as HTMLElement;
  return el.querySelector('dialog')?.hasAttribute('open') ?? false;
}

function conflictDialog(): { chooseReload(): void; chooseKeep(): void } {
  return harness.fixture.debugElement.query(By.directive(ConflictDialog)).componentInstance;
}

function publishDialog(): { view: PublishDialogView; isOpen(): boolean } {
  const debug = harness.fixture.debugElement.query(By.directive(PublishPriceDialog));
  return {
    view: debug.componentInstance as PublishDialogView,
    isOpen: () => (debug.nativeElement as HTMLElement).querySelector('dialog')?.hasAttribute('open') ?? false,
  };
}

/** The page's own #returnToDraftDialog (child components hold confirm dialogs too). */
function returnToDraftDialog(page: PriceVersionView): { close(confirmed: boolean): void } {
  return page.returnToDraftDialog() as unknown as { close(confirmed: boolean): void };
}

const byMin = (page: PriceVersionView, min: string): PriceEntry =>
  page.serverEntries().find((e) => e.minimumQuantity === min)!;

beforeEach(async () => {
  // jsdom has no scrollIntoView; the lines table calls it when it focuses a row.
  Element.prototype.scrollIntoView = () => undefined;
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW));
  setFakeActor(FAKE_ME);
  setFakeSoloOwnerEligible(FAKE_ME, false);
  localStorage.clear();
  sessionStorage.clear();
  document.documentElement.lang = 'en';
  dialogProto['showModal'] = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  dialogProto['close'] = function (this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    // Browsers fire "close" as a later task, after the code that called close() has finished.
    setTimeout(() => this.dispatchEvent(new Event('close')), 0);
  };
  notify = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'trade/governance/price-books/:id', children: [] },
        { path: 'trade/governance/price-books/:id/versions/:versionId', component: PriceVersionPage },
      ]),
      provideTransloco({
        config: { availableLangs: ['ar', 'en'], defaultLang: 'en', reRenderOnLangChange: true },
        loader: AsyncFileLoader,
      }),
      { provide: Notify, useValue: notify },
    ],
  });
  harness = await RouterTestingHarness.create();
});

afterEach(() => {
  harness.fixture.destroy();
  setFakeActor(FAKE_ME);
  setFakeSoloOwnerEligible(FAKE_ME, false);
  vi.useRealTimers();
  dialogProto['showModal'] = originalDialog.showModal;
  dialogProto['close'] = originalDialog.close;
});

describe('PriceVersionPage load', () => {
  it('loads the version head, its If-Match token and the first page of lines', async () => {
    const bookId = await newBook();
    const versionId = await newDraft(bookId);
    const page = await openPage(bookId, versionId);

    expect(page.loading()).toBe(false);
    expect(page.notFound()).toBe(false);
    expect(page.loadFailed()).toBe(false);
    expect(page.detail()?.version.id).toBe(versionId);
    expect(page.status()).toBe('DRAFT');
    expect(page.editable()).toBe(true);
    expect(page.dirty()).toBe(false);
    expect(page.currentIfMatch()).toBe((await head(versionId)).version);
    expect(page.serverEntries().map((e) => e.minimumQuantity).sort()).toEqual(['1', '20']);
    expect(page.serverTotal()).toBe(2);
    expect(page.effectiveEntryCount()).toBe(2);
  });

  it('opens the tab named in the query', async () => {
    const bookId = await newBook();
    const versionId = await newDraft(bookId);
    const page = await openPage(bookId, versionId, '?tab=history');
    expect(page.activeTab()).toBe('history');
  });

  it('shows not found for an unknown version', async () => {
    const bookId = await newBook();
    const page = await openPage(bookId, '0193a000-0000-7000-8000-0000000fffff');
    expect(page.notFound()).toBe(true);
    expect(page.loadFailed()).toBe(false);
    expect(page.detail()).toBeNull();
  });
});

describe('PriceVersionPage edit entries', () => {
  it('saves a changed price through entries/changes with the If-Match token', async () => {
    const bookId = await newBook();
    const versionId = await newDraft(bookId);
    const page = await openPage(bookId, versionId);
    const first = byMin(page, '1');

    page.onEntryChange({ ...first, unitPrice: '12.500' });
    expect(page.dirty()).toBe(true);
    const saved = page.save();
    await tick();
    await tick();
    expect(await saved).toBe(true);

    const after = await stored(versionId);
    expect(after.entries.find((e) => e.id === first.id)?.unitPrice).toBe('12.500');
    expect(page.currentIfMatch()).toBe(after.version.version);
    expect(page.dirty()).toBe(false);
    expect(notify.success).toHaveBeenCalledWith(enPricing.toasts.saved);
  });

  it('adds a new line and removes an existing one in one save', async () => {
    const bookId = await newBook();
    const versionId = await newDraft(bookId);
    const page = await openPage(bookId, versionId);
    const removed = byMin(page, '20');

    page.onAddLine();
    const blank = page.allNewLines()[0];
    page.onEntryChange({ ...blank, itemId: ITEM, itemCode: 'X', uomId: UOM, minimumQuantity: '10', maximumQuantity: '20', unitPrice: '9.000' });
    page.onEntryRemove(removed.id);
    expect(page.effectiveEntryCount()).toBe(2);

    const saved = page.save();
    await tick();
    await tick();
    expect(await saved).toBe(true);

    const after = await stored(versionId);
    expect(after.entries.map((e) => e.minimumQuantity).sort()).toEqual(['1', '10']);
    expect(after.entries.some((e) => e.id === removed.id)).toBe(false);
    expect(page.detail()?.entryCount).toBe(2);
  });

  it('blocks the save on an incomplete new line and sends nothing', async () => {
    const bookId = await newBook();
    const versionId = await newDraft(bookId);
    const page = await openPage(bookId, versionId);
    const before = (await head(versionId)).version;

    page.onAddLine();
    const blank = page.allNewLines()[0];
    const saved = page.save();
    await tick();
    expect(await saved).toBe(false);

    expect(page.showLineErrors()).toBe(true);
    expect(page.activeTab()).toBe('lines');
    expect((await head(versionId)).version).toBe(before);
  });

  it('blocks the save when the end is not after the start', async () => {
    const bookId = await newBook();
    const versionId = await newDraft(bookId);
    const page = await openPage(bookId, versionId);
    const before = (await head(versionId)).version;

    page.toDate.set('2026-11-01');
    page.toTime.set('00:00');
    const saved = page.save();
    await tick();
    expect(await saved).toBe(false);
    expect(page.toError()).toBe(enPricing.header.endAfterStart);
    expect((await head(versionId)).version).toBe(before);
  });

  it('undo drops every pending change', async () => {
    const bookId = await newBook();
    const versionId = await newDraft(bookId);
    const page = await openPage(bookId, versionId);

    page.onEntryChange({ ...byMin(page, '1'), unitPrice: '99' });
    page.onAddLine();
    page.onEntryRemove(byMin(page, '20').id);
    expect(page.dirty()).toBe(true);
    page.undoChanges();
    expect(page.dirty()).toBe(false);
    expect(page.effectiveEntryCount()).toBe(2);
  });

  it('editing a TESTED version asks first; cancel keeps it TESTED, confirm saves it back to DRAFT', async () => {
    const bookId = await newBook();
    const versionId = await tested(bookId);
    const page = await openPage(bookId, versionId);
    expect(page.status()).toBe('TESTED');
    page.onEntryChange({ ...byMin(page, '1'), unitPrice: '11.000' });

    const declined = page.save();
    await tick();
    returnToDraftDialog(page).close(false);
    await tick();
    expect(await declined).toBe(false);
    expect((await head(versionId)).status).toBe('TESTED');

    const confirmed = page.save();
    await tick();
    returnToDraftDialog(page).close(true);
    await tick();
    await tick();
    expect(await confirmed).toBe(true);
    expect((await head(versionId)).status).toBe('DRAFT');
    expect(page.status()).toBe('DRAFT');
  });

  it('409 stale version opens the conflict dialog; reload drops the change set and refreshes the token', async () => {
    const bookId = await newBook();
    const versionId = await newDraft(bookId);
    const page = await openPage(bookId, versionId);
    page.onEntryChange({ ...byMin(page, '1'), unitPrice: '13.000' });

    // Somebody else saves the version meanwhile.
    await run(updateVersion(versionId, { notes: 'elsewhere' }, page.currentIfMatch()));
    const saved = page.save();
    await tick();
    expect(await saved).toBe(false);
    expect(conflictOpen()).toBe(true);
    expect(page.dirty()).toBe(true);

    conflictDialog().chooseReload();
    await tick();
    await tick();
    expect(page.dirty()).toBe(false);
    expect(page.currentIfMatch()).toBe((await head(versionId)).version);
    expect((await stored(versionId)).entries.find((e) => e.minimumQuantity === '1')?.unitPrice).toBe('10.000');
  });

  it('409 stale version, keep mine: the change set stays for another try', async () => {
    const bookId = await newBook();
    const versionId = await newDraft(bookId);
    const page = await openPage(bookId, versionId);
    page.onEntryChange({ ...byMin(page, '1'), unitPrice: '13.000' });
    await run(updateVersion(versionId, { notes: 'elsewhere' }, page.currentIfMatch()));

    const saved = page.save();
    await tick();
    expect(await saved).toBe(false);
    conflictDialog().chooseKeep();
    await tick();
    expect(page.dirty()).toBe(true);
  });

  it('server tier overlap between saved lines marks both rows with the other line number', async () => {
    const bookId = await newBook();
    const versionId = await newDraft(bookId);
    const page = await openPage(bookId, versionId);
    const a = byMin(page, '1');
    const b = byMin(page, '20');
    const lineOf = (id: string) => page.serverEntries().findIndex((e) => e.id === id) + 1;
    const [lineA, lineB] = [lineOf(a.id), lineOf(b.id)];

    // [5, ∞) now overlaps [1, 10).
    page.onEntryChange({ ...b, minimumQuantity: '5' });
    const saved = page.save();
    await tick();
    await tick();
    expect(await saved).toBe(false);

    expect(page.showLineErrors()).toBe(true);
    expect(page.serverOverlapErrors().get(a.id)).toBe(lineB);
    expect(page.serverOverlapErrors().get(b.id)).toBe(lineA);
    expect(notify.error).not.toHaveBeenCalled();
  });

  it('server tier overlap on a new line: today the error is keyed by the backend row name newIndex:0', async () => {
    const bookId = await newBook();
    const versionId = await newDraft(bookId);
    const page = await openPage(bookId, versionId);
    const a = byMin(page, '1');

    page.onAddLine();
    const blank = page.allNewLines()[0];
    page.onEntryChange({ ...blank, itemId: ITEM, itemCode: 'X', uomId: UOM, minimumQuantity: '2', maximumQuantity: '5', unitPrice: '9.000' });
    const saved = page.save();
    await tick();
    await tick();
    expect(await saved).toBe(false);

    expect([...page.serverOverlapErrors().keys()].sort()).toEqual([a.id, 'newIndex:0'].sort());
    expect(page.serverOverlapErrors().has(blank.id)).toBe(false);
  });

  // The backend names unsaved rows `newIndex:N` (validateEntryTiers); the page looks only for its temp-line ids.
  it.fails('bug: server tier overlap on a new line marks that new row (newIndex:N is never mapped to the temp row)', async () => {
    const bookId = await newBook();
    const versionId = await newDraft(bookId);
    const page = await openPage(bookId, versionId);

    page.onAddLine();
    const blank = page.allNewLines()[0];
    page.onEntryChange({ ...blank, itemId: ITEM, itemCode: 'X', uomId: UOM, minimumQuantity: '2', maximumQuantity: '5', unitPrice: '9.000' });
    const saved = page.save();
    await tick();
    await tick();
    expect(await saved).toBe(false);

    expect(page.serverOverlapErrors().has(blank.id)).toBe(true);
  });
});

describe('PriceVersionPage publish and maker-checker', () => {
  it('the maker cannot publish their own tested version: caption, warning, no dialog', async () => {
    const bookId = await newBook();
    const versionId = await tested(bookId);
    const page = await openPage(bookId, versionId);

    expect(page.publishBlocked()).toBe(true);
    expect(page.makerCheckerCaption()).toBe(enPricing.lines.makerCheckerNote);
    page.openPublishDialog();
    await tick();
    expect(notify.warning).toHaveBeenCalledWith(enGovernance.makerChecker.self);
    expect(publishDialog().isOpen()).toBe(false);
    expect((await head(versionId)).status).toBe('TESTED');
  });

  it('a checker publishes a colleague\'s version; a future start is scheduled and the page reloads', async () => {
    const bookId = await newBook();
    const versionId = await tested(bookId, FROM, FAKE_COLLEAGUE);
    const page = await openPage(bookId, versionId);
    expect(page.publishBlocked()).toBe(false);
    expect(page.makerCheckerCaption()).toBeNull();

    page.openPublishDialog();
    await tick();
    const dialog = publishDialog();
    expect(dialog.isOpen()).toBe(true);
    const submit = dialog.view.submit();
    await tick();
    await tick();
    await submit;

    expect((await head(versionId)).status).toBe('SCHEDULED');
    expect(page.status()).toBe('SCHEDULED');
    expect(page.editable()).toBe(false);
    expect(page.currentIfMatch()).toBe((await head(versionId)).version);
    expect(notify.success).toHaveBeenCalledWith(enPricing.toasts.scheduled);
    expect(dialog.isOpen()).toBe(false);
  });

  it('an eligible solo owner must attest before publishing their own version', async () => {
    setFakeSoloOwnerEligible(FAKE_ME, true);
    const bookId = await newBook();
    const versionId = await tested(bookId);
    const page = await openPage(bookId, versionId);
    expect(page.detail()?.soloOwnerGovernanceEligible).toBe(true);
    expect(page.publishBlocked()).toBe(false);

    page.openPublishDialog();
    await tick();
    const dialog = publishDialog();
    const unattested = dialog.view.submit();
    await tick();
    await unattested;
    expect((await head(versionId)).status).toBe('TESTED');

    dialog.view.soloOwnerAttestation.set(true);
    const attested = dialog.view.submit();
    await tick();
    await tick();
    await attested;
    expect((await head(versionId)).status).toBe('SCHEDULED');
    expect(page.detail()?.auditTrail.some((a) => a.action === 'SOLO_OWNER_SCHEDULE')).toBe(true);
  });

  it('the server still refuses the maker when solo-owner eligibility was withdrawn after load', async () => {
    setFakeSoloOwnerEligible(FAKE_ME, true);
    const bookId = await newBook();
    const versionId = await tested(bookId);
    const page = await openPage(bookId, versionId);
    page.openPublishDialog();
    await tick();
    setFakeSoloOwnerEligible(FAKE_ME, false);

    const dialog = publishDialog();
    dialog.view.soloOwnerAttestation.set(true);
    const submit = dialog.view.submit();
    await tick();
    await submit;
    expect(notify.error).toHaveBeenCalledWith(enGovernance.errors['TRADE.APPROVAL.MAKER_CHECKER_REQUIRED']);
    expect((await head(versionId)).status).toBe('TESTED');
    expect(dialog.isOpen()).toBe(true);
  });

  it('replaces the live version by default and stamps its supersededAt with the new start', async () => {
    const bookId = await newBook();
    const liveId = await published(bookId, '2026-11-01T00:00:00.000Z');
    const versionId = await tested(bookId, FROM, FAKE_COLLEAGUE);
    const page = await openPage(bookId, versionId);

    page.openPublishDialog();
    await tick();
    const dialog = publishDialog();
    expect(dialog.view.supersedesId()).toBe(liveId);
    const submit = dialog.view.submit();
    await tick();
    await tick();
    await submit;

    expect((await head(versionId)).status).toBe('SCHEDULED');
    const live = await head(liveId);
    expect(live.supersededAt).toBe(FROM);
    expect(live.supersededByVersionId).toBe(versionId);
  });

  it('supersession error: the start passed while the dialog was open (retroactive_supersession)', async () => {
    const bookId = await newBook();
    await published(bookId, '2026-11-01T00:00:00.000Z');
    const versionId = await tested(bookId, FROM, FAKE_COLLEAGUE);
    const page = await openPage(bookId, versionId);
    page.openPublishDialog();
    await tick();

    vi.setSystemTime(new Date('2026-12-02T00:00:00.000Z'));
    const dialog = publishDialog();
    const submit = dialog.view.submit();
    await tick();
    await submit;

    expect(notify.error).toHaveBeenCalledWith(
      enPricing.priceErrors['TRADE.PRICE.PUBLISH_NOT_ALLOWED.retroactive_supersession'],
    );
    expect((await head(versionId)).status).toBe('TESTED');
    expect(page.status()).toBe('TESTED');
  });

  it('supersession error: the chosen version was replaced meanwhile (predecessor_invalid)', async () => {
    const bookId = await newBook();
    const liveId = await published(bookId, '2026-11-01T00:00:00.000Z');
    const versionId = await tested(bookId, '2026-12-10T00:00:00.000Z', FAKE_COLLEAGUE);
    const page = await openPage(bookId, versionId);
    page.openPublishDialog();
    await tick();

    // Another successor replaces the live version first.
    const other = await tested(bookId, '2026-11-25T00:00:00.000Z');
    setFakeActor(FAKE_COLLEAGUE);
    await run(publishVersion(other, { supersedesVersionId: liveId }));
    setFakeActor(FAKE_ME);

    const dialog = publishDialog();
    expect(dialog.view.supersedesId()).toBe(liveId);
    const submit = dialog.view.submit();
    await tick();
    await submit;

    expect(notify.error).toHaveBeenCalledWith(enPricing.priceErrors['TRADE.PRICE.PUBLISH_NOT_ALLOWED.predecessor_invalid']);
    expect((await head(versionId)).status).toBe('TESTED');
  });

  it('publishing over a live version without replacing it is a version overlap', async () => {
    const bookId = await newBook();
    await published(bookId, '2026-11-01T00:00:00.000Z');
    const versionId = await tested(bookId, FROM, FAKE_COLLEAGUE);
    const page = await openPage(bookId, versionId);
    page.openPublishDialog();
    await tick();

    const dialog = publishDialog();
    dialog.view.supersedesId.set('');
    const submit = dialog.view.submit();
    await tick();
    await submit;

    expect(notify.error).toHaveBeenCalledWith(enGovernance.errors['TRADE.PRICE.VERSION_OVERLAP']);
    expect((await head(versionId)).status).toBe('TESTED');
  });

  it('a stale publish closes the dialog and opens the page conflict dialog', async () => {
    const bookId = await newBook();
    const versionId = await tested(bookId, FROM, FAKE_COLLEAGUE);
    const page = await openPage(bookId, versionId);
    page.openPublishDialog();
    await tick();

    // A re-test elsewhere bumps the version while it stays TESTED.
    setFakeActor(FAKE_COLLEAGUE);
    await run(testVersion(versionId, page.currentIfMatch()));
    setFakeActor(FAKE_ME);

    const dialog = publishDialog();
    const submit = dialog.view.submit();
    await tick();
    await submit;

    expect(dialog.isOpen()).toBe(false);
    expect(conflictOpen()).toBe(true);
    expect((await head(versionId)).status).toBe('TESTED');
  });
});
