import { type Injector, inject, runInInjectionContext } from '@angular/core';
import type { TenantMe } from '../../../core/auth/auth-session.model';
import type { ScopeState } from '../../../core/scope/scope';
import { TenantScopeState } from '../../../core/scope/tenant-scope';
import { branchGrants, tenantWide } from '../shared/trade-access';
import type { TradeContext } from '../shared/trade-api';
import type { ScopeTarget } from './policy.model';

export const REGISTRY_VERSION = '2026.11.1';

export const POLICY_KINDS = [
  'PRICING_GUARD',
  'ORDER_CONFIRMATION',
  'PURCHASE_APPROVAL',
  'CREDIT',
  'INVENTORY_NEGATIVE',
  'INVENTORY_RESERVATION',
  'INVENTORY_OVER_RECEIPT',
] as const;

export type PolicyKind = (typeof POLICY_KINDS)[number];

export const ACTIVE_POLICY_KINDS: readonly PolicyKind[] = [
  'PRICING_GUARD',
  'ORDER_CONFIRMATION',
  'PURCHASE_APPROVAL',
  'INVENTORY_NEGATIVE',
  'INVENTORY_RESERVATION',
  'INVENTORY_OVER_RECEIPT',
];

export const WORKFLOW_KINDS = [
  'PURCHASE_ORDER',
  'QUOTATION',
  'SALES_ORDER',
  'PRICE_PUBLICATION',
  'CONFIGURATION_PUBLICATION',
] as const;

export type WorkflowKind = (typeof WORKFLOW_KINDS)[number];

export const ACTIVE_WORKFLOW_KINDS: readonly WorkflowKind[] = ['PURCHASE_ORDER'];

export type FactType = 'string' | 'number' | 'decimal' | 'boolean';

export interface PolicyFactDefinition {
  key: string;
  type: FactType;
}

/** Dotted facts carrying money or decimal thresholds (backend numeric 24,8). */
export const MONEY_FACT_KEYS: readonly string[] = ['document.total', 'account.credit_limit'];

export function isMoneyFact(key: string): boolean {
  return MONEY_FACT_KEYS.includes(key);
}

export function isDecimalFact(fact: Pick<PolicyFactDefinition, 'key' | 'type'> | null | undefined): boolean {
  if (!fact) return false;
  return fact.type === 'decimal' || isMoneyFact(fact.key);
}

export function factLabel(translate: (key: string) => string, factKey: string): string {
  const i18nKey = `policy.facts.${factKey}`;
  const translated = translate(i18nKey);
  return translated && translated !== i18nKey ? translated : factKey;
}

export const POLICY_PERMISSIONS = {
  read: 'trade.policy.read',
  manage: 'trade.policy.manage',
  test: 'trade.policy.test',
  approve: 'trade.policy.approve',
  publish: 'trade.policy.publish',
} as const;

export function hasPolicyGrant(injector: Injector, scope: ScopeState, key: string): boolean {
  if (runInInjectionContext(injector, () => tenantWide(key))) {
    return true;
  }
  if (key === POLICY_PERMISSIONS.publish) return false;
  const grants = runInInjectionContext(injector, () => branchGrants(key));
  if (grants === 'ALL') return true;
  const company = scope.company();
  if (!company?.id) return grants.size > 0;
  const branchId = scope.branch()?.id || undefined;
  if (branchId && grants.has(branchId)) return true;
  if (!branchId && company.branches.some((branch) => grants.has(branch.id))) return true;
  const me = runInInjectionContext(injector, () => inject(TenantScopeState).me());
  const variants = [key, `${key}.own`, `${key}.team`, `${key}.all`];
  return variants.some(
    (variant) =>
      !!me?.permissions.includes(variant) &&
      !!me.permissionScopes[variant]?.companyIds.includes(company.id),
  );
}

export function operatingTradeContext(tenantScope: TenantScopeState): TradeContext {
  const sel = tenantScope.selection();
  const ctx: TradeContext = {};
  if (sel?.companyId) ctx.companyId = sel.companyId;
  if (sel?.branchId) ctx.branchId = sel.branchId;
  return ctx;
}

