import { FAKE_COMPANIES } from '../../../../core/scope/scope.fake';
import { ApiError, assertIdempotencyKey, fakeDelay, fakeId, parseIfMatch } from '../trade-api';
import { bumpVersion, clone, fakeLang, nowIso } from '../trade-foundation.fake';
import type { LocalizedNames } from '../trade-foundation.model';
import {
  INCOTERMS,
  TERM_CODE_PATTERN,
  TERM_LIMITS,
  TERM_LIST_LIMITS,
  TERM_SIDES,
  TERM_SIDE_OF,
  TERM_TYPES,
  type CountTermsQuery,
  type Incoterm,
  type ListTermsQuery,
  type TermDocumentType,
  type TermInput,
  type TermCounts,
  type TermOptions,
  type TermPage,
  type TermPatch,
  type TermSide,
  type TermType,
  type TradeTerm,
} from './terms.model';

const T0 = '2026-01-05T08:00:00.000Z';

/** Fake storage row: the company is the scope key, never part of the API response. */
type StoredTerm = TradeTerm & { companyId: string };

interface TermSeed {
  termType: TermType;
  code: string;
  side: TermSide;
  enName: string;
  arName: string;
  enText: string;
  arText: string;
  dueDays?: number;
  incotermCode?: Incoterm;
  isDefault?: boolean;
  isActive?: boolean;
}

