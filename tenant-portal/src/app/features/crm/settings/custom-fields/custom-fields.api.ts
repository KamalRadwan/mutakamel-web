import { ApiError } from '../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { crmHttp, crmQueries } from '../../shared/crm-http';
import {
  CreateCustomFieldInput, CustomField, CustomFieldDefinition, FieldRequirementRow,
  SetRequirementInput, UpdateCustomFieldPatch,
} from './custom-fields.model';

const queryKey = ['crm-settings', 'custom-fields'] as const;
const requests = new WeakMap<object, { key: string; bodyJson: string; path: string }>();

export function listCustomFields(): Promise<CustomField[]> {
  return crmQueries().fetchQuery({ queryKey, queryFn: () => crmHttp().read<CustomField[]>('/custom-fields') });
}

export function createCustomField(input: CreateCustomFieldInput): Promise<CustomFieldDefinition> {
  return write('POST', '/custom-fields', input);
}

export function updateCustomField(id: string, patch: UpdateCustomFieldPatch): Promise<CustomFieldDefinition> {
  return write('PATCH', `/custom-fields/${id}`, patch);
}

export function setRequirement(id: string, input: SetRequirementInput): Promise<FieldRequirementRow> {
  return write('POST', `/custom-fields/${id}/requirements`, input);
}

async function write<T>(method: 'POST' | 'PATCH', path: string, body: object): Promise<T> {
  const bodyJson = JSON.stringify(body);
  const previous = requests.get(body);
  const request = previous?.bodyJson === bodyJson && previous.path === path
    ? previous : { key: newIdempotencyKey(), bodyJson, path };
  requests.set(body, request);
  const queries = crmQueries();
  try {
    const result = await queries.getMutationCache().build(queries, {
      mutationFn: () => crmHttp().write<T>(method, path, JSON.parse(bodyJson), { key: request.key }),
      retry: false,
    }).execute(undefined);
    requests.delete(body);
    await queries.cancelQueries({ queryKey });
    await queries.invalidateQueries({ queryKey });
    return result.data;
  } catch (error) {
    if (!keepRequest(error)) requests.delete(body);
    throw error;
  }
}

function keepRequest(error: unknown): boolean {
  return error instanceof ApiError &&
    (error.status === 0 || error.status === 401 || error.status >= 500 || error.code === 'GW.IDEM.IN_FLIGHT');
}

/** Keeps the same body object (and its key) when a user retries an uncertain write. */
export class CustomFieldSubmission {
  private pending: { bodyJson: string; body: object } | null = null;

  async run<T extends object, R>(body: T, send: (body: T) => Promise<R>): Promise<R> {
    const bodyJson = JSON.stringify(body);
    if (this.pending?.bodyJson !== bodyJson) this.pending = { bodyJson, body };
    try {
      const result = await send(this.pending.body as T);
      this.reset();
      return result;
    } catch (error) {
      if (!keepRequest(error)) this.reset();
      throw error;
    }
  }

  reset(): void {
    this.pending = null;
  }
}
