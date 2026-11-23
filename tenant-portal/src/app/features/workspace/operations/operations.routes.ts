import { CanDeactivateFn, GuardResult, MaybeAsync, Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { requirePermission } from '../../../core/auth/permission.guard';

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
        canActivate: [requirePermission('directory.party.read')],
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
        canActivate: [requirePermission('directory.settings.manage')],
        canDeactivate: [canDeactivateIfSupported],
        providers: [provideTranslocoScope('settings', { scope: 'ws-directory-settings', alias: 'wsDirSettings' })],
        loadComponent: () =>
          import('./directory-settings/directory-settings-page/directory-settings-page').then(
            (m) => m.DirectorySettingsPage,
          ),
      },
      {
        path: 'activities',
        canActivate: [requirePermission('activities.read')],
        providers: [provideTranslocoScope('settings', 'activities', { scope: 'ws-activities', alias: 'wsActivities' })],
        loadComponent: () =>
          import('./activities/activities-page/activities-page').then((m) => m.ActivitiesPage),
      },
      {
        path: 'audit-log',
        canActivate: [requirePermission(['audit.read', 'audit.read.branch', 'audit.read.own'], { any: true })],
        providers: [provideTranslocoScope('settings', { scope: 'ws-audit-log', alias: 'wsAudit' })],
        loadComponent: () => import('./audit-log/audit-log-page/audit-log-page').then((m) => m.AuditLogPage),
      },
      {
        path: 'application-activation',
        canActivate: [requirePermission(['applications.activation.read', 'applications.activation.manage'], { any: true })],
        providers: [provideTranslocoScope('settings', { scope: 'ws-app-activation', alias: 'wsActivation' })],
        loadComponent: () =>
          import('./application-activation/activation-page/activation-page').then((m) => m.ActivationPage),
      },
      {
        path: 'addon-seats',
        canActivate: [requirePermission(['applications.addon_seats.read', 'applications.addon_seats.manage'], { any: true })],
        providers: [provideTranslocoScope('settings', { scope: 'ws-addon-seats', alias: 'wsAddonSeats' })],
        loadComponent: () => import('./addon-seats/addon-seats-page/addon-seats-page').then((m) => m.AddonSeatsPage),
      },
    ],
  },
];
