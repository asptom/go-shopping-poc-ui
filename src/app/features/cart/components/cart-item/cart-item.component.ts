import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CartItem } from '../../../../models/cart';
import { ProductService } from '../../../../services/product.service';

/**
 * Cart Item Component
 * Displays individual cart item with quantity controls and remove option
 */
@Component({
  selector: 'app-cart-item',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './cart-item.component.html',
  styleUrls: ['./cart-item.component.scss']
})
export class CartItemComponent {
  @Input() item!: CartItem;
  @Input() currency: string = 'USD';
  @Output() updateQuantity = new EventEmitter<number>();
  @Output() remove = new EventEmitter<void>();

  private productService = inject(ProductService);

  /**
   * Handles quantity input change
   * @param event The input change event
   */
  onQuantityChange(event: Event): void {
    const quantity = parseInt((event.target as HTMLInputElement).value, 10);
    if (!isNaN(quantity) && quantity >= 1 && quantity <= 99) {
      this.updateQuantity.emit(quantity);
    }
  }

  /**
   * Increments the quantity
   */
  incrementQuantity(): void {
    if (this.item.quantity < 99) {
      this.updateQuantity.emit(this.item.quantity + 1);
    }
  }

  /**
   * Decrements the quantity
   */
  decrementQuantity(): void {
    if (this.item.quantity > 1) {
      this.updateQuantity.emit(this.item.quantity - 1);
    }
  }

  /**
   * Emits remove event
   */
  onRemove(): void {
    this.remove.emit();
  }
}
