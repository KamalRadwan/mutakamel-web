import type {
  CategoryNode,
  CategoryStatus,
  Channel,
  ChannelBranch,
  ChannelStatus,
  ChannelType,
  ComboComponent,
  CommercialAccount,
  CommercialAccountRole,
  CommercialAccountStatus,
  FakeItem,
  FakeListing,
  FakeParty,
  ItemBranchProfile,
  ItemCompanyProfile,
  ItemImageSummary,
  ItemKind,
  ItemStandardCost,
  ItemStatus,
  ItemTrackingMode,
  OptionalProduct,
  Owner,
  ReasonCode,
  ReasonKind,
  Tax,
  Uom,
  UomStatus,
} from './trade-foundation.model';
import { ApiError } from './trade-api';
import { REASON_KINDS } from './reasons/reason-kinds';

const T0 ='2026-01-05T08:00:00.000Z';
const T0_MS = Date.parse(T0);
const DAY_MS = 86_400_000;
const SEED_USER = 'usr-1';

function dayIso(day: number): string {
  return new Date(T0_MS + day * DAY_MS).toISOString();
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function pad3(n: number): string {
  return String(n).padStart(3, '0');
}

function ean13(n: number): string {
  const base = `6221234${String(n).padStart(5, '0')}`;
  let sum = 0;
  for (let i = 0; i < base.length; i += 1) {
    const digit = Number(base[i]);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const check = (10 - (sum % 10)) % 10;
  return `${base}${check}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function bumpVersion<T extends { version: number; updatedAt?: string }>(row: T): T {
  row.version += 1;
  if ('updatedAt' in row && row.updatedAt !== undefined) {
    row.updatedAt = nowIso();
  }
  return row;
}

export function fakeLang(): 'en' | 'ar' {
  if (typeof document !== 'undefined' && document.documentElement.lang.toLowerCase().startsWith('ar')) {
    return 'ar';
  }
  return 'en';
}

export function clone<T>(value: T): T {
  return structuredClone(value);
}

// ---------------------------------------------------------------------------
// Units of measure (16)
// ---------------------------------------------------------------------------

interface UomSeed {
  code: string;
  en: string;
  ar: string;
  status?: UomStatus;
  version?: number;
}

const UOM_SEEDS: readonly UomSeed[] = [
  { code: 'PCS', en: 'Piece', ar: 'قطعة' },
  { code: 'BOX', en: 'Box', ar: 'علبة' },
  { code: 'CTN', en: 'Carton', ar: 'كرتونة' },
  { code: 'PACK', en: 'Pack', ar: 'عبوة' },
  { code: 'SET', en: 'Set', ar: 'طقم' },
  { code: 'DOZ', en: 'Dozen', ar: 'دستة', status: 'RETIRED', version: 2 },
  { code: 'KG', en: 'Kilogram', ar: 'كيلوجرام' },
  { code: 'G', en: 'Gram', ar: 'جرام' },
  { code: 'TON', en: 'Ton', ar: 'طن' },
  { code: 'L', en: 'Litre', ar: 'لتر' },
  { code: 'ML', en: 'Millilitre', ar: 'مليلتر' },
  { code: 'M', en: 'Metre', ar: 'متر' },
  { code: 'M2', en: 'Square metre', ar: 'متر مربع' },
  { code: 'HR', en: 'Hour', ar: 'ساعة' },
  { code: 'DAY', en: 'Day', ar: 'يوم' },
  { code: 'MONTH', en: 'Month', ar: 'شهر' },
];

function buildUoms(): Uom[] {
  return UOM_SEEDS.map((seed) => ({
    id: `uom-${seed.code.toLowerCase()}`,
    code: seed.code,
    displayName: seed.en,
    localizedNames: { en: seed.en, ar: seed.ar },
    status: seed.status ?? 'ACTIVE',
    version: seed.version ?? 1,
    updatedAt: T0,
  }));
}

// ---------------------------------------------------------------------------
// Categories (18)
// ---------------------------------------------------------------------------

interface CategorySeed {
  id: string;
  code: string;
  en: string;
  ar: string;
  parentId: string | null;
  status?: CategoryStatus;
  version?: number;
}

const CATEGORY_SEEDS: readonly CategorySeed[] = [
  { id: 'cat-elec', code: 'ELEC', en: 'Electronics', ar: 'إلكترونيات', parentId: null },
  { id: 'cat-phones', code: 'PHONES', en: 'Phones', ar: 'هواتف', parentId: 'cat-elec' },
  { id: 'cat-laptops', code: 'LAPTOPS', en: 'Laptops', ar: 'حواسيب محمولة', parentId: 'cat-elec' },
  { id: 'cat-acc', code: 'ACC', en: 'Accessories', ar: 'إكسسوارات', parentId: 'cat-elec' },
  { id: 'cat-chargers', code: 'CHARGERS', en: 'Chargers', ar: 'شواحن', parentId: 'cat-acc' },
  { id: 'cat-cables', code: 'CABLES', en: 'Cables', ar: 'كابلات', parentId: 'cat-acc' },
  { id: 'cat-food', code: 'FOOD', en: 'Food & beverage', ar: 'أغذية ومشروبات', parentId: null },
  { id: 'cat-drinks', code: 'DRINKS', en: 'Drinks', ar: 'مشروبات', parentId: 'cat-food' },
  { id: 'cat-snacks', code: 'SNACKS', en: 'Snacks', ar: 'وجبات خفيفة', parentId: 'cat-food' },
  { id: 'cat-office', code: 'OFFICE', en: 'Office supplies', ar: 'مستلزمات مكتبية', parentId: null },
  { id: 'cat-paper', code: 'PAPER', en: 'Paper', ar: 'ورق', parentId: 'cat-office' },
  { id: 'cat-pens', code: 'PENS', en: 'Pens', ar: 'أقلام', parentId: 'cat-office' },
  { id: 'cat-svc', code: 'SERVICES', en: 'Services', ar: 'خدمات', parentId: null },
  { id: 'cat-install', code: 'INSTALL', en: 'Installation', ar: 'تركيب', parentId: 'cat-svc' },
  { id: 'cat-maint', code: 'MAINT', en: 'Maintenance', ar: 'صيانة', parentId: 'cat-svc' },
  { id: 'cat-training', code: 'TRAINING', en: 'Training', ar: 'تدريب', parentId: 'cat-svc' },
  {
    id: 'cat-seasonal',
    code: 'SEASONAL',
    en: 'Seasonal',
    ar: 'موسمي',
    parentId: null,
    status: 'INACTIVE',
    version: 2,
  },
  { id: 'cat-ramadan', code: 'RAMADAN', en: 'Ramadan packs', ar: 'عبوات رمضان', parentId: 'cat-seasonal' },
];

function buildCategories(): CategoryNode[] {
  const siblingPos = new Map<string, number>();
  return CATEGORY_SEEDS.map((seed) => {
    const key = seed.parentId ?? '__root__';
    const pos = (siblingPos.get(key) ?? 0) + 1;
    siblingPos.set(key, pos);
    return {
      id: seed.id,
      code: seed.code,
      displayName: seed.en,
      localizedNames: { en: seed.en, ar: seed.ar },
      parentId: seed.parentId,
      sortOrder: pos * 1024,
      status: seed.status ?? 'ACTIVE',
      version: seed.version ?? 1,
      createdAt: T0,
      updatedAt: T0,
      deletedAt: null,
    };
  });
}

// ---------------------------------------------------------------------------
// Items (48 generated + 7 Documents items = 55)
// ---------------------------------------------------------------------------

const DRAFT_ITEMS = new Set([12, 24, 33, 36, 43, 48]);
const INACTIVE_ITEMS = new Set([10, 20, 28, 35, 42]);
const DISCONTINUED_ITEMS = new Set([15, 31, 34]);

interface FixedItemOverride {
  code: string;
  en: string;
  ar: string;
}

const FIXED_ITEM_OVERRIDES = new Map<number, FixedItemOverride>([
  [1, { code: 'PHN-A54-128', en: 'Galaxy A54 128 GB', ar: 'جالاكسي A54 سعة 128 جيجابايت' }],
  [2, { code: 'PHN-IP15-256', en: 'iPhone 15 256 GB', ar: 'آيفون 15 سعة 256 جيجابايت' }],
  [6, { code: 'LAP-TP14-I7', en: 'ThinkPad 14 Core i7', ar: 'ثينك باد 14 بمعالج كور i7' }],
  [11, { code: 'CHG-65W-GAN', en: '65 W GaN charger', ar: 'شاحن GaN بقدرة 65 واط' }],
  [14, { code: 'CBL-USBC-1M', en: 'USB-C cable 1 m', ar: 'كابل USB-C بطول متر' }],
  [17, { code: 'DRK-WTR-500', en: 'Mineral water 500 ml', ar: 'مياه معدنية 500 مل' }],
  [22, { code: 'SNK-CHP-150', en: 'Salted chips 150 g', ar: 'رقائق بطاطس مملحة 150 جرامًا' }],
  [26, { code: 'PAP-A4-80G', en: 'A4 copy paper 80 g', ar: 'ورق تصوير A4 بوزن 80 جرامًا' }],
  [30, { code: 'PEN-BLU-07', en: 'Blue ballpoint pen 0.7', ar: 'قلم حبر جاف أزرق 0.7' }],
  [37, { code: 'INS-AC-STD', en: 'Air conditioner installation', ar: 'تركيب مكيف هواء' }],
  [40, { code: 'MNT-PC-YR', en: 'Yearly PC maintenance', ar: 'صيانة سنوية للحواسيب' }],
  [45, { code: 'CMB-PHN-KIT', en: 'Phone starter kit', ar: 'حقيبة الهاتف الأساسية' }],
  [46, { code: 'CMB-LAP-BND', en: 'Laptop work bundle', ar: 'باقة الحاسوب للعمل' }],
  [47, { code: 'CMB-OFF-PCK', en: 'Office starter pack', ar: 'باقة المكتب الأساسية' }],
  [48, { code: 'CMB-RMD-BOX', en: 'Ramadan gift box', ar: 'صندوق هدايا رمضان' }],
]);

const COMBO_COMPONENTS_MAP = new Map<number, ComboComponent[]>([
  [
    45,
    [
      { componentItemId: 'item-01', quantity: '1', sortOrder: 0 },
      { componentItemId: 'item-11', quantity: '1', sortOrder: 1 },
      { componentItemId: 'item-14', quantity: '1', sortOrder: 2 },
    ],
  ],
  [
    46,
    [
      { componentItemId: 'item-06', quantity: '1', sortOrder: 0 },
      { componentItemId: 'item-13', quantity: '1', sortOrder: 1 },
      { componentItemId: 'item-16', quantity: '2', sortOrder: 2 },
    ],
  ],
  [
    47,
    [
      { componentItemId: 'item-26', quantity: '5', sortOrder: 0 },
      { componentItemId: 'item-30', quantity: '10', sortOrder: 1 },
    ],
  ],
  [
    48,
    [
      { componentItemId: 'item-17', quantity: '6', sortOrder: 0 },
      { componentItemId: 'item-22', quantity: '4', sortOrder: 1 },
    ],
  ],
]);

const OPTIONAL_PRODUCTS_MAP = new Map<number, OptionalProduct[]>([
  [45, [{ optionalProductItemId: 'item-13', sortOrder: 0 }]],
]);

interface ItemRangeMeta {
  categoryId: string | null;
  baseUomId: string;
  prefix: string;
  enStem: string;
  arStem: string;
}

function rangeMetaForItem(n: number): ItemRangeMeta {
  if (n <= 5) return { categoryId: 'cat-phones', baseUomId: 'uom-pcs', prefix: 'PHN', enStem: 'Smartphone', arStem: 'هاتف ذكي' };
  if (n <= 9) return { categoryId: 'cat-laptops', baseUomId: 'uom-pcs', prefix: 'LAP', enStem: 'Laptop', arStem: 'حاسوب محمول' };
  if (n === 10) return { categoryId: 'cat-acc', baseUomId: 'uom-pcs', prefix: 'ACC', enStem: 'Phone stand', arStem: 'حامل هاتف' };
  if (n <= 13) return { categoryId: 'cat-chargers', baseUomId: 'uom-pcs', prefix: 'CHG', enStem: 'Fast charger', arStem: 'شاحن سريع' };
  if (n <= 16) return { categoryId: 'cat-cables', baseUomId: 'uom-pcs', prefix: 'CBL', enStem: 'Data cable', arStem: 'كابل بيانات' };
  if (n <= 19) return { categoryId: 'cat-drinks', baseUomId: 'uom-pcs', prefix: 'DRK', enStem: 'Mineral water', arStem: 'مياه معدنية' };
  if (n <= 21) return { categoryId: 'cat-drinks', baseUomId: 'uom-l', prefix: 'DRK', enStem: 'Orange juice', arStem: 'عصير برتقال' };
  if (n <= 25) return { categoryId: 'cat-snacks', baseUomId: 'uom-pack', prefix: 'SNK', enStem: 'Potato chips', arStem: 'رقائق بطاطس' };
  if (n <= 27) return { categoryId: 'cat-paper', baseUomId: 'uom-pack', prefix: 'PAP', enStem: 'Copy paper', arStem: 'ورق تصوير' };
  if (n <= 29) return { categoryId: 'cat-paper', baseUomId: 'uom-box', prefix: 'PAP', enStem: 'Sticky notes', arStem: 'أوراق لاصقة' };
  if (n <= 31) return { categoryId: 'cat-pens', baseUomId: 'uom-pcs', prefix: 'PEN', enStem: 'Ballpoint pen', arStem: 'قلم حبر جاف' };
  if (n <= 33) return { categoryId: 'cat-pens', baseUomId: 'uom-box', prefix: 'PEN', enStem: 'Marker box', arStem: 'علبة أقلام تحديد' };
  if (n <= 35) return { categoryId: 'cat-ramadan', baseUomId: 'uom-set', prefix: 'RMD', enStem: 'Ramadan basket', arStem: 'سلة رمضان' };
  if (n === 36) return { categoryId: null, baseUomId: 'uom-pcs', prefix: 'GEN', enStem: 'Gift card', arStem: 'بطاقة هدية' };
  if (n <= 39) return { categoryId: 'cat-install', baseUomId: 'uom-hr', prefix: 'INS', enStem: 'Device installation', arStem: 'تركيب أجهزة' };
  if (n <= 41) return { categoryId: 'cat-maint', baseUomId: 'uom-month', prefix: 'MNT', enStem: 'Maintenance contract', arStem: 'عقد صيانة' };
  if (n === 42) return { categoryId: 'cat-maint', baseUomId: 'uom-hr', prefix: 'MNT', enStem: 'On-site repair', arStem: 'إصلاح في الموقع' };
  if (n <= 44) return { categoryId: 'cat-training', baseUomId: 'uom-day', prefix: 'TRN', enStem: 'Staff training', arStem: 'تدريب الموظفين' };
  if (n <= 46) return { categoryId: 'cat-acc', baseUomId: 'uom-set', prefix: 'CMB', enStem: 'Combo', arStem: 'باقة' };
  return { categoryId: 'cat-office', baseUomId: 'uom-set', prefix: 'CMB', enStem: 'Combo', arStem: 'باقة' };
}

function itemKindFor(n: number): ItemKind {
  if (n <= 36) return 'PRODUCT';
  if (n <= 44) return 'SERVICE';
  return 'COMBO';
}

function itemStatusFor(n: number): ItemStatus {
  if (DRAFT_ITEMS.has(n)) return 'DRAFT';
  if (INACTIVE_ITEMS.has(n)) return 'INACTIVE';
  if (DISCONTINUED_ITEMS.has(n)) return 'DISCONTINUED';
  return 'ACTIVE';
}

function itemImageFor(n: number): ItemImageSummary | null {
  if (n % 2 !== 1 || n > 39) return null;
  return {
    id: `img-${pad2(n)}`,
    sequence: 1,
    thumb: {
      mimeType: 'image/webp',
      widthPx: 256,
      heightPx: 256,
      sha256: String(n).padStart(64, '0'),
    },
    print: {
      mimeType: 'image/jpeg',
      widthPx: 512,
      heightPx: 512,
    },
    hasAlpha: false,
    createdAt: dayIso(n),
  };
}

interface DocItemSeed {
  n: number;
  code: string;
  en: string;
  ar: string;
  kind: ItemKind;
  baseUomId: string;
  trackingMode: ItemTrackingMode;
  defaultSalesUomId: string | null;
  salesPrice: string;
  taxId: string | null;
}

const DOC_ITEM_SEEDS: readonly DocItemSeed[] = [
  {
    n: 49,
    code: 'ST-220',
    en: 'Steel shelf 220 cm',
    ar: 'رف فولاذي 220 سم',
    kind: 'PRODUCT',
    baseUomId: 'uom-pcs',
    trackingMode: 'LOT',
    defaultSalesUomId: null,
    salesPrice: '1850.00000000',
    taxId: 'tax-vat14',
  },
  {
    n: 50,
    code: 'BX-12',
    en: 'Storage box 12 L',
    ar: 'صندوق تخزين 12 لترًا',
    kind: 'PRODUCT',
    baseUomId: 'uom-pcs',
    trackingMode: 'NONE',
    defaultSalesUomId: 'uom-box',
    salesPrice: `${50 * 250 + 99}.000`,
    taxId: 'tax-vat14',
  },
  {
    n: 51,
    code: 'SV-INST',
    en: 'Installation service',
    ar: 'خدمة التركيب',
    kind: 'SERVICE',
    baseUomId: 'uom-hr',
    trackingMode: 'NONE',
    defaultSalesUomId: null,
    salesPrice: `${51 * 250 + 99}.000`,
    taxId: 'tax-vat14',
  },
  {
    n: 52,
    code: 'LP-14',
    en: 'Laptop 14 inch',
    ar: 'حاسوب محمول 14 بوصة',
    kind: 'PRODUCT',
    baseUomId: 'uom-pcs',
    trackingMode: 'SERIAL',
    defaultSalesUomId: null,
    salesPrice: `${52 * 250 + 99}.000`,
    taxId: 'tax-vat14',
  },
  {
    n: 53,
    code: 'SW-OFF',
    en: 'Office software licence',
    ar: 'ترخيص برامج مكتبية',
    kind: 'SERVICE',
    baseUomId: 'uom-pcs',
    trackingMode: 'NONE',
    defaultSalesUomId: null,
    salesPrice: `${53 * 250 + 99}.000`,
    taxId: null,
  },
  {
    n: 54,
    code: 'RB-12',
    en: 'Rebar 12 mm',
    ar: 'حديد تسليح 12 مم',
    kind: 'PRODUCT',
    baseUomId: 'uom-ton',
    trackingMode: 'NONE',
    defaultSalesUomId: 'uom-kg',
    salesPrice: `${54 * 250 + 99}.000`,
    taxId: 'tax-vat14-incl',
  },
  {
    n: 55,
    code: 'WM-6',
    en: 'Wire mesh 6 mm',
    ar: 'شبكة أسلاك 6 مم',
    kind: 'PRODUCT',
    baseUomId: 'uom-m2',
    trackingMode: 'NONE',
    defaultSalesUomId: null,
    salesPrice: `${55 * 250 + 99}.000`,
    taxId: 'tax-vat14',
  },
];

function buildItems(): FakeItem[] {
  const result: FakeItem[] = [];

  for (let n = 1; n <= 48; n += 1) {
    const meta = rangeMetaForItem(n);
    const fixed = FIXED_ITEM_OVERRIDES.get(n);
    const kind = itemKindFor(n);
    const status = itemStatusFor(n);
    const image = itemImageFor(n);
    const modelTag = `M${n}`;

    result.push({
      id: `item-${pad2(n)}`,
      canonicalCode: fixed?.code ?? `${meta.prefix}-${pad3(n)}`,
      itemKind: kind,
      status,
      localizedNames: {
        en: fixed?.en ?? `${meta.enStem} ${modelTag}`,
        ar: fixed?.ar ?? `${meta.arStem} ${modelTag}`,
      },
      baseUomId: meta.baseUomId,
      categoryId: meta.categoryId,
      barcode: kind === 'PRODUCT' ? ean13(n) : null,
      ownerUserId: `usr-${(n % 6) + 1}`,
      weightKg: kind === 'PRODUCT' ? (((n % 5) + 1) * 0.25).toFixed(3) : null,
      volumeM3: null,
      notes: null,
      quotationDescription: null,
      salesOrderDescription: null,
      receiptDescription: null,
      deliveryOrderDescription: null,
      variantIdentity: null,
      currentImageId: image?.id ?? null,
      image,
      version: status === 'DRAFT' ? 1 : 2,
      createdAt: dayIso(n),
      updatedAt: dayIso(n + 2),
      createdBy: SEED_USER,
      updatedBy: SEED_USER,
      comboComponents: COMBO_COMPONENTS_MAP.get(n) ?? [],
      optionalProducts: OPTIONAL_PRODUCTS_MAP.get(n) ?? [],
      deletedAt: null,
    });
  }

  for (const doc of DOC_ITEM_SEEDS) {
    result.push({
      id: `item-${pad2(doc.n)}`,
      canonicalCode: doc.code,
      itemKind: doc.kind,
      status: 'ACTIVE',
      localizedNames: { en: doc.en, ar: doc.ar },
      baseUomId: doc.baseUomId,
      categoryId: null,
      barcode: doc.kind === 'PRODUCT' ? ean13(doc.n) : null,
      ownerUserId: `usr-${(doc.n % 6) + 1}`,
      weightKg: doc.kind === 'PRODUCT' ? (((doc.n % 5) + 1) * 0.25).toFixed(3) : null,
      volumeM3: null,
      notes: null,
      quotationDescription: null,
      salesOrderDescription: null,
      receiptDescription: null,
      deliveryOrderDescription: null,
      variantIdentity: null,
      currentImageId: null,
      image: null,
      version: 2,
      createdAt: dayIso(doc.n),
      updatedAt: dayIso(doc.n + 2),
      createdBy: SEED_USER,
      updatedBy: SEED_USER,
      comboComponents: [],
      optionalProducts: [],
      deletedAt: null,
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Company profiles, standard costs, branch profiles
// ---------------------------------------------------------------------------

function hasC1Profile(n: number): boolean {
  return (n >= 1 && n <= 30) || (n >= 37 && n <= 46);
}

function hasC2Profile(n: number): boolean {
  return (n >= 1 && n <= 8) || (n >= 21 && n <= 30) || n === 39 || n === 40 || n === 47 || n === 48;
}

function trackingModeFor(n: number): ItemTrackingMode {
  if (n <= 9) return 'SERIAL';
  if (n >= 17 && n <= 25) return 'LOT';
  return 'NONE';
}

function buildCompanyProfiles(items: readonly FakeItem[]): ItemCompanyProfile[] {
  const profiles: ItemCompanyProfile[] = [];
  const itemById = new Map(items.map((item) => [item.id, item]));

  for (let n = 1; n <= 48; n += 1) {
    const item = itemById.get(`item-${pad2(n)}`);
    if (!item) continue;

    const companies: ('c1' | 'c2')[] = [];
    if (hasC1Profile(n)) companies.push('c1');
    if (hasC2Profile(n)) companies.push('c2');

    for (const companyId of companies) {
      const isProduct = item.itemKind === 'PRODUCT';
      const salesTaxId =
        companyId === 'c1' ? (n >= 17 && n <= 25 ? 'tax-zero' : 'tax-vat14') : 'tax-vat15';
      profiles.push({
        id: `cp-${companyId}-${pad2(n)}`,
        itemId: item.id,
        companyId,
        canSell: true,
        canPurchase: isProduct,
        canPos: isProduct && n <= 20,
        trackInventory: isProduct,
        trackingMode: trackingModeFor(n),
        taxClassificationKey: null,
        defaultSalesUomId: n >= 26 && n <= 28 ? 'uom-box' : null,
        defaultPurchaseUomId: n >= 17 && n <= 19 ? 'uom-ctn' : null,
        salesPrice: companyId === 'c1' ? `${n * 250 + 99}.000` : `${n * 20 + 9}.500`,
        currencyCode: companyId === 'c1' ? 'EGP' : 'SAR',
        salesTaxId,
        purchaseTaxId: isProduct ? salesTaxId : null,
        capabilitySet: [],
        capabilitySetVersion: 1,
        accountingMappingKey: null,
        status: item.status === 'DRAFT' ? 'DRAFT' : 'ACTIVE',
        version: 1,
        updatedAt: T0,
      });
    }
  }

  for (const doc of DOC_ITEM_SEEDS) {
    const isProduct = doc.kind === 'PRODUCT';
    profiles.push({
      id: `cp-c1-${pad2(doc.n)}`,
      itemId: `item-${pad2(doc.n)}`,
      companyId: 'c1',
      canSell: true,
      canPurchase: true,
      canPos: false,
      trackInventory: isProduct,
      trackingMode: doc.trackingMode,
      taxClassificationKey: null,
      defaultSalesUomId: doc.defaultSalesUomId,
      defaultPurchaseUomId: null,
      salesPrice: doc.salesPrice,
      currencyCode: 'EGP',
      salesTaxId: doc.taxId,
      purchaseTaxId: doc.taxId,
      capabilitySet: [],
      capabilitySetVersion: 1,
      accountingMappingKey: null,
      status: 'ACTIVE',
      version: 1,
      updatedAt: T0,
    });
  }

  return profiles;
}

function buildStandardCosts(
  items: readonly FakeItem[],
  profiles: readonly ItemCompanyProfile[],
): ItemStandardCost[] {
  const itemById = new Map(items.map((item) => [item.id, item]));
  const costs: ItemStandardCost[] = [];

  for (const profile of profiles) {
    const item = itemById.get(profile.itemId);
    if (!item || item.itemKind !== 'PRODUCT') continue;
    const integerPart = Number((profile.salesPrice ?? '0').split('.')[0]);
    costs.push({
      itemId: profile.itemId,
      companyProfileId: profile.id,
      standardCost: `${Math.round(integerPart * 0.6)}.000`,
      currencyCode: profile.currencyCode,
      version: profile.version,
    });
  }

  return costs;
}

function buildBranchProfiles(): ItemBranchProfile[] {
  const result: ItemBranchProfile[] = [];
  const add = (companyId: 'c1' | 'c2', branchId: string, n: number): void => {
    const suffix = pad2(n);
    result.push({
      id: `bp-${branchId}-${suffix}`,
      itemCompanyProfileId: `cp-${companyId}-${suffix}`,
      companyId,
      branchId,
      defaultFulfillmentNodeId: null,
      isAssorted: true,
      replenishmentPolicyKey: null,
      restrictions: {},
      version: 1,
    });
  };

  for (let n = 1; n <= 30; n += 1) add('c1', 'b1', n);
  for (let n = 49; n <= 55; n += 1) add('c1', 'b1', n);
  for (let n = 1; n <= 18; n += 1) add('c1', 'b2', n);
  for (let n = 1; n <= 8; n += 1) add('c2', 'b4', n);
  for (let n = 21; n <= 27; n += 1) add('c2', 'b4', n);

  return result;
}

// ---------------------------------------------------------------------------
// Channels, channelBranches, listings
// ---------------------------------------------------------------------------

interface ChannelSeed {
  id: string;
  companyId: string;
  code: string;
  name: string;
  channelType: ChannelType;
  status?: ChannelStatus;
  version?: number;
}

const CHANNEL_SEEDS: readonly ChannelSeed[] = [
  { id: 'ch-c1-int', companyId: 'c1', code: 'INT-SALES', name: 'Internal sales', channelType: 'INTERNAL_SALES' },
  { id: 'ch-c1-pos', companyId: 'c1', code: 'MAIN-POS', name: 'Main POS', channelType: 'POS' },
  { id: 'ch-c1-web', companyId: 'c1', code: 'WEB-STORE', name: 'Online store', channelType: 'ECOMMERCE' },
  { id: 'ch-c1-b2b', companyId: 'c1', code: 'B2B-PORTAL', name: 'B2B portal', channelType: 'B2B_PORTAL' },
  {
    id: 'ch-c1-field',
    companyId: 'c1',
    code: 'FIELD-TEAM',
    name: 'Field team',
    channelType: 'FIELD_SALES',
    status: 'INACTIVE',
    version: 2,
  },
  { id: 'ch-c2-int', companyId: 'c2', code: 'INT-SALES', name: 'Internal sales', channelType: 'INTERNAL_SALES' },
  { id: 'ch-c2-pos', companyId: 'c2', code: 'RYD-POS', name: 'Riyadh POS', channelType: 'POS' },
];

function buildChannels(): Channel[] {
  return CHANNEL_SEEDS.map((seed) => ({
    id: seed.id,
    companyId: seed.companyId,
    code: seed.code,
    name: seed.name,
    channelType: seed.channelType,
    status: seed.status ?? 'ACTIVE',
    configurationProfileVersionId: null,
    version: seed.version ?? 1,
    createdAt: T0,
    updatedAt: T0,
  }));
}

function buildChannelBranches(): ChannelBranch[] {
  const seeds: readonly { id: string; channelId: string; companyId: string; branchId: string; isActive: boolean }[] = [
    { id: 'chb-b1-int', channelId: 'ch-c1-int', companyId: 'c1', branchId: 'b1', isActive: true },
    { id: 'chb-b1-pos', channelId: 'ch-c1-pos', companyId: 'c1', branchId: 'b1', isActive: true },
    { id: 'chb-b1-web', channelId: 'ch-c1-web', companyId: 'c1', branchId: 'b1', isActive: true },
    { id: 'chb-b2-int', channelId: 'ch-c1-int', companyId: 'c1', branchId: 'b2', isActive: true },
    { id: 'chb-b2-pos', channelId: 'ch-c1-pos', companyId: 'c1', branchId: 'b2', isActive: true },
    { id: 'chb-b2-web', channelId: 'ch-c1-web', companyId: 'c1', branchId: 'b2', isActive: false },
    { id: 'chb-b4-int', channelId: 'ch-c2-int', companyId: 'c2', branchId: 'b4', isActive: true },
    { id: 'chb-b4-pos', channelId: 'ch-c2-pos', companyId: 'c2', branchId: 'b4', isActive: true },
  ];

  return seeds.map((seed) => ({
    ...seed,
    version: 1,
  }));
}

function buildListings(items: readonly FakeItem[], profiles: readonly ItemCompanyProfile[]): FakeListing[] {
  const itemById = new Map(items.map((item) => [item.id, item]));
  const c1ActiveProfiles = profiles
    .filter((profile) => {
      if (profile.companyId !== 'c1') return false;
      const item = itemById.get(profile.itemId);
      if (!item || item.status !== 'ACTIVE') return false;
      const num = Number(item.id.slice('item-'.length));
      return num <= 48;
    })
    .slice(0, 25);

  return c1ActiveProfiles.map((profile, idx) => ({
    id: `lst-${pad2(idx + 1)}`,
    itemId: profile.itemId,
    companyId: 'c1',
    channelId: profile.canPos ? 'ch-c1-pos' : 'ch-c1-int',
    branchId: null,
    publicationStatus: (idx + 1) % 5 === 0 ? 'DRAFT' : 'PUBLISHED',
    saleConstraints: {},
    version: 1,
    updatedAt: T0,
  }));
}

// ---------------------------------------------------------------------------
// Parties (24) and Commercial Accounts (26)
// ---------------------------------------------------------------------------

interface PartySeed {
  num: number;
  en: string;
  ar: string;
  partyType: 'ORGANIZATION' | 'INDIVIDUAL';
  roles: CommercialAccountRole[];
}

const PARTY_SEEDS: readonly PartySeed[] = [
  { num: 1, en: 'Nile Electronics Co.', ar: 'شركة النيل للإلكترونيات', partyType: 'ORGANIZATION', roles: ['CUSTOMER'] },
  { num: 2, en: 'Delta Foods', ar: 'دلتا للأغذية', partyType: 'ORGANIZATION', roles: ['CUSTOMER', 'SUPPLIER'] },
  { num: 3, en: 'Cairo Office Mart', ar: 'مركز القاهرة للمستلزمات المكتبية', partyType: 'ORGANIZATION', roles: ['CUSTOMER'] },
  { num: 4, en: 'Pyramids Telecom', ar: 'الأهرام للاتصالات', partyType: 'ORGANIZATION', roles: ['CUSTOMER'] },
  { num: 5, en: 'Red Sea Hotels', ar: 'فنادق البحر الأحمر', partyType: 'ORGANIZATION', roles: ['CUSTOMER'] },
  { num: 6, en: 'Alex Retail Group', ar: 'مجموعة الإسكندرية للتجزئة', partyType: 'ORGANIZATION', roles: ['CUSTOMER'] },
  { num: 7, en: 'Sinai Trading', ar: 'سيناء للتجارة', partyType: 'ORGANIZATION', roles: ['CUSTOMER'] },
  { num: 8, en: 'Giza Schools', ar: 'مدارس الجيزة', partyType: 'ORGANIZATION', roles: ['CUSTOMER'] },
  { num: 9, en: 'Horizon Distribution', ar: 'الأفق للتوزيع', partyType: 'ORGANIZATION', roles: ['SUPPLIER'] },
  { num: 10, en: 'Orient Paper Mills', ar: 'مصانع الشرق للورق', partyType: 'ORGANIZATION', roles: ['SUPPLIER'] },
  { num: 11, en: 'TechSource Import', ar: 'تك سورس للاستيراد', partyType: 'ORGANIZATION', roles: ['SUPPLIER'] },
  { num: 12, en: 'Fresh Valley Beverages', ar: 'الوادي الطازج للمشروبات', partyType: 'ORGANIZATION', roles: ['SUPPLIER'] },
  { num: 13, en: 'Riyadh Business Center', ar: 'مركز الرياض للأعمال', partyType: 'ORGANIZATION', roles: ['CUSTOMER'] },
  { num: 14, en: 'Gulf Star Markets', ar: 'أسواق نجمة الخليج', partyType: 'ORGANIZATION', roles: ['CUSTOMER'] },
  { num: 15, en: 'Najd Supplies', ar: 'نجد للتوريدات', partyType: 'ORGANIZATION', roles: ['SUPPLIER'] },
  {
    num: 16,
    en: 'Jeddah Logistics',
    ar: 'جدة للخدمات اللوجستية',
    partyType: 'ORGANIZATION',
    roles: ['CUSTOMER', 'SUPPLIER'],
  },
  { num: 17, en: 'Ahmed Samir', ar: 'أحمد سمير', partyType: 'INDIVIDUAL', roles: ['CUSTOMER'] },
  { num: 18, en: 'Mona Adel', ar: 'منى عادل', partyType: 'INDIVIDUAL', roles: ['CUSTOMER'] },
  { num: 19, en: 'Karim Fathy', ar: 'كريم فتحي', partyType: 'INDIVIDUAL', roles: ['CUSTOMER'] },
  { num: 20, en: 'Salma Hassan', ar: 'سلمى حسن', partyType: 'INDIVIDUAL', roles: ['CUSTOMER'] },
  { num: 21, en: 'Omar Khaled', ar: 'عمر خالد', partyType: 'INDIVIDUAL', roles: ['SUPPLIER'] },
  { num: 22, en: 'Nour Ibrahim', ar: 'نور إبراهيم', partyType: 'INDIVIDUAL', roles: ['CUSTOMER'] },
  { num: 23, en: 'Faisal Alotaibi', ar: 'فيصل العتيبي', partyType: 'INDIVIDUAL', roles: ['CUSTOMER'] },
  { num: 24, en: 'Huda Alqahtani', ar: 'هدى القحطاني', partyType: 'INDIVIDUAL', roles: ['CUSTOMER'] },
];

function buildParties(): FakeParty[] {
  return PARTY_SEEDS.map((seed) => {
    const nn = pad2(seed.num);
    return {
      id: `pty-${nn}`,
      displayName: seed.en,
      displayNameAr: seed.ar,
      partyType: seed.partyType,
      code: seed.partyType === 'ORGANIZATION' ? `P-00${nn}` : null,
      roles: [...seed.roles],
    };
  });
}

function buildAccounts(): CommercialAccount[] {
  const accounts: CommercialAccount[] = [];

  const pushGroup = (
    companyId: 'c1' | 'c2',
    role: CommercialAccountRole,
    partyNums: readonly number[],
    currency: string | null,
  ): void => {
    const roleChar = role === 'CUSTOMER' ? 'c' : 's';
    partyNums.forEach((num, idx) => {
      const nn = pad2(num);
      const id = `acc-${companyId}-${roleChar}-${nn}`;
      let status: CommercialAccountStatus = 'ACTIVE';
      let blockReasonCode: string | null = null;
      if (id === 'acc-c1-c-07') {
        status = 'BLOCKED';
        blockReasonCode = 'OVERDUE';
      } else if (id === 'acc-c1-s-11') {
        status = 'BLOCKED';
        blockReasonCode = 'QUALITY';
      }
      const terms: CommercialAccount['terms'] = id === 'acc-c1-c-03' ? { orderingHold: true } : {};

      accounts.push({
        id,
        partyId: `pty-${nn}`,
        companyId,
        accountRole: role,
        paymentTermsId: null,
        creditLimit: role === 'CUSTOMER' ? `${(idx + 1) * 50000}.000` : null,
        creditCurrencyCode: role === 'CUSTOMER' ? currency : null,
        priceBookId: null,
        creditPolicyVersionId: null,
        terms,
        status,
        blockReasonCode,
        version: 1,
        createdAt: T0,
        updatedAt: T0,
      });
    });
  };

  pushGroup('c1', 'CUSTOMER', [1, 2, 3, 4, 5, 6, 7, 8, 17, 18, 19, 20], 'EGP');
  pushGroup('c1', 'SUPPLIER', [2, 9, 10, 11, 12, 21], null);
  pushGroup('c2', 'CUSTOMER', [13, 14, 16, 23, 24], 'SAR');
  pushGroup('c2', 'SUPPLIER', [12, 15, 16], null);

  return accounts;
}

// ---------------------------------------------------------------------------
// Owners (6), Taxes (5), Reasons (98 across 25 kinds: the backend
// TRADE_REASON_STARTER_CATALOGUE row for row, same codes, names, flags, sortOrder)
// ---------------------------------------------------------------------------

const OWNERS_SEED: Owner[] = [
  { id: 'usr-1', name: 'Hany Mostafa' },
  { id: 'usr-2', name: 'Rana Youssef' },
  { id: 'usr-3', name: 'Tarek Nabil' },
  { id: 'usr-4', name: 'Laila Fouad' },
  { id: 'usr-5', name: 'Youssef Amin' },
  { id: 'usr-6', name: 'Dina Sherif' },
];

const TAXES_SEED: Tax[] = [
  { id: 'tax-vat14', code: 'VAT14', name: 'VAT 14%', rate: '14.000', isInclusive: false, companyId: 'c1' },
  { id: 'tax-vat15', code: 'VAT15', name: 'VAT 15%', rate: '15.000', isInclusive: false, companyId: 'c2' },
  { id: 'tax-zero', code: 'ZERO', name: 'Zero-rated', rate: '0.000', isInclusive: false, companyId: null },
  { id: 'tax-exempt', code: 'EXEMPT', name: 'Exempt', rate: '0.000', isInclusive: false, companyId: null },
  { id: 'tax-vat14-incl', code: 'VAT14I', name: 'VAT 14% inclusive', rate: '14.000', isInclusive: true, companyId: 'c1' },
];

interface ReasonSeed {
  kind: ReasonKind;
  code: string;
  en: string;
  ar: string;
}

const REASON_SEEDS: readonly ReasonSeed[] = [
  { kind: 'CATEGORY_STATUS', code: 'RESTRUCTURE', en: 'Catalogue restructuring', ar: 'إعادة هيكلة الكتالوج' },
  { kind: 'CATEGORY_STATUS', code: 'SEASON_END', en: 'End of season', ar: 'انتهاء الموسم' },
  { kind: 'CATEGORY_STATUS', code: 'OTHER', en: 'Other', ar: 'سبب آخر' },

  { kind: 'CATEGORY_DELETE', code: 'DUPLICATE', en: 'Duplicate category', ar: 'فئة مكررة' },
  { kind: 'CATEGORY_DELETE', code: 'NOT_USED', en: 'No longer used', ar: 'لم تعد مستخدمة' },
  { kind: 'CATEGORY_DELETE', code: 'OTHER', en: 'Other', ar: 'سبب آخر' },

  { kind: 'ACCOUNT_BLOCK', code: 'OVERDUE', en: 'Overdue payments', ar: 'مدفوعات متأخرة' },
  { kind: 'ACCOUNT_BLOCK', code: 'QUALITY', en: 'Quality issues', ar: 'مشكلات في الجودة' },
  { kind: 'ACCOUNT_BLOCK', code: 'CREDIT_RISK', en: 'Credit risk', ar: 'مخاطر ائتمانية' },
  { kind: 'ACCOUNT_BLOCK', code: 'LEGAL', en: 'Legal hold', ar: 'إيقاف قانوني' },
  { kind: 'ACCOUNT_BLOCK', code: 'OTHER', en: 'Other', ar: 'سبب آخر' },

  { kind: 'ACCOUNT_UNBLOCK', code: 'PAID', en: 'Balance settled', ar: 'تمت تسوية الرصيد' },
  { kind: 'ACCOUNT_UNBLOCK', code: 'RESOLVED', en: 'Issue resolved', ar: 'تم حل المشكلة' },
  { kind: 'ACCOUNT_UNBLOCK', code: 'OTHER', en: 'Other', ar: 'سبب آخر' },

  { kind: 'ITEM_DISCONTINUE', code: 'END_OF_LIFE', en: 'End of life', ar: 'انتهاء دورة المنتج' },
  { kind: 'ITEM_DISCONTINUE', code: 'REPLACED', en: 'Replaced by a new item', ar: 'استُبدل بصنف جديد' },
  { kind: 'ITEM_DISCONTINUE', code: 'OTHER', en: 'Other', ar: 'سبب آخر' },

  { kind: 'DOCUMENT_CANCEL', code: 'CUSTOMER_REQUEST', en: 'Customer request', ar: 'طلب العميل' },
  { kind: 'DOCUMENT_CANCEL', code: 'DATA_ERROR', en: 'Data entry error', ar: 'خطأ في إدخال البيانات' },
  { kind: 'DOCUMENT_CANCEL', code: 'DUPLICATE', en: 'Duplicate document', ar: 'مستند مكرر' },
  { kind: 'DOCUMENT_CANCEL', code: 'PRICE_NOT_ACCEPTED', en: 'Price not accepted', ar: 'لم يُقبل السعر' },
  { kind: 'DOCUMENT_CANCEL', code: 'OTHER', en: 'Other', ar: 'سبب آخر' },

  { kind: 'QUOTATION_REJECT', code: 'PRICE_NOT_ACCEPTED', en: 'Price not accepted', ar: 'لم يُقبل السعر' },
  { kind: 'QUOTATION_REJECT', code: 'COMPETITOR_CHOSEN', en: 'Chose a competitor', ar: 'اختار منافسًا' },
  { kind: 'QUOTATION_REJECT', code: 'NO_LONGER_NEEDED', en: 'No longer needed', ar: 'لم يعد مطلوبًا' },
  { kind: 'QUOTATION_REJECT', code: 'OTHER', en: 'Other', ar: 'سبب آخر' },

  { kind: 'DOCUMENT_HOLD', code: 'CREDIT_REVIEW', en: 'Credit review', ar: 'مراجعة ائتمانية' },
  { kind: 'DOCUMENT_HOLD', code: 'CUSTOMER_REQUEST', en: 'Customer request', ar: 'طلب العميل' },
  { kind: 'DOCUMENT_HOLD', code: 'STOCK_ISSUE', en: 'Stock issue', ar: 'مشكلة في المخزون' },
  { kind: 'DOCUMENT_HOLD', code: 'OTHER', en: 'Other', ar: 'سبب آخر' },

  { kind: 'DOCUMENT_HOLD_RELEASE', code: 'ISSUE_RESOLVED', en: 'Issue resolved', ar: 'تم حل المشكلة' },
  { kind: 'DOCUMENT_HOLD_RELEASE', code: 'OTHER', en: 'Other', ar: 'سبب آخر' },

  // Same codes as the Trade 0730 seed (db-update 2026-11-22).
  { kind: 'DOCUMENT_DISCOUNT', code: 'VOLUME', en: 'Volume discount', ar: 'خصم على الكمية' },
  { kind: 'DOCUMENT_DISCOUNT', code: 'LOYAL_CUSTOMER', en: 'Loyal customer', ar: 'عميل دائم' },
  { kind: 'DOCUMENT_DISCOUNT', code: 'PROMOTION', en: 'Promotion', ar: 'عرض ترويجي' },
  { kind: 'DOCUMENT_DISCOUNT', code: 'PRICE_MATCH', en: 'Competitor price match', ar: 'مطابقة سعر منافس' },
  { kind: 'DOCUMENT_DISCOUNT', code: 'OTHER', en: 'Other', ar: 'سبب آخر' },

  { kind: 'PURCHASE_ORDER_REJECT', code: 'PRICE_NOT_ACCEPTED', en: 'Price not accepted', ar: 'لم يُقبل السعر' },
  { kind: 'PURCHASE_ORDER_REJECT', code: 'BUDGET', en: 'Over budget', ar: 'تجاوز الميزانية' },
  { kind: 'PURCHASE_ORDER_REJECT', code: 'WRONG_ITEMS', en: 'Wrong items', ar: 'أصناف غير صحيحة' },
  { kind: 'PURCHASE_ORDER_REJECT', code: 'OTHER', en: 'Other', ar: 'سبب آخر' },

  { kind: 'INVENTORY_PERIOD_CLOSE', code: 'MONTH_END_CLOSE', en: 'Month-end close', ar: 'إقفال نهاية الشهر' },
  { kind: 'INVENTORY_PERIOD_CLOSE', code: 'AUDIT_HOLD', en: 'Audit hold', ar: 'إيقاف للتدقيق' },
  { kind: 'INVENTORY_PERIOD_CLOSE', code: 'CORRECTION_DONE', en: 'Corrections done', ar: 'اكتملت التصحيحات' },
  { kind: 'INVENTORY_PERIOD_CLOSE', code: 'OTHER', en: 'Other', ar: 'سبب آخر' },

  { kind: 'INVENTORY_PERIOD_REOPEN', code: 'LATE_DOCUMENT', en: 'Late document', ar: 'مستند متأخر' },
  { kind: 'INVENTORY_PERIOD_REOPEN', code: 'CORRECTION', en: 'Correction', ar: 'تصحيح' },
  { kind: 'INVENTORY_PERIOD_REOPEN', code: 'AUDIT_REQUEST', en: 'Audit request', ar: 'طلب تدقيق' },
  { kind: 'INVENTORY_PERIOD_REOPEN', code: 'OTHER', en: 'Other', ar: 'سبب آخر' },

  { kind: 'INVENTORY_UOM_PUBLISH', code: 'NEW_PACKAGING', en: 'New packaging', ar: 'تعبئة جديدة' },
  { kind: 'INVENTORY_UOM_PUBLISH', code: 'SUPPLIER_CHANGE', en: 'Supplier change', ar: 'تغيير المورد' },
  { kind: 'INVENTORY_UOM_PUBLISH', code: 'CORRECTION', en: 'Correction', ar: 'تصحيح' },
  { kind: 'INVENTORY_UOM_PUBLISH', code: 'OTHER', en: 'Other', ar: 'سبب آخر' },

  { kind: 'INVENTORY_UOM_RETIRE', code: 'PACKAGING_DISCONTINUED', en: 'Packaging discontinued', ar: 'توقفت التعبئة' },
  { kind: 'INVENTORY_UOM_RETIRE', code: 'REPLACED', en: 'Replaced', ar: 'استُبدلت' },
  { kind: 'INVENTORY_UOM_RETIRE', code: 'CORRECTION', en: 'Correction', ar: 'تصحيح' },
  { kind: 'INVENTORY_UOM_RETIRE', code: 'OTHER', en: 'Other', ar: 'سبب آخر' },

  { kind: 'INVENTORY_REVERSAL', code: 'WRONG_QUANTITY', en: 'Wrong quantity', ar: 'كمية غير صحيحة' },
  { kind: 'INVENTORY_REVERSAL', code: 'WRONG_ITEM', en: 'Wrong item', ar: 'صنف غير صحيح' },
  { kind: 'INVENTORY_REVERSAL', code: 'DAMAGED', en: 'Damaged', ar: 'تالف' },
  { kind: 'INVENTORY_REVERSAL', code: 'DUPLICATE_ENTRY', en: 'Duplicate entry', ar: 'إدخال مكرر' },
  { kind: 'INVENTORY_REVERSAL', code: 'OTHER', en: 'Other', ar: 'سبب آخر' },

  // Governance and automation kinds: same codes and names as the backend
  // starter catalogue (trade-reason-starter-catalogue.ts). One source for every reason.
  { kind: 'PRICE_VERSION_RETIRE', code: 'REPLACED_BY_NEW_PRICES', en: 'Replaced by new prices', ar: 'استُبدلت بأسعار جديدة' },
  { kind: 'PRICE_VERSION_RETIRE', code: 'PRICING_ERROR', en: 'Pricing error', ar: 'خطأ في التسعير' },
  { kind: 'PRICE_VERSION_RETIRE', code: 'CAMPAIGN_ENDED', en: 'Campaign ended', ar: 'انتهت الحملة' },
  { kind: 'PRICE_VERSION_RETIRE', code: 'OTHER', en: 'Other', ar: 'سبب آخر' },

  { kind: 'POLICY_VERSION_REJECT', code: 'RULES_INCORRECT', en: 'Rules are incorrect', ar: 'القواعد غير صحيحة' },
  { kind: 'POLICY_VERSION_REJECT', code: 'TESTS_INSUFFICIENT', en: 'Tests are not enough', ar: 'الاختبارات غير كافية' },
  { kind: 'POLICY_VERSION_REJECT', code: 'NEEDS_BUSINESS_APPROVAL', en: 'Needs business approval', ar: 'يحتاج إلى موافقة الإدارة' },
  { kind: 'POLICY_VERSION_REJECT', code: 'OTHER', en: 'Other', ar: 'سبب آخر' },

  { kind: 'WORKFLOW_VERSION_REJECT', code: 'RULES_INCORRECT', en: 'Rules are incorrect', ar: 'القواعد غير صحيحة' },
  { kind: 'WORKFLOW_VERSION_REJECT', code: 'TESTS_INSUFFICIENT', en: 'Tests are not enough', ar: 'الاختبارات غير كافية' },
  { kind: 'WORKFLOW_VERSION_REJECT', code: 'NEEDS_BUSINESS_APPROVAL', en: 'Needs business approval', ar: 'يحتاج إلى موافقة الإدارة' },
  { kind: 'WORKFLOW_VERSION_REJECT', code: 'OTHER', en: 'Other', ar: 'سبب آخر' },

  { kind: 'POLICY_VERSION_RETIRE', code: 'REPLACED', en: 'Replaced by a newer version', ar: 'استُبدلت بنسخة أحدث' },
  { kind: 'POLICY_VERSION_RETIRE', code: 'NO_LONGER_NEEDED', en: 'No longer needed', ar: 'لم تعد مطلوبة' },
  { kind: 'POLICY_VERSION_RETIRE', code: 'CAUSES_PROBLEMS', en: 'Causes problems', ar: 'تسبب مشكلات' },
  { kind: 'POLICY_VERSION_RETIRE', code: 'OTHER', en: 'Other', ar: 'سبب آخر' },

  { kind: 'WORKFLOW_VERSION_RETIRE', code: 'REPLACED', en: 'Replaced by a newer version', ar: 'استُبدلت بنسخة أحدث' },
  { kind: 'WORKFLOW_VERSION_RETIRE', code: 'NO_LONGER_NEEDED', en: 'No longer needed', ar: 'لم تعد مطلوبة' },
  { kind: 'WORKFLOW_VERSION_RETIRE', code: 'CAUSES_PROBLEMS', en: 'Causes problems', ar: 'تسبب مشكلات' },
  { kind: 'WORKFLOW_VERSION_RETIRE', code: 'OTHER', en: 'Other', ar: 'سبب آخر' },

  { kind: 'POLICY_VERSION_ROLLBACK', code: 'NEW_VERSION_FAULTY', en: 'The newer version is faulty', ar: 'النسخة الأحدث معيبة' },
  { kind: 'POLICY_VERSION_ROLLBACK', code: 'RESTORE_PREVIOUS_BEHAVIOUR', en: 'Restore the previous behaviour', ar: 'استعادة السلوك السابق' },
  { kind: 'POLICY_VERSION_ROLLBACK', code: 'AUDIT_REQUEST', en: 'Audit request', ar: 'طلب تدقيق' },
  { kind: 'POLICY_VERSION_ROLLBACK', code: 'OTHER', en: 'Other', ar: 'سبب آخر' },

  { kind: 'WORKFLOW_VERSION_ROLLBACK', code: 'NEW_VERSION_FAULTY', en: 'The newer version is faulty', ar: 'النسخة الأحدث معيبة' },
  { kind: 'WORKFLOW_VERSION_ROLLBACK', code: 'RESTORE_PREVIOUS_BEHAVIOUR', en: 'Restore the previous behaviour', ar: 'استعادة السلوك السابق' },
  { kind: 'WORKFLOW_VERSION_ROLLBACK', code: 'AUDIT_REQUEST', en: 'Audit request', ar: 'طلب تدقيق' },
  { kind: 'WORKFLOW_VERSION_ROLLBACK', code: 'OTHER', en: 'Other', ar: 'سبب آخر' },

  { kind: 'WEBHOOK_DELIVERY_RETRY', code: 'OPERATOR_RETRY', en: 'Retried by an operator', ar: 'إعادة بواسطة مشغّل' },
  { kind: 'WEBHOOK_DELIVERY_RETRY', code: 'ENDPOINT_FIXED', en: 'Receiving endpoint fixed', ar: 'أُصلح عنوان الاستقبال' },
  { kind: 'WEBHOOK_DELIVERY_RETRY', code: 'SECRET_ROTATED', en: 'Secret rotated', ar: 'دُوِّر السر' },
  { kind: 'WEBHOOK_DELIVERY_RETRY', code: 'OTHER', en: 'Other', ar: 'سبب آخر' },

  { kind: 'CONTROL_TOWER_RESOLVE', code: 'SOURCE_FIXED', en: 'Source fixed', ar: 'أُصلح المصدر' },
  { kind: 'CONTROL_TOWER_RESOLVE', code: 'DUPLICATE_RESULT_IGNORED', en: 'Duplicate result ignored', ar: 'تُجوهلت نتيجة مكررة' },
  { kind: 'CONTROL_TOWER_RESOLVE', code: 'CONFIRMED_WITH_OWNER', en: 'Confirmed with the owner', ar: 'أُكّد مع الجهة المالكة' },
  { kind: 'CONTROL_TOWER_RESOLVE', code: 'OTHER', en: 'Other', ar: 'سبب آخر' },
];

function buildReasons(): ReasonCode[] {
  const kindPos = new Map<ReasonKind, number>();
  return REASON_SEEDS.map((seed) => {
    const pos = (kindPos.get(seed.kind) ?? 0) + 1;
    kindPos.set(seed.kind, pos);
    const isOther = seed.code === 'OTHER';
    return {
      id: `rsn-${seed.kind.toLowerCase()}-${seed.code.toLowerCase()}`,
      kind: seed.kind,
      code: seed.code,
      localizedNames: { en: seed.en, ar: seed.ar },
      requiresNote: isOther && !seed.kind.startsWith('INVENTORY_'),
      isActive: true,
      sortOrder: pos * 1024,
      isSystem: isOther,
      version: 1,
      updatedAt: T0,
    };
  });
}

// ---------------------------------------------------------------------------
// Reason rule (mirrors backend TradeReasonsService.assertUsable / assertUsableCode)
// ---------------------------------------------------------------------------

/** Backend DTOs: `@IsString() @MaxLength(500) reasonNote` -> 400 TRADE.VALIDATION_FAILED (raw length, before the service). */
export const TRADE_REASON_NOTE_MAX_LENGTH = 500;
/** Backend DTOs for code-based reasons: `@Matches(/^[A-Z][A-Z0-9_]{1,39}$/) reasonCode` -> 400 TRADE.VALIDATION_FAILED. */
const TRADE_REASON_CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,39}$/;

/** DTO-level note check: absent/null is fine; not a string or longer than 500 -> 400 TRADE.VALIDATION_FAILED. */
export function assertReasonNoteShape(note: unknown): void {
  if (note === undefined || note === null) return;
  if (typeof note !== 'string' || note.length > TRADE_REASON_NOTE_MAX_LENGTH) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
  }
}

/** DTO-level code check: an id or any non-code value -> 400 TRADE.VALIDATION_FAILED. */
export function assertReasonCodeShape(code: unknown): asserts code is string {
  if (typeof code !== 'string' || !TRADE_REASON_CODE_PATTERN.test(code)) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
  }
}

/** Backend order: NOT_FOUND -> INACTIVE -> KIND_INVALID -> NOTE_REQUIRED, all 422 with details.field = [field]. */
function usableReason(
  row: ReasonCode | undefined,
  kind: ReasonKind,
  note: string | null | undefined,
  field: 'reasonCodeId' | 'reasonCode',
  checkNote: boolean,
): ReasonCode {
  const fail = (code: string, mismatch = false): never => {
    throw new ApiError(422, code, { field: [field], ...(mismatch ? { reason: ['kind_mismatch'] } : {}) });
  };
  if (!row) return fail('TRADE.REASON.NOT_FOUND');
  if (!row.isActive) return fail('TRADE.REASON.INACTIVE');
  if (row.kind !== kind) return fail('TRADE.REASON.KIND_INVALID', true);
  if (checkNote && row.requiresNote && !note?.trim()) return fail('TRADE.REASON.NOTE_REQUIRED');
  return row;
}

/** Same as backend `assertUsable` (look-up by reason id). */
export function assertUsableReason(input: { id: string; kind: ReasonKind; note?: string | null }): ReasonCode {
  const row = TRADE_FAKE_DB.reasons.find((entry) => entry.id === input.id);
  return usableReason(row, input.kind, input.note, 'reasonCodeId', true);
}

/** Same as backend `assertUsableCode`: prefers the requested kind when a code is shared by several kinds. */
export function assertUsableReasonCode(
  kind: ReasonKind,
  code: string,
  note?: string | null,
  options: { checkNote?: boolean } = {},
): ReasonCode {
  const rows = TRADE_FAKE_DB.reasons.filter((entry) => entry.code === code);
  const row = rows.find((entry) => entry.kind === kind) ?? rows[0];
  return usableReason(row, kind, note, 'reasonCode', options.checkNote !== false);
}

// ---------------------------------------------------------------------------
// Reason-code read endpoints (backend TradeReasonsAdminService.list / counts)
// ---------------------------------------------------------------------------

const REASON_KIND_SET: ReadonlySet<string> = new Set(REASON_KINDS);

/** Backend assertKind: an unknown kind -> 422 TRADE.REASON.KIND_INVALID, details { field: ['kind'] }. */
export function assertReasonKind(kind: string): void {
  if (!REASON_KIND_SET.has(kind)) {
    throw new ApiError(422, 'TRADE.REASON.KIND_INVALID', { field: ['kind'] });
  }
}

/**
 * GET /reason-codes?kind&includeInactive -> `{ items }` (no paging; at most 500 rows).
 * `kind` is optional; `includeInactive` defaults to false. Ordered by sortOrder, code, kind.
 */
export function fakeListReasonCodes(query: { kind?: ReasonKind; includeInactive?: boolean } = {}): { items: ReasonCode[] } {
  if (query.kind !== undefined) assertReasonKind(query.kind);
  const includeInactive = query.includeInactive ?? false;
  const items = TRADE_FAKE_DB.reasons
    .filter((row) => (query.kind === undefined || row.kind === query.kind) && (includeInactive || row.isActive))
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code) || a.kind.localeCompare(b.kind))
    .slice(0, 500);
  return clone({ items });
}

/** GET /reason-codes/counts?includeInactive -> `{ total, byKind }`; `includeInactive` defaults to TRUE here. */
export function fakeCountReasonCodes(query: { includeInactive?: boolean } = {}): {
  total: number;
  byKind: Record<ReasonKind, number>;
} {
  const includeInactive = query.includeInactive ?? true;
  const byKind: Record<ReasonKind, number> = Object.fromEntries(REASON_KINDS.map((kind) => [kind, 0])) as Record<ReasonKind, number>;
  for (const row of TRADE_FAKE_DB.reasons) {
    if (!includeInactive && !row.isActive) continue;
    if (row.kind in byKind) byKind[row.kind] += 1;
  }
  return { total: Object.values(byKind).reduce((sum, count) => sum + count, 0), byKind };
}

// ---------------------------------------------------------------------------
// Store assembly
// ---------------------------------------------------------------------------

const seededItems = buildItems();
const seededCompanyProfiles = buildCompanyProfiles(seededItems);

export const TRADE_FAKE_DB: {
  uoms: Uom[];
  categories: CategoryNode[];
  meta: { categoryTreeVersion: number };
  items: FakeItem[];
  companyProfiles: ItemCompanyProfile[];
  branchProfiles: ItemBranchProfile[];
  standardCosts: ItemStandardCost[];
  channels: Channel[];
  channelBranches: ChannelBranch[];
  listings: FakeListing[];
  parties: FakeParty[];
  accounts: CommercialAccount[];
  owners: Owner[];
  taxes: Tax[];
  reasons: ReasonCode[];
  uomExternalRefs: string[];
  retainedCategoryRefs: string[];
} = {
  uoms: buildUoms(),
  categories: buildCategories(),
  meta: { categoryTreeVersion: 19 },
  items: seededItems,
  companyProfiles: seededCompanyProfiles,
  branchProfiles: buildBranchProfiles(),
  standardCosts: buildStandardCosts(seededItems, seededCompanyProfiles),
  channels: buildChannels(),
  channelBranches: buildChannelBranches(),
  listings: buildListings(seededItems, seededCompanyProfiles),
  parties: buildParties(),
  accounts: buildAccounts(),
  owners: OWNERS_SEED,
  taxes: TAXES_SEED,
  reasons: buildReasons(),
  uomExternalRefs: ['uom-kg'],
  retainedCategoryRefs: ['cat-ramadan'],
};
