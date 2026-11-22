import { Component, Injectable, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TranslocoLoader, type Translation, provideTransloco } from '@jsverse/transloco';
import { map, timer } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import enGlobal from '../../../../../../../public/i18n/en.json';
import enSettings from '../../../../../../../public/i18n/settings/en.json';
import enItemForm from '../../../../../../../public/i18n/trade-item-form/en.json';
import enItems from '../../../../../../../public/i18n/trade-items/en.json';
import enShared from '../../../../../../../public/i18n/trade-shared/en.json';
import { Notify } from '../../../../../core/notify/notify';
import { UnsavedDialog, type UnsavedChoice } from '../../../../../shared/ui/unsaved-dialog/unsaved-dialog';
import type { ActionItem, ActionSelection } from '../../../../../shared/ui/actions-menu/actions-menu';
import type { ReasonPickerValue } from '../../../shared/pickers/reason-picker/reason-picker';
import { ApiError } from '../../../shared/trade-api';
import { TRADE_FAKE_DB } from '../../../shared/trade-foundation.fake';
import type { FakeItem, ItemDetail, ItemStatus } from '../../../shared/trade-foundation.model';
import { actionKey, fileSignature } from '../../action-keys';
import type { DraftErrors, ItemDraft } from '../item-form/item-draft';
import { fakeCreateItem, fakeDeleteItemImage, fakeMoveItemStatus, fakePutItemImage } from '../items.fake';
import { ItemPage } from './item-page';

/** Real translation files, served asynchronously like the HTTP loader (a sync loader triggers NG0600). */
const FILES: Record<string, Translation> = {
  en: enGlobal,
  'settings/en': enSettings,
  'trade-item-form/en': enItemForm,
  'trade-items/en': enItems,
  'trade-shared/en': enShared,
};

@Injectable()
class AsyncFileLoader implements TranslocoLoader {
  getTranslation(path: string) {
    return timer(0).pipe(map(() => FILES[path] ?? {}));
  }
}

@Component({ template: '' })
class ListStub {}

/** The protected surface the template drives, as the spec calls it. */
interface ItemPageView {
  loading(): boolean;
  notFound(): boolean;
  loadFailed(): boolean;
  detail(): ItemDetail | null;
  itemVersion(): number;
  itemDraft(): ItemDraft;
  itemServerErrors(): DraftErrors;
  itemDirty(): boolean;
  updatingStatus(): boolean;
  uploadingImage(): boolean;
  discontinueOpen(): boolean;
  actionItems(): ActionItem[];
  discontinueReason: WritableSignal<ReasonPickerValue>;
  onItemDraftChange(next: ItemDraft): void;
  save(): Promise<boolean>;
  onStatusChange(target: ItemStatus): Promise<void>;
  onActionSelected(selection: ActionSelection): void;
  confirmDiscontinue(): void;
  cancelDiscontinue(): void;
  onImagePicked(file: File): Promise<void>;
  onImageRemove(): Promise<void>;
  retryLoad(): void;
}

type DialogHandle = { close(choice: UnsavedChoice): void };

const dialogProto = HTMLDialogElement.prototype as unknown as Record<string, unknown>;
const originalDialog = { showModal: dialogProto['showModal'], close: dialogProto['close'] };

let notify: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>; warning: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn> };
let harness: RouterTestingHarness;
let codeSeq = 0;

/** Run a fake call to completion under fake timers. */
async function run<T>(promise: Promise<T>): Promise<T> {
  const settled = promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  await vi.advanceTimersByTimeAsync(400);
  const result = await settled;
  if (!result.ok) throw result.error;
  return result.value;
}

async function failure(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await run(promise);
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    return error as ApiError;
  }
  throw new Error('expected a failure');
}

async function tick(ms = 1000): Promise<void> {
  harness.detectChanges();
  await vi.advanceTimersByTimeAsync(ms);
  harness.detectChanges();
  await vi.advanceTimersByTimeAsync(0);
  harness.detectChanges();
}

