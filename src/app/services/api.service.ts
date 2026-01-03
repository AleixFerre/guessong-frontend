import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { BACKEND_URL } from '../config.json';
import { LibraryId, LibraryInfo, LibraryTrack, LobbyMode, LobbySnapshot } from '../models';

export interface LobbyResponse {
  lobbyId: string;
  playerId: string;
  lobbyState: LobbySnapshot;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${BACKEND_URL}/api`;

  createLobby(payload: {
    username: string;
    password: string;
    mode: LobbyMode;
    library: LibraryId;
    roundDuration: number;
    penalty: number;
    maxPlayers: number;
    totalRounds: number;
    maxGuessesPerRound: number;
  }) {
    return this.http.post<LobbyResponse>(`${this.baseUrl}/lobbies`, payload);
  }

  joinLobby(lobbyId: string, username: string, password: string) {
    return this.http.post<LobbyResponse>(`${this.baseUrl}/lobbies/${lobbyId}/join`, {
      username,
      password,
    });
  }

  listLibraries() {
    return this.http.get<LibraryInfo[]>(`${this.baseUrl}/libraries`);
  }

  getLibraryTracks(libraryId: LibraryId) {
    return this.http.get<LibraryTrack[]>(`${this.baseUrl}/libraries/${libraryId}/tracks`);
  }
}
