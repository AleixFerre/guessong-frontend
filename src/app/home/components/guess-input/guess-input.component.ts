import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  ViewChild,
  computed,
  effect,
  inject,
  input,
  output,
} from '@angular/core';
import { LibraryTrack } from '../../../models';

type GuessOption = {
  label: string;
  normalized: string;
  score: number | null;
  index: number;
};

@Component({
  selector: 'app-guess-input',
  standalone: true,
  templateUrl: './guess-input.component.html',
  styleUrl: './guess-input.component.scss',
})
export class GuessInputComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  @ViewChild('guessInput')
  private inputEl?: ElementRef<HTMLInputElement>;

  readonly tracks = input.required<LibraryTrack[]>();
  readonly value = input.required<string>();
  readonly placeholder = input<string>('Escribe tu respuesta');
  readonly disabled = input<boolean>(false);
  readonly autoFocus = input<boolean>(false);
  readonly valueChange = output<string>();

  readonly filteredOptions = computed(() => {
    const query = this.normalizeValue(this.value());
    const options = this.tracks().map((track, index) => {
      const label = this.formatGuessOption(track);
      const normalized = this.normalizeValue(label);
      const score = query ? this.fuzzyScore(query, normalized) : 0;
      return { label, normalized, score, index } satisfies GuessOption;
    });

    if (!query) {
      return options.map((option) => option.label);
    }

    return options
      .filter((option) => option.score !== null)
      .sort((a, b) => {
        if (a.score === b.score) {
          return a.index - b.index;
        }
        return (b.score ?? 0) - (a.score ?? 0);
      })
      .map((option) => option.label);
  });

  onInput(event: Event) {
    const target = event.target as HTMLInputElement | null;
    this.valueChange.emit(target?.value ?? '');
  }

  selectOption(option: string) {
    this.valueChange.emit(option);
  }

  clearInput() {
    this.valueChange.emit('');
    const input = this.inputEl?.nativeElement;
    if (input) {
      queueMicrotask(() => input.focus());
    }
  }

  private formatGuessOption(track: LibraryTrack) {
    const artist = track.artist.trim();
    return artist ? `${artist} - ${track.title}` : track.title;
  }

  private normalizeValue(value: string) {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '');
  }

  private fuzzyScore(query: string, candidate: string) {
    let score = 0;
    let lastIndex = -1;

    for (const char of query) {
      const matchIndex = candidate.indexOf(char, lastIndex + 1);
      if (matchIndex === -1) {
        return null;
      }
      const gap = matchIndex - lastIndex - 1;
      score += Math.max(1, 5 - gap);
      lastIndex = matchIndex;
    }

    return score;
  }

  ngAfterViewInit() {
    const focusEffect = effect(
      () => {
        if (!this.autoFocus() || this.disabled()) {
          return;
        }
        const input = this.inputEl?.nativeElement;
        if (!input || document.activeElement === input) {
          return;
        }
        queueMicrotask(() => input.focus());
      },
      { injector: this.injector },
    );

    this.destroyRef.onDestroy(() => focusEffect.destroy());
  }
}
