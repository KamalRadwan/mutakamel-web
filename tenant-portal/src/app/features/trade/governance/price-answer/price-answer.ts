import { Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerCalculator,
  tablerCopy,
  tablerExternalLink,
  tablerReceipt2,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { Notify } from '../../../../core/notify/notify';
import { Badge } from '../../../../shared/ui/badge/badge';
import { Button } from '../../../../shared/ui/button/button';
import { formatMoney, formatQty } from '../../shared/trade-format';
import type {
  MatchedPromotion,
  PriceEntry,
  PriceVersionBookRef,
  PricingDecision,
  PricingEvaluateErrorCode,
  PromotionRule,
  RejectedCandidate,
} from '../pricing.model';
import { formatDateTime, formatUnitPrice } from '../pricing.service';

export type PriceAnswerErrorCode = PricingEvaluateErrorCode;

export interface PriceAnswerError {
  code: PriceAnswerErrorCode;
}

/**
 * Display data the decision does not carry: the decision holds ids only, so the
 * page reads the matched version (GET /price-book-versions/:id?include=none) and
 * its lines for the item and unit (GET /price-book-versions/:id/entries).
 */
export interface PriceAnswerContext {
  book: Pick<PriceVersionBookRef, 'id' | 'code' | 'name' | 'localizedNames'>;
  entries: readonly PriceEntry[];
  promotions: readonly PromotionRule[];
}

type ErrorActionKind = 'openBooks' | 'changeQuestion';

interface ErrorPresentation {
  titleKey: string;
  messageKey: string;
  actionKind: ErrorActionKind;
}

const ERROR_PRESENTATIONS: Readonly<Record<PriceAnswerErrorCode, ErrorPresentation>> = {
  'TRADE.PRICE.NO_ELIGIBLE_PRICE': {
    titleKey: 'priceEval.answer.errors.noEligiblePriceTitle',
    messageKey: 'priceEval.answer.errors.noEligiblePrice',
    actionKind: 'openBooks',
  },
  'TRADE.PRICE.AMBIGUOUS_RULES': {
    titleKey: 'priceEval.answer.errors.ambiguousRulesTitle',
    messageKey: 'priceEval.answer.errors.ambiguousRules',
    actionKind: 'openBooks',
  },
  'TRADE.CONFIGURATION.DEFAULT_PRICE_BOOK_NOT_FOUND': {
    titleKey: 'priceEval.answer.errors.defaultBookNotFoundTitle',
    messageKey: 'priceEval.answer.errors.defaultBookNotFound',
    actionKind: 'openBooks',
  },
  'TRADE.CONFIGURATION.DEFAULT_PRICE_BOOK_INCOMPATIBLE': {
    titleKey: 'priceEval.answer.errors.defaultBookIncompatibleTitle',
    messageKey: 'priceEval.answer.errors.defaultBookIncompatible',
    actionKind: 'changeQuestion',
  },
  'TRADE.PRICE.BOOK_INVALID': {
    titleKey: 'priceEval.answer.errors.bookInvalidTitle',
    messageKey: 'priceEval.answer.errors.bookInvalid',
    actionKind: 'changeQuestion',
  },
  'TRADE.PRICE.BOOK_NOT_FOUND': {
    titleKey: 'priceEval.answer.errors.bookNotFoundTitle',
    messageKey: 'priceEval.answer.errors.bookNotFound',
    actionKind: 'changeQuestion',
  },
  'TRADE.PRICE.ENTRY_INVALID': {
    titleKey: 'priceEval.answer.errors.entryInvalidTitle',
    messageKey: 'priceEval.answer.errors.entryInvalid',
    actionKind: 'changeQuestion',
  },
};

function shortenMiddle(raw: string): string {
  const clean = raw.trim();
  if (clean.length <= 10) return clean;
  return `${clean.slice(0, 4)}…${clean.slice(-4)}`;
}

function formatTrimmedDecimal(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.includes('.')) return trimmed;
  return trimmed.replace(/\.?0+$/, '');
}

@Component({
  selector: 'app-price-answer',
  imports: [RouterLink, TranslocoPipe, NgIcon, Badge, Button],
  viewProviders: [
    provideTranslocoScope({ scope: 'trade-governance', alias: 'governance' }, { scope: 'trade-shared', alias: 'tradeShared' }, { scope: 'trade-gov-price-eval', alias: 'priceEval' }),
  ],
  providers: [
    provideIcons({
      tablerAlertTriangle,
      tablerCalculator,
      tablerCopy,
      tablerExternalLink,
      tablerReceipt2,
    }),
  ],
  templateUrl: './price-answer.html',
})
export class PriceAnswer {
  private readonly transloco = inject(TranslocoService);
  private readonly langState = inject(LanguageState);
  private readonly notify = inject(Notify);
  private readonly translationTick = translationEvents(this.transloco);

  readonly decision = input<PricingDecision | null>(null);
  readonly context = input<PriceAnswerContext | null>(null);
  readonly error = input<PriceAnswerError | null>(null);
  readonly loading = input(false);
  readonly unitLabel = input('');

  readonly focusQuestion = output<void>();

  protected readonly errorPresentation = computed(() => {
    const err = this.error();
    if (!err) return null;
    return ERROR_PRESENTATIONS[err.code];
  });

  protected readonly formattedFinalUnitPrice = computed(() => {
    const dec = this.decision();
    if (!dec) return '';
    return formatUnitPrice(dec.currencyCode, dec.unitPrice);
  });

