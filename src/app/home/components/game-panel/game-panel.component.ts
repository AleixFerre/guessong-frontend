import { Component, input, output, signal } from '@angular/core';
import { LibraryTrack, RoundEndPayload } from '../../../models';

type RoundStatus = 'IDLE' | 'PLAYING' | 'PAUSED' | 'ENDED';

@Component({
  selector: 'app-game-panel',
  standalone: true,
  templateUrl: './game-panel.component.html',
  styleUrls: ['../../home.shared.scss', './game-panel.component.scss'],
})
export class GamePanelComponent {
  readonly progressPercent = input.required<number>();
  readonly roundDurationSec = input.required<number>();
  readonly elapsedSeconds = input.required<number>();
  readonly roundStatus = input.required<RoundStatus>();
  readonly canBuzz = input.required<boolean>();
  readonly canGuess = input.required<boolean>();
  readonly guessTracks = input.required<LibraryTrack[]>();
  readonly roundResult = input.required<RoundEndPayload | null>();
  readonly notifications = input.required<string[]>();

  readonly buzzRequest = output<void>();
  readonly skipRequest = output<void>();
  readonly guessRequest = output<string>();

  readonly guessText = signal('');
  readonly guessListId = 'guess-options';

  formatTime(seconds: number) {
    const safe = Math.max(0, Math.ceil(seconds));
    return `${safe}s`;
  }

  sendGuess() {
    const text = this.guessText().trim();
    if (!text || !this.isGuessAllowed()) {
      return;
    }
    this.guessRequest.emit(text);
    this.guessText.set('');
  }

  formatGuessOption(track: LibraryTrack) {
    const artist = track.artist.trim();
    return artist ? `${track.title} - ${artist}` : track.title;
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
      return artist ? normalized === `${title} - ${artist}` : false;
    });
  }

  private normalizeGuess(value: string) {
    return value.trim().toLowerCase();
  }
}
