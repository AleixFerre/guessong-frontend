import { Component, inject, input, output } from '@angular/core';
import { LobbySnapshot, Player } from '../../../models';
import { WsService } from '../../../services/ws.service';

@Component({
  selector: 'app-lobby-panel',
  standalone: true,
  templateUrl: './lobby-panel.component.html',
  styleUrls: ['../../home.shared.scss', './lobby-panel.component.scss'],
})
export class LobbyPanelComponent {
  private readonly ws = inject(WsService);
  private lockoutDurationCache = new Map<string, { until: number; value: string }>();

  readonly lobby = input.required<LobbySnapshot | null>();
  readonly isHost = input.required<boolean>();
  readonly playersOverride = input<Player[] | null>(null);
  readonly showActions = input<boolean>(true);
  readonly currentPlayerId = input<string | null>(null);

  readonly startGameRequest = output<void>();

  playersToShow() {
    return this.playersOverride() ?? this.lobby()?.players ?? [];
  }

  lockoutDuration(player: Player) {
    const until = player.lockedUntilMs;
    if (!until) {
      this.lockoutDurationCache.delete(player.id);
      return '0ms';
    }

    const cached = this.lockoutDurationCache.get(player.id);
    if (cached && cached.until === until) {
      return cached.value;
    }

    const now = Date.now() + this.ws.serverOffsetMs();
    const remaining = Math.max(0, until - now);
    const value = `${Math.round(remaining)}ms`;
    this.lockoutDurationCache.set(player.id, { until, value });
    return value;
  }
}