const TERM_SEEDS: readonly TermSeed[] = [
  // PAYMENT (6)
  {
    termType: 'PAYMENT',
    code: 'NET30',
    side: 'SALES',
    dueDays: 30,
    isDefault: true,
    enName: 'Net 30 days',
    arName: 'صافي خلال 30 يومًا',
    enText:
      'Full invoice payment is due within 30 calendar days from the invoice issue date by bank transfer or approved cheque. Overdue balances accrue late fees as agreed.',
    arText:
      'يستحق سداد كامل قيمة الفاتورة خلال 30 يومًا ميلاديًا من تاريخ إصدارها عبر التحويل البنكي أو شيك مقبول الدفع. تخضع المبالغ المتأخرة لرسوم التأخير المتفق عليها.',
  },
  {
    termType: 'PAYMENT',
    code: 'ADV50',
    side: 'BOTH',
    dueDays: 0,
    enName: '50% advance, 50% on delivery',
    arName: '50% مقدمًا و50% عند التسليم',
    enText:
      '50% of the total order value is payable upon order confirmation before processing. The remaining 50% is due upon delivery and handover of the goods.',
    arText:
      'يُسدد 50% من إجمالي قيمة الطلب عند تأكيد الطلب وقبل البدء بالتجهيز، ويستحق سداد نسبة الـ 50% المتبقية عند تسليم البضاعة واستلامها.',
  },
  {
    termType: 'PAYMENT',
    code: 'COD',
    side: 'SALES',
    dueDays: 0,
    enName: 'Cash on delivery',
    arName: 'الدفع عند الاستلام',
    enText:
      'Full payment is collected in cash or via approved electronic point-of-sale terminal at the time of delivery before unloading.',
    arText:
      'يُحصّل كامل المبلغ نقدًا أو عبر جهاز الدفع الإلكتروني المعتمد عند التسليم وقبل تفريغ البضاعة.',
  },
  {
    termType: 'PAYMENT',
    code: 'NET45',
    side: 'SALES',
    dueDays: 45,
    isActive: false,
    enName: 'Net 45 days',
    arName: 'صافي خلال 45 يومًا',
    enText:
      'Extended credit term requiring full settlement within 45 calendar days from the invoice date for pre-approved corporate accounts.',
    arText:
      'مهلة سداد ممتدة تقتضي تسوية كامل المبلغ خلال 45 يومًا ميلاديًا من تاريخ الفاتورة للحسابات التجارية المعتمدة مسبقًا.',
  },
  {
    termType: 'PAYMENT',
    code: 'SUP60',
    side: 'PURCHASE',
    dueDays: 60,
    isDefault: true,
    enName: 'Supplier net 60 days',
    arName: 'صافي للمورد خلال 60 يومًا',
    enText:
      'Supplier invoices are settled within 60 calendar days from receipt of matching goods, inspection approval, and compliant tax invoice.',
    arText:
      'تُسوّى فواتير المورد خلال 60 يومًا ميلاديًا من تاريخ استلام البضاعة المطابقة واعتماد الفحص واستلام الفاتورة الضريبية المستوفاة.',
  },
  {
    termType: 'PAYMENT',
    code: 'SUP30',
    side: 'PURCHASE',
    dueDays: 30,
    enName: 'Supplier net 30 days',
    arName: 'صافي للمورد خلال 30 يومًا',
    enText:
      'Payment to the supplier is due within 30 calendar days following verified delivery and receipt of the original commercial invoice.',
    arText:
      'يستحق السداد للمورد خلال 30 يومًا ميلاديًا من تاريخ التسليم المعتمد واستلام الفاتورة التجارية الأصلية.',
  },

  // DELIVERY (4)
  {
    termType: 'DELIVERY',
    code: 'SITE14',
    side: 'SALES',
    incotermCode: 'DAP',
    isDefault: true,
    enName: 'Delivery to customer site (14 days)',
    arName: 'التسليم في موقع العميل (14 يومًا)',
    enText:
      'Seller arranges transport and delivers the goods to the buyer’s designated destination within 14 working days. Unloading at site is the buyer’s responsibility.',
    arText:
      'يتولى البائع شحن البضاعة وتسليمها في الموقع المحدد من المشتري خلال 14 يوم عمل، وتقع مسؤولية التفريغ في الموقع على عاتق المشتري.',
  },
  {
    termType: 'DELIVERY',
    code: 'PICKUP',
    side: 'SALES',
    incotermCode: 'EXW',
    enName: 'Warehouse pickup (Ex Works)',
    arName: 'الاستلام من المستودع',
    enText:
      'Goods are made available at the seller’s warehouse loading bay. Risk and transport arrangements transfer to the buyer upon collection.',
    arText:
      'تُجهز البضاعة للاستلام من رصيف التحميل في مستودع البائع، وتنتقل المخاطر وترتيبات النقل إلى المشتري عند الاستلام.',
  },
  {
    termType: 'DELIVERY',
    code: 'SUPDEL',
    side: 'PURCHASE',
    incotermCode: 'DDP',
    isDefault: true,
    enName: 'Supplier delivery duty paid',
    arName: 'التسليم من المورد خالص الرسوم',
    enText:
      'Supplier delivers goods cleared for import with all customs duties, taxes, and freight paid to our designated receiving warehouse.',
    arText:
      'يلتزم المورد بتسليم البضاعة مخلّصة جمركيًا مع سداد جميع الرسوم والضرائب وتكاليف الشحن حتى مستودع الاستلام المحدد.',
  },
  {
    termType: 'DELIVERY',
    code: 'FOB-ALX',
    side: 'PURCHASE',
    incotermCode: 'FOB',
    enName: 'Free on board — Alexandria Port',
    arName: 'التسليم على ظهر السفينة — ميناء الإسكندرية',
    enText:
      'Supplier clears goods for export and loads them on board the nominated vessel at Alexandria Port; risk passes once loaded on board.',
    arText:
      'يتولى المورد التخليص للتصدير وتحميل البضاعة على ظهر السفينة المحددة في ميناء الإسكندرية، وتنتقل المخاطر فور إتمام التحميل.',
  },

  // WARRANTY (3)
  {
    termType: 'WARRANTY',
    code: 'W12',
    side: 'SALES',
    isDefault: true,
    enName: '12-month standard warranty',
    arName: 'ضمان قياسي لمدة 12 شهرًا',
    enText:
      'Covers manufacturing and material defects for 12 months from delivery under normal use. Excludes consumables, misuse, and unauthorized modifications.',
    arText:
      'يغطي الضمان عيوب التصنيع والمواد لمدة 12 شهرًا من تاريخ التسليم في ظروف الاستخدام المعتاد، ولا يشمل القطع الاستهلاكية أو سوء الاستخدام أو التعديل غير المصرح به.',
  },
  {
    termType: 'WARRANTY',
    code: 'W24',
    side: 'SALES',
    enName: '24-month extended warranty',
    arName: 'ضمان ممتد لمدة 24 شهرًا',
    enText:
      'Provides full repair or replacement coverage for manufacturing defects over 24 months from handover, subject to scheduled preventive maintenance.',
    arText:
      'يوفر تغطية شاملة للإصلاح أو الاستبدال لعيوب التصنيع لمدة 24 شهرًا من تاريخ الاستلام، بشرط الالتزام بالصيانة الوقائية الدورية.',
  },
  {
    termType: 'WARRANTY',
    code: 'NONE',
    side: 'BOTH',
    enName: 'No warranty (as-is)',
    arName: 'دون ضمان (بحالته الراهنة)',
    enText:
      'Goods are supplied on an as-is basis without expressed or implied post-delivery warranty beyond statutory compliance at handover.',
    arText:
      'تُورّد الأصناف بحالتها الراهنة دون أي ضمان صريح أو ضمني بعد التسليم باستثناء المطابقة النظامية وقت الاستلام.',
  },

  // RETURNS (2)
  {
    termType: 'RETURNS',
    code: 'RET14',
    side: 'SALES',
    enName: '14-day return policy',
    arName: 'سياسة الإرجاع خلال 14 يومًا',
    enText:
      'Unused items in original sealed packaging may be returned within 14 calendar days of delivery with prior authorization and original invoice.',
    arText:
      'يمكن إرجاع الأصناف غير المستخدمة في عبوتها الأصلية المختومة خلال 14 يومًا ميلاديًا من تاريخ التسليم بموجب موافقة مسبقة وإبراز أصل الفاتورة.',
  },
  {
    termType: 'RETURNS',
    code: 'NORET',
    side: 'SALES',
    enName: 'Final sale — no returns',
    arName: 'بيع نهائي — لا يُقبل الإرجاع',
    enText:
      'Custom-configured, made-to-order, and clearance items are sold on a final basis and are not eligible for return or exchange once confirmed.',
    arText:
      'تُعد الأصناف المصنّعة حسب الطلب أو المخصّصة أو المصفّاة مبيعات نهائية غير قابلة للإرجاع أو الاستبدال بعد تأكيد الطلب.',
  },

  // GENERAL (9)
  {
    termType: 'GENERAL',
    code: 'GEN',
    side: 'BOTH',
    isDefault: true,
    enName: 'Standard general conditions',
    arName: 'الشروط والأحكام العامة القياسية',
    enText:
      'This document is governed by the agreed commercial terms between the parties. Any amendment requires written confirmation signed by authorized representatives.',
    arText:
      'يخضع هذا المستند للشروط التجارية المتفق عليها بين الطرفين، ولا يسري أي تعديل عليه إلا بموافقة خطية موقعة من الممثلين المفوضين.',
  },
  {
    termType: 'GENERAL',
    code: 'CONF',
    side: 'BOTH',
    enName: 'Confidentiality',
    arName: 'السرية وعدم الإفصاح',
    enText:
      'Both parties shall keep pricing, technical specifications, and commercial terms strictly confidential and shall not disclose them to third parties without prior written consent.',
    arText:
      'يلتزم الطرفان بالحفاظ على سرية الأسعار والمواصفات الفنية والشروط التجارية وعدم الإفصاح عنها لأي طرف ثالث دون موافقة خطية مسبقة.',
  },
  {
    termType: 'GENERAL',
    code: 'FORCE',
    side: 'BOTH',
    enName: 'Force majeure',
    arName: 'القوة القاهرة',
    enText:
      'Neither party shall be liable for delay or non-performance resulting from unforeseeable events beyond reasonable control, provided prompt written notice is given.',
    arText:
      'لا يتحمل أي من الطرفين المسؤولية عن التأخير أو عدم التنفيذ الناشئ عن ظروف قاهرة خارجة عن الإرادة المعقولة، شريطة إخطار الطرف الآخر خطيًا دون تأخير.',
  },
  {
    termType: 'GENERAL',
    code: 'LAW',
    side: 'BOTH',
    enName: 'Governing law',
    arName: 'القانون الواجب التطبيق',
    enText:
      'This agreement and any commercial documents issued hereunder shall be governed by and construed in accordance with the applicable local commercial laws.',
    arText:
      'تخضع هذه الاتفاقية وجميع المستندات التجارية الصادرة بموجبها للقوانين والأنظمة التجارية المحلية المعمول بها وتُفسّر وفقًا لها.',
  },
  {
    termType: 'GENERAL',
    code: 'DISPUTE',
    side: 'BOTH',
    enName: 'Dispute resolution',
    arName: 'تسوية المنازعات',
    enText:
      'Parties shall attempt amicable settlement within 30 days of written notice before referring any unresolved dispute to the competent commercial courts.',
    arText:
      'يسعى الطرفان إلى تسوية أي نزاع وديًا خلال 30 يومًا من تاريخ الإخطار الخطي قبل إحالة النزاع غير المحلول إلى المحكمة التجارية المختصة.',
  },
  {
    termType: 'GENERAL',
    code: 'PRICES',
    side: 'BOTH',
    enName: 'Prices and taxes',
    arName: 'الأسعار والضرائب',
    enText:
      'Quoted prices exclude value-added tax and statutory levies unless explicitly stated otherwise. Applicable taxes are calculated at the rate effective on the invoice date.',
    arText:
      'تُعرض الأسعار غير شاملة لضريبة القيمة المضافة أو الرسوم النظامية ما لم يُنص على خلاف ذلك، وتُحتسب الضرائب السارية وفق النسبة المطبقة بتاريخ الفاتورة.',
  },
  {
    termType: 'GENERAL',
    code: 'TITLE',
    side: 'BOTH',
    enName: 'Retention of title',
    arName: 'الاحتفاظ بالملكية',
    enText:
      'Legal ownership of delivered goods remains with the seller until full payment of all due amounts under the corresponding invoice has been received in cleared funds.',
    arText:
      'تبقى الملكية القانونية للبضاعة المسلّمة للبائع إلى حين استلام كامل المبالغ المستحقة بموجب الفاتورة ذات الصلة بشكل نهائي ومحصّل.',
  },
  {
    termType: 'GENERAL',
    code: 'INSPECT',
    side: 'BOTH',
    enName: 'Inspection on receipt',
    arName: 'الفحص عند الاستلام',
    enText:
      'The receiving party must inspect quantities and visible condition upon delivery and record any shortage or damage on the delivery note within 48 hours.',
    arText:
      'يتعين على الجهة المستلمة فحص الكميات والحالة الظاهرية عند التسليم وإثبات أي نقص أو تلف في إشعار التسليم خلال 48 ساعة.',
  },
  {
    termType: 'GENERAL',
    code: 'LIABILITY',
    side: 'BOTH',
    enName: 'Limitation of liability',
    arName: 'تحديد المسؤولية',
    enText:
      'Each party’s aggregate liability arising out of this transaction shall not exceed the total value of the affected order, excluding indirect or consequential losses.',
    arText:
      'لا تتجاوز المسؤولية الإجمالية لأي طرف عن هذه المعاملة إجمالي قيمة الطلب المتأثر، ولا تشمل الخسائر غير المباشرة أو التبعية.',
  },
];

