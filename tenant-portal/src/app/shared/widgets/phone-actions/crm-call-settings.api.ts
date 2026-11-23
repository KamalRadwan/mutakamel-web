import { inject } from '@angular/core';
import { CrmModules } from '../../../features/crm/shared/crm-modules/crm-modules';
import type { CrmModulesState } from '../../../features/crm/shared/crm-modules/crm-modules.model';
import { runInCrm } from '../../../features/crm/shared/crm-runtime';

// Keep the existing helper exports compatible; they no longer supply the live flag.
let fakeClickToCallEnabled = true;

export function getFakeClickToCallEnabled(): boolean {
  return fakeClickToCallEnabled;
}

export function setFakeClickToCallEnabled(enabled: boolean): void {
  fakeClickToCallEnabled = enabled;
}

// Reuse GET /api/tenant/crm/v1/settings/modules; no settings permission is needed.
export async function getCrmClickToCallSetting(): Promise<{ clickToCallEnabled: boolean }> {
  const modules = runInCrm(() => inject(CrmModules));
  await modules.ensureLoaded();
  // Older images and the current shared model can omit the additive calls field.
  const state: (CrmModulesState & { calls?: { clickToCallEnabled?: boolean } }) | null = modules.state();
  return { clickToCallEnabled: state?.calls?.clickToCallEnabled ?? true };
}
