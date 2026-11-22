import { Component, ElementRef, input, model, output, viewChild } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerId } from '@ng-icons/tabler-icons';
import { Field } from '../../../../../shared/ui/field/field';
import { BRANDING_TEXT_MAX, BrandingIdentityErrors } from '../branding.model';

@Component({
  selector: 'app-branding-identity-card',
  imports: [TranslocoPipe, NgIcon, Field],
  providers: [provideIcons({ tablerId })],
  templateUrl: './branding-identity-card.html',
})
export class BrandingIdentityCard {
  private static nextId = 0;
  protected readonly uid = `branding-identity-${++BrandingIdentityCard.nextId}`;

  private readonly appNameInput = viewChild<ElementRef<HTMLInputElement>>('appNameInput');
  private readonly tabTitleInput = viewChild<ElementRef<HTMLInputElement>>('tabTitleInput');

  readonly appName = model('');
  readonly tabTitle = model('');
  readonly errors = input<BrandingIdentityErrors>({ appName: null, tabTitle: null });
  readonly readOnly = input(false);
  readonly fieldBlur = output<'appName' | 'tabTitle'>();

  protected readonly textMax = BRANDING_TEXT_MAX;

  focusField(field: 'appName' | 'tabTitle'): void {
    const target = field === 'appName' ? this.appNameInput() : this.tabTitleInput();
    target?.nativeElement.focus();
  }

  protected onAppNameInput(event: Event): void {
    this.appName.set((event.target as HTMLInputElement).value);
  }

  protected onTabTitleInput(event: Event): void {
    this.tabTitle.set((event.target as HTMLInputElement).value);
  }
}
