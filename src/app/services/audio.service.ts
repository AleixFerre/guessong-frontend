import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AudioService {
  private audio = new Audio();
  private durationSeconds = 0;
  private playTimeout?: number;
  private readonly volumeStorageKey = 'audio.volume';
  private volume = 0.7;

  constructor() {
    const stored = window.localStorage.getItem(this.volumeStorageKey);
    if (stored !== null) {
      const parsed = Number.parseFloat(stored);
      if (!Number.isNaN(parsed)) {
        this.volume = Math.min(1, Math.max(0, parsed));
        this.audio.volume = this.volume;
      }
    }
  }

  loadClip(url: string | null, durationSeconds: number) {
    this.durationSeconds = durationSeconds;
    const resolved = this.resolveClipUrl(url ?? '');
    this.audio.src = resolved;
    this.audio.volume = this.volume;
    this.audio.preload = 'auto';
    this.audio.crossOrigin = 'anonymous';
    this.audio.load();
  }

  schedulePlay(startAtServerTs: number, serverOffsetMs: number, seekToSeconds = 0) {
    this.clearPlayTimeout();
    const clientStart = startAtServerTs - serverOffsetMs;
    const delay = Math.max(0, clientStart - Date.now());
    this.playTimeout = window.setTimeout(() => {
      this.play(seekToSeconds);
    }, delay);
  }

  pauseAt(offsetSeconds: number) {
    this.clearPlayTimeout();
    this.audio.pause();
    this.audio.currentTime = Math.max(0, offsetSeconds);
  }

  stop() {
    this.clearPlayTimeout();
    this.audio.pause();
    this.audio.currentTime = 0;
  }

  private play(seekToSeconds: number) {
    this.audio.currentTime = Math.max(0, seekToSeconds);
    this.audio.play().catch(() => undefined);
  }

  private clearPlayTimeout() {
    if (this.playTimeout) {
      window.clearTimeout(this.playTimeout);
      this.playTimeout = undefined;
    }
  }

  private resolveClipUrl(url: string) {
    if (!url) {
      return '';
    }
    try {
      const base = document.baseURI || window.location.href;
      if (url.startsWith('/')) {
        const baseUrl = new URL(base);
        const basePath = baseUrl.pathname.replace(/\/?$/, '/');
        const normalizedBasePath = basePath === '/' ? '' : basePath.replace(/\/$/, '');
        return `${baseUrl.origin}${normalizedBasePath}${url}`;
      }
      return new URL(url, base).toString();
    } catch {
      return url;
    }
  }

  setVolume(value: number) {
    const clamped = Math.min(1, Math.max(0, value));
    this.volume = clamped;
    this.audio.volume = clamped;
    window.localStorage.setItem(this.volumeStorageKey, clamped.toString());
  }

  getVolume() {
    return this.volume;
  }
}
