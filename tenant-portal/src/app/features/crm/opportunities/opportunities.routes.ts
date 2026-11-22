import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { recordCanDeactivate } from '../shared/record/nav/record-page.guard';

const OPPORTUNITY_PAGE_SCOPES = [
  'opportunities',
  { scope: 'opportunity-page', alias: 'oppPage' },
  { scope: 'opportunity-form', alias: 'oppForm' },
  { scope: 'record-page', alias: 'recordPage' },
  { scope: 'record-fields', alias: 'recordFields' },
  { scope: 'record-form', alias: 'recordForm' },
  { scope: 'record-attachments', alias: 'recordAttachments' },
  { scope: 'record-history', alias: 'recordHistory' },
  { scope: 'record-activities-tab', alias: 'recordActivitiesTab' },
  { scope: 'record-related', alias: 'recordRelated' },
];

export const opportunitiesRoutes: Routes = [
  {
    path: '',
    providers: [provideTranslocoScope('opportunities')],
    canDeactivate: [recordCanDeactivate],
    loadComponent: () =>
      import('./opportunities-page/opportunities-page').then((m) => m.OpportunitiesPage),
  },
  {
    path: 'new',
    providers: [provideTranslocoScope(...OPPORTUNITY_PAGE_SCOPES)],
    canDeactivate: [recordCanDeactivate],
    loadComponent: () =>
      import('./opportunity-page/opportunity-page').then((m) => m.OpportunityPage),
  },
  {
    path: ':id',
    providers: [provideTranslocoScope(...OPPORTUNITY_PAGE_SCOPES)],
    canDeactivate: [recordCanDeactivate],
    loadComponent: () =>
      import('./opportunity-page/opportunity-page').then((m) => m.OpportunityPage),
  },
];
