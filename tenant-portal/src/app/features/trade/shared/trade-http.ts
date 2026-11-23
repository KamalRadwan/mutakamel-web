import { Service, inject } from '@angular/core';
import { QueryClient } from '@tanstack/angular-query';
import { CoreHttp, type CoreQuery, type CoreReadOptions, type CoreWriteMethod, type CoreWriteOptions, type CoreWriteResult } from '../../../core/api/core-http';
import { ApiError, TRADE_API_BASE, toTradeError } from './trade-api';

export type TradeReadOptions = Pick<CoreReadOptions, 'scope'>;
export type TradeWriteOptions = Omit<CoreWriteOptions, 'key' | 'bare' | 'noBody'> & { key: string };
export type TradeHttpTransport = Pick<TradeHttp, 'read' | 'readBlob' | 'write' | 'writeMultipart'>;
export type TradeCoreTransport = Pick<CoreHttp, 'read' | 'readPage' | 'readBlob'>;

@Service()
export class TradeHttp {
  private readonly core = inject(CoreHttp);

  async read<T>(path: string, query?: CoreQuery, options?: TradeReadOptions): Promise<T> {
    try {
      return await this.core.read<T>(`${TRADE_API_BASE}${path}`, query, { scope: options?.scope });
    } catch (error) {
      throw toTradeError(error);
    }
  }

  async readBlob(path: string, query?: CoreQuery, options?: TradeReadOptions): Promise<Blob> {
    try {
      return await this.core.readBlob(`${TRADE_API_BASE}${path}`, query, { scope: options?.scope });
    } catch (error) {
      throw toTradeError(error);
    }
  }

  /** Reuse a key only for a retry of the same body; never resend after GW.IDEM.MISMATCH. */
  async write<T>(method: CoreWriteMethod, path: string, body: unknown, options: TradeWriteOptions): Promise<CoreWriteResult<T>> {
    try {
      if (!options.key) throw new ApiError(400, 'TRADE.IDEMPOTENCY.KEY_MISSING');
      return await this.core.write<T>(method, `${TRADE_API_BASE}${path}`, body, {
        key: options.key, ifMatch: options.ifMatch, scope: options.scope, query: options.query, noBody: body === undefined,
      });
    } catch (error) {
      throw toTradeError(error);
    }
  }

  /** The caller follows the same retry/key rules as write. */
  writeMultipart<T>(path: string, form: FormData, options: { key: string; scope?: TradeReadOptions['scope'] }): Promise<CoreWriteResult<T>> {
    return this.write<T>('POST', path, form, options);
  }
}

const defaultQueries = new QueryClient({
  defaultOptions: {
    queries: { retry: false, gcTime: 0, networkMode: 'always' },
    mutations: { retry: false, gcTime: 0, networkMode: 'always' },
  },
});

let boundHttp: TradeHttpTransport | undefined;
let boundCore: TradeCoreTransport | undefined;
let boundQueries = defaultQueries;

export function bindTradeHttp(http: TradeHttpTransport, queries: QueryClient, core: TradeCoreTransport): void {
  boundHttp = http;
  boundQueries = queries;
  boundCore = core;
}

export function tradeHttp(): TradeHttpTransport {
  if (!boundHttp) throw new Error('TradeHttp is not bound');
  return boundHttp;
}

export function tradeCore(): TradeCoreTransport {
  if (!boundCore) throw new Error('Trade CoreHttp is not bound');
  return boundCore;
}

export function tradeQueries(): QueryClient {
  return boundQueries;
}

/** Tests supply their own transports; omitted transports stay unbound. */
export function bindTradeHttpForTest(stub?: TradeHttpTransport, core?: TradeCoreTransport): () => void {
  const previousHttp = boundHttp;
  const previousCore = boundCore;
  const previousQueries = boundQueries;
  boundHttp = stub;
  boundCore = core;
  boundQueries = defaultQueries;
  return () => {
    boundHttp = previousHttp;
    boundCore = previousCore;
    boundQueries = previousQueries;
  };
}
