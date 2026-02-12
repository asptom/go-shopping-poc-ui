import { Routes } from '@angular/router';

/**
 * Cart Feature Routes
 */
export const cartRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./cart.component').then(m => m.CartComponent),
    title: 'Shopping Cart - GoShopping'
  }
];
