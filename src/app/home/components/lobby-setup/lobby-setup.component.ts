import { Component, WritableSignal, computed, effect, input, output, signal } from '@angular/core';
import { LibraryInfo, PublicLobbyInfo } from '../../../models';

type PresetKey = 'beginner' | 'intermediate' | 'hard' | 'custom';

interface PresetValues {
  requireBuzzToGuess: boolean;
  roundDuration: number;
  totalRounds: number;
  maxGuessesPerRound: number;
  guessOptionsLimit: number;
  lockoutSeconds: number;
  responseSeconds: number;
  penalty: number;
}

const PRESETS: Record<Exclude<PresetKey, 'custom'>, PresetValues> = {
  beginner: {
    requireBuzzToGuess: false,
    roundDuration: 30,
    totalRounds: 5,
    maxGuessesPerRound: 0,
    guessOptionsLimit: 4,
    lockoutSeconds: 2,
    responseSeconds: 15,
    penalty: 0,
  },
  intermediate: {
    requireBuzzToGuess: false,
    roundDuration: 20,
    totalRounds: 6,
    maxGuessesPerRound: 3,
    guessOptionsLimit: 5,
    lockoutSeconds: 2,
    responseSeconds: 10,
    penalty: 10,
  },
  hard: {
    requireBuzzToGuess: false,
    roundDuration: 12,
    totalRounds: 7,
    maxGuessesPerRound: 2,
    guessOptionsLimit: 6,
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
  private static readonly REFRESH_COOLDOWN_MS = 3000;
  private refreshCooldownTimeoutId?: number;
  private refreshCooldownIntervalId?: number;
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
  readonly guessOptionsLimit = input.required<WritableSignal<number>>();
  readonly requireBuzzToGuess = input.required<WritableSignal<boolean>>();
  readonly lockoutSeconds = input.required<WritableSignal<number>>();
  readonly responseSeconds = input.required<WritableSignal<number>>();
  readonly isPublicLobby = input.required<WritableSignal<boolean>>();
  readonly publicLobbies = input<PublicLobbyInfo[]>([]);
  readonly publicLobbiesLoading = input<boolean>(false);
  readonly showPublicLobbies = input<boolean>(false);
  readonly createPassword = input.required<WritableSignal<string>>();
  readonly joinPassword = input.required<WritableSignal<string>>();
  readonly joinRequiresPassword = input<boolean>(false);
  readonly canSave = input<boolean>(true);
  readonly entryMode = input.required<'create' | 'join' | 'edit'>();

  readonly createLobbyRequest = output<void>();
  readonly joinLobbyRequest = output<void>();
  readonly updateLobbyRequest = output<void>();
  readonly togglePublicLobbiesRequest = output<void>();
  readonly refreshPublicLobbiesRequest = output<void>();
  readonly joinPublicLobbyRequest = output<string>();

  readonly selectedPreset = signal<PresetKey>('beginner');
  readonly refreshCooldownActive = signal(false);
  readonly lastRefreshAtMs = signal<number | null>(null);
  readonly refreshCooldownRemainingSec = signal(0);
  readonly refreshButtonLabel = computed(() =>
    this.refreshCooldownActive() && this.refreshCooldownRemainingSec() > 0
      ? `Actualizar (${this.refreshCooldownRemainingSec()}s)`
      : 'Actualizar',
  );
  readonly isCustomPreset = computed(() => this.selectedPreset() === 'custom');
  readonly presetSummary = computed(() => [
    { label: 'Requiere PULSA', value: this.requireBuzzToGuess()() ? 'Si' : 'No' },
    { label: 'Rondas', value: String(this.totalRounds()()) },
    { label: 'Duración de ronda', value: `${this.roundDuration()()}s` },
    {
      label: 'Intentos por ronda',
      value: this.maxGuessesPerRound()() === 0 ? 'Infinito' : String(this.maxGuessesPerRound()()),
    },
    { label: 'Opciones por ronda', value: String(this.guessOptionsLimit()()) },
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

  private readonly presetSync = effect(() => {
    const mode = this.entryMode();
    if (mode !== 'create' && mode !== 'edit') {
      return;
    }
    const resolved = this.resolvePresetKey();
    if (this.selectedPreset() === 'custom' && resolved !== 'custom') {
      return;
    }
    if (this.selectedPreset() !== resolved) {
      this.selectedPreset.set(resolved);
    }
  });

  selectPreset(preset: PresetKey) {
    this.selectedPreset.set(preset);
    if (preset === 'custom') {
      return;
    }
    const values = PRESETS[preset];
    const trackCount = this.selectedLibraryInfo()?.trackCount ?? 0;
    const resolvedGuessOptionsLimit =
      values.guessOptionsLimit > 0 ? values.guessOptionsLimit : trackCount;
    this.roundDuration().set(values.roundDuration);
    this.totalRounds().set(values.totalRounds);
    this.maxGuessesPerRound().set(values.maxGuessesPerRound);
    this.guessOptionsLimit().set(resolvedGuessOptionsLimit);
    this.requireBuzzToGuess().set(values.requireBuzzToGuess);
    this.lockoutSeconds().set(values.lockoutSeconds);
    this.responseSeconds().set(values.responseSeconds);
    this.penalty().set(values.penalty);
  }

  private resolvePresetKey(): PresetKey {
    const roundDuration = this.roundDuration()();
    const totalRounds = this.totalRounds()();
    const maxGuessesPerRound = this.maxGuessesPerRound()();
    const guessOptionsLimit = this.guessOptionsLimit()();
    const requireBuzzToGuess = this.requireBuzzToGuess()();
    const lockoutSeconds = this.lockoutSeconds()();
    const responseSeconds = this.responseSeconds()();
    const penalty = this.penalty()();
    const trackCount = this.selectedLibraryInfo()?.trackCount ?? 0;

    const matchesPreset = (preset: PresetKey) => {
      if (preset === 'custom') {
        return false;
      }
      const values = PRESETS[preset];
      const resolvedGuessOptionsLimit =
        values.guessOptionsLimit > 0 ? values.guessOptionsLimit : trackCount;
      return (
        values.roundDuration === roundDuration &&
        values.totalRounds === totalRounds &&
        values.maxGuessesPerRound === maxGuessesPerRound &&
        resolvedGuessOptionsLimit === guessOptionsLimit &&
        values.requireBuzzToGuess === requireBuzzToGuess &&
        values.lockoutSeconds === lockoutSeconds &&
        values.responseSeconds === responseSeconds &&
        values.penalty === penalty
      );
    };

    if (matchesPreset('beginner')) {
      return 'beginner';
    }
    if (matchesPreset('intermediate')) {
      return 'intermediate';
    }
    if (matchesPreset('hard')) {
      return 'hard';
    }
    return 'custom';
  }

  requestRefreshPublicLobbies() {
    if (this.refreshCooldownActive()) {
      return;
    }
    const now = Date.now();
    const lastRefreshAtMs = this.lastRefreshAtMs();
    if (lastRefreshAtMs && now - lastRefreshAtMs < LobbySetupComponent.REFRESH_COOLDOWN_MS) {
      this.refreshCooldownActive.set(true);
      const remaining = LobbySetupComponent.REFRESH_COOLDOWN_MS - (now - lastRefreshAtMs);
      this.startRefreshCooldown(remaining);
      return;
    }
    this.lastRefreshAtMs.set(now);
    this.refreshPublicLobbiesRequest.emit();
  }

  private startRefreshCooldown(remainingMs: number) {
    if (this.refreshCooldownTimeoutId) {
      window.clearTimeout(this.refreshCooldownTimeoutId);
    }
    if (this.refreshCooldownIntervalId) {
      window.clearInterval(this.refreshCooldownIntervalId);
    }
    this.refreshCooldownRemainingSec.set(Math.max(1, Math.ceil(remainingMs / 1000)));
    this.refreshCooldownIntervalId = window.setInterval(() => {
      this.refreshCooldownRemainingSec.update((value) => Math.max(0, value - 1));
    }, 1000);
    this.refreshCooldownTimeoutId = window.setTimeout(() => {
      this.refreshCooldownActive.set(false);
      this.refreshCooldownRemainingSec.set(0);
      if (this.refreshCooldownIntervalId) {
        window.clearInterval(this.refreshCooldownIntervalId);
        this.refreshCooldownIntervalId = undefined;
      }
      this.refreshCooldownTimeoutId = undefined;
    }, remainingMs);
  }
}
