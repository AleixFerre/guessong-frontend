import { Component, WritableSignal, computed, input, output, signal } from '@angular/core';
import { LibraryInfo, PublicLobbyInfo } from '../../../models';

type PresetKey = 'beginner' | 'intermediate' | 'hard' | 'custom';

const PRESETS: Record<
  Exclude<PresetKey, 'custom'>,
  {
    roundDuration: number;
    totalRounds: number;
    maxGuessesPerRound: number;
    lockoutSeconds: number;
    responseSeconds: number;
    penalty: number;
  }
> = {
  beginner: {
    roundDuration: 30,
    totalRounds: 5,
    maxGuessesPerRound: 0,
    lockoutSeconds: 2,
    responseSeconds: 15,
    penalty: 0,
  },
  intermediate: {
    roundDuration: 20,
    totalRounds: 6,
    maxGuessesPerRound: 3,
    lockoutSeconds: 2,
    responseSeconds: 10,
    penalty: 10,
  },
  hard: {
    roundDuration: 12,
    totalRounds: 7,
    maxGuessesPerRound: 2,
    lockoutSeconds: 3,
    responseSeconds: 5,
    penalty: 20,
  },
};

@Component({
  selector: 'app-lobby-setup',
  standalone: true,
  templateUrl: './lobby-setup.component.html',
  styleUrls: ['../../home.shared.scss', './lobby-setup.component.scss'],
})
export class LobbySetupComponent {
  readonly libraries = input.required<LibraryInfo[]>();
  readonly selectedLibraryInfo = input.required<LibraryInfo | null>();
  readonly username = input.required<WritableSignal<string>>();
  readonly lobbyName = input.required<WritableSignal<string>>();
  readonly joinLobbyId = input.required<WritableSignal<string>>();
  readonly library = input.required<WritableSignal<string>>();
  readonly roundDuration = input.required<WritableSignal<number>>();
  readonly penalty = input.required<WritableSignal<number>>();
  readonly maxPlayers = input.required<WritableSignal<number>>();
  readonly totalRounds = input.required<WritableSignal<number>>();
  readonly maxGuessesPerRound = input.required<WritableSignal<number>>();
  readonly lockoutSeconds = input.required<WritableSignal<number>>();
  readonly responseSeconds = input.required<WritableSignal<number>>();
  readonly isPublicLobby = input.required<WritableSignal<boolean>>();
  readonly publicLobbies = input<PublicLobbyInfo[]>([]);
  readonly publicLobbiesLoading = input<boolean>(false);
  readonly showPublicLobbies = input<boolean>(false);
  readonly createPassword = input.required<WritableSignal<string>>();
  readonly joinPassword = input.required<WritableSignal<string>>();
  readonly canSave = input<boolean>(true);
  readonly entryMode = input.required<'create' | 'join' | 'edit'>();

  readonly createLobbyRequest = output<void>();
  readonly joinLobbyRequest = output<void>();
  readonly updateLobbyRequest = output<void>();
  readonly togglePublicLobbiesRequest = output<void>();
  readonly refreshPublicLobbiesRequest = output<void>();
  readonly joinPublicLobbyRequest = output<string>();

  readonly selectedPreset = signal<PresetKey>('beginner');
  readonly isCustomPreset = computed(() => this.selectedPreset() === 'custom');
  readonly presetSummary = computed(() => [
    { label: 'Rondas', value: String(this.totalRounds()()) },
    { label: 'Duración de ronda', value: `${this.roundDuration()()}s` },
    {
      label: 'Intentos por ronda',
      value: this.maxGuessesPerRound()() === 0 ? 'Infinito' : String(this.maxGuessesPerRound()()),
    },
    {
      label: 'Tiempo de bloqueo',
      value: this.lockoutSeconds()() === 0 ? 'Sin bloqueo' : `${this.lockoutSeconds()()}s`,
    },
    {
      label: 'Tiempo para responder',
      value: this.responseSeconds()() === 0 ? 'Sin límite' : `${this.responseSeconds()()}s`,
    },
    { label: 'Penalización por fallo', value: `${this.penalty()()}%` },
  ]);

  selectPreset(preset: PresetKey) {
    this.selectedPreset.set(preset);
    if (preset === 'custom') {
      return;
    }
    const values = PRESETS[preset];
    this.roundDuration().set(values.roundDuration);
    this.totalRounds().set(values.totalRounds);
    this.maxGuessesPerRound().set(values.maxGuessesPerRound);
    this.lockoutSeconds().set(values.lockoutSeconds);
    this.responseSeconds().set(values.responseSeconds);
    this.penalty().set(values.penalty);
  }
}
