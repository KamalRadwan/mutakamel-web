import { fakeGetDirectorySettings, fakeUpdateDirectorySettings } from './directory-settings.fake';
import { DirectorySettings, DirectorySettingsPatch } from './directory-settings.model';

export * from './directory-settings.model';

/** GET /api/tenant/core/v1/directory/settings (permission: directory.settings.manage, tenant-wide) */
export function getDirectorySettings(): Promise<DirectorySettings> {
  return fakeGetDirectorySettings();
}

/** PATCH /api/tenant/core/v1/directory/settings (permission: directory.settings.manage, tenant-wide; no idempotency key; no concurrency token) */
export function updateDirectorySettings(patch: Partial<DirectorySettingsPatch>): Promise<DirectorySettings> {
  return fakeUpdateDirectorySettings(patch);
}