/** A fresh DRAFT product owned by this spec, so tests never share an item. */
async function freshItem(): Promise<FakeItem> {
  codeSeq += 1;
  const saved = await run(
    fakeCreateItem(
      {
        canonicalCode: `SPEC-IP-${codeSeq}`,
        itemKind: 'PRODUCT',
        localizedNames: { en: `Spec item ${codeSeq}`, ar: `صنف ${codeSeq}` },
        baseUomId: TRADE_FAKE_DB.uoms.find((uom) => uom.status === 'ACTIVE')!.id,
      },
      uuidV7(),
    ),
  );
  return TRADE_FAKE_DB.items.find((item) => item.id === saved.id)!;
}

function uuidV7(): string {
  // Same shape the fake checks: version nibble 7, variant 8..b.
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-7${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

async function openPage(id: string): Promise<ItemPageView> {
  const page = await harness.navigateByUrl(`/trade/foundation/items/${id}`, ItemPage);
  await tick();
  return page as unknown as ItemPageView;
}

function dialogs(): { unsaved: DialogHandle; conflict: DialogHandle; conflictEl: HTMLDialogElement } {
  const found = harness.fixture.debugElement.queryAll(By.directive(UnsavedDialog));
  expect(found.length).toBe(2);
  return {
    unsaved: found[0].componentInstance as DialogHandle,
    conflict: found[1].componentInstance as DialogHandle,
    conflictEl: (found[1].nativeElement as HTMLElement).querySelector('dialog')!,
  };
}

const png = (name = 'photo.png', bytes = 64) => new File([new Uint8Array(bytes)], name, { type: 'image/png', lastModified: 1 });

/** Somebody else saves the item meanwhile: the page's If-Match is now stale. */
function bumpElsewhere(item: FakeItem): void {
  item.version += 1;
}

beforeEach(async () => {
  vi.useFakeTimers();
  localStorage.clear();
  sessionStorage.clear();
  document.documentElement.lang = 'en';
  dialogProto['showModal'] = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  dialogProto['close'] = function (this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    // Browsers fire "close" as a later task, after the code that called close() has finished.
    setTimeout(() => this.dispatchEvent(new Event('close')), 0);
  };
  notify = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'trade/foundation/items', component: ListStub },
        { path: 'trade/foundation/items/:id', component: ItemPage },
      ]),
      provideTransloco({
        config: { availableLangs: ['ar', 'en'], defaultLang: 'en', reRenderOnLangChange: true },
        loader: AsyncFileLoader,
      }),
      { provide: Notify, useValue: notify },
    ],
  });
  harness = await RouterTestingHarness.create();
});

afterEach(() => {
  harness.fixture.destroy();
  vi.useRealTimers();
  dialogProto['showModal'] = originalDialog.showModal;
  dialogProto['close'] = originalDialog.close;
});

describe('ItemPage load', () => {
  it('loads the item into the form with its version and the status actions it allows', async () => {
    const item = await freshItem();
    const page = await openPage(item.id);

    expect(page.loading()).toBe(false);
    expect(page.notFound()).toBe(false);
    expect(page.loadFailed()).toBe(false);
    expect(page.detail()?.id).toBe(item.id);
    expect(page.itemVersion()).toBe(item.version);
    expect(page.itemDraft().canonicalCode).toBe(item.canonicalCode);
    expect(page.itemDraft().nameEn).toBe(item.localizedNames['en']);
    expect(page.itemDirty()).toBe(false);
    // DRAFT may go to ACTIVE or DISCONTINUED, never INACTIVE.
    expect(page.actionItems().map((a) => a.id)).toEqual(['activate', 'copyCode', 'discontinue']);
    expect(page.actionItems().find((a) => a.id === 'activate')?.title).toBe(enItems.actions.activate);
  });

  it('shows not found on a 404 and loads again on retry once the item exists', async () => {
    const item = await freshItem();
    item.deletedAt = '2026-11-01T00:00:00.000Z';
    const page = await openPage(item.id);

    expect(page.notFound()).toBe(true);
    expect(page.loading()).toBe(false);
    expect(page.detail()).toBeNull();

    item.deletedAt = null;
    page.retryLoad();
    await tick();
    expect(page.notFound()).toBe(false);
    expect(page.detail()?.id).toBe(item.id);
  });

  it('shows not found for an id the backend never had', async () => {
    const page = await openPage('item-does-not-exist');
    expect(page.notFound()).toBe(true);
    expect(page.loadFailed()).toBe(false);
  });
});

