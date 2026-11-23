import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { crmHttp, type CrmHttpTransport } from '../../shared/crm-http';
import { keepEmailKey } from './outbound-emails.model';

const pending = new WeakMap<CrmHttpTransport, Map<string, { key: string; bodyJson: string }>>();

/** Options, preview and search are reads over POST, but still carry stable retry keys. */
export async function requestEmailData<T>(path: string, body: unknown): Promise<T> {
  const http = crmHttp();
  let actions = pending.get(http);
  if (!actions) {
    actions = new Map();
    pending.set(http, actions);
  }
  const bodyJson = JSON.stringify(body);
  let action = actions.get(path);
  if (!action || action.bodyJson !== bodyJson) {
    action = { key: newIdempotencyKey(), bodyJson };
    actions.set(path, action);
  }
  try {
    const result = await http.write<T>('POST', path, body, { key: action.key });
    if (actions.get(path) === action) actions.delete(path);
    return result.data;
  } catch (error) {
    if (!keepEmailKey(error) && actions.get(path) === action) actions.delete(path);
    throw error;
  }
}
