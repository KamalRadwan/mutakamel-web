import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';

export const tradeSettingsRoutes: Routes = [
  {
    path: '',
    providers: [provideTranslocoScope('settings', { scope: 'trade-shared', alias: 'tradeShared' })],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'terms' },
      { path: 'terms', loadComponent: () => import('./terms/terms-page').then((m) => m.TermsPage) },
      { path: 'reasons', loadComponent: () => import('./reasons/reasons-page').then((m) => m.ReasonsPage) },
    ],
  },
];
