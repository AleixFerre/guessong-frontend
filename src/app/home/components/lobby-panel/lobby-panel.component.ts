import { Component, computed, inject, input, output } from '@angular/core';
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
  readonly activeBuzzPlayerId = input<string | null>(null);
  readonly maxGuessesPerRound = input<number | null>(null);
  readonly guessCounts = input<Record<string, number>>({});
  readonly showScore = input<boolean>(true);
  readonly showLockout = input<boolean>(true);
  readonly showTries = input<boolean>(true);
  readonly showRanks = input<boolean>(true);
  readonly showCopyLink = input<boolean>(false);
  readonly hasGuessLimit = computed(() => {
    const maxGuesses = this.maxGuessesPerRound();
    return maxGuesses !== null && maxGuesses > 0;
  });

  readonly startGameRequest = output<void>();
  readonly copyLinkRequest = output<void>();

  readonly sortedPlayers = computed(() => {
    const players = this.playersOverride() ?? this.lobby()?.players ?? [];
    return [...players].sort((a, b) => b.score - a.score);
  });

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

  remainingGuesses(player: Player) {
    const maxGuesses = this.maxGuessesPerRound();
    if (maxGuesses === null || maxGuesses <= 0) {
      return null;
    }
    const used = this.guessCounts()[player.id] ?? 0;
    return Math.max(0, maxGuesses - used);
  }

  guessLimitLabel(player: Player) {
    const maxGuesses = this.maxGuessesPerRound();
    if (maxGuesses === null || maxGuesses <= 0) {
      return '∞';
    }
    const remaining = this.remainingGuesses(player);
    const safeRemaining = remaining === null ? maxGuesses : remaining;
    return `${safeRemaining}/${maxGuesses}`;
  }
}
