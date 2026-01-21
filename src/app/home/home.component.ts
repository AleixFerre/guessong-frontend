import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import confetti from '@hiseb/confetti';
import { firstValueFrom } from 'rxjs';
import config from '../config.json';
import {
  AVATAR_CREDIT,
  AVATAR_OPTIONS,
  BEGINNER_LOCKOUT_SECONDS,
  BEGINNER_MAX_GUESSES_PER_ROUND,
  BEGINNER_PENALTY,
  BEGINNER_RESPONSE_SECONDS,
  BEGINNER_ROUND_DURATION,
  BEGINNER_TOTAL_ROUNDS,
  BuzzAcceptedPayload,
  BuzzTimeoutPayload,
  DEFAULT_GUESSES_PER_ROUND,
  DEFAULT_LOCKOUT_SECONDS,
  DEFAULT_RESPONSE_SECONDS,
  EarlyBuzzPayload,
  GuessResultPayload,
  LibraryId,
  LibraryInfo,
  LibraryTrack,
  LobbySnapshot,
  MAX_GUESSES_PER_ROUND,
  MAX_LOCKOUT_SECONDS,
  MAX_PLAYERS,
  MAX_RESPONSE_SECONDS,
  MAX_ROUND_DURATION_SEC,
  NEXT_ROUND_DELAY_SEC,
  PausePayload,
  PlayPayload,
  PublicLobbyInfo,
  RoundEndPayload,
  RoundStartPayload,
} from '../models';
import { NicknameGenerator, createNicknameGenerator } from '../nicknames.model';
import { ApiService } from '../services/api.service';
import { AudioService } from '../services/audio.service';
import { ToastService } from '../services/toast.service';
import { WsService } from '../services/ws.service';
import { GamePanelComponent } from './components/game-panel/game-panel.component';
import { HeroComponent } from './components/hero/hero.component';
import { LobbyPanelComponent } from './components/lobby-panel/lobby-panel.component';
import { LobbySetupComponent } from './components/lobby-setup/lobby-setup.component';

