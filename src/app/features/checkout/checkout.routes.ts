import { Routes } from '@angular/router';
import { CartGuard } from '../../core/guards/cart.guard';

/**
 * Checkout Feature Routes
 */
export const checkoutRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./checkout.component').then(m => m.CheckoutComponent),
    canActivate: [CartGuard],
    title: 'Checkout - GoShopping'
  }
];
