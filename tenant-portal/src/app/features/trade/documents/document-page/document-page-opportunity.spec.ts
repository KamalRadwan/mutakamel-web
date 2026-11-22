import { Injectable } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { TranslocoLoader, type Translation, provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeCreateQuotation } from '../shared/documents.fake';
import { DocumentPage } from './document-page';

const TDPG_EN: Translation = {
  header: {
    back: 'Back to list',
    revision: 'Revision {{n}}',
    fromQuotation: 'From quotation {{number}}',
    fromPurchaseQuotation: 'From supplier quotation {{number}}',
    opportunityLink: 'Linked opportunity: {{name}}',
  },
  save: {
    save: 'Save',
    newRevision: 'Save as new revision',
    create: {
      quotation: 'Create quotation',
      'sales-order': 'Create sales order',
      'purchase-order': 'Create purchase order',
      'purchase-quotation': 'Create purchase quotation',
    },
  },
  sections: {
    items: 'Items',
    terms: 'Terms',
    revisions: 'Revisions',
  },
  itemsNote: {
    lineDiscount: 'Discount per line · your limit {{max}} %',
  },
  fields: {
    customer: 'Customer',
    customerHint: 'Choose the customer for this document.',
    customerPlaceholder: 'Select customer',
    customerSearchPlaceholder: 'Search customers...',
    contact: 'Contact person',
    contactHint: 'Optional contact person at the customer.',
    contactPlaceholder: 'Select contact person',
    contactNotNeeded: 'Not needed for a person',
    currency: 'Currency',
    currencyHint: 'Document currency used for pricing and totals.',
    validUntil: 'Valid until',
    validUntilHint: 'Last date this quotation remains valid.',
    validUntilPlaceholder: 'Select date',
    businessDate: 'Business date',
    businessDateHint: 'Accounting and issue date assigned by the system.',
    yourReference: 'Your reference',
    yourReferenceHint: 'Optional internal reference code up to 80 characters.',
    yourReferencePlaceholder: 'Internal reference',
    opportunity: 'Opportunity',
    opportunityHint: 'Link this quotation to an open opportunity of the same customer.',
    opportunityPlaceholder: 'Select opportunity',
    opportunitySearchPlaceholder: 'Search opportunities...',
    opportunityPickCustomerFirst: 'Select a customer first',
    opportunityNotAvailable: 'Opportunity not available',
    clear: 'Clear selection',
    loading: 'Loading...',
    noMatches: 'No matches found.',
    loadFailed: 'Could not load options.',
    today: 'Today',
    prevMonth: 'Previous month',
    nextMonth: 'Next month',
  },
  terms: {
    paymentTerms: 'Payment terms',
    paymentTermsHintQuotation: 'Needed to turn the quotation into a sales order.',
    deliveryTerms: 'Delivery terms',
    deliveryTermsHint: 'Delivery terms applied to this document.',
    warrantyTerms: 'Warranty terms',
    warrantyTermsHint: 'Warranty terms applied to this document.',
    clauses: 'Terms and conditions',
    clausesHint: 'Additional standard clauses attached to this document.',
    notes: 'Notes',
    notesHint: 'Free-text notes shown on the document.',
    notesPlaceholder: 'Add notes...',
    none: '—',
  },
  totals: {
    subtotal: 'Subtotal',
    discount: 'Discount',
    charges: 'Charges',
    tax: 'Tax',
    rounding: 'Rounding',
    grandTotal: 'Grand total',
    amountDue: 'Amount due',
  },
  revisions: {
    empty: 'No revisions yet.',
  },
  confirm: {
    deadlineLabel: 'Requested deadline',
    deadlineHint: 'Stored with the order for reference.',
    receivingWarehouseLabel: 'Receiving warehouse',
    receivingWarehouseHint: 'Choose the warehouse.',
  },
  unsaved: {
    title: 'Save changes?',
    text: 'You have unsaved changes.',
    save: 'Save',
    discard: 'Discard',
    cancel: 'Cancel',
  },
};

const SCOPED_TRANSLATIONS: Record<string, Translation> = {
  en: { tdpg: TDPG_EN },
  'trade-documents-page/en': TDPG_EN,
};

@Injectable()
class TestTranslocoLoader implements TranslocoLoader {
  getTranslation(path: string) {
    return of(SCOPED_TRANSLATIONS[path] ?? {});
  }
}

const dialogProto = HTMLDialogElement.prototype as unknown as Record<string, unknown>;
const originalDialog = { showModal: dialogProto['showModal'], close: dialogProto['close'] };

async function advanceAndTick(fixture: ComponentFixture<DocumentPage>, ms = 350): Promise<void> {
  fixture.detectChanges();
  await vi.advanceTimersByTimeAsync(ms);
  await Promise.resolve();
  fixture.detectChanges();
  await Promise.resolve();
  fixture.detectChanges();
}

