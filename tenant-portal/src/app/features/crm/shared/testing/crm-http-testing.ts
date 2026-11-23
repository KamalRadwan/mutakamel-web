import type { CoreQuery, CoreWriteMethod, CoreWriteResult } from '../../../../core/api/core-http';
import type { CrmHttpTransport, CrmReadOptions, CrmWriteOptions } from '../crm-http';
import { CRM_SETTINGS_FIXTURES } from './crm-settings-fixtures';

export interface RecordedCrmRead {
  path: string;
  query: CoreQuery | undefined;
  scope: CrmReadOptions['scope'];
}

export interface RecordedCrmWrite {
  method: CoreWriteMethod;
  path: string;
  body: unknown;
  options: CrmWriteOptions;
}

export class CrmHttpStub implements CrmHttpTransport {
  private reads: RecordedCrmRead[] = [];
  private writes: RecordedCrmWrite[] = [];

  constructor(private readonly fixtures: Readonly<Record<string, unknown>> = CRM_SETTINGS_FIXTURES) {}

  async read<T>(path: string, query?: CoreQuery, options?: CrmReadOptions): Promise<T> {
    this.reads.push(structuredClone({ path, query, scope: options?.scope }));
    if (!Object.hasOwn(this.fixtures, path)) throw new Error(`No CRM GET fixture for ${path}`);
    const data = structuredClone(this.fixtures[path]);
    if (!Array.isArray(data) || !query) return data as T;
    return data.filter((item: Record<string, unknown>) => Object.entries(query).every(([key, value]) =>
      value === undefined || value === null || value === '' || !(key in item) ||
      (Array.isArray(value) ? value.includes(item[key] as string) : item[key] === value),
    )) as T;
  }

  async readBlob(path: string, query?: CoreQuery, options?: CrmReadOptions): Promise<Blob> {
    this.reads.push(structuredClone({ path, query, scope: options?.scope }));
    const data = this.fixtures[path];
    if (!(data instanceof Blob)) throw new Error(`No CRM Blob fixture for ${path}`);
    return data.slice(0, data.size, data.type);
  }

  async write<T>(method: CoreWriteMethod, path: string, body: unknown, options: CrmWriteOptions): Promise<CoreWriteResult<T>> {
    this.writes.push({ method, path, body: copyBody(body), options: structuredClone(options) });
    return {
      status: method === 'DELETE' ? 204 : method === 'POST' ? 201 : 200,
      data: (method === 'DELETE' ? undefined : copyBody(body)) as T,
      etag: null,
      location: null,
    };
  }

  writeMultipart<T>(path: string, form: FormData, options: { key: string }): Promise<CoreWriteResult<T>> {
    return this.write<T>('POST', path, form, options);
  }

  recordedReads(): readonly RecordedCrmRead[] {
    return [...this.reads];
  }

  recordedWrites(): readonly RecordedCrmWrite[] {
    return [...this.writes];
  }

  reset(): void {
    this.reads = [];
    this.writes = [];
  }
}

function copyBody(body: unknown): unknown {
  if (!(body instanceof FormData)) return structuredClone(body);
  const copy = new FormData();
  body.forEach((value, key) => copy.append(key, value));
  return copy;
}
