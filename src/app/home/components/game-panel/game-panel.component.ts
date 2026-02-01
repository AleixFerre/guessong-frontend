import { Component, input, output } from '@angular/core';
import { LibraryId, LibraryTrack, LobbyMode, RoundEndPayload } from '../../../models';
import { GuessInputComponent } from '../guess-input/guess-input.component';

type RoundStatus = 'IDLE' | 'PLAYING' | 'PAUSED' | 'ENDED';

@Component({
  selector: 'app-game-panel',
  standalone: true,
  templateUrl: './game-panel.component.html',
  styleUrls: ['../../home.shared.scss', './game-panel.component.scss'],
  imports: [GuessInputComponent],
})
export class GamePanelComponent {
  readonly progressPercent = input.required<number>();
  readonly roundDurationSec = input.required<number>();
  readonly elapsedSeconds = input.required<number>();
  readonly roundStatus = input.required<RoundStatus>();
  readonly currentRound = input.required<number>();
  readonly totalRounds = input.required<number>();
  readonly canBuzz = input.required<boolean>();
  readonly canGuess = input.required<boolean>();
  readonly remainingGuesses = input<number | null>(null);
  readonly maxGuessesPerRound = input<number>(0);
  readonly guessTracks = input.required<LibraryTrack[]>();
  readonly mode = input.required<LobbyMode>();
  readonly libraryId = input<LibraryId | ''>('');
  readonly buzzCountdownSec = input.required<number | null>();
  readonly buzzOwnerName = input<string | null>(null);
  readonly isBuzzOwner = input<boolean>(false);
  readonly requireBuzzToGuess = input<boolean>(true);
  readonly canReplayClip = input<boolean>(false);
  readonly clipDuration = input<number>(0);
  readonly roundResult = input.required<RoundEndPayload | null>();
  readonly winnerName = input<string | null>(null);
  readonly isWinner = input<boolean>(false);
  readonly notifications = input.required<string[]>();
  readonly audioUnavailable = input.required<boolean>();

  readonly buzzRequest = output<void>();
  readonly replayClipRequest = output<void>();
  readonly guessRequest = output<string>();

  formatTime(seconds: number) {
    const safe = Math.max(0, Math.ceil(seconds));
    return `${safe}s`;
  }

  formatRoundStatus(status: RoundStatus) {
    switch (status) {
      case 'IDLE':
        return 'En espera';
      case 'PLAYING':
        return 'Reproduciendo';
      case 'PAUSED':
        return 'En pausa';
      case 'ENDED':
        return 'Finalizada';
      default:
        return status;
    }
  }

  hasGuessesLeft() {
    const maxGuesses = this.maxGuessesPerRound();
    if (maxGuesses <= 0) {
      return true;
    }
    const remaining = this.remainingGuesses();
    return remaining === null ? true : remaining > 0;
  }

  onGuessSelect(option: string) {
    if (!this.canGuess() || !this.hasGuessesLeft()) {
      return;
    }
    this.guessRequest.emit(option);
  }

  clipLabel() {
    const duration = this.clipDuration();
    return duration > 0 ? `Repetir clip (${duration}s)` : 'Repetir clip';
  }
}
