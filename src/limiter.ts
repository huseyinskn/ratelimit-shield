import { RateLimitInfo, RateShieldOptions, Store } from './types.js';
import { MemoryStore } from './memory-store.js';

export class RateLimiter {
  public readonly options: Required<
    Omit<RateShieldOptions, 'store' | 'skip' | 'onLimitReached' | 'max' | 'message'>
  > & {
    store: Store;
    skip?: RateShieldOptions['skip'];
    onLimitReached?: RateShieldOptions['onLimitReached'];
    max: number | ((req: any) => number | Promise<number>);
    message: string | Record<string, unknown> | ((req: any, res: any) => unknown);
  };

  private strikeMap = new Map<string, number>();

  constructor(options: RateShieldOptions = {}) {
    this.options = {
      windowMs: options.windowMs ?? 60_000,
      max: options.max ?? 60,
      statusCode: options.statusCode ?? 429,
      message: options.message ?? {
        success: false,
        error: 'Too many requests, please try again later.'
      },
      keyGenerator: options.keyGenerator ?? ((req: any) => req.ip || '127.0.0.1'),
      skip: options.skip,
      standardHeaders: options.standardHeaders ?? true,
      banThreshold: options.banThreshold ?? 0,
      banDurationMs: options.banDurationMs ?? 3_600_000,
      whitelist: options.whitelist ?? [],
      blacklist: options.blacklist ?? [],
      store: options.store ?? new MemoryStore(),
      onLimitReached: options.onLimitReached
    };
  }

  async check(key: string, req?: any): Promise<RateLimitInfo> {
    if (this.options.blacklist.includes(key)) {
      return {
        totalHits: 999999,
        remainingHits: 0,
        resetTime: new Date(Date.now() + 86400000),
        isBlocked: true,
        isBanned: true,
        retryAfterSeconds: 86400
      };
    }

    if (this.options.whitelist.includes(key)) {
      return {
        totalHits: 0,
        remainingHits: 999999,
        resetTime: new Date(Date.now() + this.options.windowMs),
        isBlocked: false,
        isBanned: false,
        retryAfterSeconds: 0
      };
    }

    const isCurrentlyBanned = await this.options.store.isBanned(key);
    if (isCurrentlyBanned) {
      return {
        totalHits: 999999,
        remainingHits: 0,
        resetTime: new Date(Date.now() + this.options.banDurationMs),
        isBlocked: true,
        isBanned: true,
        retryAfterSeconds: Math.ceil(this.options.banDurationMs / 1000)
      };
    }

    const maxAllowed =
      typeof this.options.max === 'function'
        ? await this.options.max(req)
        : this.options.max;

    const { hits, resetTime } = await this.options.store.increment(key, this.options.windowMs);
    const remaining = Math.max(0, maxAllowed - hits);
    const msUntilReset = Math.max(0, resetTime.getTime() - Date.now());
    const retryAfterSeconds = Math.ceil(msUntilReset / 1000);
    const isBlocked = hits > maxAllowed;

    let isBanned = false;
    if (isBlocked && this.options.banThreshold > 0) {
      const currentStrikes = (this.strikeMap.get(key) || 0) + 1;
      this.strikeMap.set(key, currentStrikes);

      if (currentStrikes >= this.options.banThreshold) {
        await this.options.store.ban(key, this.options.banDurationMs);
        this.strikeMap.delete(key);
        isBanned = true;
      }
    }

    return {
      totalHits: hits,
      remainingHits: remaining,
      resetTime,
      isBlocked,
      isBanned,
      retryAfterSeconds
    };
  }
}
