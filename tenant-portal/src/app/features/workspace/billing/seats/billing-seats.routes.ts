import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import type { SeatDowngradePage } from './seat-downgrade-page/seat-downgrade-page';

export const billingSeatsRoutes: Routes = [
  {
    path: '',
    providers: [provideTranslocoScope('settings', 'seats', { scope: 'seats-billing', alias: 'sb' })],
    children: [
      {
        // /workspace/billing/subscription itself belongs to SubscriptionPage (billing.routes.ts).
        path: 'seats',
        pathMatch: 'full',
        loadComponent: () =>
          import('./subscription-seats-page/subscription-seats-page').then((m) => m.SubscriptionSeatsPage),
      },
      {
        path: 'seats/reduce',
        canDeactivate: [(component: SeatDowngradePage) => component.canDeactivate()],
        loadComponent: () =>
          import('./seat-downgrade-page/seat-downgrade-page').then((m) => m.SeatDowngradePage),
      },
      {
        path: 'seats/automatic',
        loadComponent: () =>
          import('./seat-migration-page/seat-migration-page').then((m) => m.SeatMigrationPage),
      },
    ],
  },
];
