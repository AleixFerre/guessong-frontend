import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { BACKEND_URL } from '../config.json';
import { LibraryInfo, LibraryTrack, LobbyMode, LobbySnapshot } from '../models';

export interface LobbyResponse {
  lobbyId: string;
  playerId: string;
  lobbyState: LobbySnapshot;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${BACKEND_URL}/api`;

  getLibraries() {
    return this.http.get<LibraryInfo[]>(`${this.baseUrl}/libraries`);
  }

  getLibraryTracks(libraryId: string) {
    return this.http.get<LibraryTrack[]>(`${this.baseUrl}/libraries/${libraryId}/tracks`);
  }

  createLobby(payload: {
    username: string;
    password: string;
    mode: LobbyMode;
    library: string;
    roundDuration: number;
    maxPlayers: number;
    totalRounds: number;
  }) {
    return this.http.post<LobbyResponse>(`${this.baseUrl}/lobbies`, payload);
  }

  joinLobby(lobbyId: string, username: string, password: string) {
    return this.http.post<LobbyResponse>(`${this.baseUrl}/lobbies/${lobbyId}/join`, {
      username,
      password,
    });
  }
}
