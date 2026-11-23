import type { CoreQuery, CoreWriteMethod, CoreWriteResult } from '../../../../core/api/core-http';
import type { CorePage } from '../../../../core/api/core-page';
import type { TradeCoreTransport, TradeHttpTransport, TradeReadOptions, TradeWriteOptions } from '../trade-http';
import { ApiError } from '../trade-api';

export interface RecordedTradeRead {
  path: string;
  query: CoreQuery | undefined;
  scope: TradeReadOptions['scope'];
}

export interface RecordedTradeWrite extends RecordedTradeRead {
  method: CoreWriteMethod;
  body: unknown;
  key: string;
  ifMatch: string | undefined;
}

/** Fixtures contain unwrapped data keyed by "METHOD /path"; Error fixtures reject. */
export class TradeHttpStub implements TradeHttpTransport {
  private reads: RecordedTradeRead[] = [];
  private writes: RecordedTradeWrite[] = [];
  private readonly fixtures: Record<string, unknown>;

  constructor(fixtures: Readonly<Record<string, unknown>> = {}) {
    this.fixtures = { ...fixtures };
  }

  register(method: 'GET' | CoreWriteMethod, path: string, data: unknown): this {
    this.fixtures[`${method} ${path}`] = data;
    return this;
  }

  async read<T>(path: string, query?: CoreQuery, options?: TradeReadOptions): Promise<T> {
    this.reads.push(structuredClone({ path, query, scope: options?.scope }));
    return copyBody(this.fixture('GET', path)) as T;
  }

  async readBlob(path: string, query?: CoreQuery, options?: TradeReadOptions): Promise<Blob> {
    this.reads.push(structuredClone({ path, query, scope: options?.scope }));
    const data = this.fixture('GET', path);
    if (!(data instanceof Blob)) throw new Error(`TradeHttpStub: fixture for GET ${path} is not a Blob`);
    return data.slice(0, data.size, data.type);
  }

  async write<T>(method: CoreWriteMethod, path: string, body: unknown, options: TradeWriteOptions): Promise<CoreWriteResult<T>> {
    if (!options.key) throw new ApiError(400, 'TRADE.IDEMPOTENCY.KEY_MISSING');
    this.writes.push({ method, path, body: copyBody(body), ...structuredClone({
      key: options.key, ifMatch: options.ifMatch, scope: options.scope, query: options.query,
    }) });
    return {
      status: method === 'DELETE' ? 204 : method === 'POST' ? 201 : 200,
      data: copyBody(this.fixture(method, path)) as T,
      etag: null,
      location: null,
    };
  }

  writeMultipart<T>(path: string, form: FormData, options: { key: string; scope?: TradeReadOptions['scope'] }): Promise<CoreWriteResult<T>> {
    return this.write<T>('POST', path, form, options);
  }

  recordedReads(): readonly RecordedTradeRead[] { return [...this.reads]; }
  recordedWrites(): readonly RecordedTradeWrite[] { return [...this.writes]; }

  /** Clear recordings, retaining fixtures, like CrmHttpStub.reset(). */
  reset(): void {
    this.reads = [];
    this.writes = [];
  }

  private fixture(method: string, path: string): unknown {
    const exact = `${method} ${path}`;
    const key = Object.hasOwn(this.fixtures, exact) ? exact : Object.keys(this.fixtures).find((candidate) => {
      const parts = candidate.split('/');
      const actual = exact.split('/');
      return parts.length === actual.length && parts.every((part, i) => part.startsWith(':') ? !!actual[i] : part === actual[i]);
    });
    if (key === undefined) throw new Error(`TradeHttpStub: no fixture for ${exact}`);
    const data = this.fixtures[key];
    if (data instanceof Error) throw data;
    return data;
  }
}

/** Core fixtures retain {data, meta} pages; no Trade envelope or base path is added. */
export class TradeCoreStub extends TradeHttpStub implements TradeCoreTransport {
  readPage<T>(path: string, query?: CoreQuery, options?: TradeReadOptions): Promise<CorePage<T>> {
    return this.read<CorePage<T>>(path, query, options);
  }
}

function copyBody(body: unknown): unknown {
  if (body instanceof Blob) return body.slice(0, body.size, body.type);
  if (!(body instanceof FormData)) return structuredClone(body);
  const copy = new FormData();
  body.forEach((value, key) => copy.append(key, value));
  return copy;
}
