import { Injectable, signal } from '@angular/core';

export type ToastType = 'error' | 'success' | 'info';

export type ToastItem = {
  id: number;
  message: string;
  type: ToastType;
};

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 0;
  readonly toasts = signal<ToastItem[]>([]);

  show(message: string, type: ToastType = 'info', durationMs = 3000) {
    const id = (this.nextId += 1);
    const toast: ToastItem = { id, message, type };
    this.toasts.update((items) => [...items, toast].slice(-3));
    window.setTimeout(() => this.dismiss(id), durationMs);
  }

  dismiss(id: number) {
    this.toasts.update((items) => items.filter((toast) => toast.id !== id));
  }
}