describe('ItemPage edit', () => {
  it('saves a changed name with the loaded version, then reloads the saved item', async () => {
    const item = await freshItem();
    const page = await openPage(item.id);
    const before = item.version;

    page.onItemDraftChange({ ...page.itemDraft(), nameEn: 'Renamed item' });
    expect(page.itemDirty()).toBe(true);

    const saved = page.save();
    await tick();
    expect(await saved).toBe(true);

    expect(item.localizedNames['en']).toBe('Renamed item');
    expect(item.version).toBe(before + 1);
    expect(page.itemVersion()).toBe(item.version);
    expect(page.itemDirty()).toBe(false);
    expect(notify.success).toHaveBeenCalledWith(enItemForm.toast.saved);
  });

  it('does not call the backend when nothing changed', async () => {
    const item = await freshItem();
    const page = await openPage(item.id);
    const before = item.version;

    const saved = page.save();
    await tick();
    expect(await saved).toBe(true);
    expect(item.version).toBe(before);
    expect(notify.success).not.toHaveBeenCalled();
  });

  it('409 conflict, keep mine: reloads, rebases the change and saves it on the new version', async () => {
    const item = await freshItem();
    const page = await openPage(item.id);
    page.onItemDraftChange({ ...page.itemDraft(), nameEn: 'Mine' });
    bumpElsewhere(item);

    const saved = page.save();
    await tick();
    const { conflict, conflictEl } = dialogs();
    expect(conflictEl.hasAttribute('open')).toBe(true);

    conflict.close('discard');
    await tick();
    await tick();
    expect(await saved).toBe(true);
    expect(item.localizedNames['en']).toBe('Mine');
    expect(page.itemVersion()).toBe(item.version);
    expect(page.itemDirty()).toBe(false);
  });

  it('409 conflict, reload: takes the server copy and drops the change', async () => {
    const item = await freshItem();
    const page = await openPage(item.id);
    const serverName = item.localizedNames['en'];
    page.onItemDraftChange({ ...page.itemDraft(), nameEn: 'Mine' });
    bumpElsewhere(item);

    const saved = page.save();
    await tick();
    dialogs().conflict.close('save');
    await tick();
    expect(await saved).toBe(false);
    expect(item.localizedNames['en']).toBe(serverName);
    expect(page.itemDraft().nameEn).toBe(serverName);
    expect(page.itemVersion()).toBe(item.version);
    expect(page.itemDirty()).toBe(false);
  });

  it('409 conflict, cancel: keeps the draft and sends nothing more', async () => {
    const item = await freshItem();
    const page = await openPage(item.id);
    page.onItemDraftChange({ ...page.itemDraft(), nameEn: 'Mine' });
    bumpElsewhere(item);
    const staleVersion = page.itemVersion();

    const saved = page.save();
    await tick();
    dialogs().conflict.close('cancel');
    await tick();
    expect(await saved).toBe(false);
    expect(page.itemDraft().nameEn).toBe('Mine');
    expect(page.itemVersion()).toBe(staleVersion);
    expect(item.localizedNames['en']).not.toBe('Mine');
  });
});

