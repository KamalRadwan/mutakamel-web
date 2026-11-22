import { Injectable } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { TranslocoLoader, provideTransloco } from '@jsverse/transloco';
import { map, timer } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Notify } from '../../../../../core/notify/notify';
import {
  fakeApplyChange,
  fakeGetOperation,
  fakeGetSubscription,
  fakePrepareChange,
  fakeQuoteChange,
  setFakeBillingOwner,
} from '../../billing.fake';
import { CommercialPreview, PrepareBody, SubscriptionView } from '../../billing.model';
import { CHANGE_JOURNAL_KEY, readChangeJournal } from '../change-journal';
import { ChangePage } from './change-page';

/*
 * Runs on the real billing fake (vi.mock of relative modules is not supported by the Angular unit-test
 * builder). The fake's subscription is module-level and every apply moves its revision on, so the
 * expectations read the subscription back from the fake instead of hard-coding a revision.
 */

@Injectable()
class EmptyLoader implements TranslocoLoader {
  /** Async like the HTTP loader: a synchronous loader emits during a render and throws NG0600. */
  getTranslation() {
    return timer(0).pipe(map(() => ({})));
  }
}

const dialogProto = HTMLDialogElement.prototype as unknown as Record<string, unknown>;
const originalDialog = { showModal: dialogProto['showModal'], close: dialogProto['close'] };

// Protected members are reached through this view on purpose: the spec reads the page state directly.
type Internals = Record<string, any>;

let fixture: ComponentFixture<ChangePage>;
let c: Internals;

async function flush(ms = 1000): Promise<void> {
  fixture.detectChanges();
  await vi.advanceTimersByTimeAsync(ms);
  fixture.detectChanges();
}

async function settle<T>(promise: Promise<T>): Promise<T> {
  await vi.advanceTimersByTimeAsync(400);
  return promise;
}

async function subscriptionNow(): Promise<SubscriptionView> {
  return settle(fakeGetSubscription());
}

/** Another owner applies a change first (Accounting +1 seat), which moves the subscription revision on. */
async function applyElsewhere(): Promise<void> {
  const sub = await subscriptionNow();
  const accounting = sub.baseItems.find((b) => b.applicationKey === 'accounting')!;
  const body: PrepareBody = {
    expectedSubscriptionRevision: sub.subscriptionRevision,
    changes: [
      {
        sourceKind: 'APPLICATION',
        operation: 'CHANGE',
        selectionKey: crypto.randomUUID(),
        itemId: accounting.id,
        seats: accounting.seats + 1,
      },
    ],
  };
  const op = await settle(fakePrepareChange(body, crypto.randomUUID()));
  await settle(fakeGetOperation(op.operationId));
  await settle(fakeGetOperation(op.operationId));
  const preview = await settle(fakeQuoteChange({ ...body, preparationId: op.operationId }, crypto.randomUUID()));
  await settle(fakeApplyChange(preview.previewId, crypto.randomUUID()));
}

function root(): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

function button(label: string, scope: ParentNode = root()): HTMLButtonElement | undefined {
  return Array.from(scope.querySelectorAll<HTMLButtonElement>('button')).find(
    (b) => b.textContent?.trim() === label,
  );
}

function conflictDialog(): HTMLDialogElement {
  // The second ui-modal on the page; the first is the unfinished-change journal modal.
  return root().querySelectorAll<HTMLDialogElement>('ui-modal dialog')[1];
}

function toasts(type: string): string[] {
  return TestBed.inject(Notify)
    .toasts()
    .filter((t) => t.type === type)
    .map((t) => t.title);
}

async function render(url = '/'): Promise<void> {
  const navigating = TestBed.inject(Router).navigateByUrl(url);
  await vi.advanceTimersByTimeAsync(0);
  await navigating;
  fixture = TestBed.createComponent(ChangePage);
  c = fixture.componentInstance as unknown as Internals;
  await flush();
}

async function typeNewSeats(value: string): Promise<void> {
  const input = root().querySelector<HTMLInputElement>('app-change-row input[type="number"]')!;
  input.value = value;
  input.dispatchEvent(new Event('input'));
  await flush(0);
}

/** Review: prepare, two operation polls (2 s apart) and the quote, all on the fake's clock. */
async function review(): Promise<void> {
  button('bsub.change.reviewBtn')!.click();
  await flush(7000);
}

async function confirmApply(): Promise<void> {
  button('bsub.change.confirmBtn')!.click();
  await flush();
}

