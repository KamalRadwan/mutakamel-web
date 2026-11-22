import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { LanguageState } from '../../../../core/i18n/language';
import { ScopeState } from '../../../../core/scope/scope';
import { getCrmModules, syncCrmModuleDefaults, syncCrmModulesState } from './crm-modules.api';
import { CrmModule, CrmModuleFlags, CrmModulesState } from './crm-modules.model';

@Injectable({ providedIn: 'root' })
export class CrmModules {
  private readonly scope = inject(ScopeState);
  private readonly language = inject(LanguageState);

  private readonly rawState = signal<CrmModulesState | null>(null);
  private readonly loadedState = signal(false);
  private inFlight: Promise<void> | null = null;

  readonly loaded: Signal<boolean> = this.loadedState.asReadonly();

  readonly state: Signal<CrmModulesState | null> = computed(() => {
    const current = this.rawState();
    if (!current) return null;
    const lang = this.language.current();
    const scopeCompanies = this.scope.companies();
    return {
      ...current,
      companies: current.companies.map((company) => {
        const match = scopeCompanies.find((item) => item.id === company.companyId);
        return {
          ...company,
          name: match ? (lang === 'ar' ? match.nameAr : match.nameEn) : company.name,
        };
      }),
    };
  });

  readonly leadsEnabled: Signal<boolean> = computed(() => this.isEnabled('leads'));

  readonly opportunitiesEnabled: Signal<boolean> = computed(() => this.isEnabled('opportunities'));

  readonly leadsAnywhere: Signal<boolean> = computed(() => {
    const current = this.state();
    if (!current) return true;
    return (
      current.defaults.leadsEnabled ||
      current.companies.some((company) => (company.override.leadsEnabled ?? current.defaults.leadsEnabled))
    );
  });

  readonly opportunitiesAnywhere: Signal<boolean> = computed(() => {
    const current = this.state();
    if (!current) return true;
    return (
      current.defaults.opportunitiesEnabled ||
      current.companies.some(
        (company) => (company.override.opportunitiesEnabled ?? current.defaults.opportunitiesEnabled),
      )
    );
  });

  ensureLoaded(): Promise<void> {
    if (this.loadedState() && this.rawState() !== null) {
      return Promise.resolve();
    }
    if (this.inFlight) {
      return this.inFlight;
    }
    return this.reload();
  }

  reload(): Promise<void> {
    const promise = getCrmModules()
      .then((result) => {
        this.rawState.set(result);
        this.loadedState.set(true);
      })
      .catch(() => {
        this.loadedState.set(true);
      })
      .finally(() => {
        if (this.inFlight === promise) {
          this.inFlight = null;
        }
      });
    this.inFlight = promise;
    return promise;
  }

  isEnabled(module: CrmModule, companyId?: string): boolean {
    const targetId = companyId ?? this.scope.company().id;
    const current = this.state();
    if (!current) return true;
    const key = module === 'leads' ? 'leadsEnabled' : 'opportunitiesEnabled';
    const company = current.companies.find((item) => item.companyId === targetId);
    if (!company) return current.defaults[key];
    return company.override[key] ?? current.defaults[key];
  }

  apply(state: CrmModulesState): void {
    const synced = syncCrmModulesState(state);
    this.rawState.set(synced);
    this.loadedState.set(true);
  }

  applyDefaults(defaults: Partial<CrmModuleFlags>): void {
    const synced = syncCrmModuleDefaults(defaults);
    const current = this.rawState();
    if (!current) {
      this.rawState.set(synced);
      this.loadedState.set(true);
      return;
    }
    const nextDefaults: CrmModuleFlags = { ...current.defaults, ...defaults };
    this.rawState.set({
      ...current,
      defaults: nextDefaults,
      companies: current.companies.map((company) => ({
        ...company,
        effective: {
          leadsEnabled: company.override.leadsEnabled ?? nextDefaults.leadsEnabled,
          opportunitiesEnabled: company.override.opportunitiesEnabled ?? nextDefaults.opportunitiesEnabled,
        },
      })),
    });
  }
}