describe('ItemPage status moves', () => {
  it('activates with the action key for (status, id, version, target): replayable, then released', async () => {
    const item = await freshItem();
    const page = await openPage(item.id);
    const version = page.itemVersion();
    const pending = actionKey('status', item.id, version, 'ACTIVE', undefined);

    page.onActionSelected({ id: 'activate' });
    await tick();

    expect(item.status).toBe('ACTIVE');
    expect(page.itemDraft().status).toBe('ACTIVE');
    expect(page.detail()?.status).toBe('ACTIVE');
    expect(page.itemVersion()).toBe(item.version);
    expect(page.updatingStatus()).toBe(false);
    expect(notify.success).toHaveBeenCalledWith(enItemForm.toast.statusChanged);

    // The backend saw exactly this key: the same request under it replays, though the version moved on.
    const replay = await run(fakeMoveItemStatus(item.id, version, 'ACTIVE', pending.key));
    expect(replay.version).toBe(item.version);
    // done() ran: the next action on the same signature gets a new key.
    expect(actionKey('status', item.id, version, 'ACTIVE', undefined).key).not.toBe(pending.key);
  });

  it('a retry after a failure reuses the same key; the successful retry is the one recorded', async () => {
    const item = await freshItem();
    const page = await openPage(item.id);
    const version = page.itemVersion();

    item.deletedAt = '2026-11-01T00:00:00.000Z';
    const first = page.onStatusChange('ACTIVE');
    await tick();
    await first;
    expect(notify.error).toHaveBeenCalledWith(enShared.errors.TRADE_CATALOG_ITEM_NOT_FOUND);
    expect(item.status).toBe('DRAFT');
    const kept = actionKey('status', item.id, version, 'ACTIVE', undefined).key;

    item.deletedAt = null;
    const retry = page.onStatusChange('ACTIVE');
    await tick();
    await retry;
    expect(item.status).toBe('ACTIVE');
    const replay = await run(fakeMoveItemStatus(item.id, version, 'ACTIVE', kept));
    expect(replay.status).toBe('ACTIVE');
    // Another body under the same key is a mismatch, which proves the key was spent on this move.
    expect((await failure(fakeMoveItemStatus(item.id, version, 'INACTIVE', kept))).code).toBe('TRADE.IDEMPOTENCY.MISMATCH');
  });

  it('gives a different move its own key', async () => {
    const item = await freshItem();
    const page = await openPage(item.id);
    const v1 = page.itemVersion();
    const first = actionKey('status', item.id, v1, 'ACTIVE', undefined);

    const activate = page.onStatusChange('ACTIVE');
    await tick();
    await activate;
    const v2 = page.itemVersion();
    const second = actionKey('status', item.id, v2, 'INACTIVE', undefined);
    const deactivate = page.onStatusChange('INACTIVE');
    await tick();
    await deactivate;

    expect(item.status).toBe('INACTIVE');
    expect(second.key).not.toBe(first.key);
    expect((await run(fakeMoveItemStatus(item.id, v2, 'INACTIVE', second.key))).status).toBe('INACTIVE');
  });

  it('ignores a move the current status does not allow', async () => {
    const item = await freshItem();
    const page = await openPage(item.id);
    const before = item.version;

    await page.onStatusChange('INACTIVE');
    await tick();
    expect(item.status).toBe('DRAFT');
    expect(item.version).toBe(before);
    expect(notify.success).not.toHaveBeenCalled();
    expect(notify.error).not.toHaveBeenCalled();
  });

  it('discontinue asks for a reason; cancel sends nothing', async () => {
    const item = await freshItem();
    const page = await openPage(item.id);

    const move = page.onStatusChange('DISCONTINUED');
    await tick();
    expect(page.discontinueOpen()).toBe(true);
    page.cancelDiscontinue();
    await tick();
    await move;
    expect(item.status).toBe('DRAFT');
    expect(page.discontinueOpen()).toBe(false);
  });

  it('discontinue with a reason sends it, under a key whose signature includes the reason', async () => {
    const item = await freshItem();
    const page = await openPage(item.id);
    const version = page.itemVersion();
    const reasonCodeId = 'rsn-item_discontinue-end_of_life';
    const pending = actionKey('status', item.id, version, 'DISCONTINUED', { reasonCodeId });

    const move = page.onStatusChange('DISCONTINUED');
    await tick();
    page.discontinueReason.set({ reasonCodeId, note: '' });
    await tick();
    page.confirmDiscontinue();
    await tick();
    await move;

    expect(item.status).toBe('DISCONTINUED');
    expect(page.actionItems().map((a) => a.id)).toEqual(['copyCode']);
    const replay = await run(fakeMoveItemStatus(item.id, version, 'DISCONTINUED', pending.key, { reasonCodeId }));
    expect(replay.status).toBe('DISCONTINUED');
  });

  it('409 conflict, keep mine: re-reads the item and moves it on the fresh version with a new key', async () => {
    const item = await freshItem();
    const page = await openPage(item.id);
    const stale = page.itemVersion();
    bumpElsewhere(item);

    const move = page.onStatusChange('ACTIVE');
    await tick();
    const { conflict, conflictEl } = dialogs();
    expect(conflictEl.hasAttribute('open')).toBe(true);
    expect(item.status).toBe('DRAFT');

    const fresh = item.version;
    const retryKey = actionKey('status', item.id, fresh, 'ACTIVE', undefined);
    conflict.close('discard');
    await tick();
    await tick();
    await move;

    expect(item.status).toBe('ACTIVE');
    expect(page.itemVersion()).toBe(item.version);
    expect(page.itemDraft().status).toBe('ACTIVE');
    expect(retryKey.key).not.toBe(actionKey('status', item.id, stale, 'ACTIVE', undefined).key);
    expect((await run(fakeMoveItemStatus(item.id, fresh, 'ACTIVE', retryKey.key))).status).toBe('ACTIVE');
  });

  it('409 conflict, reload: reloads the item and does not move it', async () => {
    const item = await freshItem();
    const page = await openPage(item.id);
    bumpElsewhere(item);

    const move = page.onStatusChange('ACTIVE');
    await tick();
    dialogs().conflict.close('save');
    await tick();
    await tick();
    await move;

    expect(item.status).toBe('DRAFT');
    expect(page.itemVersion()).toBe(item.version);
    expect(page.updatingStatus()).toBe(false);
  });

  it('409 conflict, cancel: leaves the page as it was', async () => {
    const item = await freshItem();
    const page = await openPage(item.id);
    const stale = page.itemVersion();
    bumpElsewhere(item);

    const move = page.onStatusChange('ACTIVE');
    await tick();
    dialogs().conflict.close('cancel');
    await tick();
    await move;

    expect(item.status).toBe('DRAFT');
    expect(page.itemVersion()).toBe(stale);
    expect(page.updatingStatus()).toBe(false);
  });
});

