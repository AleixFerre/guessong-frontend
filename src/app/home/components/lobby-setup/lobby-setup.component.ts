import { Component, WritableSignal, computed, effect, input, output, signal } from '@angular/core';
import { BaseMode, GAME_MODES, resolveBaseMode } from '../../../game-modes';
import { LibraryInfo, LobbyMode, PublicLobbyInfo } from '../../../models';
import { LobbyNameGenerator, createLobbyNameGenerator } from '../../../nicknames.model';

type PresetKey = 'beginner' | 'intermediate' | 'hard' | 'custom';

const DEFAULT_CLIP_SECONDS = 2;

const TOOLTIP_TEXTS = {
  rounds: 'Número total de rondas de la partida.',
  roundDuration: 'Tiempo total que dura cada ronda.',
  clipSeconds: 'Duración del fragmento reproducido en el modo de clip.',
  maxGuesses: 'Máximo de intentos por jugador en cada ronda.',
  guessOptions: 'Cantidad de canciones disponibles para elegir en cada ronda.',
  lockout: 'Tiempo que un jugador queda bloqueado tras fallar o pulsar antes de tiempo.',
  responseTime: 'Tiempo que tiene el jugador para responder tras pulsar el timbre.',
  penalty: 'Porcentaje de puntos que se resta al fallar.',
} as const;

