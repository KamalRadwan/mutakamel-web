import { Injector, Service, inject } from '@angular/core';
import { QueryClient } from '@tanstack/angular-query';
import { CoreHttp, type CoreQuery, type CoreReadOptions, type CoreWriteMethod, type CoreWriteOptions, type CoreWriteResult } from '../../../core/api/core-http';
import { CrmEvents } from '../../../core/realtime/crm-events';

export type CrmWriteOptions = Omit<CoreWriteOptions, 'key' | 'bare' | 'noBody'> & { key: string };
export type CrmReadOptions = Pick<CoreReadOptions, 'scope'>;
export type CrmHttpTransport = Pick<CrmHttp, 'read' | 'readBlob' | 'write' | 'writeMultipart'>;

const basePath = '/api/tenant/crm/v1';

@Service()
export class CrmHttp {
  private readonly core = inject(CoreHttp);
  private readonly injector = inject(Injector);

  /** Started by the existing app initializer, after the real transport is bound. */
  connectRealtime(queries: QueryClient): void {
    this.injector.get(CrmEvents).bind(queries);
  }

  read<T>(path: string, query?: CoreQuery, options?: CrmReadOptions): Promise<T> {
    return this.core.read<T>(`${basePath}${path}`, query, { bare: true, scope: options?.scope });
  }

  readBlob(path: string, query?: CoreQuery, options?: CrmReadOptions): Promise<Blob> {
    return this.core.readBlob(`${basePath}${path}`, query, { scope: options?.scope });
  }

  write<T>(method: CoreWriteMethod, path: string, body: unknown, options: CrmWriteOptions): Promise<CoreWriteResult<T>> {
    return this.core.write<T>(method, `${basePath}${path}`, body, { ...options, bare: true, noBody: body === undefined });
  }

  writeMultipart<T>(path: string, form: FormData, options: { key: string }): Promise<CoreWriteResult<T>> {
    return this.write<T>('POST', path, form, options);
  }
}

const settingsQueries = new QueryClient({
  defaultOptions: {
    queries: { retry: false, gcTime: 0, networkMode: 'always' },
    mutations: { retry: false, gcTime: 0, networkMode: 'always' },
  },
});

let boundHttp: CrmHttpTransport | undefined;
let boundQueries = settingsQueries;

export function bindCrmHttp(http: CrmHttpTransport, queries: QueryClient): void {
  boundHttp = http;
  boundQueries = queries;
  if (http instanceof CrmHttp) http.connectRealtime(queries);
}

export function crmHttp(): CrmHttpTransport {
  if (!boundHttp) throw new Error('CrmHttp is not bound');
  return boundHttp;
}

export function crmQueries(): QueryClient {
  return boundQueries;
}

export function bindCrmHttpForTest(stub: CrmHttpTransport = crmHttp()): () => void {
  const previousHttp = boundHttp;
  const previousQueries = boundQueries;
  boundHttp = stub;
  boundQueries = settingsQueries;
  return () => {
    boundHttp = previousHttp;
    boundQueries = previousQueries;
  };
}
