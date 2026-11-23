import { fakeGetItemDetail } from '../../foundation/items/items.fake';
import { fakeGetTerm, fakeListTermOptions } from '../terms/terms.fake';
import { fakeListReasonCodes, TRADE_FAKE_DB } from '../trade-foundation.fake';
import { TradeHttpStub } from './trade-http-testing';

/** Explicit seed fixtures for legacy component/fake tests; never installed by production. */
export class TradeFoundationFixtures extends TradeHttpStub {
  override async read<T>(...args: Parameters<TradeHttpStub['read']>): Promise<T> {
    const [path, query, options] = args;
    const companyId = options?.scope?.companyId ?? 'c1';
    if (path === '/reason-codes') {
      const kind = query?.['kind'];
      const items = fakeListReasonCodes({ includeInactive: query?.['includeInactive'] === true }).items
        .filter((row) => kind === undefined || row.kind === kind);
      this.register('GET', path, { items });
    } else if (path === '/terms/options') {
      const type = query?.['documentType'];
      if (type === 'QUOTATION' || type === 'SALES_ORDER' || type === 'PURCHASE_ORDER' || type === 'PURCHASE_QUOTATION') {
        this.register('GET', path, await fakeListTermOptions(companyId, type));
      }
    } else if (path.startsWith('/terms/')) {
      this.register('GET', path, await fakeGetTerm(companyId, decodeURIComponent(path.slice('/terms/'.length))));
    } else if (path === '/items/reference-data') {
      this.register('GET', path, { owners: [], taxes: TRADE_FAKE_DB.taxes, companyCurrencyCode: 'EGP' });
    } else if (/^\/items\/[^/]+$/.test(path)) {
      this.register('GET', path, await fakeGetItemDetail(options?.scope ?? {}, decodeURIComponent(path.slice('/items/'.length))));
    }
    return super.read<T>(...args);
  }
}
