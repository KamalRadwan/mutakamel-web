import { Routes, UrlSegment } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { authGuard } from './core/auth/auth.guards';
import { requireApp } from './core/guards/app-entitlement.guard';
import { requireCrmModule } from './features/crm/shared/crm-modules/crm-module.guard';
import { isKnownPath } from './layout/navigation';

const AUTH_PATHS = new Set(['login', 'verify', 'reset-password', 'tenant/reset-password', 'tenant/accept-invite']);

function isAuthPath(_route: unknown, segments: UrlSegment[]): boolean {
  if (segments.length === 0 || segments.length > 2) return false;
  return AUTH_PATHS.has(segments.map((segment) => segment.path).join('/'));
}

const TEMPLATE_TABS = new Set(['overview', 'design', 'preview', 'validation', 'versions', 'recovery']);

function isTemplateOperationsRoute(_route: unknown, segments: UrlSegment[]): boolean {
  const page = segments[2]?.path;
  if (page === 'template-assets' || page === 'template-assignments') {
    return segments.length === 3;
  }
  if (page === 'template-platform') {
    if (segments.length === 3 || segments.length === 4) return true;
    return segments.length === 5 && TEMPLATE_TABS.has(segments[4]?.path ?? '');
  }
  return false;
}

export const routes: Routes = [
  { path: '', canMatch: [isAuthPath], loadChildren: () => import('./features/auth/auth.routes').then((m) => m.authRoutes) },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/app-layout/app-layout').then((m) => m.AppLayout),
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('./features/workspace/home/home-page/home-page').then((m) => m.HomePage),
      },
      {
        path: 'workspace',
        pathMatch: 'full',
        loadComponent: () => import('./features/workspace/home/home-page/home-page').then((m) => m.HomePage),
      },
      {
        path: 'workspace/home',
        pathMatch: 'full',
        loadComponent: () => import('./features/workspace/home/home-page/home-page').then((m) => m.HomePage),
      },
      {
        path: 'workspace/settings',
        loadChildren: () => import('./features/workspace/settings/settings.routes').then((m) => m.workspaceSettingsRoutes),
      },
      {
        path: 'crm/leads',
        canActivate: [requireCrmModule('leads')],
        loadChildren: () => import('./features/crm/leads/leads.routes').then((m) => m.leadsRoutes),
      },
      {
        path: 'crm/opportunities',
        canActivate: [requireCrmModule('opportunities')],
        loadChildren: () =>
          import('./features/crm/opportunities/opportunities.routes').then((m) => m.opportunitiesRoutes),
      },
      {
        // TODO(Phase 5): crm.customer_profiles.read guard
        path: 'crm/customers',
        canActivate: [requireApp('crm')],
        loadChildren: () => import('./features/crm/customers/customers.routes').then((m) => m.customersRoutes),
      },
      {
        path: 'crm/settings',
        canActivate: [requireApp('crm')],
        providers: [provideTranslocoScope('settings')],
        loadChildren: () => import('./features/crm/settings/settings.routes').then((m) => m.settingsRoutes),
      },
      {
        path: 'crm/dashboard',
        canActivate: [requireApp('crm')],
        loadChildren: () => import('./features/crm/dashboard/dashboard.routes').then((m) => m.dashboardRoutes),
      },
      {
        path: 'crm/reports',
        canActivate: [requireApp('crm')],
        loadChildren: () => import('./features/crm/reports/reports.routes').then((m) => m.reportsRoutes),
      },
      {
        path: 'crm/off/:module',
        loadComponent: () =>
          import('./features/crm/shared/crm-modules/module-off-page/module-off-page').then((m) => m.ModuleOffPage),
      },
      {
        path: 'workspace/staff',
        loadChildren: () => import('./features/workspace/staff/staff.routes').then((m) => m.staffRoutes),
      },
      {
        path: 'workspace/operations',
        canMatch: [isTemplateOperationsRoute],
        loadChildren: () => import('./features/workspace/templates/templates.routes').then((m) => m.templatesRoutes),
      },
      {
        path: 'workspace/operations',
        loadChildren: () => import('./features/workspace/operations/operations.routes').then((m) => m.operationsRoutes),
      },
      {
        path: 'workspace/account',
        loadChildren: () => import('./features/workspace/account/account.routes').then((m) => m.accountRoutes),
      },
      {
        path: 'workspace/notifications',
        loadChildren: () =>
          import('./features/workspace/notifications/notifications.routes').then((m) => m.notificationsRoutes),
      },
      {
        path: 'workspace/billing',
        loadChildren: () => import('./features/workspace/billing/billing.routes').then((m) => m.billingRoutes),
      },
      {
        path: 'workspace/billing/subscription',
        children: [
          {
            path: 'seats/over-capacity',
            loadComponent: () =>
              import('./features/workspace/seats/over-capacity/seat-swap-page/seat-swap-page').then(
                (m) => m.SeatSwapPage,
              ),
          },
          {
            path: '',
            loadChildren: () =>
              import('./features/workspace/billing/seats/billing-seats.routes').then((m) => m.billingSeatsRoutes),
          },
        ],
      },
      {
        path: 'trade/foundation',
        canActivate: [requireApp('trade')],
        loadChildren: () => import('./features/trade/foundation/foundation.routes').then((m) => m.foundationRoutes),
      },
      {
        path: 'trade/documents',
        canActivate: [requireApp('trade')],
        providers: [provideTranslocoScope({ scope: 'trade-shared', alias: 'tradeShared' })],
        loadChildren: () => import('./features/trade/documents/documents.routes').then((m) => m.DOCUMENTS_ROUTES),
      },
      {
        path: 'trade/inventory',
        canActivate: [requireApp('trade')],
        providers: [provideTranslocoScope({ scope: 'trade-shared', alias: 'tradeShared' })],
        loadChildren: () => import('./features/trade/inventory/inventory.routes').then((m) => m.inventoryRoutes),
      },
      {
        path: 'trade/governance',
        canActivate: [requireApp('trade')],
        providers: [provideTranslocoScope({ scope: 'trade-shared', alias: 'tradeShared' })],
        loadChildren: () => import('./features/trade/governance/governance.routes').then((m) => m.governanceRoutes),
      },
      {
        path: 'trade/dashboard',
        canActivate: [requireApp('trade')],
        loadChildren: () => import('./features/trade/dashboard/dashboard.routes').then((m) => m.tradeDashboardRoutes),
      },
      {
        path: 'trade/automation',
        canActivate: [requireApp('trade')],
        providers: [provideTranslocoScope({ scope: 'trade-shared', alias: 'tradeShared' })],
        loadChildren: () => import('./features/trade/automation/automation.routes').then((m) => m.automationRoutes),
      },
      {
        path: 'trade/settings',
        canActivate: [requireApp('trade')],
        loadChildren: () => import('./features/trade/settings/settings.routes').then((m) => m.tradeSettingsRoutes),
      },
      {
        path: 'forbidden',
        title: 'errors.forbidden.title',
        data: { kind: 'forbidden' },
        loadComponent: () => import('./shared/ui/route-error/route-error').then((m) => m.RouteError),
      },
      {
        path: 'not-found',
        title: 'errors.notFound.title',
        loadComponent: () => import('./layout/not-found/not-found-page').then((m) => m.NotFoundPage),
      },
      {
        path: '**',
        canMatch: [(_: unknown, segments: UrlSegment[]) => isKnownPath(segments.map((segment) => segment.path))],
        loadComponent: () => import('./layout/not-ready/not-ready-page').then((m) => m.NotReadyPage),
      },
      {
        path: '**',
        title: 'errors.notFound.title',
        loadComponent: () => import('./layout/not-found/not-found-page').then((m) => m.NotFoundPage),
      },
    ],
  },
];