describe('DocumentPage opportunity fallback lookup (§2)', () => {
  const fixtures: ComponentFixture<DocumentPage>[] = [];

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.removeItem('lang');
    document.documentElement.lang = 'en';
    dialogProto['showModal'] = function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
    dialogProto['close'] = function (this: HTMLDialogElement) {
      if (!this.hasAttribute('open')) return;
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    };
  });

  afterEach(() => {
    while (fixtures.length > 0) {
      fixtures.pop()!.destroy();
    }
    vi.useRealTimers();
    localStorage.removeItem('lang');
    dialogProto['showModal'] = originalDialog.showModal;
    dialogProto['close'] = originalDialog.close;
  });

  async function mountQuotationPage(id: string): Promise<ComponentFixture<DocumentPage>> {
    const paramMap = convertToParamMap({ id });
    const emptyMap = convertToParamMap({});
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            data: of({ kind: 'quotation' }),
            paramMap: of(paramMap),
            queryParamMap: of(emptyMap),
            snapshot: {
              data: { kind: 'quotation' },
              paramMap,
              queryParamMap: emptyMap,
            },
          },
        },
        provideTransloco({
          config: { availableLangs: ['ar', 'en'], defaultLang: 'en', reRenderOnLangChange: true },
          loader: TestTranslocoLoader,
        }),
      ],
    });

    const fixture = TestBed.createComponent(DocumentPage);
    fixtures.push(fixture);
    await advanceAndTick(fixture, 350);
    return fixture;
  }

  it('shows "Opportunity" while loading and updates to resolved name when fetched via getOpportunity', async () => {
    const createPromise = fakeCreateQuotation({
      partyId: 'pty-alnoor',
      currencyCode: 'EGP',
      sourceCrmOpportunityId: 'opp-02-1',
    });
    await vi.advanceTimersByTimeAsync(350);
    const created = await createPromise;
    expect('sourceCrmOpportunity' in created).toBe(false);

    const fixture = await mountQuotationPage(created.id);
    const el = fixture.nativeElement as HTMLElement;

    // Immediately after document detail loads, opportunity options are still resolving -> generic "Opportunity" link.
    const linkWhileLoading = el.querySelector<HTMLAnchorElement>('a[href="/crm/opportunities/opp-02-1"]');
    expect(linkWhileLoading).not.toBeNull();
    expect(linkWhileLoading!.textContent?.trim()).toBe('Opportunity');

    // Step 1: listOpportunityOptions resolves; step 2: fallback getOpportunity('opp-02-1') resolves.
    await advanceAndTick(fixture, 350);
    await advanceAndTick(fixture, 350);

    const linkAfterResolve = el.querySelector<HTMLAnchorElement>('a[href="/crm/opportunities/opp-02-1"]');
    expect(linkAfterResolve).not.toBeNull();
    expect(linkAfterResolve!.textContent?.trim()).toBe('Warehouse Expansion Supply — Delta Foods');
    expect(linkAfterResolve!.getAttribute('title')).toContain('Warehouse Expansion Supply — Delta Foods');

    const oppTrigger = el.querySelector<HTMLButtonElement>('button[id$="-sourceCrmOpportunityId"]');
    expect(oppTrigger).not.toBeNull();
    expect(oppTrigger!.textContent?.trim()).toContain('Warehouse Expansion Supply — Delta Foods');

    oppTrigger!.click();
    await advanceAndTick(fixture, 50);

    const selectedOption = el.querySelector<HTMLElement>('[role="option"][aria-selected="true"]');
    expect(selectedOption).not.toBeNull();
    expect(selectedOption!.textContent).toContain('Warehouse Expansion Supply — Delta Foods');
  });

  it('shows "Opportunity" header link and "Opportunity not available" dropdown option when getOpportunity returns null', async () => {
    const createPromise = fakeCreateQuotation({
      partyId: 'pty-alnoor',
      currencyCode: 'EGP',
      sourceCrmOpportunityId: 'opp-missing-404',
    });
    await vi.advanceTimersByTimeAsync(350);
    const created = await createPromise;

    const fixture = await mountQuotationPage(created.id);
    await advanceAndTick(fixture, 350);
    await advanceAndTick(fixture, 350);

    const el = fixture.nativeElement as HTMLElement;
    const link = el.querySelector<HTMLAnchorElement>('a[href="/crm/opportunities/opp-missing-404"]');
    expect(link).not.toBeNull();
    expect(link!.textContent?.trim()).toBe('Opportunity');

    const oppTrigger = el.querySelector<HTMLButtonElement>('button[id$="-sourceCrmOpportunityId"]');
    expect(oppTrigger).not.toBeNull();
    expect(oppTrigger!.textContent?.trim()).toContain('Opportunity not available');

    oppTrigger!.click();
    await advanceAndTick(fixture, 50);

    const selectedOption = el.querySelector<HTMLElement>('[role="option"][aria-selected="true"]');
    expect(selectedOption).not.toBeNull();
    expect(selectedOption!.textContent).toContain('Opportunity not available');
  });
});