  protected readonly resolvedUnitLabel = computed(() => {
    this.translationTick();
    this.langState.current();
    const label = this.unitLabel().trim();
    return label || this.transloco.translate('priceEval.answer.unitFallback');
  });

  protected readonly formattedBasePrice = computed(() => {
    const dec = this.decision();
    if (!dec) return '';
    return formatMoney(dec.currencyCode, dec.baselineUnitPrice);
  });

  protected readonly formattedFloorPrice = computed(() => {
    const dec = this.decision();
    if (!dec || !dec.minimumAllowedPrice) return '';
    return formatMoney(dec.currencyCode, dec.minimumAllowedPrice);
  });

  /** Entries of the matched version keyed by id (from the context read). */
  private readonly entriesById = computed(() => {
    const map = new Map<string, PriceEntry>();
    for (const entry of this.context()?.entries ?? []) map.set(entry.id, entry);
    return map;
  });

  /** Promotion versions of the matched version keyed by promotion version id. */
  private readonly promotionsById = computed(() => {
    const map = new Map<string, PromotionRule>();
    for (const promo of this.context()?.promotions ?? []) map.set(promo.id, promo);
    return map;
  });

  protected readonly bookDisplayName = computed(() => {
    const dec = this.decision();
    if (!dec) return '';
    const book = this.context()?.book;
    if (!book || book.id !== dec.priceBookId) return shortenMiddle(dec.priceBookId);
    const lang = this.langState.current();
    return book.localizedNames?.[lang] || book.localizedNames?.['en'] || book.name || book.code;
  });

  protected readonly sourceKey = computed(() => {
    const dec = this.decision();
    if (!dec?.priceBookSource) return '';
    if (dec.priceBookSource === 'ACCOUNT') {
      return dec.decisionType === 'PURCHASE_PRICE'
        ? 'priceEval.answer.source.ACCOUNT_PURCHASE'
        : 'priceEval.answer.source.ACCOUNT_SALES';
    }
    return `priceEval.answer.source.${dec.priceBookSource}`;
  });

  protected readonly previewBadgeKey = computed(() => {
    const dec = this.decision();
    if (!dec || !dec.previewOfStatus) return null;
    if (dec.previewOfStatus === 'DRAFT' || dec.previewOfStatus === 'TESTED') {
      return `priceEval.answer.previewBadge.${dec.previewOfStatus}`;
    }
    return null;
  });

  protected readonly matchedLineText = computed(() => {
    this.translationTick();
    this.langState.current();
    const dec = this.decision();
    if (!dec) return '';
    const entry = this.entriesById().get(dec.matchedEntryId);
    if (!entry) return shortenMiddle(dec.matchedEntryId);
    const range = this.rangeLabel(entry.minimumQuantity, entry.maximumQuantity);
    const uom = this.unitLabel().trim();
    if (uom) {
      return this.transloco.translate('priceEval.answer.matchedLineSummary', {
        uom,
        range,
        priority: entry.priority,
      });
    }
    return this.transloco.translate('priceEval.answer.matchedLineNoUom', {
      range,
      priority: entry.priority,
    });
  });

  protected readonly calculatedAtText = computed(() => {
    const dec = this.decision();
    if (!dec) return '';
    return formatDateTime(dec.evaluatedAt, this.langState.current());
  });

  protected readonly shortFingerprint = computed(() => {
    const dec = this.decision();
    if (!dec) return '';
    return shortenMiddle(dec.inputFingerprint);
  });

  protected formatDiscount(currencyCode: string, amount: string): string {
    return formatMoney(currencyCode, amount);
  }

  /** "10" for a PERCENTAGE promotion (shown as "(10%)"); null otherwise or when unknown. */
  protected promoPercent(promo: MatchedPromotion): string | null {
    const rule = this.promotionsById().get(promo.promotionVersionId);
    if (!rule || rule.benefit.type !== 'PERCENTAGE') return null;
    return formatTrimmedDecimal(rule.benefit.value);
  }

  protected candidatePrice(currencyCode: string, cand: RejectedCandidate): string {
    const entry = this.entriesById().get(cand.entryId);
    return entry ? formatMoney(currencyCode, entry.unitPrice) : '';
  }

  protected candidateSummary(cand: RejectedCandidate): string {
    const entry = this.entriesById().get(cand.entryId);
    if (!entry) return '';
    const range = this.rangeLabel(entry.minimumQuantity, entry.maximumQuantity);
    const uom = this.unitLabel().trim();
    return uom ? `${uom}, ${range}` : range;
  }

  protected shortId(id: string): string {
    return shortenMiddle(id);
  }

  protected async copyFingerprint(): Promise<void> {
    const fp = this.decision()?.inputFingerprint;
    if (!fp) return;
    try {
      await navigator.clipboard.writeText(fp);
      this.notify.success(this.transloco.translate('priceEval.answer.footer.copied'));
    } catch {
      this.notify.error(this.transloco.translate('priceEval.answer.footer.copyFailed'));
    }
  }

  private rangeLabel(minRaw: string, maxRaw: string | null): string {
    this.translationTick();
    this.langState.current();
    const min = formatQty(minRaw);
    if (maxRaw && maxRaw.trim()) {
      return this.transloco.translate('priceEval.answer.range.between', {
        min,
        max: formatQty(maxRaw),
      });
    }
    return this.transloco.translate('priceEval.answer.range.from', { min });
  }
}