function buildInitialTerms(): StoredTerm[] {
  const rows: StoredTerm[] = [];
  for (const company of FAKE_COMPANIES) {
    const typeCount = new Map<TermType, number>();
    for (const seed of TERM_SEEDS) {
      const pos = (typeCount.get(seed.termType) ?? 0) + 1;
      typeCount.set(seed.termType, pos);
      rows.push({
        id: `term-${company.id}-${seed.termType.toLowerCase()}-${seed.code.toLowerCase()}`,
        companyId: company.id,
        termType: seed.termType,
        side: seed.side,
        code: seed.code,
        displayName: seed.enName,
        localizedNames: { en: seed.enName, ar: seed.arName },
        localizedTexts: { en: seed.enText, ar: seed.arText },
        dueDays: seed.termType === 'PAYMENT' ? (seed.dueDays ?? null) : null,
        incotermCode: seed.termType === 'DELIVERY' ? (seed.incotermCode ?? null) : null,
        isDefault: Boolean(seed.isDefault),
        isActive: seed.isActive ?? true,
        sortOrder: pos * 10,
        version: 1,
        updatedAt: T0,
      });
    }
  }
  return rows;
}

const termsState: StoredTerm[] = buildInitialTerms();

/** DomainIdempotencyService: replays are scoped by company and operation (`create`, `update:<id>`, ...). */
const replayStore = new Map<string, { fingerprint: string; term: TradeTerm }>();

