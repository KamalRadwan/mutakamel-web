import type { ScopeCompany } from './scope';

export const FAKE_COMPANIES: readonly ScopeCompany[] = [
  {
    id: 'c1',
    nameEn: 'Mutakamel Trading',
    nameAr: 'متكامل للتجارة',
    currencyCode: 'EGP',
    branches: [
      { id: 'b1', nameEn: 'Cairo HQ', nameAr: 'المقر الرئيسي بالقاهرة' },
      { id: 'b2', nameEn: 'Alexandria', nameAr: 'الإسكندرية' },
      { id: 'b3', nameEn: 'Giza', nameAr: 'الجيزة' },
    ],
  },
  {
    id: 'c2',
    nameEn: 'Mutakamel Industries',
    nameAr: 'متكامل للصناعات',
    currencyCode: 'SAR',
    branches: [
      { id: 'b4', nameEn: '10th of Ramadan Factory', nameAr: 'مصنع العاشر من رمضان' },
      { id: 'b5', nameEn: 'Cairo Office', nameAr: 'مكتب القاهرة' },
    ],
  },
];