const DISSOLVE_COUNTDOWN_SEC = 10;

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [GamePanelComponent, HeroComponent, LobbyPanelComponent, LobbySetupComponent],
  templateUrl: './home.component.html',
  styleUrls: ['./home.shared.scss', './home.component.scss'],
})
export class HomeComponent {
  private readonly api = inject(ApiService);
  readonly ws = inject(WsService);
  private readonly audio = inject(AudioService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private libraryTracksRequestId = 0;
  private lastLoadedLibraryId: LibraryId | null = null;

  readonly libraries = signal<LibraryInfo[]>([]);
  readonly username = signal('');
  readonly lobbyName = signal('');
  readonly joinLobbyId = signal('');
  readonly library = signal<LibraryId | ''>('');
  readonly roundDuration = signal(BEGINNER_ROUND_DURATION);
  readonly penalty = signal(BEGINNER_PENALTY);
  readonly maxPlayers = signal(8);
  readonly totalRoundsInput = signal(BEGINNER_TOTAL_ROUNDS);
  readonly maxGuessesPerRound = signal(BEGINNER_MAX_GUESSES_PER_ROUND);
  readonly guessOptionsLimit = signal(4);
  readonly requireBuzzToGuess = signal(false);
  readonly lockoutSeconds = signal(BEGINNER_LOCKOUT_SECONDS);
  readonly responseSeconds = signal(BEGINNER_RESPONSE_SECONDS);
  readonly isPublicLobby = signal(true);
  readonly entryMode = signal<'create' | 'join' | null>(null);
  readonly showPublicLobbies = signal(false);
  avatarOptions = [...AVATAR_OPTIONS];
  readonly avatarCredit = AVATAR_CREDIT;
  readonly selectedAvatar = signal(this.avatarOptions[0]);

  readonly lobby = signal<LobbySnapshot | null>(null);
  readonly playerId = signal<string | null>(null);
  readonly libraryTracks = signal<LibraryTrack[]>([]);
  readonly libraryTracksLoading = signal(false);
  readonly roundGuessOptions = signal<LibraryTrack[] | null>(null);
  readonly excludedGuessOptions = signal<string[]>([]);
  readonly guessCounts = signal<Record<string, number>>({});
  readonly roundStatus = signal<'IDLE' | 'PLAYING' | 'PAUSED' | 'ENDED'>('IDLE');
  readonly roundStartAt = signal<number | null>(null);
  readonly roundDurationSec = signal(30);
  readonly clipDuration = signal(0);
  readonly pausedOffsetSeconds = signal<number | null>(null);
  readonly buzzDeadlineAt = signal<number | null>(null);
  readonly buzzCountdownSec = signal<number | null>(null);
  readonly elapsedSeconds = signal(0);
  readonly activeBuzzPlayerId = signal<string | null>(null);
  readonly roundResult = signal<RoundEndPayload | null>(null);
  readonly nextRoundCountdownSec = signal<number | null>(null);
  readonly notifications = signal<string[]>([]);
  readonly nextRoundProgress = computed(() => {
    const remaining = this.nextRoundCountdownSec();
    if (remaining === null) {
      return null;
    }
    if (!NEXT_ROUND_DELAY_SEC) {
      return 0;
    }
    return Math.max(
      0,
      Math.min(100, ((NEXT_ROUND_DELAY_SEC - remaining) / NEXT_ROUND_DELAY_SEC) * 100),
    );
  });
  readonly settingsBaseline = signal<{
    name: string;
    library: LibraryId | '';
    roundDuration: number;
    penalty: number;
    maxPlayers: number;
    totalRounds: number;
    maxGuessesPerRound: number;
    guessOptionsLimit: number;
    requireBuzzToGuess: boolean;
    lockoutSeconds: number;
    responseSeconds: number;
    isPublic: boolean;
  } | null>(null);
  readonly volume = signal(Math.round(this.audio.getVolume() * 100));
  readonly audioUnavailable = signal(false);
  readonly dissolveCountdown = signal(0);
  readonly dissolveCountdownDisplay = computed(() =>
    Math.max(0, Math.ceil(this.dissolveCountdown())),
  );
  readonly dissolveProgress = computed(() => {
    const remaining = this.dissolveCountdown();
    if (!DISSOLVE_COUNTDOWN_SEC) {
      return 0;
    }
    return Math.max(
      0,
      Math.min(100, ((DISSOLVE_COUNTDOWN_SEC - remaining) / DISSOLVE_COUNTDOWN_SEC) * 100),
    );
  });
  readonly showResultModal = signal(false);
  readonly showFinalOverlay = signal(false);
  readonly rematchRequested = signal(false);
  readonly publicLobbies = signal<PublicLobbyInfo[]>([]);
  readonly publicLobbiesLoading = signal(false);
  private dissolveIntervalId?: number;
  private dissolveTimeoutId?: number;
  private dissolveStartAtMs: number | null = null;
  private lastRoundCelebrated: number | null = null;
  private finalCelebrated = false;
  private lastPauseAtServerTs: number | null = null;
  private roundEndAtServerTs: number | null = null;
  private readonly init = this.setup();
  private nicknameGenerator: NicknameGenerator | null = null;
  readonly viewState = computed(() => {
    const lobby = this.lobby();
    if (!lobby) {
      return 'MENU';
    }
    if (lobby.state === 'IN_GAME') {
      return 'IN_GAME';
    }
    if (lobby.state === 'FINISHED') {
      return 'FINISHED';
    }
    return 'WAITING';
  });
  readonly canSaveLobbySettings = computed(() => {
    const lobby = this.lobby();
    if (!lobby || lobby.state !== 'WAITING' || lobby.hostId !== this.playerId()) {
      return false;
    }
    const baseline = this.settingsBaseline();
    if (!baseline) {
      return false;
    }
    const current = this.buildSettingsSnapshotFromSignals();
    return !this.isSameSettings(baseline, current);
  });
  readonly sortedPlayers = computed(() => {
    const players = this.lobby()?.players ?? [];
    return [...players].sort((a, b) => b.score - a.score);
  });
  readonly currentRound = computed(() => this.lobby()?.currentRound ?? 0);
  readonly totalRoundsDisplay = computed(() => this.lobby()?.settings.totalRounds ?? 0);
  readonly remainingGuesses = computed(() => {
    const maxGuesses = this.maxGuessesPerRound();
    if (maxGuesses <= 0) {
      return null;
    }
    const playerId = this.playerId();
    if (!playerId) {
      return maxGuesses;
    }
    const used = this.guessCounts()[playerId] ?? 0;
    return Math.max(0, maxGuesses - used);
  });
  readonly roundGuessTracks = computed(() => {
    const excluded = new Set(this.excludedGuessOptions());
    const options = this.roundGuessOptions() ?? this.libraryTracks();
    return options.filter((track) => {
      const label = this.formatGuessOption(track);
      const normalized = this.normalizeGuessOption(label);
      return normalized ? !excluded.has(normalized) : true;
    });
  });
  readonly roundWinnerName = computed(() => {
    const winnerId = this.roundResult()?.winnerId;
    if (!winnerId) {
      return null;
    }
    return this.lobby()?.players.find((player) => player.id === winnerId)?.username ?? null;
  });
  readonly roundWinnerPlayer = computed(() => {
    const winnerId = this.roundResult()?.winnerId;
    if (!winnerId) {
      return null;
    }
    return this.lobby()?.players.find((player) => player.id === winnerId) ?? null;
  });
  readonly isRoundWinner = computed(() => {
    const winnerId = this.roundResult()?.winnerId;
    if (!winnerId) {
      return false;
    }
    return winnerId === this.playerId();
  });
  readonly activeBuzzPlayerName = computed(() => {
    const playerId = this.activeBuzzPlayerId();
    if (!playerId) {
      return null;
    }
    return this.lobby()?.players.find((player) => player.id === playerId)?.username ?? null;
  });

  readonly selectedLibraryInfo = computed(
    () => this.libraries().find((lib) => lib.id === this.library()) ?? null,
  );
  readonly activeLibraryId = computed<LibraryId | ''>(
    () => this.lobby()?.settings.library ?? this.library(),
  );

  readonly isHost = computed(() => !!this.lobby() && this.lobby()?.hostId === this.playerId());
  readonly currentPlayer = computed(
    () => this.lobby()?.players.find((player) => player.id === this.playerId()) ?? null,
  );
  readonly canBuzz = computed(() => {
    const lobby = this.lobby();
    const player = this.currentPlayer();
    if (!lobby || !player || !this.requireBuzzToGuess()) {
      return false;
    }
    const maxGuesses = this.maxGuessesPerRound();
    const remaining = this.remainingGuesses();
    const hasGuessesLeft = maxGuesses <= 0 || remaining === null || remaining > 0;
    return this.roundStatus() === 'PLAYING' && !player.lockedForRound && hasGuessesLeft;
  });

  readonly canGuess = computed(() => {
    const lobby = this.lobby();
    const status = this.roundStatus();
    if (!lobby || (status !== 'PLAYING' && status !== 'PAUSED')) {
      return false;
    }
    if (this.requireBuzzToGuess()) {
      return this.activeBuzzPlayerId() === this.playerId();
    }
    const player = this.currentPlayer();
    if (!player) {
      return false;
    }
    const maxGuesses = this.maxGuessesPerRound();
    const remaining = this.remainingGuesses();
    const hasGuessesLeft = maxGuesses <= 0 || remaining === null || remaining > 0;
    return this.roundStatus() === 'PLAYING' && !player.lockedForRound && hasGuessesLeft;
  });

  readonly progressPercent = computed(() => {
    const duration = this.roundDurationSec();
    if (!duration) {
      return 0;
    }
    const elapsed = Math.min(duration, this.elapsedSeconds());
    return Math.min(100, Math.max(0, (elapsed / duration) * 100));
  });

  private setup() {
    this.applyLobbyLinkFromUrl();
    this.shuffleAvatars();
    this.nicknameGenerator = createNicknameGenerator(5, 200);
    if (!this.username().trim()) {
      this.setRandomUsername();
    }
    this.ws.messages$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((message) => {
      this.handleWsMessage(message.type, message.payload);
    });

    effect(() => {
      const entryMode = this.entryMode();
      if (!entryMode || this.libraries().length) {
        return;
      }
      untracked(() => {
        void this.loadLibraries();
      });
    });

    effect(() => {
      const lobby = this.lobby();
      if (!lobby || this.libraries().length) {
        return;
      }
      untracked(() => {
        void this.loadLibraries();
      });
    });

    effect(() => {
      const libraryId = this.activeLibraryId();
      const viewState = this.viewState();
      if (!libraryId || (viewState !== 'IN_GAME' && viewState !== 'FINISHED')) {
        this.libraryTracks.set([]);
        this.libraryTracksLoading.set(false);
        return;
      }
      if (this.libraryTracksLoading()) {
        return;
      }
      if (this.lastLoadedLibraryId === libraryId && this.libraryTracks().length) {
        return;
      }
      untracked(() => {
        void this.loadLibraryTracks(libraryId);
      });
    });

    effect(() => {
      this.audio.setVolume(this.volume() / 100);
    });

    effect(() => {
      const duration = this.roundDuration();
      if (duration > MAX_ROUND_DURATION_SEC) {
        this.roundDuration.set(MAX_ROUND_DURATION_SEC);
      } else if (duration < 5) {
        this.roundDuration.set(5);
      }

      const players = this.maxPlayers();
      if (players > MAX_PLAYERS) {
        this.maxPlayers.set(MAX_PLAYERS);
      } else if (players < 2) {
        this.maxPlayers.set(2);
      }

      const maxGuesses = this.maxGuessesPerRound();
      if (maxGuesses > MAX_GUESSES_PER_ROUND) {
        this.maxGuessesPerRound.set(MAX_GUESSES_PER_ROUND);
      } else if (maxGuesses < 0) {
        this.maxGuessesPerRound.set(0);
      }

      const lockoutSeconds = this.lockoutSeconds();
      if (lockoutSeconds > MAX_LOCKOUT_SECONDS) {
        this.lockoutSeconds.set(MAX_LOCKOUT_SECONDS);
      } else if (lockoutSeconds < 0) {
        this.lockoutSeconds.set(0);
      }

      const responseSeconds = this.responseSeconds();
      if (responseSeconds > MAX_RESPONSE_SECONDS) {
        this.responseSeconds.set(MAX_RESPONSE_SECONDS);
      } else if (responseSeconds < 0) {
        this.responseSeconds.set(0);
      }
    });

    effect(() => {
      const info = this.selectedLibraryInfo();
      if (!info) {
        return;
      }
      const maxRounds = Math.max(1, info.trackCount);
      const rounds = this.totalRoundsInput();
      if (rounds > maxRounds) {
        this.totalRoundsInput.set(maxRounds);
      } else if (rounds < 1) {
        this.totalRoundsInput.set(1);
      }
      const maxOptions = Math.max(2, info.trackCount);
      const optionsLimit = this.guessOptionsLimit();
      if (optionsLimit > maxOptions || optionsLimit <= 0) {
        this.guessOptionsLimit.set(maxOptions);
      } else if (optionsLimit < 2) {
        this.guessOptionsLimit.set(2);
      }
    });

    effect(() => {
      const lobby = this.lobby();
      if (!lobby || lobby.state !== 'FINISHED') {
        this.clearDissolveCountdown();
        this.showFinalOverlay.set(false);
        this.rematchRequested.set(false);
        return;
      }
      if (!this.showFinalOverlay()) {
        this.clearDissolveCountdown();
        return;
      }
      if (!this.dissolveTimeoutId) {
        this.startDissolveCountdown();
      }
    });

    effect(() => {
      const roundResult = this.roundResult();
      const currentRound = this.lobby()?.currentRound ?? null;
      if (!roundResult || !this.showResultModal() || !this.isRoundWinner()) {
        return;
      }
      if (currentRound === null || this.lastRoundCelebrated === currentRound) {
        return;
      }
      this.lastRoundCelebrated = currentRound;
      this.launchConfetti('round');
    });

    effect(() => {
      const showFinal = this.showFinalOverlay() && this.viewState() === 'FINISHED';
      if (!showFinal) {
        this.finalCelebrated = false;
        return;
      }
      const topPlayerId = this.sortedPlayers()[0]?.id ?? null;
      if (!topPlayerId || topPlayerId !== this.playerId() || this.finalCelebrated) {
        return;
      }
      this.finalCelebrated = true;
      this.launchConfetti('final');
    });

    const interval = window.setInterval(() => this.tickElapsed(), 50);
    this.destroyRef.onDestroy(() => window.clearInterval(interval));
    this.destroyRef.onDestroy(() => this.clearDissolveCountdown());
  }

  async createLobby() {
    const username = this.username().trim();
    const lobbyName = this.lobbyName().trim();
    if (!username) {
      this.toast.show('Elige un nombre primero.', 'error');
      return;
    }
    if (!lobbyName) {
      this.toast.show('Elige un nombre para la sala.', 'error');
      return;
    }
    const library = this.library();
    if (!library) {
      this.toast.show('Selecciona una biblioteca primero.', 'error');
      return;
    }

    try {
      const response = await firstValueFrom(
        this.api.createLobby({
          username,
          name: lobbyName,
          avatar: this.selectedAvatar() || undefined,
          isPublic: this.isPublicLobby(),
          mode: 'BUZZ',
          library,
          roundDuration: this.roundDuration(),
          penalty: this.penalty(),
          maxPlayers: this.maxPlayers(),
          totalRounds: this.totalRoundsInput(),
          maxGuessesPerRound: this.maxGuessesPerRound(),
          guessOptionsLimit: this.guessOptionsLimit(),
          requireBuzzToGuess: this.requireBuzzToGuess(),
          lockoutSeconds: this.lockoutSeconds(),
          responseSeconds: this.responseSeconds(),
        }),
      );
      window.scrollTo({ top: 0, behavior: 'smooth' });
      this.handleLobbyResponse(response);
    } catch (_error) {
      this.toast.show('No se pudo crear la sala.', 'error');
    }
  }

  async joinLobby() {
    const username = this.username().trim();
    const lobbyId = this.joinLobbyId().trim();
    if (!username) {
      this.toast.show('Se requiere nombre.', 'error');
      return;
    }
    if (!lobbyId) {
      this.toast.show('Se requiere código de sala.', 'error');
      return;
    }

    try {
      const response = await firstValueFrom(
        this.api.joinLobby(lobbyId, username, this.selectedAvatar() || undefined),
      );
      this.handleLobbyResponse(response);
    } catch (error) {
      const serverMessage =
        typeof (error as { error?: { error?: string } })?.error?.error === 'string'
          ? (error as { error?: { error?: string } }).error?.error
          : '';
      if (serverMessage === 'Lobby not found') {
        this.toast.show('La sala no existe', 'error');
        return;
      }
      this.toast.show('No se pudo unir a la sala.', 'error');
    }
  }

  startGame() {
    this.ws.send('START_GAME', {});
  }

  sendBuzz() {
    this.ws.send('BUZZ', {});
  }

  sendGuess(guessText: string) {
    const text = guessText.trim();
    if (!text) {
      return;
    }
    this.ws.send('GUESS', { guessText: text });
  }

  requestRematch() {
    if (this.rematchRequested()) {
      return;
    }
    this.rematchRequested.set(true);
    this.ws.send('REMATCH', {});
  }

  confirmLeaveLobby() {
    if (!this.lobby()) {
      return;
    }
    const confirmed = window.confirm('¿Seguro que quieres salir de la sala?');
    if (!confirmed) {
      return;
    }
    this.leaveLobby();
  }

  updateLobbySettings() {
    const lobby = this.lobby();
    if (!lobby || lobby.state !== 'WAITING' || lobby.hostId !== this.playerId()) {
      return;
    }
    const lobbyName = this.lobbyName().trim();
    const isPublic = this.isPublicLobby();
    if (!lobbyName) {
      this.toast.show('El nombre de la sala es obligatorio.', 'error');
      return;
    }
    const library = this.library();
    if (!library) {
      this.toast.show('Selecciona una biblioteca primero.', 'error');
      return;
    }
    this.ws.send('UPDATE_SETTINGS', {
      name: lobbyName,
      isPublic,
      library,
      roundDuration: this.roundDuration(),
      penalty: this.penalty(),
      maxPlayers: this.maxPlayers(),
      totalRounds: this.totalRoundsInput(),
      maxGuessesPerRound: this.maxGuessesPerRound(),
      guessOptionsLimit: this.guessOptionsLimit(),
      requireBuzzToGuess: this.requireBuzzToGuess(),
      lockoutSeconds: this.lockoutSeconds(),
      responseSeconds: this.responseSeconds(),
    });
    this.toast.show('Configuración actualizada', 'success');
  }

  leaveLobby() {
    this.ws.disconnect();
    this.audio.stop();
    this.lobby.set(null);
    this.playerId.set(null);
    this.roundResult.set(null);
    this.showResultModal.set(false);
    this.roundGuessOptions.set(null);
    this.notifications.set([]);
    this.roundStatus.set('IDLE');
    this.activeBuzzPlayerId.set(null);
    this.entryMode.set(null);
    this.audioUnavailable.set(false);
    this.libraryTracksLoading.set(false);
    this.excludedGuessOptions.set([]);
    this.guessCounts.set({});
    this.clearDissolveCountdown();
    this.rematchRequested.set(false);
    this.settingsBaseline.set(null);
    this.lastRoundCelebrated = null;
    this.finalCelebrated = false;
  }

  private startDissolveCountdown() {
    this.clearDissolveCountdown();
    this.dissolveStartAtMs = Date.now();
    this.dissolveCountdown.set(DISSOLVE_COUNTDOWN_SEC);
    this.dissolveIntervalId = window.setInterval(() => {
      if (this.dissolveStartAtMs === null) {
        return;
      }
      const elapsedMs = Date.now() - this.dissolveStartAtMs;
      const remainingMs = Math.max(0, DISSOLVE_COUNTDOWN_SEC * 1000 - elapsedMs);
      this.dissolveCountdown.set(remainingMs / 1000);
    }, 50);
    this.dissolveTimeoutId = window.setTimeout(
      () => this.clearDissolveCountdown(),
      DISSOLVE_COUNTDOWN_SEC * 1000,
    );
  }

  private clearDissolveCountdown() {
    if (this.dissolveIntervalId) {
      window.clearInterval(this.dissolveIntervalId);
      this.dissolveIntervalId = undefined;
    }
    if (this.dissolveTimeoutId) {
      window.clearTimeout(this.dissolveTimeoutId);
      this.dissolveTimeoutId = undefined;
    }
    this.dissolveStartAtMs = null;
    this.dissolveCountdown.set(0);
  }

  selectEntryMode(mode: 'create' | 'join') {
    this.resetLobbyForm();
    this.entryMode.set(mode);
    if (mode === 'join') {
      this.showPublicLobbies.set(true);
      void this.loadPublicLobbies();
    } else {
      this.showPublicLobbies.set(false);
    }
  }

  resetEntryMode() {
    this.entryMode.set(null);
    this.showPublicLobbies.set(false);
  }

  updateVolume(value: number) {
    this.volume.set(Math.round(value));
  }

  togglePublicLobbies() {
    if (this.showPublicLobbies()) {
      this.showPublicLobbies.set(false);
      return;
    }
    this.showPublicLobbies.set(true);
    void this.loadPublicLobbies();
  }

  async loadPublicLobbies() {
    this.publicLobbiesLoading.set(true);
    try {
      const lobbies = await firstValueFrom(this.api.listPublicLobbies());
      this.publicLobbies.set(lobbies);
    } catch (_error) {
      this.toast.show('No se pudieron cargar las salas públicas.', 'error');
    } finally {
      this.publicLobbiesLoading.set(false);
    }
  }

  joinPublicLobby(lobbyId: string) {
    this.joinLobbyId.set(lobbyId);
    void this.joinLobby();
  }

  async copyLobbyLink() {
    const lobbyId = this.lobby()?.id;
    if (!lobbyId) {
      this.toast.show('No hay sala activa.', 'error');
      return;
    }
    try {
      const baseUrl = `${window.location.origin}${window.location.pathname}`;
      const url = new URL(baseUrl);
      url.searchParams.set('lobby', lobbyId);
      await navigator.clipboard.writeText(url.toString());
      this.toast.show('Link copiado', 'success');
    } catch {
      this.toast.show('No se pudo copiar el link', 'error');
    }
  }

  private async loadLibraries() {
    try {
      const libs = await firstValueFrom(this.api.listLibraries());
      this.libraries.set(libs);
      if (!this.library() && libs.length) {
        this.library.set(libs[0].id);
      }
    } catch (_error) {
      this.toast.show('No se pudieron cargar las bibliotecas.', 'error');
    }
  }

  private async loadLibraryTracks(libraryId: LibraryId) {
    const requestId = (this.libraryTracksRequestId += 1);
    this.libraryTracksLoading.set(true);
    this.libraryTracks.set([]);
    try {
      const tracks = await firstValueFrom(this.api.getLibraryTracks(libraryId));
      if (requestId !== this.libraryTracksRequestId) {
        this.libraryTracksLoading.set(false);
        return;
      }
      this.libraryTracks.set(tracks);
      this.lastLoadedLibraryId = libraryId;
      this.libraryTracksLoading.set(false);
    } catch (_error) {
      if (requestId !== this.libraryTracksRequestId) {
        this.libraryTracksLoading.set(false);
        return;
      }
      this.libraryTracks.set([]);
      this.libraryTracksLoading.set(false);
      this.toast.show('No se pudieron cargar las canciones.', 'error');
    }
  }

  private handleLobbyResponse(response: {
    lobbyId: string;
    playerId: string;
    lobbyState: LobbySnapshot;
  }) {
    this.lobby.set(response.lobbyState);
    this.syncLobbySettings(response.lobbyState);
    this.guessCounts.set({});
    this.playerId.set(response.playerId);
    this.joinLobbyId.set(response.lobbyId);
    this.roundStatus.set('IDLE');
    this.roundResult.set(null);
    this.showResultModal.set(false);
    this.excludedGuessOptions.set([]);
    this.isPublicLobby.set(response.lobbyState.isPublic);
    this.connectSocket(response.lobbyId, response.playerId);
  }

  private connectSocket(lobbyId: string, playerId: string) {
    const baseUrl = config.isProd ? config.BACKEND_URL_PROD : config.BACKEND_URL_LOCAL;
    const wsBaseUrl = baseUrl.replace(/^http/, 'ws');
    const wsUrl = `${wsBaseUrl}/ws`;
    this.ws.connect(wsUrl);
    this.ws.send('JOIN_LOBBY', {
      lobbyId,
      playerId,
      username: this.username().trim(),
    });
  }

  private handleWsMessage(type: string, payload: any) {
    switch (type) {
      case 'LOBBY_UPDATE':
        this.applyLobbyUpdate(payload as LobbySnapshot);
        break;
      case 'ROUND_START':
        this.onRoundStart(payload as RoundStartPayload);
        break;
      case 'PLAY':
        this.onPlay(payload as PlayPayload);
        break;
      case 'PAUSE':
        this.onPause(payload as PausePayload);
        break;
      case 'BUZZ_ACCEPTED':
        this.onBuzzAccepted(payload as BuzzAcceptedPayload);
        break;
      case 'GUESS_RESULT':
        this.onGuessResult(payload as GuessResultPayload);
        break;
      case 'ROUND_END':
        this.onRoundEnd(payload as RoundEndPayload);
        break;
      case 'BUZZ_TIMEOUT':
        this.onBuzzTimeout(payload as BuzzTimeoutPayload);
        break;
      case 'EARLY_BUZZ':
        this.onEarlyBuzz(payload as EarlyBuzzPayload);
        break;
      case 'ERROR':
        this.toast.show(payload?.message ?? 'Error inesperado del servidor.', 'error');
        break;
      case 'LOBBY_DISSOLVED':
        this.leaveLobby();
        this.toast.show(
          payload?.reason === 'REMATCH' ? 'No entraste en la revancha.' : 'La sala se disolvió.',
          'info',
        );
        break;
      default:
        break;
    }
  }

  private onRoundStart(payload: RoundStartPayload) {
    this.roundResult.set(null);
    this.showResultModal.set(false);
    this.showFinalOverlay.set(false);
    this.notifications.set([]);
    this.excludedGuessOptions.set([]);
    this.guessCounts.set({});
    this.roundStatus.set('PLAYING');
    this.roundStartAt.set(payload.startAtServerTs);
    this.roundDurationSec.set(this.lobby()?.settings.roundDuration ?? 30);
    this.clipDuration.set(payload.clipDuration);
    this.roundGuessOptions.set(payload.guessOptions ?? null);
    this.activeBuzzPlayerId.set(null);
    this.pausedOffsetSeconds.set(null);
    this.buzzDeadlineAt.set(null);
    this.buzzCountdownSec.set(null);
    this.nextRoundCountdownSec.set(null);
    this.audioUnavailable.set(!payload.clipUrl);
    this.audio.loadClip(payload.clipUrl || null, payload.clipDuration);
    this.lastPauseAtServerTs = null;
    this.roundEndAtServerTs = null;
  }

  private onPlay(payload: PlayPayload) {
    if (
      this.roundStatus() === 'PAUSED' &&
      this.lastPauseAtServerTs !== null &&
      payload.startAtServerTs < this.lastPauseAtServerTs
    ) {
      return;
    }
    this.roundStatus.set('PLAYING');
    this.pausedOffsetSeconds.set(null);
    this.activeBuzzPlayerId.set(null);
    this.buzzDeadlineAt.set(null);
    this.buzzCountdownSec.set(null);
    this.lastPauseAtServerTs = null;
    if (payload.startAtServerTs) {
      const seekSeconds = payload.seekToSeconds ?? 0;
      this.roundStartAt.set(payload.startAtServerTs - seekSeconds * 1000);
    }
    this.audio.schedulePlay(
      payload.startAtServerTs,
      this.ws.serverOffsetMs(),
      payload.seekToSeconds ?? 0,
    );
  }

  private onPause(payload: PausePayload) {
    this.roundStatus.set('PAUSED');
    this.pausedOffsetSeconds.set(payload.offsetSeconds);
    this.buzzDeadlineAt.set(payload.responseDeadlineServerTs ?? null);
    this.audio.pauseAt(payload.offsetSeconds);
    this.lastPauseAtServerTs = Date.now() + this.ws.serverOffsetMs();
  }

  private onBuzzAccepted(payload: BuzzAcceptedPayload) {
    this.activeBuzzPlayerId.set(payload.playerId);
  }

  private onGuessResult(payload: GuessResultPayload) {
    if (!payload.correct) {
      const player = this.lobby()?.players.find((p) => p.id === payload.playerId);
      const guessText = payload.guessText?.trim();
      if (guessText) {
        const normalized = this.normalizeGuessOption(guessText);
        if (normalized) {
          const excluded = this.excludedGuessOptions();
          if (!excluded.includes(normalized)) {
            this.excludedGuessOptions.set([...excluded, normalized]);
          }
        }
      }
      const guessLabel = guessText ? `: ${guessText}` : '';
      this.addNotice(`${player?.username ?? 'Jugador'} fallo la respuesta${guessLabel}.`);
    }
    this.incrementGuessCount(payload.playerId);
  }

  private onBuzzTimeout(payload: BuzzTimeoutPayload) {
    const player = this.lobby()?.players.find((p) => p.id === payload.playerId);
    this.addNotice(`${player?.username ?? 'Jugador'} se quedo sin tiempo.`);
  }

  private onEarlyBuzz(payload: EarlyBuzzPayload) {
    const player = this.lobby()?.players.find((p) => p.id === payload.playerId);
    this.addNotice(`${player?.username ?? 'Jugador'} pulso antes de empezar.`);
  }

  private onRoundEnd(payload: RoundEndPayload) {
    this.roundStatus.set('ENDED');
    this.roundResult.set(payload);
    this.showResultModal.set(true);
    this.showFinalOverlay.set(false);
    if (payload.winnerId) {
      this.incrementGuessCount(payload.winnerId);
    }
    this.activeBuzzPlayerId.set(null);
    this.buzzDeadlineAt.set(null);
    this.buzzCountdownSec.set(null);
    this.pausedOffsetSeconds.set(null);
    this.audioUnavailable.set(false);
    this.audio.replay();
    this.lastPauseAtServerTs = null;
    this.roundEndAtServerTs = Date.now() + this.ws.serverOffsetMs();
  }

  private tickElapsed() {
    if (this.roundStatus() === 'ENDED') {
      const nowServer = Date.now() + this.ws.serverOffsetMs();
      if (this.lobby()?.state !== 'FINISHED') {
        const roundEndAt = this.roundEndAtServerTs;
        if (roundEndAt) {
          const remaining = Math.max(0, NEXT_ROUND_DELAY_SEC - (nowServer - roundEndAt) / 1000);
          this.nextRoundCountdownSec.set(remaining);
        }
      } else if (this.showFinalOverlay()) {
        this.nextRoundCountdownSec.set(null);
      } else {
        const roundEndAt = this.roundEndAtServerTs;
        if (roundEndAt) {
          const remaining = Math.max(0, NEXT_ROUND_DELAY_SEC - (nowServer - roundEndAt) / 1000);
          this.nextRoundCountdownSec.set(remaining);
          if (remaining <= 0) {
            this.showFinalClassification();
          }
        }
      }
      this.buzzCountdownSec.set(null);
      return;
    }

    const startAt = this.roundStartAt();
    const duration = this.roundDurationSec();
    if (!startAt || !duration) {
      this.elapsedSeconds.set(0);
      this.buzzCountdownSec.set(null);
      this.nextRoundCountdownSec.set(null);
      return;
    }

    const pausedOffset = this.pausedOffsetSeconds();
    if (pausedOffset !== null) {
      this.elapsedSeconds.set(Math.min(duration, pausedOffset));
      const deadlineAt = this.buzzDeadlineAt();
      if (deadlineAt) {
        const nowServer = Date.now() + this.ws.serverOffsetMs();
        const remaining = Math.max(0, (deadlineAt - nowServer) / 1000);
        this.buzzCountdownSec.set(remaining);
      } else {
        this.buzzCountdownSec.set(null);
      }
      return;
    }

    const nowServer = Date.now() + this.ws.serverOffsetMs();
    const elapsed = Math.max(0, (nowServer - startAt) / 1000);
    this.elapsedSeconds.set(Math.min(duration, elapsed));
    this.buzzCountdownSec.set(null);
    this.nextRoundCountdownSec.set(null);
  }

  private addNotice(message: string) {
    const next = [...this.notifications().slice(-3), message];
    this.notifications.set(next);
  }

  private launchConfetti(kind: 'round' | 'final') {
    const isFinal = kind === 'final';
    const count = isFinal ? 160 : 90;
    const size = isFinal ? 1.2 : 0.9;
    const velocity = isFinal ? 260 : 200;
    const position = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    confetti({ position, count, size, velocity, fade: true });
    if (isFinal) {
      window.setTimeout(() => {
        confetti({
          position,
          count: Math.round(count * 0.7),
          size,
          velocity: velocity * 0.9,
          fade: true,
        });
      }, 180);
    }
  }

  private incrementGuessCount(playerId: string) {
    if (!playerId) {
      return;
    }
    this.guessCounts.update((counts) => ({
      ...counts,
      [playerId]: (counts[playerId] ?? 0) + 1,
    }));
  }

  private applyLobbyUpdate(nextLobby: LobbySnapshot) {
    const prevLobby = this.lobby();
    if (
      prevLobby?.state === 'FINISHED' &&
      nextLobby.state === 'WAITING' &&
      nextLobby.currentRound === 0
    ) {
      const resetPlayers = nextLobby.players.map((player) => ({
        ...player,
        score: 0,
        lockedForRound: false,
        lockedUntilMs: null,
      }));
      const updatedLobby = { ...nextLobby, players: resetPlayers };
      this.lobby.set(updatedLobby);
      this.syncLobbySettings(updatedLobby);
      this.resetRoundState();
      this.guessCounts.set({});
      return;
    }
    if (nextLobby.state === 'WAITING') {
      this.resetRoundState();
      this.guessCounts.set({});
    }
    this.lobby.set(nextLobby);
    this.syncLobbySettings(nextLobby);
  }

  private syncLobbySettings(lobby: LobbySnapshot) {
    if (lobby.state !== 'WAITING' && lobby.state !== 'IN_GAME' && lobby.state !== 'FINISHED') {
      return;
    }
    const isEditingHost = lobby.state === 'WAITING' && lobby.hostId === this.playerId();
    const baseline = this.settingsBaseline();
    if (isEditingHost && baseline) {
      const current = this.buildSettingsSnapshotFromSignals();
      const serverSnapshot = this.buildSettingsSnapshotFromLobby(lobby);
      const serverMatchesBaseline = this.isSameSettings(serverSnapshot, baseline);
      const hasLocalChanges = !this.isSameSettings(current, baseline);
      // Keep local edits when the server hasn't acknowledged any changes yet.
      if (serverMatchesBaseline && hasLocalChanges) {
        return;
      }
    }
    this.lobbyName.set(lobby.name);
    this.library.set(lobby.settings.library);
    this.roundDuration.set(lobby.settings.roundDuration);
    this.penalty.set(lobby.settings.penalty);
    this.maxPlayers.set(lobby.settings.maxPlayers);
    this.totalRoundsInput.set(lobby.settings.totalRounds);
    this.maxGuessesPerRound.set(lobby.settings.maxGuessesPerRound ?? DEFAULT_GUESSES_PER_ROUND);
    this.guessOptionsLimit.set(lobby.settings.guessOptionsLimit);
    this.requireBuzzToGuess.set(lobby.settings.requireBuzzToGuess);
    this.lockoutSeconds.set(lobby.settings.lockoutSeconds ?? DEFAULT_LOCKOUT_SECONDS);
    this.responseSeconds.set(lobby.settings.responseSeconds ?? DEFAULT_RESPONSE_SECONDS);
    this.isPublicLobby.set(lobby.isPublic);
    if (lobby.state === 'WAITING') {
      this.settingsBaseline.set(this.buildSettingsSnapshotFromLobby(lobby));
    }
  }

  private resetLobbyForm() {
    this.lobbyName.set('');
    this.joinLobbyId.set('');
    const firstLibrary = this.libraries()[0]?.id ?? '';
    this.library.set(firstLibrary);
    this.roundDuration.set(BEGINNER_ROUND_DURATION);
    this.penalty.set(BEGINNER_PENALTY);
    this.maxPlayers.set(8);
    this.totalRoundsInput.set(BEGINNER_TOTAL_ROUNDS);
    this.maxGuessesPerRound.set(BEGINNER_MAX_GUESSES_PER_ROUND);
    this.guessOptionsLimit.set(4);
    this.requireBuzzToGuess.set(false);
    this.lockoutSeconds.set(BEGINNER_LOCKOUT_SECONDS);
    this.responseSeconds.set(BEGINNER_RESPONSE_SECONDS);
    this.isPublicLobby.set(true);
    this.settingsBaseline.set(null);
  }

  private resetRoundState() {
    this.roundResult.set(null);
    this.showResultModal.set(false);
    this.showFinalOverlay.set(false);
    this.roundStatus.set('IDLE');
    this.roundStartAt.set(null);
    this.pausedOffsetSeconds.set(null);
    this.buzzDeadlineAt.set(null);
    this.buzzCountdownSec.set(null);
    this.nextRoundCountdownSec.set(null);
    this.activeBuzzPlayerId.set(null);
    this.roundGuessOptions.set(null);
    this.roundEndAtServerTs = null;
    this.audio.stop();
  }

  selectRandomAvatar() {
    if (!this.avatarOptions.length) {
      return;
    }
    const randomIndex = Math.floor(Math.random() * this.avatarOptions.length);
    this.selectedAvatar.set(this.avatarOptions[randomIndex]);
  }

  setRandomUsername() {
    this.username.set(this.generateRandomUsername());
  }

  private shuffleAvatars() {
    const shuffled = [...AVATAR_OPTIONS];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    this.avatarOptions = shuffled;
    this.selectedAvatar.set(shuffled[0] ?? '');
  }

  private generateRandomUsername() {
    if (!this.nicknameGenerator) {
      this.nicknameGenerator = createNicknameGenerator(5, 200);
    }
    return this.nicknameGenerator.next();
  }

  showFinalClassification() {
    if (this.lobby()?.state !== 'FINISHED') {
      return;
    }
    if (this.showFinalOverlay()) {
      return;
    }
    this.showResultModal.set(false);
    this.showFinalOverlay.set(true);
    this.nextRoundCountdownSec.set(null);
    this.ws.send('FINAL_RESULTS_SHOWN', {});
    if (!this.dissolveTimeoutId) {
      this.startDissolveCountdown();
    }
  }

  private buildSettingsSnapshotFromLobby(lobby: LobbySnapshot) {
    return {
      name: lobby.name,
      library: lobby.settings.library,
      roundDuration: lobby.settings.roundDuration,
      penalty: lobby.settings.penalty,
      maxPlayers: lobby.settings.maxPlayers,
      totalRounds: lobby.settings.totalRounds,
      maxGuessesPerRound: lobby.settings.maxGuessesPerRound ?? DEFAULT_GUESSES_PER_ROUND,
      guessOptionsLimit: lobby.settings.guessOptionsLimit,
      requireBuzzToGuess: lobby.settings.requireBuzzToGuess,
      lockoutSeconds: lobby.settings.lockoutSeconds ?? DEFAULT_LOCKOUT_SECONDS,
      responseSeconds: lobby.settings.responseSeconds ?? DEFAULT_RESPONSE_SECONDS,
      isPublic: lobby.isPublic,
    };
  }

  private buildSettingsSnapshotFromSignals() {
    return {
      name: this.lobbyName().trim(),
      library: this.library(),
      roundDuration: this.roundDuration(),
      penalty: this.penalty(),
      maxPlayers: this.maxPlayers(),
      totalRounds: this.totalRoundsInput(),
      maxGuessesPerRound: this.maxGuessesPerRound(),
      guessOptionsLimit: this.guessOptionsLimit(),
      requireBuzzToGuess: this.requireBuzzToGuess(),
      lockoutSeconds: this.lockoutSeconds(),
      responseSeconds: this.responseSeconds(),
      isPublic: this.isPublicLobby(),
    };
  }

  private isSameSettings(
    left: ReturnType<HomeComponent['buildSettingsSnapshotFromSignals']>,
    right: ReturnType<HomeComponent['buildSettingsSnapshotFromSignals']>,
  ) {
    return (
      left.name === right.name &&
      left.library === right.library &&
      left.roundDuration === right.roundDuration &&
      left.penalty === right.penalty &&
      left.maxPlayers === right.maxPlayers &&
      left.totalRounds === right.totalRounds &&
      left.maxGuessesPerRound === right.maxGuessesPerRound &&
      left.guessOptionsLimit === right.guessOptionsLimit &&
      left.requireBuzzToGuess === right.requireBuzzToGuess &&
      left.lockoutSeconds === right.lockoutSeconds &&
      left.responseSeconds === right.responseSeconds &&
      left.isPublic === right.isPublic
    );
  }

  private formatGuessOption(track: LibraryTrack) {
    const artist = track.artist.trim();
    return artist ? `${artist} - ${track.title}` : track.title;
  }

  private normalizeGuessOption(value: string) {
    return value.trim().toLowerCase();
  }

  formatCountdown(seconds: number) {
    const safe = Math.max(0, Math.ceil(seconds));
    return `${safe}s`;
  }

  private applyLobbyLinkFromUrl() {
    if (this.lobby()) {
      return;
    }
    const lobbyId = new URLSearchParams(window.location.search).get('lobby') ?? '';
    if (!lobbyId) {
      return;
    }
    this.joinLobbyId.set(lobbyId);
    this.entryMode.set('join');
  }
}