function replay(companyId: string, operation: string, key: string, request: unknown): TradeTerm | null {
  const hit = replayStore.get(`${companyId}:${operation}:${key}`);
  if (!hit) return null;
  if (hit.fingerprint !== JSON.stringify(request)) {
    throw new ApiError(422, 'TRADE.IDEMPOTENCY.MISMATCH');
  }
  return clone(hit.term);
}

function remember(companyId: string, operation: string, key: string, request: unknown, view: TradeTerm): TradeTerm {
  replayStore.set(`${companyId}:${operation}:${key}`, { fingerprint: JSON.stringify(request), term: clone(view) });
  return view;
}

function toView(row: StoredTerm): TradeTerm {
  const lang = fakeLang();
  const { companyId: _companyId, ...view } = row;
  const displayName = row.localizedNames[lang] || row.localizedNames['en'] || row.displayName;
  return clone({ ...view, displayName });
}

function validationFailed(): never {
  throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
}

const SORT_ORDER_MAX = 1_000_000;

/** TermLocalizedNamesDto: en and ar strings, raw length <= 120 with a non-space character (400). Stored trimmed. */
function normalizeNames(raw: LocalizedNames | undefined): LocalizedNames {
  if (!raw || typeof raw !== 'object') validationFailed();
  for (const lang of ['en', 'ar']) {
    const value: unknown = raw[lang];
    if (typeof value !== 'string' || [...value].length > TERM_LIMITS.nameMax || !/\S/.test(value)) validationFailed();
  }
  return { en: raw['en'].trim(), ar: raw['ar'].trim() };
}

