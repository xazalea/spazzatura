import { EventEmitter } from 'events';

export class IdleTracker extends EventEmitter {
  private timer30: ReturnType<typeof setTimeout> | null = null;
  private timer60: ReturnType<typeof setTimeout> | null = null;
  private running = false;

  start(): void {
    if (this.running) return;
    this.running = true;
    this.resetTimers();

    process.stdin.setRawMode?.(true);
    process.stdin.resume();
    process.stdin.on('data', this._onInput);
  }

  stop(): void {
    this.running = false;
    this.clearTimers();
    process.stdin.off('data', this._onInput);
    try {
      process.stdin.pause();
    } catch {
      // ignore
    }
  }

  resetTimers(): void {
    this.clearTimers();
    this.timer30 = setTimeout(() => {
      this.emit('idle:30s');
    }, 30_000);
    this.timer60 = setTimeout(() => {
      this.emit('idle:60s');
    }, 60_000);
  }

  private clearTimers(): void {
    if (this.timer30 !== null) {
      clearTimeout(this.timer30);
      this.timer30 = null;
    }
    if (this.timer60 !== null) {
      clearTimeout(this.timer60);
      this.timer60 = null;
    }
  }

  private _onInput = (): void => {
    this.emit('active');
    this.resetTimers();
  };
}
