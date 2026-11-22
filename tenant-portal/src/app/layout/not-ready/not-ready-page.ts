import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerTools } from '@ng-icons/tabler-icons';
import { Button } from '../../shared/ui/button/button';

@Component({
  selector: 'app-not-ready-page',
  imports: [RouterLink, TranslocoPipe, NgIcon, Button],
  providers: [provideIcons({ tablerTools })],
  templateUrl: './not-ready-page.html',
  host: { class: 'flex flex-1 flex-col items-center justify-center gap-8 p-16 text-center' },
})
export class NotReadyPage {}
