import { isUUIDv7 } from "@/lib/uuid";
import {
  TRADE_V1,
  isBoundedString,
  isTradeDate,
  parseTradeFinalizedDocument,
  record,
  tradeInvalidResponse,
  type TradeFinalizedDocument,
} from "../documents/trade-document-contract";

// Contracts — 7 routes.
//
// **Not feature-gated.** MASTER-PLAN 11.18 says contracts are gated on
// `trade.contracts_recurring`. They are not: `TradeContractsController` carries
// no `@RequireTradeFeature`, and `trade.contracts_recurring` is referenced
// **nowhere** in `trade-app/src` — it is a declared feature key with no
// consumer. No entitlement gate is built for it.

export const CONTRACTS_PATH = `${TRADE_V1}/contracts`;

export const CONTRACT_PERMISSIONS = {
  read: "trade.contracts.read",
  create: "trade.contracts.create",
  update: "trade.contracts.update",
  activate: "trade.contracts.activate",
} as const;

export interface Contract extends TradeFinalizedDocument {
  effectiveFrom: string | null;
  effectiveTo: string | null;
}

interface ContractClause {
  id: string;
  clauseOrder: number;
  title: string;
  body: string;
}

export interface ContractDetail extends Contract {
  clauses: ContractClause[];
}

/**
 * `financialTerms.mode` — `@IsIn(["FINANCIAL","NON_FINANCIAL"])`, an inline
 * list rather than an exported enum, stored inside `termsSnapshot.financial`.
 */
export function contractFinancialMode(contract: Contract): string | null {
  const financial = record(contract.termsSnapshot.financial);
  const mode = financial?.mode;
  return typeof mode === "string" ? mode : null;
}

export function parseContract(payload: unknown): Contract {
  const document = parseTradeFinalizedDocument(payload);
  const row = record(payload);
  if (!row) tradeInvalidResponse();
  return {
    ...document,
    effectiveFrom: optionalDate(row.effectiveFrom),
    effectiveTo: optionalDate(row.effectiveTo),
  };
}

export function parseContractDetail(payload: unknown): ContractDetail {
  const contract = parseContract(payload);
  const row = record(payload);
  if (!row || !Array.isArray(row.clauses)) tradeInvalidResponse();
  return { ...contract, clauses: row.clauses.map(parseClause) };
}

function parseClause(payload: unknown): ContractClause {
  const clause = record(payload);
  if (
    !clause ||
    !isUUIDv7(clause.id) ||
    typeof clause.clauseOrder !== "number" ||
    !isBoundedString(clause.title, 500) ||
    // `ContractClauseInputDto.body` is `@MaxLength(20_000)` and the column is
    // `text`, so the response bound is the DTO's.
    !isBoundedString(clause.body, 20_000)
  ) {
    tradeInvalidResponse();
  }
  return {
    id: clause.id,
    clauseOrder: clause.clauseOrder,
    title: clause.title,
    body: clause.body,
  };
}

function optionalDate(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return isTradeDate(value) ? value : tradeInvalidResponse();
}
