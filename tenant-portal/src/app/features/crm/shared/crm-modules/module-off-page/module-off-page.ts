import { Component, computed, effect, inject, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerTarget, tablerUserPlus } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { ScopeState } from '../../../../../core/scope/scope';
import { Button } from '../../../../../shared/ui/button/button';
import { CrmModules } from '../crm-modules';
import { CrmModule } from '../crm-modules.model';

const CAN_MANAGE_SETTINGS = true; // later from session permission crm.settings.manage

@Component({
  selector: 'app-module-off-page',
  imports: [RouterLink, TranslocoPipe, NgIcon, Button],
  providers: [
    provideTranslocoScope({ scope: 'crm-modules', alias: 'crmModules' }),
    provideIcons({ tablerUserPlus, tablerTarget }),
  ],
  templateUrl: './module-off-page.html',
  host: { class: 'flex flex-1 flex-col items-center justify-center gap-8 p-16 text-center' },
})
export class ModuleOffPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly scope = inject(ScopeState);
  private readonly language = inject(LanguageState);
  private readonly crmModules = inject(CrmModules);

  protected readonly canManageSettings = CAN_MANAGE_SETTINGS;

  private readonly paramMap = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });

  protected readonly module = computed<CrmModule>(() =>
    this.paramMap().get('module') === 'opportunities' ? 'opportunities' : 'leads',
  );

  protected readonly icon = computed(() =>
    this.module() === 'opportunities' ? 'tablerTarget' : 'tablerUserPlus',
  );

  protected readonly companyName = computed(() => {
    const company = this.scope.company();
    return this.language.current() === 'ar' ? company.nameAr : company.nameEn;
  });

  constructor() {
    void this.crmModules.ensureLoaded();
    effect(() => {
      if (!this.crmModules.loaded()) return;
      const mod = this.module();
      if (this.crmModules.isEnabled(mod)) {
        untracked(() => void this.router.navigateByUrl(`/crm/${mod}`));
      }
    });
  }
}
