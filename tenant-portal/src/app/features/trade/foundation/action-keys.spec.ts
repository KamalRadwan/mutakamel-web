import { actionKey } from './action-keys';

describe('actionKey', () => {
  it('reuses the key when the same request is retried and makes a new one after success', () => {
    const first = actionKey('status', 'item-01', 3, 'ACTIVE');
    expect(actionKey('status', 'item-01', 3, 'ACTIVE').key).toBe(first.key);
    first.done();
    expect(actionKey('status', 'item-01', 3, 'ACTIVE').key).not.toBe(first.key);
  });

  it('gives another request (new version or body) its own key', () => {
    const a = actionKey('status', 'item-02', 3, 'ACTIVE');
    expect(actionKey('status', 'item-02', 4, 'ACTIVE').key).not.toBe(a.key);
    expect(actionKey('status', 'item-02', 3, 'INACTIVE').key).not.toBe(a.key);
  });
});
