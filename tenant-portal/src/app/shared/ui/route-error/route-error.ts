import { NgOptimizedImage } from '@angular/common';
import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Button } from '../button/button';

@Component({
  selector: 'app-route-error',
  imports: [NgOptimizedImage, RouterLink, TranslocoPipe, Button],
  templateUrl: './route-error.html',
  styleUrl: './route-error.css',
  host: { class: 'flex min-w-0 flex-1 flex-col items-center justify-center gap-8 p-16 text-center' },
})
export class RouteError {
  readonly kind = input.required<'notFound' | 'forbidden'>();
}
