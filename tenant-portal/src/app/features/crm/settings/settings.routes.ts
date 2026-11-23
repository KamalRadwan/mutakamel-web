import { inject } from '@angular/core';
import { Router, type Route, type Routes } from '@angular/router';
import { TenantScopeState } from '../../../core/scope/tenant-scope';
import { CrmModules } from '../shared/crm-modules/crm-modules';
import { requireCrmModuleAnywhere } from '../shared/crm-modules/crm-module.guard';
import type { CrmModule } from '../shared/crm-modules/crm-modules.model';
import { anyGrant, tenantWide } from './shared/settings-access';

interface SettingsPage {
  path: string;
  read: () => boolean;
  module?: CrmModule;
  loadComponent: Route['loadComponent'];
}

const settingsPages: SettingsPage[] = [
  {
    path: 'lead-stages',
    read: () => tenantWide('crm.lead_stages.read'),
    module: 'leads',
    loadComponent: () => import('./lead-stages/lead-stages-page').then((m) => m.LeadStagesPage),
  },
  {
    path: 'pipelines',
    read: () => tenantWide('crm.pipelines.manage'),
    module: 'opportunities',
    loadComponent: () => import('./pipelines/pipelines-page').then((m) => m.PipelinesPage),
  },
  {
    path: 'pipelines/:id',
    read: () => tenantWide('crm.pipelines.manage'),
    module: 'opportunities',
    loadComponent: () => import('./pipelines/pipeline-detail/pipeline-detail-page').then((m) => m.PipelineDetailPage),
  },
  {
    path: 'opportunity-stages',
    read: () => tenantWide('crm.pipelines.manage'),
    module: 'opportunities',
    loadComponent: () => import('./opportunity-stages/opportunity-stages-page').then((m) => m.OpportunityStagesPage),
  },
  {
    path: 'lead-sources',
    read: () => anyGrant('crm.acquisition_sources.read'),
    loadComponent: () => import('./lead-sources/lead-sources-page').then((m) => m.LeadSourcesPage),
  },
  {
    path: 'tags',
    read: () => tenantWide('crm.tags.read'),
    loadComponent: () => import('./tags/tags-page').then((m) => m.TagsPage),
  },
  {
    path: 'custom-fields',
    read: () => tenantWide('crm.custom_fields.read'),
    loadComponent: () => import('./custom-fields/custom-fields-page').then((m) => m.CustomFieldsPage),
  },
  {
    path: 'reasons',
    read: () => tenantWide('crm.settings.read'),
    loadComponent: () => import('./reasons/reasons-page').then((m) => m.ReasonsPage),
  },
  {
    path: 'outbound-emails',
    read: () => anyGrant('crm.activities.read'),
    loadComponent: () => import('./outbound-emails/outbound-emails-page').then((m) => m.OutboundEmailsPage),
  },
  {
    path: 'general',
    read: () => tenantWide('crm.settings.read'),
    loadComponent: () => import('./general/general-page').then((m) => m.GeneralPage),
  },
  {
    path: 'static-data',
    read: () => inject(TenantScopeState).me() !== null,
    loadComponent: () => import('./static-data/static-data-page').then((m) => m.StaticDataPage),
  },
  {
    path: 'targets',
    read: () => anyGrant('crm.targets.read'),
    loadComponent: () => import('./targets/targets-page').then((m) => m.TargetsPage),
  },
  {
    path: 'sla',
    read: () => anyGrant('crm.sla.manage') || anyGrant('crm.dashboards.read'),
    loadComponent: () => import('./sla/sla-page').then((m) => m.SlaPage),
  },
  {
    path: 'calendars',
    read: () => anyGrant('crm.sla.manage') || anyGrant('crm.targets.read'),
    loadComponent: () => import('./calendars/calendars-page').then((m) => m.CalendarsPage),
  },
  {
    path: 'data-readiness',
    read: () => tenantWide('crm.analytics.readiness.view'),
    loadComponent: () => import('./data-readiness/data-readiness-page').then((m) => m.DataReadinessPage),
  },
];

export const settingsRoutes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    canActivate: [
      async () => {
        const crmModules = inject(CrmModules);
        const router = inject(Router);
        const readablePages = settingsPages.filter((page) => page.read());
        await crmModules.ensureLoaded();
        const first = readablePages.find((page) => !page.path.includes(':') && (
          !page.module || (page.module === 'leads' ? crmModules.leadsAnywhere() : crmModules.opportunitiesAnywhere())
        ));
        return first ? router.createUrlTree(['/crm/settings', first.path]) : router.createUrlTree(['/forbidden']);
      },
    ],
    children: [],
  },
  ...settingsPages.map(({ read, module, ...route }) => ({
    ...route,
    canActivate: [
      () => read() || inject(Router).createUrlTree(['/forbidden']),
      ...(module ? [requireCrmModuleAnywhere(module)] : []),
    ],
  })),
];