describe('ItemPage image', () => {
  it('uploads with the action key for (image, id, version, file) and stores the receipt', async () => {
    const item = await freshItem();
    const page = await openPage(item.id);
    const version = page.itemVersion();
    const file = png();
    const pending = actionKey('image', item.id, version, fileSignature(file));

    const upload = page.onImagePicked(file);
    await tick();
    await upload;

    expect(item.image).not.toBeNull();
    expect(page.detail()?.image?.id).toBe(item.image!.id);
    expect(page.detail()?.currentImageId).toBe(item.image!.id);
    expect(page.itemVersion()).toBe(item.version);
    expect(page.uploadingImage()).toBe(false);
    expect(notify.success).toHaveBeenCalledWith(enItemForm.toast.imageSaved);
    const replay = await run(fakePutItemImage(item.id, version, file, pending.key));
    expect(replay.image.id).toBe(item.image!.id);
  });

  it('415 for a type the backend refuses: field error and toast, nothing stored', async () => {
    const item = await freshItem();
    const page = await openPage(item.id);
    const before = item.version;

    const upload = page.onImagePicked(new File([new Uint8Array(8)], 'anim.gif', { type: 'image/gif' }));
    await tick();
    await upload;

    expect(item.image).toBeNull();
    expect(item.version).toBe(before);
    expect(page.itemServerErrors()['image']).toEqual({ key: 'tradeShared.errors.TRADE_CATALOG_ITEM_IMAGE_INVALID' });
    expect(notify.error).toHaveBeenCalledWith(enShared.errors.TRADE_CATALOG_ITEM_IMAGE_INVALID);
    expect(page.uploadingImage()).toBe(false);
  });

  it('413 for a file over 10 MB: field error and toast', async () => {
    const item = await freshItem();
    const page = await openPage(item.id);

    const upload = page.onImagePicked(png('huge.png', 10_485_761));
    await tick();
    await upload;

    expect(item.image).toBeNull();
    expect(page.itemServerErrors()['image']).toEqual({ key: 'tradeShared.errors.TRADE_CATALOG_ITEM_IMAGE_TOO_LARGE' });
    expect(notify.error).toHaveBeenCalledWith(enShared.errors.TRADE_CATALOG_ITEM_IMAGE_TOO_LARGE);
  });

  it('a retried upload of the same file reuses the key', async () => {
    const item = await freshItem();
    const page = await openPage(item.id);
    const version = page.itemVersion();
    const file = png();

    item.deletedAt = '2026-11-01T00:00:00.000Z';
    const first = page.onImagePicked(file);
    await tick();
    await first;
    expect(notify.error).toHaveBeenCalledWith(enShared.errors.TRADE_CATALOG_ITEM_NOT_FOUND);
    const kept = actionKey('image', item.id, version, fileSignature(file)).key;

    item.deletedAt = null;
    const second = page.onImagePicked(file);
    await tick();
    await second;
    expect(item.image).not.toBeNull();
    expect((await run(fakePutItemImage(item.id, version, file, kept))).image.id).toBe(item.image!.id);
  });

  it('upload 409 conflict, keep mine: retries on the fresh version', async () => {
    const item = await freshItem();
    const page = await openPage(item.id);
    bumpElsewhere(item);

    const upload = page.onImagePicked(png());
    await tick();
    dialogs().conflict.close('discard');
    await tick();
    await tick();
    await upload;

    expect(item.image).not.toBeNull();
    expect(page.detail()?.image?.id).toBe(item.image!.id);
    expect(page.itemVersion()).toBe(item.version);
  });

  it('upload 409 conflict, reload: reloads without uploading', async () => {
    const item = await freshItem();
    const page = await openPage(item.id);
    bumpElsewhere(item);

    const upload = page.onImagePicked(png());
    await tick();
    dialogs().conflict.close('save');
    await tick();
    await upload;

    expect(item.image).toBeNull();
    expect(page.itemVersion()).toBe(item.version);
    expect(page.uploadingImage()).toBe(false);
  });

  it('removes the image with the action key for (image-remove, id, version)', async () => {
    const item = await freshItem();
    const page = await openPage(item.id);
    const upload = page.onImagePicked(png());
    await tick();
    await upload;
    const version = page.itemVersion();
    const pending = actionKey('image-remove', item.id, version);

    const remove = page.onImageRemove();
    await tick();
    await remove;

    expect(item.image).toBeNull();
    expect(page.detail()?.image).toBeNull();
    expect(page.detail()?.currentImageId).toBeNull();
    expect(page.itemVersion()).toBe(item.version);
    expect(notify.success).toHaveBeenCalledWith(enItemForm.toast.imageRemoved);
    const replay = await run(fakeDeleteItemImage(item.id, version, pending.key));
    expect(replay.removed).toBe(true);
  });

  it('remove error: toast only, the image stays', async () => {
    const item = await freshItem();
    const page = await openPage(item.id);
    const upload = page.onImagePicked(png());
    await tick();
    await upload;
    const imageId = item.image!.id;

    item.deletedAt = '2026-11-01T00:00:00.000Z';
    const remove = page.onImageRemove();
    await tick();
    await remove;
    item.deletedAt = null;

    expect(notify.error).toHaveBeenCalledWith(enShared.errors.TRADE_CATALOG_ITEM_NOT_FOUND);
    expect(page.detail()?.image?.id).toBe(imageId);
    expect(page.uploadingImage()).toBe(false);
  });

  it('remove 409 conflict, keep mine: removes on the fresh version', async () => {
    const item = await freshItem();
    const page = await openPage(item.id);
    const upload = page.onImagePicked(png());
    await tick();
    await upload;
    bumpElsewhere(item);

    const remove = page.onImageRemove();
    await tick();
    dialogs().conflict.close('discard');
    await tick();
    await tick();
    await remove;

    expect(item.image).toBeNull();
    expect(page.detail()?.image).toBeNull();
    expect(page.itemVersion()).toBe(item.version);
  });
});

