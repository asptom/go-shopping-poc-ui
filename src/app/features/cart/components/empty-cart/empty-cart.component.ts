import { Component } from '@angular/core';

import { RouterModule } from '@angular/router';

/**
 * Empty Cart Component
 * Displays when the shopping cart has no items
 */
@Component({
  selector: 'app-empty-cart',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './empty-cart.component.html',
  styleUrls: ['./empty-cart.component.scss']
})
export class EmptyCartComponent {}
