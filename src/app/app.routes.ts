import { Routes } from '@angular/router';
import { LayoutComponent } from './layout/layout.component';
import { AuthGuard } from './auth/auth.guard';

export const routes: Routes = [
  {
    path: '',
    component: LayoutComponent,
    children: [
      { path: '', redirectTo: '/home', pathMatch: 'full' },
      { 
        path: 'home', 
        loadComponent: () => import('./features/home/home.component').then(m => m.HomeComponent),
        title: 'Home - GoShopping'
      },
      { 
        path: 'profile', 
        loadComponent: () => import('./features/profile/profile.component').then(m => m.ProfileComponent),
        canActivate: [AuthGuard],
        title: 'Profile - GoShopping'
      },
      {
        path: 'products',
        loadComponent: () => import('./features/products/product-list/product-list.component').then(m => m.ProductListComponent),
        title: 'Products - GoShopping'
      },
      {
        path: 'products/:id',
        loadComponent: () => import('./features/products/product-detail/product-detail.component').then(m => m.ProductDetailComponent),
        title: 'Product Details - GoShopping'
      },
      {
        path: 'cart',
        loadChildren: () => import('./features/cart/cart.routes').then(m => m.cartRoutes),
        title: 'Shopping Cart - GoShopping'
      },
      {
        path: 'checkout',
        loadChildren: () => import('./features/checkout/checkout.routes').then(m => m.checkoutRoutes),
        title: 'Checkout - GoShopping'
      },
      {
        path: 'order-confirmation',
        loadChildren: () => import('./features/order-confirmation/order-confirmation.routes').then(m => m.orderConfirmationRoutes),
        title: 'Order Confirmation - GoShopping'
      },
      {
        path: 'profile/orders',
        loadComponent: () => import('./features/order-history/order-history.component').then(m => m.OrderHistoryComponent),
        canActivate: [AuthGuard],
        title: 'Order History - GoShopping'
      }
    ]
  }
];
