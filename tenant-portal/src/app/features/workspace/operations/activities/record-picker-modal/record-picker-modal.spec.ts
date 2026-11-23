import { TestBed } from '@angular/core/testing';
import { provideTransloco, TRANSLOCO_LOADER } from '@jsverse/transloco';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../../core/api/api-errors';
import { ActivitiesApi } from '../../../../../shared/widgets/activities/activities.api';
import { RecordPickerModal } from './record-picker-modal';

describe('RecordPickerModal', () => {
  const listActivityTargets = vi.fn();
  let picker: RecordPickerModal;
  beforeEach(() => {
    listActivityTargets.mockReset().mockResolvedValue([]);
    TestBed.configureTestingModule({ providers: [
      provideTransloco({ config: { availableLangs: ['en'], defaultLang: 'en', prodMode: true } }),
      { provide: TRANSLOCO_LOADER, useValue: { getTranslation: () => of({}) } },
      { provide: ActivitiesApi, useValue: { listActivityTargets } },
    ] });
    TestBed.overrideComponent(RecordPickerModal, { set: { template: '', imports: [] } });
    const fixture = TestBed.createComponent(RecordPickerModal);
    fixture.componentRef.setInput('availableApps', ['CORE']);
    picker = fixture.componentInstance;
    Object.defineProperty(picker, 'modal', { value: () => ({ open: vi.fn(), close: vi.fn() }) });
  });

  it('empty targets show no records found', async () => {
    await picker['loadTargets']();
    expect(picker['results']()).toEqual([]);
    expect(picker['loading']()).toBe(false);
    expect(picker['loadFailed']()).toBe(false);
    expect(listActivityTargets).toHaveBeenCalledWith({ targetApp: 'CORE', targetType: 'PARTY', search: undefined });
  });

  it('a 5xx shows inline retry', async () => {
    listActivityTargets.mockRejectedValueOnce(new ApiError(503, 'ACCESS_POLICY_UNAVAILABLE'));
    await picker['loadTargets']();
    expect(picker['loadFailed']()).toBe(true);
    picker['retryLoad']();
    await vi.waitFor(() => expect(picker['loadFailed']()).toBe(false));
    expect(listActivityTargets).toHaveBeenCalledTimes(2);
  });
});
