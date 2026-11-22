import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerChevronRight } from '@ng-icons/tabler-icons';

export interface Crumb {
  label: string;
  link?: string | unknown[];
}

@Component({
  selector: 'ui-breadcrumbs',
  imports: [RouterLink, NgIcon],
  providers: [provideIcons({ tablerChevronRight })],
  templateUrl: './breadcrumbs.html',
  host: { class: 'block min-w-0' },
})
export class Breadcrumbs {
  readonly items = input.required<readonly Crumb[]>();
  readonly label = input('');
}
