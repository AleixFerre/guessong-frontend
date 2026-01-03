import { Component, input, output, signal } from '@angular/core';
import { LibraryTrack, RoundEndPayload } from '../../../models';
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
  readonly buzzCountdownSec = input.required<number | null>();
  readonly buzzOwnerName = input<string | null>(null);
  readonly isBuzzOwner = input<boolean>(false);
  readonly roundResult = input.required<RoundEndPayload | null>();
  readonly notifications = input.required<string[]>();
  readonly audioUnavailable = input.required<boolean>();

  readonly buzzRequest = output<void>();
  readonly guessRequest = output<string>();

  readonly guessText = signal('');

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

  sendGuess() {
    const text = this.guessText().trim();
    if (!this.canGuess() || !text || !this.isGuessAllowed() || !this.hasGuessesLeft()) {
      return;
    }
    this.guessRequest.emit(text);
    this.guessText.set('');
  }

  hasGuessesLeft() {
    const maxGuesses = this.maxGuessesPerRound();
    if (maxGuesses <= 0) {
      return true;
    }
    const remaining = this.remainingGuesses();
    return remaining === null ? true : remaining > 0;
  }

  isGuessAllowed() {
    const normalized = this.normalizeGuess(this.guessText());
    const tracks = this.guessTracks();
    if (!normalized || !tracks.length) {
      return false;
    }
    return tracks.some((track) => {
      const title = this.normalizeGuess(track.title);
      if (!title) {
        return false;
      }
      if (normalized === title) {
        return true;
      }
      const artist = this.normalizeGuess(track.artist);
      if (!artist) {
        return false;
      }
      return normalized === `${artist} - ${title}` || normalized === `${title} - ${artist}`;
    });
  }

  private normalizeGuess(value: string) {
    return value.trim().toLowerCase();
  }
}
