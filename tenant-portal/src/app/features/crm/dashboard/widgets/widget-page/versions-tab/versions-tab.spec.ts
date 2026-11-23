import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setupWidgetTest, widgetDetail } from '../../builder/builder-test-support';
import { OrgApi } from '../../../../../../shared/widgets/dashboard/org.api';
import { VersionsTab } from './versions-tab';
import { ApiError } from '../../../../../../core/api/api-errors';

describe('widget version branch enrichment', () => {
  let env: ReturnType<typeof setupWidgetTest>;
  afterEach(() => env.restore());

  it('reads branches from the live organization directory', async () => {
    env = setupWidgetTest(); env.initialize();
    const read = vi.spyOn(TestBed.inject(OrgApi), 'listGrantedBranches').mockResolvedValue([
      { id: 'real-branch', companyId: 'company', name: { en: 'Live branch', ar: 'الفرع الفعلي' } },
    ]);
    vi.spyOn(env.stub, 'read').mockResolvedValue({ widgetId: widgetDetail().id, widgetRevision: 7,
      activeVersionNumber: null, items: [], nextBeforeVersion: null });
    const fixture = env.create(VersionsTab);
    fixture.componentRef.setInput('widget', widgetDetail());
    fixture.detectChanges(); await fixture.whenStable();
    expect(read).toHaveBeenCalledTimes(1);
    expect(env.notify.error).not.toHaveBeenCalled();
  });

  it('keeps version loading available when optional branch-name enrichment is denied', async () => {
    env = setupWidgetTest(); env.initialize();
    vi.spyOn(TestBed.inject(OrgApi), 'listGrantedBranches').mockRejectedValue(new ApiError(403, 'PERMISSION_DENIED'));
    const versions = vi.spyOn(env.stub, 'read').mockResolvedValue({ widgetId: widgetDetail().id, widgetRevision: 7,
      activeVersionNumber: null, items: [], nextBeforeVersion: null });
    const fixture = env.create(VersionsTab);
    fixture.componentRef.setInput('widget', widgetDetail());
    fixture.detectChanges(); await fixture.whenStable();
    expect(versions).toHaveBeenCalledWith(`/widgets/${widgetDetail().id}/versions`, expect.any(Object));
    expect(env.notify.error).not.toHaveBeenCalled();
  });
});
