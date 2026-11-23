import { inject } from '@angular/core';
import { CurrentUser } from '../../../../core/auth/current-user';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { getCrmSettings } from '../general/general.api';
import { tenantWide } from './settings-access';

/** Call in an injection context, before awaiting; null means no suffix and UTC bounds. */
export async function settingsTimeZone(): Promise<string | null> {
  const me = inject(TenantScopeState).me();
  // WG-7 adds workspace to /me. Until then CurrentUser may contain only a fake zone.
  if (me && 'workspace' in me) {
    const zone = inject(CurrentUser).user().timeZone;
    if (zone) return zone;
  }
  if (!tenantWide('crm.settings.read')) return null;
  return (await getCrmSettings()).analyticsTimeZone;
}
