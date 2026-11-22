import { Routes } from '@angular/router';
import { DATE_RANGE_NOW } from '../../../shared/ui/date-range/date-range-clock';
import { FAKE_NOW } from '../../../shared/widgets/dashboard/analytics-api';
import { dashboardPageCanDeactivate } from './dashboards/dashboard-page/dashboard-page.guard';
import { widgetPageCanDeactivate } from './widgets/widget-page/widget-page.guard';

// The dashboard fakes run on FAKE_NOW, so date pickers without a `today` input follow it too.
const dashboardChildren: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'home' },
  {
    path: 'home',
    canDeactivate: [dashboardPageCanDeactivate],
    loadComponent: () => import('./dashboards/dashboard-page/dashboard-page').then((m) => m.DashboardPage),
  },
  {
    path: 'dashboards',
    loadComponent: () => import('./dashboards/dashboards-page/dashboards-page').then((m) => m.DashboardsPage),
  },
  {
    path: 'dashboards/:id',
    canDeactivate: [dashboardPageCanDeactivate],
    loadComponent: () => import('./dashboards/dashboard-page/dashboard-page').then((m) => m.DashboardPage),
  },
  {
    path: 'dashboards/:id/records',
    loadComponent: () => import('./dashboards/records-page/records-page').then((m) => m.RecordsPage),
  },
  {
    path: 'widgets',
    loadComponent: () => import('./widgets/widgets-page/widgets-page').then((m) => m.WidgetsPage),
  },
  {
    path: 'widgets/new',
    canDeactivate: [widgetPageCanDeactivate],
    loadComponent: () => import('./widgets/widget-page/widget-page').then((m) => m.WidgetPage),
  },
  { path: 'widgets/:id', pathMatch: 'full', redirectTo: 'widgets/:id/builder' },
  {
    path: 'widgets/:id/:tab',
    canDeactivate: [widgetPageCanDeactivate],
    loadComponent: () => import('./widgets/widget-page/widget-page').then((m) => m.WidgetPage),
  },
  {
    path: 'alerts',
    loadComponent: () => import('./alerts/alerts-page/alerts-page').then((m) => m.AlertsPage),
  },
  {
    path: 'access',
    loadComponent: () => import('./access/access-page/access-page').then((m) => m.AccessPage),
  },
];

export const dashboardRoutes: Routes = [
  {
    path: '',
    providers: [{ provide: DATE_RANGE_NOW, useValue: () => new Date(FAKE_NOW) }],
    children: dashboardChildren,
  },
];
