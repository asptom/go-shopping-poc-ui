import { CurrencyPipe } from '@angular/common';
import { Component, inject, input, output, ChangeDetectionStrategy } from '@angular/core';
import { CartItem } from '../../../../models/cart';
import { ProductService } from '../../../../services/product.service';

@Component({
  selector: 'app-cart-item',
  imports: [CurrencyPipe],
  templateUrl: './cart-item.component.html',
  styleUrls: ['./cart-item.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartItemComponent {
  readonly item = input.required<CartItem>();
  readonly currency = input<string>('USD');
  readonly updateQuantity = output<number>();
  readonly remove = output<void>();

  private readonly productService = inject(ProductService);

  get isPendingValidation(): boolean {
    return this.item().status === 'pending_validation';
  }

  get isBackorder(): boolean {
    return this.item().status === 'backorder';
  }

  get isConfirmed(): boolean {
    const status = this.item().status as string;
    return status === 'confirmed' || status === 'validated';
  }

  get statusText(): string {
    const status = this.item().status as string;
    switch (status) {
      case 'pending_validation': return 'Validating...';
      case 'backorder': return 'Backorder';
      case 'confirmed':
      case 'validated': return 'Available';
      default: return '';
    }
  }

  get statusClass(): string {
    const status = this.item().status as string;
    switch (status) {
      case 'pending_validation': return 'status-pending';
      case 'backorder': return 'status-backorder';
      case 'confirmed':
      case 'validated': return 'status-confirmed';
      default: return '';
    }
  }

  get isQuantityControlsDisabled(): boolean {
    return this.isPendingValidation || this.isBackorder;
  }

  onQuantityChange(event: Event): void {
    const quantity = parseInt((event.target as HTMLInputElement).value, 10);
    if (!isNaN(quantity) && quantity >= 1 && quantity <= 99) {
      this.updateQuantity.emit(quantity);
    }
  }

  incrementQuantity(): void {
    if (this.item().quantity < 99 && !this.isQuantityControlsDisabled) {
      this.updateQuantity.emit(this.item().quantity + 1);
    }
  }

  decrementQuantity(): void {
    if (this.item().quantity > 1 && !this.isQuantityControlsDisabled) {
      this.updateQuantity.emit(this.item().quantity - 1);
    }
  }

  onRemove(): void {
    this.remove.emit();
  }
}
