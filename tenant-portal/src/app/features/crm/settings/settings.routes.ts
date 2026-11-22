import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';
import { CrmModules } from '../shared/crm-modules/crm-modules';
import { requireCrmModuleAnywhere } from '../shared/crm-modules/crm-module.guard';

export const settingsRoutes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    canActivate: [
      async () => {
        const crmModules = inject(CrmModules);
        const router = inject(Router);
        await crmModules.ensureLoaded();
        return router.createUrlTree(['/crm/settings', crmModules.leadsAnywhere() ? 'lead-stages' : 'lead-sources']);
      },
    ],
    children: [],
  },
  {
    path: 'lead-stages',
    canActivate: [requireCrmModuleAnywhere('leads')],
    loadComponent: () => import('./lead-stages/lead-stages-page').then((m) => m.LeadStagesPage),
  },
  {
    path: 'pipelines',
    canActivate: [requireCrmModuleAnywhere('opportunities')],
    loadComponent: () => import('./pipelines/pipelines-page').then((m) => m.PipelinesPage),
  },
  {
    path: 'pipelines/:id',
    canActivate: [requireCrmModuleAnywhere('opportunities')],
    loadComponent: () => import('./pipelines/pipeline-detail/pipeline-detail-page').then((m) => m.PipelineDetailPage),
  },
  {
    path: 'opportunity-stages',
    canActivate: [requireCrmModuleAnywhere('opportunities')],
    loadComponent: () => import('./opportunity-stages/opportunity-stages-page').then((m) => m.OpportunityStagesPage),
  },
  {
    path: 'lead-sources',
    loadComponent: () => import('./lead-sources/lead-sources-page').then((m) => m.LeadSourcesPage),
  },
  {
    path: 'tags',
    loadComponent: () => import('./tags/tags-page').then((m) => m.TagsPage),
  },
  {
    path: 'custom-fields',
    loadComponent: () => import('./custom-fields/custom-fields-page').then((m) => m.CustomFieldsPage),
  },
  {
    path: 'reasons',
    loadComponent: () => import('./reasons/reasons-page').then((m) => m.ReasonsPage),
  },
  {
    path: 'outbound-emails',
    loadComponent: () => import('./outbound-emails/outbound-emails-page').then((m) => m.OutboundEmailsPage),
  },
  {
    path: 'general',
    loadComponent: () => import('./general/general-page').then((m) => m.GeneralPage),
  },
  {
    path: 'duplicates',
    loadComponent: () => import('./duplicates/duplicates-page').then((m) => m.DuplicatesPage),
  },
  {
    path: 'static-data',
    loadComponent: () => import('./static-data/static-data-page').then((m) => m.StaticDataPage),
  },
  {
    path: 'targets',
    loadComponent: () => import('./targets/targets-page').then((m) => m.TargetsPage),
  },
  {
    path: 'sla',
    loadComponent: () => import('./sla/sla-page').then((m) => m.SlaPage),
  },
  {
    path: 'calendars',
    loadComponent: () => import('./calendars/calendars-page').then((m) => m.CalendarsPage),
  },
  {
    path: 'data-readiness',
    loadComponent: () => import('./data-readiness/data-readiness-page').then((m) => m.DataReadinessPage),
  },
];
