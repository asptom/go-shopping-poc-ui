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
   * Check if item is in pending validation state
   */
  get isPendingValidation(): boolean {
    return this.item.status === 'pending_validation';
  }

  /**
   * Check if item is on backorder
   */
  get isBackorder(): boolean {
    return this.item.status === 'backorder';
  }

  /**
   * Check if item is confirmed
   */
  get isConfirmed(): boolean {
    const status = this.item.status as string;
    return status === 'confirmed' || status === 'validated';
  }

  /**
   * Get display status text
   */
  get statusText(): string {
    const status = this.item.status as string;
    switch (status) {
      case 'pending_validation':
        return 'Validating...';
      case 'backorder':
        return 'Backorder';
      case 'confirmed':
      case 'validated':
        return 'Available';
      default:
        return '';
    }
  }

  /**
   * Get CSS class for status badge
   */
  get statusClass(): string {
    const status = this.item.status as string;
    switch (status) {
      case 'pending_validation':
        return 'status-pending';
      case 'backorder':
        return 'status-backorder';
      case 'confirmed':
      case 'validated':
        return 'status-confirmed';
      default:
        return '';
    }
  }

  /**
   * Check if quantity controls should be disabled
   */
  get isQuantityControlsDisabled(): boolean {
    return this.isPendingValidation || this.isBackorder;
  }

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
    if (this.item.quantity < 99 && !this.isQuantityControlsDisabled) {
      this.updateQuantity.emit(this.item.quantity + 1);
    }
  }

  /**
   * Decrements the quantity
   */
  decrementQuantity(): void {
    if (this.item.quantity > 1 && !this.isQuantityControlsDisabled) {
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
