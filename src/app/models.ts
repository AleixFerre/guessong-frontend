export type LobbyMode = 'CLASSIC' | 'BUZZ' | 'ORIGIN' | 'MID_CLIP' | 'WRITE' | 'ONE_SECOND';

export enum LibraryId {
  ANIME = 'anime',
  OST = 'ost',
  ROCK = 'rock',
}

export interface Player {
  id: string;
  username: string;
  avatar?: string;
  score: number;
  lockedForRound: boolean;
  lockedUntilMs: number | null;
  isHost?: boolean;
}

export interface LobbySnapshot {
  id: string;
  name: string;
  hostId: string;
  isPublic: boolean;
  settings: {
    mode: LobbyMode;
    library: LibraryId;
    roundDuration: number;
    clipSeconds: number;
    penalty: number;
    maxPlayers: number;
    totalRounds: number;
    maxGuessesPerRound: number;
    guessOptionsLimit: number;
    requireBuzzToGuess: boolean;
    lockoutSeconds: number;
    responseSeconds: number;
  };
  currentRound: number;
  players: Player[];
  state: 'WAITING' | 'IN_GAME' | 'FINISHED';
  round: null | {
    status: 'PLAYING' | 'PAUSED' | 'ENDED';
    clipDuration: number;
    startAtServerTs: number;
  };
}

export interface PublicLobbyInfo {
  id: string;
  name: string;
  hostId: string;
  library: LibraryId;
  state: 'WAITING' | 'IN_GAME' | 'FINISHED';
  playersCount: number;
  maxPlayers: number;
}

export interface LibraryInfo {
  id: LibraryId;
  name: string;
  description: string;
  trackCount: number;
}

export interface LibraryTrack {
  title: string;
  artist: string;
  duration: number;
  origin?: string;
}

export interface RoundStartPayload {
  clipUrl: string;
  clipDuration: number;
  clipStartSeconds?: number;
  startAtServerTs: number;
  mode: LobbyMode;
  guessOptions: LibraryTrack[];
}

export interface PlayPayload {
  startAtServerTs: number;
  seekToSeconds?: number;
  roundOffsetSeconds?: number;
}

export interface PausePayload {
  offsetSeconds: number;
  byPlayerId?: string;
  responseDeadlineServerTs?: number | null;
}

export interface RoundEndPayload {
  reason: 'WIN' | 'TIMEOUT' | 'SKIP';
  winnerId: string | null;
  pointsAwarded: number;
  revealedTrackMeta: { title: string; artist: string; origin?: string };
  leaderboard: Player[];
}

export interface GuessResultPayload {
  playerId: string;
  correct: boolean;
  guessText: string;
}

export interface BuzzAcceptedPayload {
  playerId: string;
  offsetSeconds: number;
}

export interface BuzzTimeoutPayload {
  playerId: string;
}

export interface EarlyBuzzPayload {
  playerId: string;
}

export type LobbyUpdatePayload = LobbySnapshot;

export const AVATAR_COUNT = 43;
export const AVATAR_OPTIONS = Array.from(
  { length: AVATAR_COUNT },
  (_value, index) => `${index}.webp`,
);

export const AVATAR_CREDIT = 'Adventurer Neutral by Lisa Wischofsky is licensed under CC BY 4.0.';

export const MAX_ROUND_DURATION_SEC = 30;
export const MAX_PLAYERS = 10;
export const MAX_GUESSES_PER_ROUND = 10;
export const DEFAULT_GUESSES_PER_ROUND = 3;
export const MAX_LOCKOUT_SECONDS = 30;
export const DEFAULT_LOCKOUT_SECONDS = 2;
export const DEFAULT_RESPONSE_SECONDS = 10;
export const MAX_RESPONSE_SECONDS = 60;
export const NEXT_ROUND_DELAY_SEC = 5;
export const BEGINNER_ROUND_DURATION = 30;
export const BEGINNER_TOTAL_ROUNDS = 5;
export const BEGINNER_MAX_GUESSES_PER_ROUND = 0;
export const BEGINNER_LOCKOUT_SECONDS = 2;
export const BEGINNER_RESPONSE_SECONDS = 15;
export const BEGINNER_PENALTY = 0;
