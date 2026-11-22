import { EnvironmentProviders, InjectionToken, makeEnvironmentProviders } from '@angular/core';
import { BulkJob, BulkJobApp, BulkJobItem } from './bulk-jobs.model';

export interface BulkJobActionDescriptor {
  titleKey: string;
  icon: string;
  tone: 'blue' | 'green' | 'teal' | 'red' | 'violet' | 'amber';
  succeededKey: string;
  /**
   * Optional title params that need translating. Returns a map of title param
   * name to translation key; each key is translated in the active language when
   * the title is shown and merged over the job's paramsSummary.
   */
  titleParams?: (paramsSummary: BulkJob['paramsSummary']) => Record<string, string>;
}

export interface BulkJobModuleDescriptor {
  app: BulkJobApp;
  module: string;
  i18nScopes: string[];
  actions: Record<string, BulkJobActionDescriptor>;
  codeKeyPrefixes: string[];
  itemLink?: (item: BulkJobItem, job: BulkJob) => { commands: unknown[]; queryParams?: Record<string, string> } | null;
  selectFailedRoute?: (job: BulkJob) => { commands: unknown[]; queryParams: Record<string, string> } | null;
  summaryLines?: (job: BulkJob) => { key: string; params: Record<string, string | number> }[];
  retryOverrides?: (job: BulkJob) => 'START_AT' | null;
  /** Module texts that replace the generic "started" and "already running" toasts. */
  toasts?: { startedKey?: string; activeKey?: string; activeDetailKey?: string };
}

export const BULK_JOB_MODULES = new InjectionToken<BulkJobModuleDescriptor[]>('BULK_JOB_MODULES');

export function provideBulkJobModules(modules: BulkJobModuleDescriptor[]): EnvironmentProviders {
  return makeEnvironmentProviders(
    modules.map((descriptor) => ({
      provide: BULK_JOB_MODULES,
      useValue: descriptor,
      multi: true,
    })),
  );
}
