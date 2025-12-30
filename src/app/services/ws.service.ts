import { Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';

export interface ServerMessage {
  type: string;
  payload?: any;
}

@Injectable({ providedIn: 'root' })
export class WsService {
  private socket?: WebSocket;
  private messageSubject = new Subject<ServerMessage>();
  private statusSignal = signal<'disconnected' | 'connecting' | 'connected'>('disconnected');
  private serverOffsetSignal = signal(0);
  private pending: Array<{ type: string; payload?: unknown }> = [];

  readonly messages$ = this.messageSubject.asObservable();
  readonly status = this.statusSignal.asReadonly();
  readonly serverOffsetMs = this.serverOffsetSignal.asReadonly();

  connect(url: string) {
    if (this.socket) {
      this.socket.close();
    }

    this.statusSignal.set('connecting');
    this.socket = new WebSocket(url);

    this.socket.onopen = () => {
      this.statusSignal.set('connected');
      this.send('PING', { ts: Date.now() });
      this.flushPending();
    };

    this.socket.onclose = () => {
      this.statusSignal.set('disconnected');
    };

    this.socket.onmessage = (event) => {
      let parsed: ServerMessage | null = null;
      try {
        parsed = JSON.parse(event.data);
      } catch {
        return;
      }

      if (parsed?.type === 'PONG') {
        const clientTs = parsed.payload?.clientTs ?? Date.now();
        const serverTs = parsed.payload?.serverTs ?? Date.now();
        const now = Date.now();
        const roundTrip = now - clientTs;
        const offset = serverTs + roundTrip / 2 - now;
        this.serverOffsetSignal.set(offset);
        return;
      }

      if (parsed) {
        this.messageSubject.next(parsed);
      }
    };
  }

  disconnect() {
    this.socket?.close();
    this.socket = undefined;
    this.statusSignal.set('disconnected');
  }

  send(type: string, payload?: unknown) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.pending.push({ type, payload });
      return;
    }
    this.socket.send(JSON.stringify({ type, payload }));
  }

  private flushPending() {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }
    this.pending.forEach((message) => {
      this.socket?.send(JSON.stringify(message));
    });
    this.pending = [];
  }
}
