import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { CrmModules } from './crm-modules';
import { CrmModule } from './crm-modules.model';

export function requireCrmModule(module: CrmModule): CanActivateFn {
  return async () => {
    const crmModules = inject(CrmModules);
    const router = inject(Router);
    await crmModules.ensureLoaded();
    return crmModules.isEnabled(module) ? true : router.createUrlTree(['/crm/off', module]);
  };
}

export function requireCrmModuleAnywhere(module: CrmModule): CanActivateFn {
  return async () => {
    const crmModules = inject(CrmModules);
    const router = inject(Router);
    await crmModules.ensureLoaded();
    const enabled = module === 'leads' ? crmModules.leadsAnywhere() : crmModules.opportunitiesAnywhere();
    return enabled ? true : router.createUrlTree(['/crm/off', module]);
  };
}
