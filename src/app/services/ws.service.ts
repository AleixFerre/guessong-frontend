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
  private pingSignal = signal<number | null>(null);
  private pending: Array<{ type: string; payload?: unknown }> = [];
  private pingIntervalId?: number;

  readonly messages$ = this.messageSubject.asObservable();
  readonly status = this.statusSignal.asReadonly();
  readonly serverOffsetMs = this.serverOffsetSignal.asReadonly();
  readonly pingMs = this.pingSignal.asReadonly();

  connect(url: string) {
    if (this.socket) {
      this.socket.close();
    }
    this.clearPingInterval();

    this.statusSignal.set('connecting');
    this.socket = new WebSocket(url);

    this.socket.onopen = () => {
      this.statusSignal.set('connected');
      this.send('PING', { ts: Date.now() });
      this.startPingInterval();
      this.flushPending();
    };

    this.socket.onclose = () => {
      this.statusSignal.set('disconnected');
      this.clearPingInterval();
      this.pingSignal.set(null);
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
        this.pingSignal.set(Math.max(0, Math.round(roundTrip)));
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
    this.clearPingInterval();
    this.pingSignal.set(null);
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

  private startPingInterval() {
    if (this.pingIntervalId) {
      return;
    }
    this.pingIntervalId = window.setInterval(() => {
      this.send('PING', { ts: Date.now() });
    }, 5000);
  }

  private clearPingInterval() {
    if (this.pingIntervalId) {
      window.clearInterval(this.pingIntervalId);
      this.pingIntervalId = undefined;
    }
  }
}
