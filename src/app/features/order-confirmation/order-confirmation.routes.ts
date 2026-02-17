import { Routes } from '@angular/router';

export const orderConfirmationRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./order-confirmation.component').then(m => m.OrderConfirmationComponent),
    title: 'Order Confirmation - GoShopping'
  }
];