interface PresetValues {
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
    roundDuration: 30,
    totalRounds: 5,
    maxGuessesPerRound: 0,
    guessOptionsLimit: 4,
    lockoutSeconds: 2,
    responseSeconds: 15,
    penalty: 0,
  },
  intermediate: {
    roundDuration: 20,
    totalRounds: 6,
    maxGuessesPerRound: 3,
    guessOptionsLimit: 5,
    lockoutSeconds: 2,
    responseSeconds: 10,
    penalty: 10,
  },
  hard: {
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
  readonly lobbyName = input.required<WritableSignal<string>>();
  readonly joinLobbyId = input.required<WritableSignal<string>>();
  readonly library = input.required<WritableSignal<string>>();
  readonly mode = input.required<WritableSignal<LobbyMode>>();
  readonly roundDuration = input.required<WritableSignal<number>>();
  readonly clipSeconds = input.required<WritableSignal<number>>();
  readonly penalty = input.required<WritableSignal<number>>();
  readonly maxPlayers = input.required<WritableSignal<number>>();
  readonly totalRounds = input.required<WritableSignal<number>>();
  readonly maxGuessesPerRound = input.required<WritableSignal<number>>();
  readonly guessOptionsLimit = input.required<WritableSignal<number>>();
  readonly lockoutSeconds = input.required<WritableSignal<number>>();
  readonly responseSeconds = input.required<WritableSignal<number>>();
  readonly isPublicLobby = input.required<WritableSignal<boolean>>();
  readonly publicLobbies = input<PublicLobbyInfo[]>([]);
  readonly publicLobbiesLoading = input<boolean>(false);
  readonly showPublicLobbies = input<boolean>(false);
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
  readonly lobbyNameRolling = signal(false);
  readonly lobbyNamePending = signal<string | null>(null);
  readonly lobbyNameRevealed = signal(false);
  private lobbyNameRevealTimeoutId?: number;
  readonly lastRefreshAtMs = signal<number | null>(null);
  readonly refreshCooldownRemainingSec = signal(0);
  readonly refreshButtonLabel = computed(() =>
    this.refreshCooldownActive() && this.refreshCooldownRemainingSec() > 0
      ? `Actualizar (${this.refreshCooldownRemainingSec()}s)`
      : 'Actualizar',
  );
  readonly availableModes = GAME_MODES;
  readonly selectedMode = computed(() => resolveBaseMode(this.mode()()));
  readonly selectedModeInfo = computed(
    () => this.availableModes.find((mode) => mode.id === this.selectedMode()) ?? null,
  );
  readonly isMidClipMode = computed(() => this.selectedMode() === 'MID_CLIP');
  readonly isCustomPreset = computed(() => this.selectedPreset() === 'custom');
  readonly presetSummary = computed(() => [
    {
      label: 'Rondas',
      tooltip: TOOLTIP_TEXTS.rounds,
      value: String(this.totalRounds()()),
    },
    {
      label: 'Duración de ronda',
      tooltip: TOOLTIP_TEXTS.roundDuration,
      value: `${this.roundDuration()()}s`,
    },
    {
      label: 'Intentos por ronda',
      tooltip: TOOLTIP_TEXTS.maxGuesses,
      value: this.maxGuessesPerRound()() === 0 ? 'Infinito' : String(this.maxGuessesPerRound()()),
    },
    {
      label: 'Opciones por ronda',
      tooltip: TOOLTIP_TEXTS.guessOptions,
      value: String(this.guessOptionsLimit()()),
    },
    {
      label: 'Tiempo de bloqueo',
      tooltip: TOOLTIP_TEXTS.lockout,
      value: this.lockoutSeconds()() === 0 ? 'Sin bloqueo' : `${this.lockoutSeconds()()}s`,
    },
    {
      label: 'Tiempo para responder',
      tooltip: TOOLTIP_TEXTS.responseTime,
      value: this.responseSeconds()() === 0 ? 'Sin límite' : `${this.responseSeconds()()}s`,
    },
    {
      label: 'Penalización por fallo',
      tooltip: TOOLTIP_TEXTS.penalty,
      value: `${this.penalty()()}%`,
    },
  ]);

  private lobbyNameGenerator: LobbyNameGenerator | null = null;

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

  private readonly clipPresetSync = effect(() => {
    if (this.selectedMode() !== 'MID_CLIP' || this.selectedPreset() === 'custom') {
      return;
    }
    if (this.clipSeconds()() !== DEFAULT_CLIP_SECONDS) {
      this.clipSeconds().set(DEFAULT_CLIP_SECONDS);
    }
  });

  private readonly lobbyNameInit = effect(() => {
    const mode = this.entryMode();
    if (mode !== 'create') {
      return;
    }
    if (!this.lobbyNameGenerator) {
      this.lobbyNameGenerator = createLobbyNameGenerator(10, 18);
    }
    const lobbyNameSignal = this.lobbyName();
    if (!lobbyNameSignal().trim()) {
      lobbyNameSignal.set(this.lobbyNameGenerator.next());
    }
  });

  tooltipText(key: keyof typeof TOOLTIP_TEXTS) {
    return TOOLTIP_TEXTS[key];
  }

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
    this.lockoutSeconds().set(values.lockoutSeconds);
    this.responseSeconds().set(values.responseSeconds);
    this.penalty().set(values.penalty);
    if (this.selectedMode() === 'MID_CLIP') {
      this.clipSeconds().set(DEFAULT_CLIP_SECONDS);
    }
  }

  setRandomLobbyName() {
    if (!this.lobbyNameGenerator) {
      this.lobbyNameGenerator = createLobbyNameGenerator(10, 18);
    }
    this.lobbyNamePending.set(this.lobbyNameGenerator.next());
    this.triggerLobbyNameRoll();
  }

  finishLobbyNameRoll() {
    this.lobbyNameRolling.set(false);
  }

  finishLobbyNameReveal() {
    this.lobbyNameRevealed.set(false);
  }

  private resolvePresetKey(): PresetKey {
    const roundDuration = this.roundDuration()();
    const totalRounds = this.totalRounds()();
    const maxGuessesPerRound = this.maxGuessesPerRound()();
    const guessOptionsLimit = this.guessOptionsLimit()();
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

  private triggerLobbyNameRoll() {
    if (this.lobbyNameRolling()) {
      this.lobbyNameRolling.set(false);
      requestAnimationFrame(() => this.lobbyNameRolling.set(true));
      this.scheduleLobbyNameReveal();
      return;
    }
    this.lobbyNameRolling.set(true);
    this.scheduleLobbyNameReveal();
  }

  private triggerLobbyNameReveal() {
    if (this.lobbyNameRevealed()) {
      this.lobbyNameRevealed.set(false);
      requestAnimationFrame(() => this.lobbyNameRevealed.set(true));
      return;
    }
    this.lobbyNameRevealed.set(true);
  }

  private scheduleLobbyNameReveal() {
    if (this.lobbyNameRevealTimeoutId) {
      window.clearTimeout(this.lobbyNameRevealTimeoutId);
    }
    this.lobbyNameRevealTimeoutId = window.setTimeout(() => {
      const pending = this.lobbyNamePending();
      if (pending) {
        this.lobbyName().set(pending);
        this.lobbyNamePending.set(null);
      }
      this.triggerLobbyNameReveal();
      this.lobbyNameRevealTimeoutId = undefined;
    }, 300);
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

  selectMode(mode: BaseMode) {
    this.mode().set(mode as LobbyMode);
    if (mode === 'MID_CLIP' && !this.isCustomPreset()) {
      this.clipSeconds().set(DEFAULT_CLIP_SECONDS);
    } else if (mode === 'MID_CLIP' && this.clipSeconds()() <= 0) {
      this.clipSeconds().set(DEFAULT_CLIP_SECONDS);
    }
  }
}
