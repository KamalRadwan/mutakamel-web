import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';

export const inventoryRoutes: Routes = [
  {
    path: '',
    providers: [
      provideTranslocoScope(
        'settings',
        { scope: 'trade-shared', alias: 'tradeShared' },
        { scope: 'trade-inventory', alias: 'tradeInventory' },
      ),
    ],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'availability' },
      {
        path: 'availability',
        loadComponent: () =>
          import('./availability-page/availability-page').then((m) => m.AvailabilityPage),
      },
      {
        path: 'availability/:id',
        loadComponent: () =>
          import('./availability-page/availability-page').then((m) => m.AvailabilityPage),
      },
      {
        path: 'fulfilment-nodes',
        loadComponent: () => import('./nodes-page/nodes-page').then((m) => m.NodesPage),
      },
      {
        path: 'fulfilment-nodes/:id',
        loadComponent: () => import('./nodes-page/nodes-page').then((m) => m.NodesPage),
      },
      {
        path: 'periods',
        loadComponent: () => import('./periods-page/periods-page').then((m) => m.PeriodsPage),
      },
      {
        path: 'periods/:id',
        loadComponent: () => import('./periods-page/periods-page').then((m) => m.PeriodsPage),
      },
      {
        path: 'uom-conversions',
        loadComponent: () =>
          import('./uom-conversions-page/uom-conversions-page').then((m) => m.UomConversionsPage),
      },
      {
        path: 'uom-conversions/:id',
        loadComponent: () =>
          import('./uom-conversions-page/uom-conversions-page').then((m) => m.UomConversionsPage),
      },
      {
        path: 'movements',
        loadComponent: () => import('./movements-page/movements-page').then((m) => m.MovementsPage),
      },
      {
        path: 'movements/:id',
        loadComponent: () => import('./movements-page/movements-page').then((m) => m.MovementsPage),
      },
      {
        path: 'serials',
        loadComponent: () => import('./serials-page/serials-page').then((m) => m.SerialsPage),
      },
      {
        path: 'serials/:id',
        loadComponent: () => import('./serials-page/serials-page').then((m) => m.SerialsPage),
      },
      {
        path: 'decisions',
        loadComponent: () => import('./decisions-page/decisions-page').then((m) => m.DecisionsPage),
      },
      {
        path: 'decisions/:id',
        loadComponent: () => import('./decisions-page/decisions-page').then((m) => m.DecisionsPage),
      },
    ],
  },
];
