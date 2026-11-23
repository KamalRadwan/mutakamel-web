import { Injectable } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  Translation,
  TranslocoLoader,
  TranslocoService,
  provideTransloco,
} from '@jsverse/transloco';
import { defer } from 'rxjs';
import { vi } from 'vitest';
import {
  CoreHttp,
  CoreQuery,
  CoreWriteMethod,
  CoreWriteResult,
} from '../../../../core/api/core-http';
import { ApiError } from '../../../../core/api/api-errors';
import { Notify } from '../../../../core/notify/notify';
import { CrmWriteOptions, CrmReadOptions } from '../../shared/crm-http';
import { CrmHttpStub } from '../../shared/testing/crm-http-testing';
import {
  OpportunityTransport,
  bindRecordTest,
  recordTestProviders,
} from '../opportunity-page/opportunity-test-support';
import { listTranslations } from './opportunities-test-translations';
import { pipeline } from '../opportunity-page/opportunity-test-support';
import { opportunityRowToBoardRow } from '../opportunity-card/opportunity-card';
import { BoardResponse } from '../opportunities.model';
import { OpportunityMoves } from '../opportunity-moves/opportunity-moves';

@Injectable()
class ListTranslations implements TranslocoLoader {
  getTranslation(path: string) {
    return defer(() => Promise.resolve(listTranslations[path] ?? {}));
  }
}

export class OpportunityListTransport extends OpportunityTransport {
  searchFailure: ApiError | null = null;
  boardResponse: BoardResponse = {
    pipeline,
    stages: pipeline.stages.map((stage, index) => ({
      stage,
      items: index === 0 ? [opportunityRowToBoardRow(this.row)] : [],
      summary: { totalCount: index === 0 ? 2 : 0, amountsByCurrency: index === 0 ? [{ currencyCode: 'KWD', amount: '12400.00000000' }] : [] },
      activitySummary: { totalCount: index === 0 ? 2 : 0, noOpenCount: index === 0 ? 2 : 0, overdueCount: 0, todayCount: 0, futureCount: 0 },
      pageInfo: { limit: 50, hasMore: index === 0, nextCursor: index === 0 ? 'more-new' : null },
    })),
  };
  override async read<T>(path: string, query?: CoreQuery, options?: CrmReadOptions): Promise<T> {
    if (path === '/opportunities/reasons') {
      await CrmHttpStub.prototype.read.call(this, path, query, options).catch(() => undefined);
      const error = this.readErrors.get(path);
      if (error) throw error;
      return { items: [{ id: 'reason', code: 'R1', nameEn: 'Price', nameAr: 'السعر', kind: query?.['kind'] }] } as T;
    }
    if (path === '/static-data' || path === '/acquisition-sources') {
      await CrmHttpStub.prototype.read.call(this, path, query, options).catch(() => undefined);
      return (
        path === '/static-data'
          ? { pagination: { pageSizes: [20, 50, 100], defaultPageSize: 20 } }
          : []
      ) as T;
    }
    return super.read<T>(path, query, options);
  }
  override async write<T>(
    method: CoreWriteMethod,
    path: string,
    body: unknown,
    options: CrmWriteOptions,
  ): Promise<CoreWriteResult<T>> {
    if (path.startsWith('/pipelines/')) {
      const response = await CrmHttpStub.prototype.write.call(this, method, path, body, options) as CoreWriteResult<T>;
      const error = this.writeErrorsByPath.get(path) ?? this.writeErrors.shift();
      if (error) throw error;
      const request = body as { limitPerStage?: number; cursor?: string; limit?: number };
      if (path.endsWith('/board')) return { ...response, data: structuredClone({
        ...this.boardResponse,
        stages: this.boardResponse.stages.map((lane) => ({ ...lane, items: request.limitPerStage === 0 ? [] : lane.items })),
      }) as T };
      if (path.endsWith('/cards')) return { ...response, data: {
        pipeline, selectedStageId: null, items: [structuredClone(this.row)], totalCount: 130,
        pageInfo: { limit: request.limit, hasMore: !request.cursor, nextCursor: request.cursor ? null : 'card-next' },
      } as T };
      const stageId = path.split('/')[4];
      const lane = this.boardResponse.stages.find((stage) => stage.stage.id === stageId)!;
      return { ...response, data: structuredClone({ ...lane, stageId, items: request.cursor ? [] : lane.items,
        pageInfo: { limit: 50, hasMore: false, nextCursor: null } }) as T };
    }
    if (path !== '/opportunities/search') return super.write<T>(method, path, body, options);
    const response = (await CrmHttpStub.prototype.write.call(
      this,
      method,
      path,
      body,
      options,
    )) as CoreWriteResult<T>;
    if (this.searchFailure) throw this.searchFailure;
    const { page, limit } = body as { page: number; limit: number };
    return {
      ...response,
      data: {
        items: [structuredClone(this.row)],
        total: 130,
        page,
        limit,
        totalPages: Math.ceil(130 / limit),
        hasNext: page * limit < 130,
        hasPrev: page > 1,
      } as T,
    };
  }
}

