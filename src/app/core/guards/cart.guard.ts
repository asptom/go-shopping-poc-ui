import { Injectable, inject } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { CartStore } from '../../store/cart/cart.store';

/**
 * Cart Guard
 * Prevents access to checkout if cart is empty
 */
@Injectable({
  providedIn: 'root'
})
export class CartGuard implements CanActivate {
  private readonly cartStore = inject(CartStore);
  private readonly router = inject(Router);

  canActivate(): boolean {
    if (this.cartStore.isEmpty()) {
      this.router.navigate(['/cart']);
      return false;
    }
    return true;
  }
}
