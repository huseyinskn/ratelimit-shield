import { Store } from './types.js';

interface RecordItem {
  hits: number;
  resetTime: number;
}

export class MemoryStore implements Store {
  private hitsMap = new Map<string, RecordItem>();
  private banMap = new Map<string, number>();
  private sweepTimer?: NodeJS.Timeout;

  constructor(sweepIntervalMs: number = 60_000) {
    if (typeof setInterval !== 'undefined') {
      this.sweepTimer = setInterval(() => this.cleanup(), sweepIntervalMs);
      if (this.sweepTimer.unref) {
        this.sweepTimer.unref();
      }
    }
  }

  async increment(key: string, windowMs: number): Promise<{ hits: number; resetTime: Date }> {
    const now = Date.now();
    const existing = this.hitsMap.get(key);

    if (!existing || existing.resetTime <= now) {
      const resetTime = now + windowMs;
      this.hitsMap.set(key, { hits: 1, resetTime });
      return { hits: 1, resetTime: new Date(resetTime) };
    }

    existing.hits += 1;
    return { hits: existing.hits, resetTime: new Date(existing.resetTime) };
  }

  async get(key: string): Promise<{ hits: number; resetTime: Date } | undefined> {
    const record = this.hitsMap.get(key);
    if (!record) return undefined;
    if (record.resetTime <= Date.now()) {
      this.hitsMap.delete(key);
      return undefined;
    }
    return { hits: record.hits, resetTime: new Date(record.resetTime) };
  }

  async resetKey(key: string): Promise<void> {
    this.hitsMap.delete(key);
  }

  async ban(key: string, durationMs: number): Promise<void> {
    this.banMap.set(key, Date.now() + durationMs);
  }

  async isBanned(key: string): Promise<boolean> {
    const banExpiresAt = this.banMap.get(key);
    if (!banExpiresAt) return false;
    if (banExpiresAt <= Date.now()) {
      this.banMap.delete(key);
      return false;
    }
    return true;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.hitsMap.entries()) {
      if (item.resetTime <= now) {
        this.hitsMap.delete(key);
      }
    }
    for (const [key, banExpiresAt] of this.banMap.entries()) {
      if (banExpiresAt <= now) {
        this.banMap.delete(key);
      }
    }
  }

  public destroy(): void {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
    }
    this.hitsMap.clear();
    this.banMap.clear();
  }
}
