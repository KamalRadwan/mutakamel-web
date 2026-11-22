import { Routes } from '@angular/router';
import type { CanDeactivateFn } from '@angular/router';
import type { TradeDashboardPage } from './dashboard-page/dashboard-page';

const tradeDashboardCanDeactivate: CanDeactivateFn<TradeDashboardPage> = (component) => component.canDeactivate();

export const tradeDashboardRoutes: Routes = [
  {
    path: '',
    canDeactivate: [tradeDashboardCanDeactivate],
    loadComponent: () => import('./dashboard-page/dashboard-page').then((m) => m.TradeDashboardPage),
  },
];
