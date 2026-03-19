import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';


@Component({
  selector: 'app-error-state',
  imports: [],
  template: `
    <div class="error-state">
      <div class="icon">⚠️</div>
      <h2>Something went wrong</h2>
      <p>{{ message || 'Unable to load products. Please try again.' }}</p>
      <button class="btn-retry" (click)="retry.emit()">
        Try Again
      </button>
    </div>
  `,
  styles: [`
    .error-state {
      text-align: center;
      padding: 60px 20px;
      
      .icon {
        font-size: 48px;
        margin-bottom: 16px;
      }
      
      h2 {
        font-size: 24px;
        font-weight: 600;
        color: #131921;
        margin-bottom: 12px;
      }
      
      p {
        color: #565959;
        font-size: 16px;
        margin-bottom: 24px;
      }
      
      .btn-retry {
        padding: 12px 24px;
        background: #ff9900;
        color: #131921;
        border: none;
        border-radius: 4px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        
        &:hover {
          background: #e88a00;
        }
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErrorStateComponent {
  readonly message = input<string | null>(null);
  readonly retry = output<void>();
}
