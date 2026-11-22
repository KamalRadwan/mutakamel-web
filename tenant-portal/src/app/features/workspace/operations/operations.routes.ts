import { CanDeactivateFn, GuardResult, MaybeAsync, Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';

interface DeactivatableComponent {
  canDeactivate?: () => MaybeAsync<GuardResult>;
}

const canDeactivateIfSupported: CanDeactivateFn<DeactivatableComponent> = (component) =>
  component?.canDeactivate ? component.canDeactivate() : true;

export const operationsRoutes: Routes = [
  {
    path: '',
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'party-directory' },
      {
        path: 'party-directory',
        providers: [
          provideTranslocoScope(
            'settings',
            { scope: 'ws-party-directory', alias: 'wsParty' },
            { scope: 'ws-party-modal', alias: 'wsPartyModal' },
          ),
        ],
        loadComponent: () =>
          import('./party-directory/party-directory-page/party-directory-page').then((m) => m.PartyDirectoryPage),
      },
      {
        path: 'directory-settings',
        canDeactivate: [canDeactivateIfSupported],
        providers: [provideTranslocoScope('settings', { scope: 'ws-directory-settings', alias: 'wsDirSettings' })],
        loadComponent: () =>
          import('./directory-settings/directory-settings-page/directory-settings-page').then(
            (m) => m.DirectorySettingsPage,
          ),
      },
      {
        path: 'activities',
        providers: [provideTranslocoScope('settings', 'activities', { scope: 'ws-activities', alias: 'wsActivities' })],
        loadComponent: () =>
          import('./activities/activities-page/activities-page').then((m) => m.ActivitiesPage),
      },
      {
        path: 'audit-log',
        providers: [provideTranslocoScope('settings', { scope: 'ws-audit-log', alias: 'wsAudit' })],
        loadComponent: () => import('./audit-log/audit-log-page/audit-log-page').then((m) => m.AuditLogPage),
      },
      {
        path: 'application-activation',
        providers: [provideTranslocoScope('settings', { scope: 'ws-app-activation', alias: 'wsActivation' })],
        loadComponent: () =>
          import('./application-activation/activation-page/activation-page').then((m) => m.ActivationPage),
      },
      {
        path: 'addon-seats',
        providers: [provideTranslocoScope('settings', { scope: 'ws-addon-seats', alias: 'wsAddonSeats' })],
        loadComponent: () => import('./addon-seats/addon-seats-page/addon-seats-page').then((m) => m.AddonSeatsPage),
      },
    ],
  },
];
