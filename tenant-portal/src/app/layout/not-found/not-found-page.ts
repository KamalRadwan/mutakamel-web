import { Component } from '@angular/core';
import { RouteError } from '../../shared/ui/route-error/route-error';

@Component({
  selector: 'app-not-found-page',
  imports: [RouteError],
  template: '<app-route-error kind="notFound" />',
  host: { class: 'flex min-w-0 flex-1' },
})
export class NotFoundPage {}
