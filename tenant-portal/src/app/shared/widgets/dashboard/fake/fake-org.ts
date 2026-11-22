export interface FakeCompany {
  id: string;
  name: { en: string; ar: string };
}

export interface FakeBranch {
  id: string;
  name: { en: string; ar: string };
  companyId: string;
}

export interface FakeTeam {
  id: string;
  name: { en: string; ar: string };
  branchId: string;
}

export interface FakePerson {
  id: string;
  name: string;
  nameAr: string;
  email: string;
  teamId: string;
  branchId: string;
}

const COMPANY_NILE_ID = '01934b10-0000-7000-8000-000000000001';
const COMPANY_DELTA_ID = '01934b10-0000-7000-8000-000000000002';

const BRANCH_CAIRO_ID = '01934b10-0000-7000-8000-000000000101';
const BRANCH_ALEX_ID = '01934b10-0000-7000-8000-000000000102';
const BRANCH_GIZA_ID = '01934b10-0000-7000-8000-000000000103';

const TEAM_CAIRO_SALES_ID = '01934b10-0000-7000-8000-000000000201';
const TEAM_CAIRO_CORP_ID = '01934b10-0000-7000-8000-000000000202';
const TEAM_ALEX_SALES_ID = '01934b10-0000-7000-8000-000000000203';
const TEAM_GIZA_SALES_ID = '01934b10-0000-7000-8000-000000000204';

export const FAKE_COMPANIES: FakeCompany[] = [
  { id: COMPANY_NILE_ID, name: { en: 'Nile Trading', ar: 'النيل للتجارة' } },
  { id: COMPANY_DELTA_ID, name: { en: 'Delta Supplies', ar: 'الدلتا للتوريدات' } },
];

export const FAKE_BRANCHES: FakeBranch[] = [
  { id: BRANCH_CAIRO_ID, name: { en: 'Cairo', ar: 'القاهرة' }, companyId: COMPANY_NILE_ID },
  { id: BRANCH_ALEX_ID, name: { en: 'Alexandria', ar: 'الإسكندرية' }, companyId: COMPANY_DELTA_ID },
  { id: BRANCH_GIZA_ID, name: { en: 'Giza', ar: 'الجيزة' }, companyId: COMPANY_NILE_ID },
];

export const FAKE_TEAMS: FakeTeam[] = [
  { id: TEAM_CAIRO_SALES_ID, name: { en: 'Cairo sales', ar: 'مبيعات القاهرة' }, branchId: BRANCH_CAIRO_ID },
  { id: TEAM_CAIRO_CORP_ID, name: { en: 'Cairo corporate', ar: 'شركات القاهرة' }, branchId: BRANCH_CAIRO_ID },
  { id: TEAM_ALEX_SALES_ID, name: { en: 'Alexandria sales', ar: 'مبيعات الإسكندرية' }, branchId: BRANCH_ALEX_ID },
  { id: TEAM_GIZA_SALES_ID, name: { en: 'Giza sales', ar: 'مبيعات الجيزة' }, branchId: BRANCH_GIZA_ID },
];

export const FAKE_PEOPLE: FakePerson[] = [
  {
    id: '01934b10-0000-7000-8000-000000000301',
    name: 'Nada Mahmoud',
    nameAr: 'ندى محمود',
    email: 'nada.mahmoud@nawa.eg',
    teamId: TEAM_CAIRO_SALES_ID,
    branchId: BRANCH_CAIRO_ID,
  },
  {
    id: '01934b10-0000-7000-8000-000000000302',
    name: 'Ali Hassan',
    nameAr: 'علي حسن',
    email: 'ali.hassan@nawa.eg',
    teamId: TEAM_CAIRO_SALES_ID,
    branchId: BRANCH_CAIRO_ID,
  },
  {
    id: '01934b10-0000-7000-8000-000000000303',
    name: 'Sara Kamel',
    nameAr: 'سارة كامل',
    email: 'sara.kamel@nawa.eg',
    teamId: TEAM_CAIRO_CORP_ID,
    branchId: BRANCH_CAIRO_ID,
  },
  {
    id: '01934b10-0000-7000-8000-000000000304',
    name: 'Omar Mostafa',
    nameAr: 'عمر مصطفى',
    email: 'omar.mostafa@nawa.eg',
    teamId: TEAM_CAIRO_CORP_ID,
    branchId: BRANCH_CAIRO_ID,
  },
  {
    id: '01934b10-0000-7000-8000-000000000305',
    name: 'Mona Adel',
    nameAr: 'منى عادل',
    email: 'mona.adel@nawa.eg',
    teamId: TEAM_ALEX_SALES_ID,
    branchId: BRANCH_ALEX_ID,
  },
  {
    id: '01934b10-0000-7000-8000-000000000306',
    name: 'Karim Samir',
    nameAr: 'كريم سمير',
    email: 'karim.samir@nawa.eg',
    teamId: TEAM_ALEX_SALES_ID,
    branchId: BRANCH_ALEX_ID,
  },
  {
    id: '01934b10-0000-7000-8000-000000000307',
    name: 'Heba Fathy',
    nameAr: 'هبة فتحي',
    email: 'heba.fathy@nawa.eg',
    teamId: TEAM_GIZA_SALES_ID,
    branchId: BRANCH_GIZA_ID,
  },
  {
    id: '01934b10-0000-7000-8000-000000000308',
    name: 'Youssef Nabil',
    nameAr: 'يوسف نبيل',
    email: 'youssef.nabil@nawa.eg',
    teamId: TEAM_GIZA_SALES_ID,
    branchId: BRANCH_GIZA_ID,
  },
];

export const FAKE_ME: { id: string; name: string; nameAr: string } = {
  id: FAKE_PEOPLE[0].id,
  name: FAKE_PEOPLE[0].name,
  nameAr: FAKE_PEOPLE[0].nameAr,
};

export function fakeLang(): 'ar' | 'en' {
  return typeof document !== 'undefined' && document.documentElement.lang === 'ar' ? 'ar' : 'en';
}
