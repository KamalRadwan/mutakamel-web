import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import type { ChangePage } from './subscription/change-page/change-page';

export const billingRoutes: Routes = [
  {
    path: '',
    providers: [provideTranslocoScope('settings', { scope: 'ws-billing', alias: 'bill' })],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'overview' },
      {
        path: 'overview',
        loadComponent: () =>
          import('./overview/overview-page/overview-page').then((m) => m.OverviewPage),
      },
      {
        path: 'invoices',
        loadComponent: () =>
          import('./invoices/invoices-page/invoices-page').then((m) => m.InvoicesPage),
      },
      {
        path: 'invoices/:id',
        loadComponent: () =>
          import('./invoices/invoice-page/invoice-page').then((m) => m.InvoicePage),
      },
      {
        path: 'subscription',
        pathMatch: 'full',
        loadComponent: () =>
          import('./subscription/subscription-page/subscription-page').then(
            (m) => m.SubscriptionPage,
          ),
      },
      {
        path: 'subscription/change',
        canDeactivate: [(c: ChangePage) => c.canDeactivate()],
        loadComponent: () =>
          import('./subscription/change-page/change-page').then((m) => m.ChangePage),
      },
      {
        path: 'catalogue',
        loadComponent: () =>
          import('./catalogue/catalogue-page/catalogue-page').then((m) => m.CataloguePage),
      },
    ],
  },
];
