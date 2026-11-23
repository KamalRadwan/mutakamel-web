import { inject } from '@angular/core';
import { RedirectCommand, Router, type CanActivateFn, type Routes } from '@angular/router';
import { can } from '../../../shared/widgets/dashboard/analytics-permissions';

function requireAnalyticsKey(key: string): CanActivateFn {
  return () => can(key) || new RedirectCommand(inject(Router).parseUrl('/forbidden'), { skipLocationChange: true });
}

export const reportsRoutes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'catalogue' },
  {
    path: 'catalogue',
    loadComponent: () => import('./catalogue/catalogue-page/catalogue-page').then((m) => m.CataloguePage),
  },
  { path: 'catalogue/:key', pathMatch: 'full', redirectTo: 'catalogue/:key/overview' },
  {
    path: 'catalogue/:key/:tab',
    loadComponent: () => import('./report/report-page/report-page').then((m) => m.ReportPage),
  },
  {
    path: 'schedules',
    canActivate: [requireAnalyticsKey('crm.subscriptions.manage')],
    loadComponent: () => import('./schedules/schedules-page/schedules-page').then((m) => m.SchedulesPage),
  },
  {
    path: 'exports',
    canActivate: [requireAnalyticsKey('crm.exports.create')],
    loadComponent: () => import('./exports/exports-page/exports-page').then((m) => m.ExportsPage),
  },
];
