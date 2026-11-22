import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { listModules } from '../../features/workspace/home/modules.api';

// App subscription check from the same fake source the home page uses.
// TODO(Phase 5): replace with the core entitlement API.
export function requireApp(appId: string): CanActivateFn {
  return async () => {
    const router = inject(Router);
    try {
      const modules = await listModules();
      const subscribed = modules.some((item) => item.id === appId && item.group === 'subscribed');
      return subscribed ? true : router.createUrlTree(['/workspace']);
    } catch {
      return router.createUrlTree(['/workspace']);
    }
  };
}