/**
 * Backend DTO: each text key is optional, but a present key must be a non-blank string of 1..400
 * (@MinLength(1), @Matches(/\S/)), even for an inactive term -> 400. Stored trimmed, absent keys stay absent.
 */
function normalizeTexts(raw: LocalizedNames | undefined): LocalizedNames {
  if (!raw || typeof raw !== 'object') validationFailed();
  const result: LocalizedNames = {};
  for (const [lang, value] of Object.entries(raw)) {
    if (lang !== 'en' && lang !== 'ar') validationFailed();
    if (value === undefined) continue;
    if (typeof value !== 'string' || !value.trim() || [...value].length > TERM_LIMITS.textMax) validationFailed();
    result[lang] = value.trim();
  }
  return result;
}

/** Backend assertTexts: an active term needs both texts -> 422 with details { field: ['localizedTexts'] }. */
function assertTexts(texts: LocalizedNames, isActive: boolean): void {
  if (isActive && (!texts['en']?.trim() || !texts['ar']?.trim())) {
    throw new ApiError(422, 'TRADE.TERMS.TEXT_REQUIRED', { field: ['localizedTexts'] });
  }
}

/** UpdateTermDto: side / sortOrder (int 0..1000000) / isActive / dueDays (int 0..3650 or null) / incotermCode -> 400. */
function assertPatchDto(body: TermPatch): void {
  if (body.side !== undefined && !TERM_SIDES.includes(body.side)) validationFailed();
  if (
    body.sortOrder !== undefined &&
    (!Number.isInteger(body.sortOrder) || body.sortOrder < 0 || body.sortOrder > SORT_ORDER_MAX)
  ) {
    validationFailed();
  }
  if (body.isActive !== undefined && typeof body.isActive !== 'boolean') validationFailed();
  const { dueDays, incotermCode } = body;
  if (
    dueDays !== undefined &&
    dueDays !== null &&
    (!Number.isInteger(dueDays) || dueDays < TERM_LIMITS.dueDaysMin || dueDays > TERM_LIMITS.dueDaysMax)
  ) {
    validationFailed();
  }
  if (incotermCode !== undefined && incotermCode !== null && !INCOTERMS.includes(incotermCode)) validationFailed();
}

