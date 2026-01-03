import { Component, inject, input, output, signal } from '@angular/core';
import { LobbySnapshot } from '../../../models';
import { ToastService } from '../../../services/toast.service';

@Component({
  selector: 'app-home-hero',
  standalone: true,
  templateUrl: './hero.component.html',
  styleUrls: ['../../home.shared.scss', './hero.component.scss'],
})
export class HeroComponent {
  private readonly toast = inject(ToastService);
  readonly lobby = input.required<LobbySnapshot | null>();
  readonly wsStatus = input.required<string>();
  readonly pingMs = input.required<number | null>();
  readonly leave = output<void>();
  readonly volume = input.required<number>();
  readonly volumeChange = output<number>();
  readonly copied = signal(false);

  formatStatus(status: string) {
    switch (status) {
      case 'connected':
        return 'Conectado';
      case 'connecting':
        return 'Conectando';
      case 'disconnected':
        return 'Desconectado';
      default:
        return status;
    }
  }

  formatPing(pingMs: number | null) {
    if (pingMs === null || Number.isNaN(pingMs)) {
      return '-- ms';
    }
    return `${pingMs} ms`;
  }

  formatMode(mode: LobbySnapshot['settings']['mode']) {
    switch (mode) {
      case 'BUZZ':
        return 'Timbre';
      case 'WRITE':
        return 'Escribir';
      case 'ONE_SECOND':
        return '1s';
      default:
        return mode;
    }
  }

  async copyLobbyCode(code: string) {
    if (!code) {
      return;
    }
    try {
      await navigator.clipboard.writeText(code);
      this.copied.set(true);
      window.setTimeout(() => this.copied.set(false), 1500);
      this.toast.show('Codigo copiado', 'success');
    } catch {
      this.toast.show('No se pudo copiar el codigo', 'error');
    }
  }

  onVolumeInput(event: Event) {
    const target = event.target as HTMLInputElement | null;
    const value = target ? Number(target.value) : 0;
    if (!Number.isNaN(value)) {
      this.volumeChange.emit(value);
    }
  }
}
