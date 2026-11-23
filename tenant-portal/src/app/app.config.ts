import { ApplicationConfig, inject, isDevMode, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { EnvironmentInjector } from '@angular/core';
import { bindCrmHttp, CrmHttp, crmQueries } from './features/crm/shared/crm-http';
import { bindCrmInjector } from './features/crm/shared/crm-runtime';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { TitleStrategy, provideRouter, withComponentInputBinding } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { acceptLanguageInterceptor } from './core/api/accept-language.interceptor';
import { sessionRecoveryInterceptor } from './core/auth/session-recovery.interceptor';
import { AuthSession } from './core/auth/auth-session';
import { LanguageState } from './core/i18n/language';
import { TranslationLoader } from './core/i18n/translation-loader';
import { ThemeState } from './core/theme/theme';
import { ViewScale } from './core/view/view-scale';
import { TabLeader } from './core/tabs/tab-leader';
import { AppTitleStrategy } from './layout/title/app-title-strategy';
import { provideBulkJobModules } from './shared/bulk-jobs/bulk-job-modules';
import { CORE_USERS_BULK_MODULE } from './features/workspace/staff/users/users-bulk/users-bulk.descriptor';
import { bindAnalyticsPermissions } from './shared/widgets/dashboard/analytics-permissions';
import { CRM_CUSTOMERS_BULK_MODULE } from './features/crm/customers/customer-bulk/customers-bulk.descriptor';
import { CRM_LEADS_BULK_MODULE } from './features/crm/leads/lead-bulk/leads-bulk.descriptor';
import { CRM_OPPORTUNITIES_BULK_MODULE } from './features/crm/opportunities/opportunity-bulk/opportunities-bulk.descriptor';
import { TRADE_ITEMS_BULK_MODULE } from './features/trade/foundation/items/item-bulk/items-bulk.descriptor';
import { TRADE_ACCOUNTS_BULK_MODULE } from './features/trade/foundation/commercial-accounts/account-bulk/accounts-bulk.descriptor';
import { provideAutomationBulkModules } from './features/trade/automation/automation-bulk-modules';
import { registerFakeBulkModuleLoader } from './shared/bulk-jobs/bulk-jobs.fake';
import { bindBulkJobsApi, BulkJobsApi } from './shared/bulk-jobs/bulk-jobs.api';
import { bindSeatPreviewApi, SeatPreviewApi } from './features/workspace/seats/seats.api';
import { routes } from './app.routes';

// FAKE-ONLY, no backend route: Trade bulk gateway rows have not landed.
registerFakeBulkModuleLoader(
  'trading',
  TRADE_ITEMS_BULK_MODULE.module,
  () => import('./features/trade/foundation/items/item-bulk/items-bulk.fake-module'),
);
registerFakeBulkModuleLoader(
  'trading',
  TRADE_ACCOUNTS_BULK_MODULE.module,
  () => import('./features/trade/foundation/commercial-accounts/account-bulk/accounts-bulk.fake-module'),
);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withInterceptors([acceptLanguageInterceptor, sessionRecoveryInterceptor])),
    provideRouter(routes, withComponentInputBinding()),
    { provide: TitleStrategy, useClass: AppTitleStrategy },
    provideTransloco({
      config: { availableLangs: ['ar', 'en'], defaultLang: 'en', reRenderOnLangChange: true, prodMode: !isDevMode() },
      loader: TranslationLoader,
    }),
    provideBulkJobModules([
      CORE_USERS_BULK_MODULE,
      CRM_LEADS_BULK_MODULE,
      CRM_OPPORTUNITIES_BULK_MODULE,
      CRM_CUSTOMERS_BULK_MODULE,
      TRADE_ITEMS_BULK_MODULE,
      TRADE_ACCOUNTS_BULK_MODULE,
    ]),
    provideAutomationBulkModules(),
    provideAppInitializer(() => {
      const injector = inject(EnvironmentInjector);
      bindBulkJobsApi(() => injector.get(BulkJobsApi));
      bindSeatPreviewApi(() => injector.get(SeatPreviewApi));
    }),
    provideAppInitializer(() => { const session = inject(AuthSession); bindAnalyticsPermissions(() => session.me()?.permissions ?? []); }),
    provideAppInitializer(() => { const injector = inject(EnvironmentInjector); bindCrmHttp(inject(CrmHttp), crmQueries()); bindCrmInjector(() => injector); }),
    provideAppInitializer(() => {
      inject(LanguageState);
      inject(ThemeState);
      inject(ViewScale);
      inject(TabLeader).start();
    }),
  ],
};
