import { Component, inject } from '@angular/core';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-toast-host',
  standalone: true,
  templateUrl: './toast-host.component.html',
  styleUrl: './toast-host.component.scss',
})
export class ToastHostComponent {
  private readonly toast = inject(ToastService);
  readonly toasts = this.toast.toasts;

  dismiss(id: number) {
    this.toast.dismiss(id);
  }
}