/**
 * Backend assertTypeFields: a type that does not use dueDays / incotermCode must not send the key at all;
 * even null is rejected -> 422 TRADE.TERMS.TYPE_FIELD_INVALID.
 */
function assertTypeFields(
  termType: TermType,
  body: { dueDays?: number | null; incotermCode?: Incoterm | null },
): void {
  if (body.dueDays !== undefined && termType !== 'PAYMENT') {
    throw new ApiError(422, 'TRADE.TERMS.TYPE_FIELD_INVALID', { field: ['dueDays'] });
  }
  if (body.incotermCode !== undefined && termType !== 'DELIVERY') {
    throw new ApiError(422, 'TRADE.TERMS.TYPE_FIELD_INVALID', { field: ['incotermCode'] });
  }
}

function matchesSide(termSide: TermSide, filterSide: TermSide | undefined): boolean {
  if (!filterSide) return true;
  if (filterSide === 'BOTH') return termSide === 'BOTH';
  return termSide === filterSide || termSide === 'BOTH';
}

/** Backend findTerm: 404 TRADE.TERMS.NOT_FOUND (no details), then 409 stale version when a version is given. */
function findTerm(companyId: string, id: string, expectedVersion?: number): StoredTerm {
  const row = termsState.find((t) => t.id === id && t.companyId === companyId);
  if (!row) throw new ApiError(404, 'TRADE.TERMS.NOT_FOUND');
  if (expectedVersion !== undefined && row.version !== expectedVersion) {
    throw new ApiError(409, 'TRADE.CONCURRENCY.STALE_VERSION');
  }
  return row;
}

/** Backend clearDefault: one default per company + type + side. */
function clearDefault(row: StoredTerm): void {
  for (const other of termsState) {
    if (
      other.id !== row.id &&
      other.companyId === row.companyId &&
      other.termType === row.termType &&
      other.side === row.side &&
      other.isDefault
    ) {
      other.isDefault = false;
      bumpVersion(other);
    }
  }
}

function byListOrder(a: StoredTerm, b: StoredTerm): number {
  return a.sortOrder - b.sortOrder || a.code.localeCompare(b.code) || a.id.localeCompare(b.id);
}

// GET /terms?type&side&active&search&page&limit -> { items, total, page, limit }
export async function fakeListTerms(companyId: string, q: ListTermsQuery = {}): Promise<TermPage> {
  await fakeDelay();
  const page = q.page ?? 1;
  const limit = q.limit ?? TERM_LIST_LIMITS.defaultLimit;
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > TERM_LIST_LIMITS.maxLimit) {
    validationFailed();
  }
  if ((q.type !== undefined && !TERM_TYPES.includes(q.type)) || (q.side !== undefined && !TERM_SIDES.includes(q.side))) {
    validationFailed();
  }
  const search = q.search?.trim() ?? '';
  if (search.length > 200) {
    validationFailed();
  }
  const needle = search.toLowerCase();

  // Backend: search matches the code and the en / ar names (ILIKE); ordered by sortOrder, code, id.
  const rows = termsState
    .filter((term) => {
      if (term.companyId !== companyId) return false;
      if (q.type !== undefined && term.termType !== q.type) return false;
      if (!matchesSide(term.side, q.side)) return false;
      if (q.active !== undefined && term.isActive !== q.active) return false;
      if (needle) {
        const codeMatch = term.code.toLowerCase().includes(needle);
        const nameMatch = ['en', 'ar'].some((lang) => (term.localizedNames[lang] ?? '').toLowerCase().includes(needle));
        if (!codeMatch && !nameMatch) return false;
      }
      return true;
    })
    .slice()
    .sort(byListOrder);

  return {
    items: rows.slice((page - 1) * limit, page * limit).map(toView),
    total: rows.length,
    page,
    limit,
  };
}

