import { Routes } from '@angular/router';
import { Layout } from './layout/layout';
import { Home } from './home/home';

export const routes: Routes = [
  {
    path: '',
    component: Layout,
    children: [
      { path: '', redirectTo: '/home', pathMatch: 'full' },
      { path: 'home', component: Home },
      // Add other feature routes here
    ]
  }
];