export function operatingScopeTarget(tenantScope: TenantScopeState): ScopeTarget {
  const sel = tenantScope.selection();
  if (sel?.branchId) return 'BRANCH';
  if (sel?.companyId) return 'COMPANY';
  return 'TENANT';
}

export function actorLabel(
  id: string | null | undefined,
  me: TenantMe | null | undefined,
  lang: 'en' | 'ar',
): string {
  if (!id) {
    return lang === 'ar' ? 'النظام' : 'System';
  }
  if (me && id === me.id) {
    return `${me.firstName} ${me.lastName}`.trim() || me.email || id;
  }
  return id;
}

const DECIMAL_STRING = /^-?\d{1,18}(\.\d{1,8})?$/;

export function isDecimalString(value: unknown): value is string {
  return typeof value === 'string' && DECIMAL_STRING.test(value.trim());
}

function toScaled(value: string | number): bigint | null {
  const text = (typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '').trim();
  if (!DECIMAL_STRING.test(text)) return null;
  const negative = text.startsWith('-');
  const [whole, frac = ''] = text.replace('-', '').split('.');
  const scaled = BigInt(whole + frac.padEnd(8, '0'));
  return negative ? -scaled : scaled;
}

/** Exact comparison of decimal strings (or legacy finite numbers); null when either is not a valid decimal. */
export function compareDecimal(a: string | number, b: string | number): number | null {
  const x = toScaled(a);
  const y = toScaled(b);
  return x === null || y === null ? null : x < y ? -1 : x > y ? 1 : 0;
}

export const OPERATORS = ['EQ', 'NEQ', 'GT', 'GTE', 'LT', 'LTE', 'IN', 'CONTAINS'] as const;
export type PolicyOperator = (typeof OPERATORS)[number];

const OPERATORS_BY_TYPE: Readonly<Record<FactType, readonly PolicyOperator[]>> = {
  number: ['EQ', 'NEQ', 'GT', 'GTE', 'LT', 'LTE', 'IN'],
  decimal: ['EQ', 'NEQ', 'GT', 'GTE', 'LT', 'LTE', 'IN'],
  string: ['EQ', 'NEQ', 'IN', 'CONTAINS'],
  boolean: ['EQ', 'NEQ'],
};

export function operatorsFor(type: FactType): readonly PolicyOperator[] {
  return OPERATORS_BY_TYPE[type] ?? OPERATORS_BY_TYPE.string;
}

export const OUTCOMES = ['ALLOW', 'DENY', 'REQUIRE_APPROVAL', 'SELECT'] as const;
export type PolicyOutcome = (typeof OUTCOMES)[number];

export const WORKFLOW_ACTIONS = [
  'SUBMIT',
  'APPROVE',
  'REJECT',
  'WITHDRAW',
  'CONFIRM',
  'CANCEL',
  'HOLD',
  'RELEASE',
  'RETRY',
] as const;
export type WorkflowAction = (typeof WORKFLOW_ACTIONS)[number];

export const PURCHASE_ORDER_WORKFLOW_SHAPE = {
  states: ['PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN'] as readonly string[],
  initialState: 'PENDING',
  terminalStates: ['APPROVED', 'REJECTED', 'WITHDRAWN'] as readonly string[],
  transitions: [
    {
      code: 'APPROVE_PURCHASE_ORDER',
      from: 'PENDING',
      to: 'APPROVED',
      action: 'APPROVE' as WorkflowAction,
      requiresApproval: true,
    },
    {
      code: 'REJECT_PURCHASE_ORDER',
      from: 'PENDING',
      to: 'REJECTED',
      action: 'REJECT' as WorkflowAction,
      requiresApproval: true,
    },
    {
      code: 'WITHDRAW_PURCHASE_ORDER',
      from: 'PENDING',
      to: 'WITHDRAWN',
      action: 'WITHDRAW' as WorkflowAction,
      requiresApproval: false,
    },
  ],
};

export const CODE_PATTERN = /^[A-Z][A-Z0-9_.-]{1,99}$/;
export const RULE_CODE = /^[A-Z][A-Z0-9_]{1,63}$/;
export const REASON_CODE = /^[A-Z][A-Z0-9_.-]{1,79}$/;
