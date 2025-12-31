import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BACKEND_URL } from '../config.json';
import { LibraryInfo, LobbyMode, LobbySnapshot } from '../models';

export interface LobbyResponse {
  lobbyId: string;
  playerId: string;
  lobbyState: LobbySnapshot;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly baseUrl: string;

  constructor(private http: HttpClient) {
    const defaultBase = `${BACKEND_URL}/api`;
    this.baseUrl = (window as { API_BASE_URL?: string }).API_BASE_URL ?? defaultBase;
  }

  getLibraries() {
    return this.http.get<LibraryInfo[]>(`${this.baseUrl}/libraries`);
  }

  createLobby(payload: {
    username: string;
    mode: LobbyMode;
    library: string;
    roundDuration: number;
    maxPlayers: number;
  }) {
    return this.http.post<LobbyResponse>(`${this.baseUrl}/lobbies`, payload);
  }

  joinLobby(lobbyId: string, username: string) {
    return this.http.post<LobbyResponse>(`${this.baseUrl}/lobbies/${lobbyId}/join`, {
      username,
    });
  }
}
