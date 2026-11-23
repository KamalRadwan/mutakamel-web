import { Component, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerBuilding } from '@ng-icons/tabler-icons';
import type { ScopeTarget } from '../automation.model';

@Component({
  selector: 'app-scope-chip',
  imports: [NgIcon, TranslocoPipe],
  providers: [provideIcons({ tablerBuilding })],
  templateUrl: './scope-chip.html',
})
export class ScopeChip {
  readonly scope = input<ScopeTarget>('COMPANY');
}
