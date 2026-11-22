import { Component, ElementRef, computed, effect, inject, input, model, output, signal, untracked, viewChild } from '@angular/core';
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerLock, tablerX } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { ScopeState } from '../../../../../core/scope/scope';
import { Dropdown, type DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { listTermOptions } from '../../../shared/terms/terms.api';
import {
  TERM_LIMITS,
  type TermDocumentType,
  type TermOptions,
  type TermSelections,
  type TradeTerm,
} from '../../../shared/terms/terms.model';
import { TradeTermsSelect } from '../../../shared/terms/terms-select/terms-select';
import { tradeContext } from '../../../shared/trade-api';
import { itemName } from '../../../shared/trade-foundation.api';
import type {
  DocumentKind,
  TermsSnapshot,
  TermsSnapshotClause,
  TermsSnapshotLocale,
  TermsSnapshotV2,
} from '../../shared/document.model';
import type { PageMode } from '../document-draft';
import { TERMS_NOTES_MAX_LENGTH } from '../../shared/document.model';
import { smoothScrollBehavior } from '../../../../../shared/ui/scroll/scroll-into-view';

const TERM_DOC_TYPE_BY_KIND: Readonly<Record<DocumentKind, TermDocumentType>> = {
  quotation: 'QUOTATION',
  'sales-order': 'SALES_ORDER',
  'purchase-order': 'PURCHASE_ORDER',
  'purchase-quotation': 'PURCHASE_QUOTATION',
};

export { TERMS_NOTES_MAX_LENGTH };

interface ResolvedSnapshotView {
  payment: string;
  delivery: string;
  warranty: string;
  clauses: TermsSnapshotClause[];
  notes: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function pickString(obj: Record<string, unknown> | TermsSnapshotLocale | undefined, key: keyof TermsSnapshotLocale): string {
  if (!obj) return '';
  const val = (obj as Record<string, unknown>)[key];
  return typeof val === 'string' ? val.trim() : '';
}

function pickClauses(obj: Record<string, unknown> | TermsSnapshotLocale | undefined): TermsSnapshotClause[] {
  if (!obj) return [];
  const raw = (obj as Record<string, unknown>)['clauses'];
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (entry): entry is TermsSnapshotClause =>
      isRecord(entry) && typeof entry['title'] === 'string' && typeof entry['body'] === 'string',
  );
}

function resolveSnapshotView(
  snapshot: TermsSnapshot | null,
  lang: 'en' | 'ar',
  fallbackNotes: string,
): ResolvedSnapshotView {
  if (!isRecord(snapshot)) {
    return { payment: '', delivery: '', warranty: '', clauses: [], notes: fallbackNotes.trim() };
  }

  const v2 = snapshot as unknown as TermsSnapshotV2;
  const localized = v2.localized;
  const primary = localized ? localized[lang] : undefined;
  const secondary = localized ? localized[lang === 'ar' ? 'en' : 'ar'] : undefined;

  const payment =
    pickString(primary, 'paymentTerms') ||
    pickString(snapshot, 'paymentTerms') ||
    pickString(secondary, 'paymentTerms');
  const delivery =
    pickString(primary, 'deliveryTerms') ||
    pickString(snapshot, 'deliveryTerms') ||
    pickString(secondary, 'deliveryTerms');
  const warranty =
    pickString(primary, 'warrantyTerms') ||
    pickString(snapshot, 'warrantyTerms') ||
    pickString(secondary, 'warrantyTerms');
  const primaryClauses = pickClauses(primary);
  const directClauses = pickClauses(snapshot);
  const secondaryClauses = pickClauses(secondary);
  const clauses =
    primaryClauses.length > 0 ? primaryClauses : directClauses.length > 0 ? directClauses : secondaryClauses;
  const notes =
    pickString(primary, 'notes') ||
    pickString(snapshot, 'notes') ||
    pickString(secondary, 'notes') ||
    fallbackNotes.trim();

  return { payment, delivery, warranty, clauses, notes };
}

@Component({
  selector: 'app-terms-section',
  imports: [NgIcon, TranslocoPipe, Field, Dropdown, TradeTermsSelect],
  providers: [
    provideTranslocoScope({ scope: 'trade-shared', alias: 'tradeShared' }, { scope: 'trade-documents-page', alias: 'tdpg' }),
    provideIcons({ tablerLock, tablerX }),
  ],
  templateUrl: './terms-section.html',
  host: { class: 'block min-w-0' },
})
export class TermsSection {
  private static nextId = 0;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly scope = inject(ScopeState);
  protected readonly lang = inject(LanguageState).current;
  private readonly termsSelect = viewChild(TradeTermsSelect);

  protected readonly uid = `doc-terms-${++TermsSection.nextId}`;

  readonly kind = input.required<DocumentKind>();
  readonly mode = input.required<PageMode>();
  readonly termSelections = model.required<TermSelections>();
  readonly notes = model.required<string>();
  readonly termsSnapshot = input<TermsSnapshot | null>(null);
  readonly lockedSelections = input<TermSelections | null>(null);
  readonly sourceNotesLocked = input(false);
  readonly showErrors = input(false);
  readonly paymentError = input<string | null>(null);
  readonly notesError = input<string | null>(null);

  readonly defaultsApplied = output<TermSelections>();

  private pendingApplyDefaults = false;
  private expectingDefaults = false;
  private optionsLoadSeq = 0;
  private readonly termOptions = signal<TermOptions | null>(null);
  protected readonly clausePick = signal<string | null>(null);

  protected readonly termDocumentType = computed<TermDocumentType>(() => TERM_DOC_TYPE_BY_KIND[this.kind()]);
  readonly notesMaxLength = computed(() => TERMS_NOTES_MAX_LENGTH);
  protected readonly isReadonly = computed(() => this.mode() === 'readonly');
  protected readonly isConvert = computed(
    () => this.mode() === 'convert-quotation' || this.mode() === 'convert-purchase-quotation',
  );

  protected readonly paymentLocked = computed(
    () => this.isConvert() && Boolean(this.lockedSelections()?.paymentTermId),
  );
  protected readonly deliveryLocked = computed(
    () => this.isConvert() && Boolean(this.lockedSelections()?.deliveryTermId),
  );
  protected readonly warrantyLocked = computed(
    () => this.isConvert() && Boolean(this.lockedSelections()?.warrantyTermId),
  );
  protected readonly clausesLocked = computed(
    () => this.isConvert() && (this.lockedSelections()?.clauseIds.length ?? 0) > 0,
  );
  protected readonly notesLocked = computed(() => this.isReadonly() || (this.isConvert() && this.sourceNotesLocked()));
  protected readonly notesLength = computed(() => [...this.notes()].length);
  protected readonly notesTooLong = computed(() => !this.notesLocked() && this.notesLength() > this.notesMaxLength());

  protected readonly useSelectiveConvertLayout = computed(
    () =>
      this.isConvert() &&
      (this.paymentLocked() || this.deliveryLocked() || this.warrantyLocked() || this.clausesLocked()),
  );

  protected readonly snapshotView = computed<ResolvedSnapshotView>(() =>
    resolveSnapshotView(this.termsSnapshot(), this.lang(), this.notes()),
  );

  protected readonly paymentDropdownOptions = computed<DropdownOption<string | null>[]>(() =>
    this.toOptions(this.termOptions()?.byType.PAYMENT ?? []),
  );
  protected readonly deliveryDropdownOptions = computed<DropdownOption<string | null>[]>(() =>
    this.toOptions(this.termOptions()?.byType.DELIVERY ?? []),
  );
  protected readonly warrantyDropdownOptions = computed<DropdownOption<string | null>[]>(() =>
    this.toOptions(this.termOptions()?.byType.WARRANTY ?? []),
  );
  protected readonly availableClauseOptions = computed<DropdownOption<string | null>[]>(() => {
    const selected = new Set(this.termSelections().clauseIds);
    const opts = this.termOptions();
    const list = [...(opts?.byType.RETURNS ?? []), ...(opts?.byType.GENERAL ?? [])].filter(
      (term) => !selected.has(term.id),
    );
    return this.toOptions(list);
  });

  protected readonly termById = computed<ReadonlyMap<string, TradeTerm>>(() => {
    const map = new Map<string, TradeTerm>();
    const opts = this.termOptions();
    if (!opts) return map;
    for (const list of Object.values(opts.byType)) {
      for (const term of list) {
        map.set(term.id, term);
      }
    }
    return map;
  });

  protected readonly maxClauses = TERM_LIMITS.maxClauses;
  protected readonly clausesAtMax = computed(() => this.termSelections().clauseIds.length >= TERM_LIMITS.maxClauses);

  readonly valid = computed<boolean>(() => {
    if (this.isReadonly()) return true;
    if (this.notesTooLong()) return false;
    const select = this.termsSelect();
    if (select) {
      return select.valid();
    }
    if (this.kind() === 'quotation' && !this.termSelections().paymentTermId) {
      return false;
    }
    return true;
  });

  constructor() {
    effect(() => {
      const select = this.termsSelect();
      if (select && this.pendingApplyDefaults) {
        this.pendingApplyDefaults = false;
        untracked(() => select.applyDefaults());
      }
    });

    effect(() => {
      const needOptions = this.useSelectiveConvertLayout();
      const docType = this.termDocumentType();
      const companyId = this.scope.company().id;
      this.lang();
      if (!needOptions) return;
      untracked(() => void this.loadConvertOptions(docType, companyId));
    });
  }

  applyDefaults(): void {
    this.expectingDefaults = true;
    const select = this.termsSelect();
    if (select) {
      select.applyDefaults();
      return;
    }
    this.pendingApplyDefaults = true;
  }

  focusPaymentTerms(): boolean {
    const btn =
      this.host.nativeElement.querySelector<HTMLElement>(`#${this.uid}-payment`) ??
      this.host.nativeElement.querySelector<HTMLElement>(`#${this.uid}-payment-dd`);
    if (!btn) return false;
    btn.scrollIntoView({ behavior: smoothScrollBehavior(), block: 'center' });
    btn.focus({ preventScroll: true });
    return true;
  }

  focusNotes(): boolean {
    const el = this.host.nativeElement.querySelector<HTMLElement>(`#${this.uid}-notes`);
    if (!el) return false;
    el.scrollIntoView({ behavior: smoothScrollBehavior(), block: 'center' });
    el.focus({ preventScroll: true });
    return true;
  }

  protected onUserSelectInteraction(): void {
    this.expectingDefaults = false;
  }

  protected onSelectValueChange(next: TermSelections): void {
    this.termSelections.set(next);
    if (this.expectingDefaults) {
      this.expectingDefaults = false;
      this.defaultsApplied.emit(next);
    }
  }

  protected onNotesInput(event: Event): void {
    if (this.notesLocked()) return;
    this.notes.set((event.target as HTMLTextAreaElement).value);
  }

  protected setSingleSlot(slot: 'paymentTermId' | 'deliveryTermId' | 'warrantyTermId', id: string | null): void {
    if (this.isReadonly()) return;
    this.termSelections.update((curr) => ({ ...curr, [slot]: id }));
  }

  protected addClause(clauseId: string | null): void {
    if (!clauseId || this.isReadonly() || this.clausesAtMax()) return;
    this.termSelections.update((curr) =>
      curr.clauseIds.includes(clauseId) ? curr : { ...curr, clauseIds: [...curr.clauseIds, clauseId] },
    );
    this.clausePick.set(null);
  }

  protected removeClauseAt(index: number): void {
    if (this.isReadonly() || this.clausesLocked()) return;
    this.termSelections.update((curr) => ({
      ...curr,
      clauseIds: curr.clauseIds.filter((_, idx) => idx !== index),
    }));
  }

  protected termDisplayLabel(id: string): string {
    const term = this.termById().get(id);
    if (!term) return id;
    const name = itemName(term, this.lang()) || term.displayName || term.code;
    return `${term.code} · ${name}`;
  }

  private toOptions(terms: readonly TradeTerm[]): DropdownOption<string | null>[] {
    const lang = this.lang();
    return terms.map((term) => {
      const name = itemName(term, lang) || term.displayName || term.code;
      return { value: term.id, label: `${term.code} · ${name}` };
    });
  }

  private async loadConvertOptions(docType: TermDocumentType, companyId: string): Promise<void> {
    const seq = ++this.optionsLoadSeq;
    try {
      const opts = await listTermOptions(docType, { companyId });
      if (seq !== this.optionsLoadSeq) return;
      this.termOptions.set(opts);
    } catch {
      if (seq !== this.optionsLoadSeq) return;
      this.termOptions.set(null);
    }
  }
}
