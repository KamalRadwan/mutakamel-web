import { describe, expect, it } from 'vitest';
import { SettingsMutationKeys } from './settings-mutation-keys';

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('SettingsMutationKeys', () => {
  it('reuses the key while the operation retries the same request', () => {
    const keys = new SettingsMutationKeys();
    const first = keys.for('update:r1', { version: 3, patch: { isActive: false } });
    expect(first).toMatch(UUID_V7);
    expect(keys.for('update:r1', { version: 3, patch: { isActive: false } })).toBe(first);
  });

  it('starts a new key when the body or the version changes', () => {
    const keys = new SettingsMutationKeys();
    const first = keys.for('update:r1', { version: 3, patch: { isActive: false } });
    const changedBody = keys.for('update:r1', { version: 3, patch: { isActive: true } });
    expect(changedBody).not.toBe(first);
    const changedVersion = keys.for('update:r1', { version: 4, patch: { isActive: true } });
    expect(changedVersion).not.toBe(changedBody);
  });

  it('keeps operations apart and starts over after clear or clearAll', () => {
    const keys = new SettingsMutationKeys();
    const update = keys.for('update:r1', { version: 1 });
    const remove = keys.for('delete:r1', { version: 1 });
    expect(remove).not.toBe(update);

    keys.clear('update:r1');
    expect(keys.for('delete:r1', { version: 1 })).toBe(remove);
    expect(keys.for('update:r1', { version: 1 })).not.toBe(update);

    keys.clearAll();
    expect(keys.for('delete:r1', { version: 1 })).not.toBe(remove);
  });
});