// GET /terms/counts?active -> { total, byType }
export async function fakeCountTerms(companyId: string, q: CountTermsQuery = {}): Promise<TermCounts> {
  await fakeDelay();
  const byType = Object.fromEntries(TERM_TYPES.map((type) => [type, 0])) as Record<TermType, number>;
  for (const term of termsState) {
    if (term.companyId !== companyId) continue;
    if (q.active !== undefined && term.isActive !== q.active) continue;
    byType[term.termType] += 1;
  }
  const total = Object.values(byType).reduce((sum, count) => sum + count, 0);
  return { total, byType };
}

// GET /terms/:id
export async function fakeGetTerm(companyId: string, id: string): Promise<TradeTerm> {
  await fakeDelay();
  return toView(findTerm(companyId, id));
}

// POST /terms (x-idempotency-key) -> 201 term
// Order: DTO 400 -> key 400/422 -> replay -> TYPE_FIELD_INVALID 422 -> TEXT_REQUIRED 422 -> CODE_TAKEN 409.
export async function fakeCreateTerm(
  companyId: string,
  input: TermInput,
  idempotencyKey: string,
): Promise<TradeTerm> {
  await fakeDelay();
  if (!TERM_TYPES.includes(input.termType) || !TERM_SIDES.includes(input.side)) validationFailed();
  // The code is matched as sent: the backend never trims or upper-cases it.
  if (typeof input.code !== 'string' || !TERM_CODE_PATTERN.test(input.code)) validationFailed();
  assertPatchDto(input);
  const localizedNames = normalizeNames(input.localizedNames);
  const localizedTexts = normalizeTexts(input.localizedTexts);

  const key = assertIdempotencyKey(idempotencyKey);
  const request = {
    termType: input.termType,
    side: input.side,
    code: input.code,
    localizedNames: input.localizedNames,
    localizedTexts: input.localizedTexts,
    dueDays: input.dueDays,
    incotermCode: input.incotermCode,
    sortOrder: input.sortOrder,
    isActive: input.isActive,
  };
  const replayed = replay(companyId, 'create', key, request);
  if (replayed) return replayed;

  const isActive = input.isActive ?? true;
  assertTypeFields(input.termType, input);
  assertTexts(localizedTexts, isActive);

  if (termsState.some((t) => t.companyId === companyId && t.termType === input.termType && t.code === input.code)) {
    throw new ApiError(409, 'TRADE.TERMS.CODE_TAKEN', { field: ['code'] });
  }

  const created: StoredTerm = {
    id: fakeId(),
    companyId,
    termType: input.termType,
    side: input.side,
    code: input.code,
    displayName: localizedNames['en'],
    localizedNames,
    localizedTexts,
    dueDays: input.dueDays ?? null,
    incotermCode: input.incotermCode ?? null,
    isDefault: false,
    isActive,
    sortOrder: input.sortOrder ?? 0,
    version: 1,
    updatedAt: nowIso(),
  };
  termsState.push(created);
  return remember(companyId, 'create', key, request, toView(created));
}

