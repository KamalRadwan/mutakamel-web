import { inject, Service } from '@angular/core';
import { ApiError } from '../../../core/api/api-errors';
import { CoreHttp, type CoreQuery, type CoreWriteMethod } from '../../../core/api/core-http';
import type { TemplateCursorPage } from './templates.model';

@Service()
export class TemplatesHttp {
  private readonly http = inject(CoreHttp);

  async cursorPage<T>(path: string, query?: CoreQuery): Promise<TemplateCursorPage<T>> {
    return this.checkCursorPage<T>(await this.http.read<unknown>(path, query));
  }

  checkCursorPage<T>(body: unknown): TemplateCursorPage<T> {
    const page = body as Partial<TemplateCursorPage<T>> | null;
    const info = page?.pageInfo;
    if (!Array.isArray(page?.items) || !info ||
        !Number.isInteger(info.limit) || info.limit < 1 || info.limit > 100 ||
        typeof info.hasNextPage !== 'boolean' ||
        !(info.nextCursor === null || typeof info.nextCursor === 'string')) {
      throw new ApiError(502, 'COMMON.GENERIC.INTERNAL_ERROR');
    }
    return page as TemplateCursorPage<T>;
  }

  read<T>(path: string, query?: CoreQuery): Promise<T> {
    return this.http.read<T>(path, query);
  }

  readWithEtag<T>(path: string, query?: CoreQuery) {
    return this.http.readWithEtag<T>(path, query);
  }

  readBlob(path: string, query?: CoreQuery): Promise<Blob> {
    return this.http.readBlob(path, query);
  }

  write<T>(method: CoreWriteMethod, path: string, body: unknown, options: { key: string; ifMatch?: string }) {
    return this.http.write<T>(method, path, body, options);
  }

  async readLikePost<T>(path: string, body: unknown): Promise<T> {
    return (await this.http.write<T>('POST', path, body)).data;
  }
}
