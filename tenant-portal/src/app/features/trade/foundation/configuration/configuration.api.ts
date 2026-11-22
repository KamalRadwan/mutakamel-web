import type { TradeContext } from '../../shared/trade-api';
import type { Page } from '../../shared/trade-foundation.model';
import {
  fakeCancelVersion,
  fakeCreateDefinition,
  fakeCreateVersion,
  fakeGetDefinition,
  fakeListDefinitions,
  fakePublishVersion,
  fakeRetireVersion,
  fakeTestVersion,
} from './configuration.fake';
import type {
  ConfigDefinition,
  ConfigDefinitionDetail,
  ConfigVersion,
  CreateDefinitionBody,
  CreateVersionBody,
  CreatedConfigVersion,
  ListDefinitionsQuery,
  PublishVersionBody,
  PublishedConfigVersion,
  TestResult,
} from './configuration.model';

// GET /api/tenant/trade/v1/configuration/definitions?page&limit (+ scope context headers: TENANT none, COMPANY company, BRANCH company + branch)
export function listDefinitions(ctx: TradeContext, query: ListDefinitionsQuery = {}): Promise<Page<ConfigDefinition>> {
  return fakeListDefinitions(ctx, query);
}

// GET /api/tenant/trade/v1/configuration/definitions/:id
export function getDefinition(id: string): Promise<ConfigDefinitionDetail> {
  return fakeGetDefinition(id);
}

// POST /api/tenant/trade/v1/configuration/definitions (+ x-idempotency-key; never send company/branch headers)
export function createDefinition(body: CreateDefinitionBody, idempotencyKey: string): Promise<ConfigDefinition> {
  return fakeCreateDefinition(body, idempotencyKey);
}

// POST /api/tenant/trade/v1/configuration/definitions/:id/versions (+ scope context headers, If-Match: definitionVersion, x-idempotency-key)
export function createVersion(
  ctx: TradeContext,
  definitionId: string,
  definitionVersion: number,
  body: CreateVersionBody,
  idempotencyKey: string,
): Promise<CreatedConfigVersion> {
  return fakeCreateVersion(ctx, definitionId, definitionVersion, body, idempotencyKey);
}

// POST /api/tenant/trade/v1/configuration/versions/:id/test (+ scope context headers, If-Match: rowVersion, x-idempotency-key; empty body)
export function testVersion(
  ctx: TradeContext,
  versionId: string,
  rowVersion: number,
  idempotencyKey: string,
): Promise<TestResult> {
  return fakeTestVersion(ctx, versionId, rowVersion, idempotencyKey);
}

// POST /api/tenant/trade/v1/configuration/versions/:id/publish (+ scope context headers, If-Match: rowVersion, x-idempotency-key)
export function publishVersion(
  ctx: TradeContext,
  versionId: string,
  rowVersion: number,
  body: PublishVersionBody,
  idempotencyKey: string,
): Promise<PublishedConfigVersion> {
  return fakePublishVersion(ctx, versionId, rowVersion, body, idempotencyKey);
}

// POST /api/tenant/trade/v1/configuration/versions/:id/retire (+ scope context headers, If-Match: rowVersion, x-idempotency-key)
export function retireVersion(
  ctx: TradeContext,
  versionId: string,
  rowVersion: number,
  idempotencyKey: string,
): Promise<ConfigVersion> {
  return fakeRetireVersion(ctx, versionId, rowVersion, idempotencyKey);
}

// POST /api/tenant/trade/v1/configuration/versions/:id/cancel (+ scope context headers, If-Match: rowVersion, x-idempotency-key)
export function cancelVersion(
  ctx: TradeContext,
  versionId: string,
  rowVersion: number,
  idempotencyKey: string,
): Promise<ConfigVersion> {
  return fakeCancelVersion(ctx, versionId, rowVersion, idempotencyKey);
}
