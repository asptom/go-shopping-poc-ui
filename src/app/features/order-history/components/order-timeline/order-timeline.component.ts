import { input, computed, Component, ChangeDetectionStrategy } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { StatusHistoryEntry } from '../../../../models/order';

@Component({
  selector: 'app-order-timeline',
  imports: [TitleCasePipe],
  templateUrl: './order-timeline.component.html',
  styleUrls: ['./order-timeline.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderTimelineComponent {
  readonly entries = input.required<StatusHistoryEntry[]>();
  readonly currentStatus = input.required<string>();

  readonly sortedEntries = computed(() => {
    const entries = this.entries();
    return [...entries].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  });

  formatDate(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  isCurrentStatus(status: string): boolean {
    return status.toLowerCase() === this.currentStatus().toLowerCase();
  }

  getStatusClass(status: string): string {
    const s = status.toLowerCase();
    const classes: Record<string, string> = {
      'created': 'status-created',
      'confirmed': 'status-confirmed',
      'processing': 'status-processing',
      'shipped': 'status-shipped',
      'delivered': 'status-delivered',
      'cancelled': 'status-cancelled',
      'refunded': 'status-refunded'
    };
    return classes[s] || 'status-default';
  }
}