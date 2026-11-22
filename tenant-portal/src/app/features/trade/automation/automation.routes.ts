import { provideEnvironmentInitializer } from '@angular/core';
import type { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { seedAutomationReasons } from './automation-reasons.seed';

export const automationRoutes: Routes = [
  {
    path: '',
    providers: [
      provideTranslocoScope(
        { scope: 'trade-automation', alias: 'automation' },
        { scope: 'trade-shared', alias: 'tradeShared' },
      ),
      provideEnvironmentInitializer(() => {
        seedAutomationReasons();
      }),
    ],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'extension-profiles' },
      {
        path: 'extension-profiles',
        loadComponent: () =>
          import('./extension-profiles-page/extension-profiles-page').then(
            (m) => m.ExtensionProfilesPage,
          ),
      },
      {
        path: 'extension-profiles/:id',
        loadComponent: () =>
          import('./extension-profile-page/extension-profile-page').then(
            (m) => m.ExtensionProfilePage,
          ),
      },
      {
        path: 'import-mappings',
        loadComponent: () =>
          import('./import-mappings-page/import-mappings-page').then((m) => m.ImportMappingsPage),
      },
      {
        path: 'import-mappings/:id',
        loadComponent: () =>
          import('./import-mapping-page/import-mapping-page').then((m) => m.ImportMappingPage),
      },
      {
        path: 'import-runs',
        loadComponent: () =>
          import('./import-runs-page/import-runs-page').then((m) => m.ImportRunsPage),
      },
      {
        path: 'import-runs/:runId',
        loadComponent: () =>
          import('./import-run-page/import-run-page').then((m) => m.ImportRunPage),
      },
      {
        path: 'webhooks',
        loadComponent: () =>
          import('./webhooks-page/webhooks-page').then((m) => m.WebhooksPage),
      },
      {
        path: 'control-tower',
        loadComponent: () =>
          import('./control-tower-page/control-tower-page').then((m) => m.ControlTowerPage),
      },
    ],
  },
];
