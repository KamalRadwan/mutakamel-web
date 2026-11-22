import { beforeEach, describe, expect, it } from 'vitest';
import { listCurrencies } from '../../features/workspace/settings/currencies/currencies.api';
import { resetCurrenciesFake } from '../../features/workspace/settings/currencies/currencies.fake';
import { listActiveCoreCurrencies, listActiveCoreCurrencyCodes } from './core-currencies';

describe('shared Core currencies lookup', () => {
  beforeEach(() => resetCurrenciesFake());

  it('reads every Core page and keeps active currencies only, ordered by code', async () => {
    const page = await listCurrencies({ limit: 100, sortBy: 'code', sortDir: 'ASC' });
    const expected = page.data.filter((currency) => currency.status === 'ACTIVE');
    const active = await listActiveCoreCurrencies();
    expect(active).toEqual(expected);
    expect(active.every((currency) => currency.status === 'ACTIVE')).toBe(true);
    expect(await listActiveCoreCurrencyCodes()).toEqual(expected.map((currency) => currency.code));
  });
});
