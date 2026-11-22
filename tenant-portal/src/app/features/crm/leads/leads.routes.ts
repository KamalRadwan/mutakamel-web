import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { leadPageCanDeactivate, leadsPageCanDeactivate } from './lead-page/lead-page.guard';

export const leadsRoutes: Routes = [
  {
    path: '',
    providers: [provideTranslocoScope('leads', { scope: 'record-related', alias: 'recordRelated' })],
    canDeactivate: [leadsPageCanDeactivate],
    loadComponent: () => import('./leads-page/leads-page').then((m) => m.LeadsPage),
  },
  {
    path: 'new',
    providers: [
      provideTranslocoScope(
        'leads',
        { scope: 'lead-page', alias: 'leadPage' },
        { scope: 'lead-modal', alias: 'leadModal' },
        { scope: 'lead-form', alias: 'leadForm' },
        { scope: 'lead-form-side', alias: 'leadSide' },
        { scope: 'lead-dup', alias: 'leadDup' },
        { scope: 'record-page', alias: 'recordPage' },
        { scope: 'record-attachments', alias: 'recordAttachments' },
        { scope: 'record-history', alias: 'recordHistory' },
        { scope: 'record-activities-tab', alias: 'recordActivitiesTab' },
        { scope: 'record-related', alias: 'recordRelated' },
      ),
    ],
    canDeactivate: [leadPageCanDeactivate],
    loadComponent: () => import('./lead-page/lead-page').then((m) => m.LeadPage),
  },
  {
    path: ':id',
    providers: [
      provideTranslocoScope(
        'leads',
        { scope: 'lead-page', alias: 'leadPage' },
        { scope: 'lead-modal', alias: 'leadModal' },
        { scope: 'lead-form', alias: 'leadForm' },
        { scope: 'lead-form-side', alias: 'leadSide' },
        { scope: 'lead-dup', alias: 'leadDup' },
        { scope: 'record-page', alias: 'recordPage' },
        { scope: 'record-attachments', alias: 'recordAttachments' },
        { scope: 'record-history', alias: 'recordHistory' },
        { scope: 'record-activities-tab', alias: 'recordActivitiesTab' },
        { scope: 'record-related', alias: 'recordRelated' },
      ),
    ],
    canDeactivate: [leadPageCanDeactivate],
    loadComponent: () => import('./lead-page/lead-page').then((m) => m.LeadPage),
  },
];