// PATCH /terms/:id (x-idempotency-key, If-Match) -> 200 term
// Order: DTO 400 -> key -> If-Match 400 -> replay -> 404 -> 409 stale -> TYPE_FIELD_INVALID -> TEXT_REQUIRED.
export async function fakeUpdateTerm(
  companyId: string,
  id: string,
  versionHeader: string,
  patch: TermPatch,
  idempotencyKey: string,
): Promise<TradeTerm> {
  await fakeDelay();
  assertPatchDto(patch);
  const nextNames = patch.localizedNames !== undefined ? normalizeNames(patch.localizedNames) : undefined;
  const nextTexts = patch.localizedTexts !== undefined ? normalizeTexts(patch.localizedTexts) : undefined;
  const key = assertIdempotencyKey(idempotencyKey);
  const expectedVersion = parseIfMatch(versionHeader);

  const operation = `update:${id}`;
  const request = { expectedVersion, ...patch };
  const replayed = replay(companyId, operation, key, request);
  if (replayed) return replayed;

  const current = findTerm(companyId, id, expectedVersion);
  assertTypeFields(current.termType, patch);

  const next: StoredTerm = {
    ...current,
    side: patch.side ?? current.side,
    dueDays: patch.dueDays !== undefined ? patch.dueDays : current.dueDays,
    incotermCode: patch.incotermCode !== undefined ? patch.incotermCode : current.incotermCode,
    sortOrder: patch.sortOrder ?? current.sortOrder,
    isActive: patch.isActive ?? current.isActive,
    localizedNames: nextNames ?? current.localizedNames,
    localizedTexts: nextTexts ?? current.localizedTexts,
  };
  assertTexts(next.localizedTexts, next.isActive);
  if (!next.isActive) next.isDefault = false;
  if (nextNames) next.displayName = nextNames['en'];

  if (JSON.stringify(next) === JSON.stringify(current)) {
    return remember(companyId, operation, key, request, toView(current));
  }
  Object.assign(current, next);
  // A default changing side replaces that side's previous default atomically.
  if (current.isDefault) clearDefault(current);
  bumpVersion(current);
  return remember(companyId, operation, key, request, toView(current));
}

// POST /terms/:id/make-default (x-idempotency-key, If-Match) -> 200 term
export async function fakeMakeDefaultTerm(
  companyId: string,
  id: string,
  versionHeader: string,
  idempotencyKey: string,
): Promise<TradeTerm> {
  await fakeDelay();
  const key = assertIdempotencyKey(idempotencyKey);
  const expectedVersion = parseIfMatch(versionHeader);

  const operation = `make_default:${id}`;
  const request = { expectedVersion };
  const replayed = replay(companyId, operation, key, request);
  if (replayed) return replayed;

  const term = findTerm(companyId, id, expectedVersion);
  if (!term.isActive) throw new ApiError(422, 'TRADE.TERMS.DEFAULT_INACTIVE');
  if (!term.isDefault) {
    clearDefault(term);
    term.isDefault = true;
    bumpVersion(term);
  }
  return remember(companyId, operation, key, request, toView(term));
}

// DELETE /terms/:id (x-idempotency-key, If-Match) -> 200 the soft-deleted term
export async function fakeDeleteTerm(
  companyId: string,
  id: string,
  versionHeader: string,
  idempotencyKey: string,
): Promise<TradeTerm> {
  await fakeDelay();
  const key = assertIdempotencyKey(idempotencyKey);
  const expectedVersion = parseIfMatch(versionHeader);

  const operation = `delete:${id}`;
  const request = { expectedVersion };
  const replayed = replay(companyId, operation, key, request);
  if (replayed) return replayed;

  const term = findTerm(companyId, id, expectedVersion);
  if (term.isDefault) throw new ApiError(409, 'TRADE.TERMS.DEFAULT_IN_USE');

  termsState.splice(termsState.indexOf(term), 1);
  bumpVersion(term);
  return remember(companyId, operation, key, request, toView(term));
}

// GET /terms/options?documentType -> { byType, defaults }: active terms of the document side or BOTH.
export async function fakeListTermOptions(
  companyId: string,
  documentType: TermDocumentType,
): Promise<TermOptions> {
  await fakeDelay();
  const side = TERM_SIDE_OF[documentType];
  if (!side) validationFailed();

  const rows = termsState
    .filter((t) => t.companyId === companyId && t.isActive && (t.side === side || t.side === 'BOTH'))
    .slice()
    .sort(byListOrder);

  const byType = Object.fromEntries(
    TERM_TYPES.map((type) => [type, rows.filter((t) => t.termType === type).map(toView)]),
  ) as Record<TermType, TradeTerm[]>;

  const defaults: Partial<Record<TermType, string>> = {};
  for (const type of TERM_TYPES) {
    const candidates = rows.filter((t) => t.termType === type && t.isDefault);
    const chosen = candidates.find((t) => t.side === side) ?? candidates.find((t) => t.side === 'BOTH');
    if (chosen) defaults[type] = chosen.id;
  }

  return { byType, defaults };
}
