import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PhoneState } from '../../../core/phone/phone';
import { listCallLogs } from '../../../core/phone/phone.api';
import { CallLogLoader, CallLogRow } from '../../../shared/widgets/call-log/call-log.model';
import { PhoneHarness, PhoneSpecContext, phoneSpecContext, setUpPhoneTest } from '../testing/phone-testing';
import { CallHistory } from './call-history';

/*
 * The history modal's loader turns the table's query ({ types: [...] }) into the API query
 * (`type` = one comma list via toCallLogTypeParam). The fake API filters exactly like the server,
 * so the loader's result is compared with a direct call that uses the expected comma list.
 */

type Internals = Record<string, any>;

let h: PhoneHarness;
let ctx: PhoneSpecContext;
let phone: PhoneState;

beforeEach(async () => {
  vi.useFakeTimers();
  h = setUpPhoneTest();
  TestBed.configureTestingModule({ providers: h.providers });
  ctx = phoneSpecContext((ms) => vi.advanceTimersByTimeAsync(ms));
  phone = await ctx.start();
});

afterEach(() => {
  ctx.destroy();
  TestBed.resetTestingModule();
  h.restore();
  vi.useRealTimers();
});

function loader(): { load: CallLogLoader; c: Internals } {
  const fixture = ctx.mount(CallHistory);
  const c = fixture.componentInstance as unknown as Internals;
  return { load: c['loadCalls'] as CallLogLoader, c };
}

describe('CallHistory loader (call-history query building)', () => {
  it('sends several types as one comma-list `type` and returns only those types', async () => {
    const { load } = loader();
    const result = await load({ page: 1, limit: 100, types: ['IN_NOANS', 'IN_BUSY'] });
    const direct = await listCallLogs({ page: 1, limit: 100, type: 'IN_NOANS,IN_BUSY' });

    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data.every((row) => row.type === 'IN_NOANS' || row.type === 'IN_BUSY')).toBe(true);
    expect(result.data.map((row) => row.id)).toEqual(direct.data.map((row) => row.id));
    expect(result.meta.total).toBe(direct.meta.total);
    expect(new Set(result.data.map((row) => row.type))).toEqual(new Set(['IN_NOANS', 'IN_BUSY']));
  });

  it('a single type is sent alone', async () => {
    const { load } = loader();
    const result = await load({ page: 1, limit: 100, types: ['OUT_ANS'] });
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data.every((row) => row.type === 'OUT_ANS')).toBe(true);
  });

  it('no types or an empty list sends no `type` at all (every call comes back)', async () => {
    const { load } = loader();
    const all = await listCallLogs({ page: 1, limit: 100 });

    expect((await load({ page: 1, limit: 100 })).meta.total).toBe(all.meta.total);
    expect((await load({ page: 1, limit: 100, types: [] })).meta.total).toBe(all.meta.total);
  });

  it('passes page, limit, q, from and to through unchanged', async () => {
    const { load } = loader();
    const direct = await listCallLogs({ page: 2, limit: 3, q: '0100' });
    const result = await load({ page: 2, limit: 3, q: '0100' });

    expect(result.meta).toEqual(direct.meta);
    expect(result.data.map((row) => row.id)).toEqual(direct.data.map((row) => row.id));

    const future = await load({ page: 1, limit: 100, from: '2999-01-01' });
    expect(future.meta.total).toBe(0);
  });

  it('maps API rows to table rows (number, name, linked record)', async () => {
    const { load } = loader();
    const [api] = (await listCallLogs({ page: 1, limit: 1 })).data;
    const [row] = (await load({ page: 1, limit: 1 })).data;

    expect(row.id).toBe(api.id);
    expect(row.number).toBe(api.phoneNumber);
    expect(row.name).toBe(api.displayName ?? api.sourceLabel);
    expect(row.record === null).toBe(!(api.sourceType && api.sourceId));
  });

  it('call back closes the modal, switches to the phone tab and dials the row', async () => {
    const { c } = loader();
    (c as unknown as CallHistory).open();
    await ctx.flush();
    phone.setTab('calls');

    const row: CallLogRow = {
      id: 'r1',
      type: 'IN_NOANS',
      number: '+201005550142',
      name: null,
      startedAt: null,
      durationSeconds: null,
      ownerName: null,
      record: null,
      linkKind: null,
    };
    c['onCallBack'](row);
    await ctx.flush();

    expect(c['opened']()).toBe(false);
    expect(phone.tab()).toBe('phone');
    expect(phone.callState()).toBe('calling');
    expect(phone.focusedLeg()?.number).toBe('+201005550142');
  });
});
