import { RouterLink } from '@angular/router';
import { Component, ChangeDetectionStrategy} from '@angular/core';

import { RouterModule } from '@angular/router';

/**
 * Empty Cart Component
 * Displays when the shopping cart has no items
 */
@Component({
  selector: 'app-empty-cart',
  imports: [RouterModule],
  templateUrl: './empty-cart.component.html',
  styleUrls: ['./empty-cart.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmptyCartComponent {}