/** Opens the page with a locked Trade seat row and moves it to the review step with a live quote. */
async function quoteTradeSeats(seats: number): Promise<CommercialPreview> {
  await render('/?add=seats:base-trade');
  await typeNewSeats(String(seats));
  await review();
  expect(c['reviewPhase']()).toBe('quoted');
  return c['preview']() as CommercialPreview;
}

beforeEach(() => {
  vi.useFakeTimers();
  sessionStorage.removeItem(CHANGE_JOURNAL_KEY);
  setFakeBillingOwner(true);
  dialogProto['showModal'] = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  dialogProto['close'] = function (this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    // Browsers fire "close" from a queued task, after the dialog's own click handler has finished.
    setTimeout(() => this.dispatchEvent(new Event('close')), 0);
  };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideTransloco({
        config: { availableLangs: ['en', 'ar'], defaultLang: 'en', missingHandler: { logMissingKey: false } },
        loader: EmptyLoader,
      }),
    ],
  });
});

afterEach(() => {
  fixture?.destroy();
  TestBed.resetTestingModule();
  sessionStorage.removeItem(CHANGE_JOURNAL_KEY);
  setFakeBillingOwner(true);
  dialogProto['showModal'] = originalDialog.showModal;
  dialogProto['close'] = originalDialog.close;
  vi.useRealTimers();
});

describe('ChangePage, plan change and preview', () => {
  it('prefills a locked seat row from ?add=seats:<itemId> and keeps Review off until the seats change', async () => {
    await render('/?add=seats:base-trade');
    const trade = (await subscriptionNow()).baseItems.find((b) => b.id === 'base-trade')!;

    expect(c['cart']()).toEqual([
      expect.objectContaining({ kind: 'change-seats', targetKind: 'APPLICATION', targetId: 'base-trade', locked: true }),
    ]);
    expect(button('bsub.change.reviewBtn')!.disabled).toBe(true);

    await typeNewSeats(String(trade.seats));
    expect(button('bsub.change.reviewBtn')!.disabled).toBe(true);

    await typeNewSeats(String(trade.seats + 2));
    expect(button('bsub.change.reviewBtn')!.disabled).toBe(false);
  });

  it('warns and leaves the cart empty when the ?add= prefill does not match the subscription', async () => {
    await render('/?add=seats:base-missing');

    expect(c['cart']()).toEqual([]);
    expect(toasts('warning')).toEqual(['bsub.change.toasts.prefillSkipped']);
  });

  it('prepares, polls and quotes the change, then shows the quote with Confirm and journals the preview', async () => {
    const sub = await subscriptionNow();
    const trade = sub.baseItems.find((b) => b.id === 'base-trade')!;

    const preview = await quoteTradeSeats(trade.seats + 1);

    expect(c['step']()).toBe(2);
    expect(preview.subscriptionRevision).toBe(sub.subscriptionRevision);
    expect(preview.changes).toEqual([
      expect.objectContaining({ sourceKind: 'APPLICATION', operation: 'CHANGE', itemId: 'base-trade', toSeats: trade.seats + 1 }),
    ]);
    expect(root().querySelector('app-quote-view')).not.toBeNull();
    expect(button('bsub.change.confirmBtn')).toBeDefined();
    expect(c['remainingSeconds']()).toBeGreaterThan(0);
    expect(readChangeJournal()).toEqual(
      expect.objectContaining({
        operationId: preview.operationId,
        previewId: preview.previewId,
        body: expect.objectContaining({ expectedSubscriptionRevision: sub.subscriptionRevision }),
      }),
    );
  });

  it('Back cancels the preparation, clears the journal and returns to step 1 with the cart kept', async () => {
    await quoteTradeSeats(12);

    button('bill.common.back')!.click();
    await flush();

    expect(c['step']()).toBe(1);
    expect(readChangeJournal()).toBeNull();
    expect(c['cart']()).toEqual([expect.objectContaining({ kind: 'change-seats', targetId: 'base-trade', newSeats: '12' })]);
  });
});

