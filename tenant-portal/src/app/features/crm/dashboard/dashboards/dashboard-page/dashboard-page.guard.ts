import type { CanDeactivateFn } from '@angular/router';
import type { DashboardPage } from './dashboard-page';

export const dashboardPageCanDeactivate: CanDeactivateFn<DashboardPage> = (component) => {
  return component.canDeactivate();
};
