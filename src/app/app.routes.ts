import { Routes } from '@angular/router';
import { Layout } from './layout/layout';
import { AuthGuard } from './auth/auth.guard';

export const routes: Routes = [
  {
    path: '',
    component: Layout,
    children: [
      { path: '', redirectTo: '/home', pathMatch: 'full' },
      { 
        path: 'home', 
        loadComponent: () => import('./features/home/home.component').then(m => m.Home),
        title: 'Home - GoShopping'
      },
      { 
        path: 'profile', 
        loadComponent: () => import('./features/profile/profile.component').then(m => m.ProfileComponent),
        canActivate: [AuthGuard],
        title: 'Profile - GoShopping'
      },
      // Add other feature routes here
    ]
  }
];
