import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AudioService {
  private audio = new Audio();
  private useOscillator = false;
  private durationSeconds = 0;
  private playTimeout?: number;
  private context?: AudioContext;
  private oscillator?: OscillatorNode;

  loadClip(url: string | null, durationSeconds: number) {
    this.durationSeconds = durationSeconds;
    this.useOscillator = !url;

    if (!this.useOscillator) {
      this.audio.src = url ?? '';
      this.audio.preload = 'auto';
      this.audio.crossOrigin = 'anonymous';
      this.audio.load();
    }
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
    if (this.useOscillator) {
      this.stopOscillator();
      return;
    }
    this.audio.pause();
    this.audio.currentTime = Math.max(0, offsetSeconds);
  }

  stop() {
    this.clearPlayTimeout();
    this.stopOscillator();
    this.audio.pause();
    this.audio.currentTime = 0;
  }

  private play(seekToSeconds: number) {
    if (this.useOscillator) {
      this.playOscillator(seekToSeconds);
      return;
    }

    this.audio.currentTime = Math.max(0, seekToSeconds);
    this.audio.play().catch(() => undefined);
  }

  private playOscillator(seekToSeconds: number) {
    if (!this.context) {
      this.context = new AudioContext();
    }

    this.stopOscillator();

    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 440;
    gain.gain.value = 0.05;
    oscillator.connect(gain).connect(this.context.destination);

    const remaining = Math.max(0.1, this.durationSeconds - seekToSeconds);
    oscillator.start();
    oscillator.stop(this.context.currentTime + remaining);
    this.oscillator = oscillator;
  }

  private stopOscillator() {
    if (this.oscillator) {
      try {
        this.oscillator.stop();
      } catch {
        // noop
      }
      this.oscillator.disconnect();
      this.oscillator = undefined;
    }
  }

  private clearPlayTimeout() {
    if (this.playTimeout) {
      window.clearTimeout(this.playTimeout);
      this.playTimeout = undefined;
    }
  }
}
