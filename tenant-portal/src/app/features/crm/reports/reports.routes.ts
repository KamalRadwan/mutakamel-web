import { Routes } from '@angular/router';

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
    loadComponent: () => import('./schedules/schedules-page/schedules-page').then((m) => m.SchedulesPage),
  },
  {
    path: 'exports',
    loadComponent: () => import('./exports/exports-page/exports-page').then((m) => m.ExportsPage),
  },
];