export function configureListTest(lang: string, theme: string, moves?: Pick<OpportunityMoves, 'move'>) {
  vi.useFakeTimers();
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
  const attrs = ['lang', 'dir', 'data-theme'].map((key) =>
    document.documentElement.getAttribute(key),
  );
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.dataset['theme'] = theme;
  localStorage.setItem('lang', lang);
  localStorage.removeItem('opportunities.view');
  localStorage.removeItem('opportunities.table.pageSize');
  localStorage.removeItem('opportunities.cards.pageSize');
  const transport = new OpportunityListTransport();
  const environment = recordTestProviders(transport);
  TestBed.configureTestingModule({
    providers: [
      ...environment.providers,
      ...(moves ? [{ provide: OpportunityMoves, useValue: moves }] : []),
      provideRouter([]),
      { provide: CoreHttp, useValue: environment.core },
      { provide: Notify, useValue: environment.notify },
      provideTransloco({
        config: {
          availableLangs: ['en', 'ar'],
          defaultLang: lang,
          reRenderOnLangChange: true,
          missingHandler: { logMissingKey: true },
        },
        loader: ListTranslations,
      }),
    ],
  });
  const service = TestBed.inject(TranslocoService);
  const aliases: Record<string, string> = {
    'record-list': 'recordList',
    'ui-query-builder': 'qb',
    'ui-pagination': 'pagination',
    'ui-query-value': 'qv',
    'record-page': 'recordPage',
    'ui-facet-search': 'facetSearch',
    'opportunity-modal': 'oppModal',
    'opportunity-form': 'oppForm',
    'opportunity-moves': 'oppMoves',
    'record-modal': 'recordModal',
    'record-fields': 'recordFields',
    'record-form': 'recordForm',
  };
  const translation: Translation = { ...listTranslations[lang] };
  for (const [path, value] of Object.entries(listTranslations)) {
    if (!path.endsWith('/' + lang)) continue;
    const scope = path.split('/')[0];
    translation[aliases[scope] ?? scope] = value;
  }
  service.setTranslation(translation, lang);
  const unbind = bindRecordTest(transport);
  return {
    transport,
    environment,
    dispose: async () => {
      TestBed.resetTestingModule();
      await vi.advanceTimersByTimeAsync(300);
      unbind();
      vi.useRealTimers();
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
      localStorage.removeItem('lang');
      localStorage.removeItem('opportunities.view');
      localStorage.removeItem('opportunities.table.pageSize');
      localStorage.removeItem('opportunities.cards.pageSize');
      ['lang', 'dir', 'data-theme'].forEach((key, index) =>
        attrs[index] === null
          ? document.documentElement.removeAttribute(key)
          : document.documentElement.setAttribute(key, attrs[index]!),
      );
    },
  };
}

export async function settleList(detect: () => void): Promise<void> {
  for (let index = 0; index < 12; index++) {
    detect();
    await vi.advanceTimersByTimeAsync(20);
  }
  detect();
}
