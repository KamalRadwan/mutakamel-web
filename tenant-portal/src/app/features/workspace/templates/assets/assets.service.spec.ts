import { describe, expect, it } from 'vitest';
import { ASSET_ACCEPT, prepareAssetFile } from './assets.service';

describe('assets service', () => {
  it('rewraps the file with the declared type', async () => {
    const original = new File(['jpeg bytes'], 'photo.jpg');
    const prepared = prepareAssetFile(original);
    expect(prepared).not.toBe(original);
    expect(prepared.type).toBe('image/jpeg');
    expect(await prepared.text()).toBe(await original.text());
  });
  it('refuses types outside PNG and JPEG', () => {
    for (const [name, type] of [['image.gif', 'image/gif'], ['image.webp', 'image/webp'], ['image.jpg', 'image/gif']]) {
      expect(() => prepareAssetFile(new File(['x'], name, { type }))).toThrow('ASSET_FILE_TYPE_INVALID');
    }
    expect(ASSET_ACCEPT).toBe('image/png,image/jpeg,.png,.jpg,.jpeg');
  });
  it('normalizes the file name to NFC', () => {
    const name = '\u0627\u0654\u0635\u0644.png';
    expect(prepareAssetFile(new File(['png'], name)).name).toBe(name.normalize('NFC'));
    expect(prepareAssetFile(new File(['png'], '  photo.png  ')).name).toBe('photo.png');
  });
});
