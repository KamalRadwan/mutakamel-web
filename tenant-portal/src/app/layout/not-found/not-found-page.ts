import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerFileSearch } from '@ng-icons/tabler-icons';
import { Button } from '../../shared/ui/button/button';

@Component({
  selector: 'app-not-found-page',
  imports: [RouterLink, TranslocoPipe, NgIcon, Button],
  providers: [provideIcons({ tablerFileSearch })],
  templateUrl: './not-found-page.html',
  host: { class: 'flex flex-1 flex-col items-center justify-center gap-8 p-16 text-center' },
})
export class NotFoundPage {}
