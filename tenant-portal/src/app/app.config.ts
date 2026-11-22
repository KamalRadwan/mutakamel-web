import { ApplicationConfig, inject, isDevMode, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { TitleStrategy, provideRouter, withComponentInputBinding } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { acceptLanguageInterceptor } from './core/api/accept-language.interceptor';
import { LanguageState } from './core/i18n/language';
import { TranslationLoader } from './core/i18n/translation-loader';
import { ThemeState } from './core/theme/theme';
import { ViewScale } from './core/view/view-scale';
import { TabLeader } from './core/tabs/tab-leader';
import { AppTitleStrategy } from './layout/title/app-title-strategy';
import { provideBulkJobModules } from './shared/bulk-jobs/bulk-job-modules';
import { CRM_CUSTOMERS_BULK_MODULE } from './features/crm/customers/customer-bulk/customers-bulk.descriptor';
import { CRM_LEADS_BULK_MODULE } from './features/crm/leads/lead-bulk/leads-bulk.descriptor';
import { CRM_OPPORTUNITIES_BULK_MODULE } from './features/crm/opportunities/opportunity-bulk/opportunities-bulk.descriptor';
import { TRADE_ITEMS_BULK_MODULE } from './features/trade/foundation/items/item-bulk/items-bulk.descriptor';
import { TRADE_ACCOUNTS_BULK_MODULE } from './features/trade/foundation/commercial-accounts/account-bulk/accounts-bulk.descriptor';
import { provideAutomationBulkModules } from './features/trade/automation/automation-bulk-modules';
import { registerFakeBulkModuleLoader } from './shared/bulk-jobs/bulk-jobs.fake';
import { routes } from './app.routes';

// Large fake data stays out of the initial bundle: loaded on the first bulk-jobs fake call for this module.
registerFakeBulkModuleLoader('crm', 'crm.leads', () => import('./features/crm/leads/lead-bulk/leads-bulk.fake-module'));
registerFakeBulkModuleLoader(
  'crm',
  CRM_OPPORTUNITIES_BULK_MODULE.module,
  () => import('./features/crm/opportunities/opportunity-bulk/opportunities-bulk.fake-module'),
);
registerFakeBulkModuleLoader(
  'crm',
  CRM_CUSTOMERS_BULK_MODULE.module,
  () => import('./features/crm/customers/customer-bulk/customers-bulk.fake-module'),
);
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
    provideHttpClient(withInterceptors([acceptLanguageInterceptor])),
    provideRouter(routes, withComponentInputBinding()),
    { provide: TitleStrategy, useClass: AppTitleStrategy },
    provideTransloco({
      config: { availableLangs: ['ar', 'en'], defaultLang: 'en', reRenderOnLangChange: true, prodMode: !isDevMode() },
      loader: TranslationLoader,
    }),
    provideBulkJobModules([
      CRM_LEADS_BULK_MODULE,
      CRM_OPPORTUNITIES_BULK_MODULE,
      CRM_CUSTOMERS_BULK_MODULE,
      TRADE_ITEMS_BULK_MODULE,
      TRADE_ACCOUNTS_BULK_MODULE,
    ]),
    provideAutomationBulkModules(),
    provideAppInitializer(() => {
      inject(LanguageState);
      inject(ThemeState);
      inject(ViewScale);
      inject(TabLeader).start();
    }),
  ],
};