describe('ChangePage, apply', () => {
  it('applies the quoted preview, shows the receipt step and clears the journal', async () => {
    const before = (await subscriptionNow()).baseItems.find((b) => b.id === 'base-trade')!;
    const preview = await quoteTradeSeats(before.seats + 1);

    await confirmApply();

    expect(c['step']()).toBe(3);
    expect(c['receipt']()).toEqual(expect.objectContaining({ previewId: preview.previewId }));
    expect(root().textContent).toContain('bsub.change.done.title');
    expect(readChangeJournal()).toBeNull();
    const after = await subscriptionNow();
    expect(after.baseItems.find((b) => b.id === 'base-trade')!.seats).toBe(before.seats + 1);
    expect(await fixture.componentInstance.canDeactivate()).toBe(true);
  });

  it('opens the conflict modal on SUBSCRIPTION_PLAN_CHANGE_PREVIEW_STALE, and Reload restarts from fresh data', async () => {
    await quoteTradeSeats(15);
    await applyElsewhere();
    const fresh = await subscriptionNow();

    await confirmApply();

    expect(conflictDialog().hasAttribute('open')).toBe(true);
    expect(c['step']()).toBe(2);
    expect(c['receipt']()).toBeNull();
    expect(toasts('error')).toEqual([]);

    button('bsub.change.conflict.reload', conflictDialog())!.click();
    await flush();

    expect(conflictDialog().hasAttribute('open')).toBe(false);
    expect(c['step']()).toBe(1);
    expect(c['subscription']().subscriptionRevision).toBe(fresh.subscriptionRevision);
    expect(c['preview']()).toBeNull();
    expect(readChangeJournal()).toBeNull();
    // The Trade row still applies to the reloaded subscription, so it stays in the cart.
    expect(c['cart']()).toEqual([expect.objectContaining({ kind: 'change-seats', targetId: 'base-trade', newSeats: '15' })]);
  });

  it('opens the conflict modal on SUBSCRIPTION_PLAN_CHANGE_PREVIEW_NOT_FOUND, and Keep returns to step 1', async () => {
    const preview = await quoteTradeSeats(16);
    // The fake knows every preview it quoted, so an unknown id stands in for one the server dropped.
    c['preview'].set({ ...preview, previewId: 'prv-missing' });
    await flush(0);

    await confirmApply();

    expect(conflictDialog().hasAttribute('open')).toBe(true);
    expect(toasts('error')).toEqual([]);

    button('bsub.change.conflict.keep', conflictDialog())!.click();
    await flush();

    expect(conflictDialog().hasAttribute('open')).toBe(false);
    expect(c['step']()).toBe(1);
    expect(c['preview']()).toBeNull();
    expect(readChangeJournal()).toBeNull();
    expect(c['cart']()).toEqual([expect.objectContaining({ targetId: 'base-trade', newSeats: '16' })]);
  });

  it('opens the conflict modal when prepare itself answers SUBSCRIPTION_PLAN_CHANGE_PREVIEW_STALE', async () => {
    await render('/?add=seats:base-trade');
    await typeNewSeats('17');
    await applyElsewhere();

    await review();

    expect(conflictDialog().hasAttribute('open')).toBe(true);
    expect(toasts('error')).toEqual([]);
  });
});

describe('ChangePage, free-seats row error', () => {
  it('puts SEAT_DOWNGRADE_FREE_UP_REQUIRED on the application seat row with a Free seats link, back on step 1', async () => {
    await render('/?add=seats:base-crm');
    // The fake's CRM has 22 seats in use, so 20 needs seats freed first.
    await typeNewSeats('20');

    await review();

    expect(c['step']()).toBe(1);
    expect(toasts('error')).toEqual(['bill.errors.generic']);
    expect(c['cart']()).toEqual([
      expect.objectContaining({
        kind: 'change-seats',
        targetId: 'base-crm',
        serverError: 'bill.errors.generic',
        freeSeatsModuleKey: 'crm',
        touched: true,
      }),
    ]);
    const link = Array.from(root().querySelectorAll<HTMLAnchorElement>('app-change-row a')).find(
      (a) => a.textContent?.trim() === 'bsub.change.freeSeats',
    )!;
    expect(decodeURIComponent(link.getAttribute('href') ?? '')).toBe('/workspace/billing/subscription/seats/reduce?module=crm');
  });

  it('clears the free-seats error when the change is reviewed again', async () => {
    await render('/?add=seats:base-crm');
    await typeNewSeats('20');
    await review();
    expect(c['cart']()[0].freeSeatsModuleKey).toBe('crm');

    await typeNewSeats('30');
    button('bsub.change.reviewBtn')!.click();
    await flush(0);

    expect(c['cart']()[0]).toEqual(expect.objectContaining({ serverError: null, freeSeatsModuleKey: null }));
  });
});

describe('ChangePage, access', () => {
  it('shows the forbidden state to a non-owner and loads nothing', async () => {
    setFakeBillingOwner(false);
    await render('/?add=seats:base-trade');

    expect(root().querySelector('app-billing-forbidden')).not.toBeNull();
    expect(c['subscription']()).toBeNull();
    expect(c['loading']()).toBe(false);
  });
});
