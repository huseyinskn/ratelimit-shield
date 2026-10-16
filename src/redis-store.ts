import { Store } from './types.js';

export interface RedisClientInterface {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number | boolean>;
  pttl(key: string): Promise<number>;
  get(key: string): Promise<string | null>;
  del(key: string): Promise<number>;
  set(key: string, value: string, ...args: any[]): Promise<any>;
}

export interface RedisStoreOptions {
  client: RedisClientInterface;
  prefix?: string;
}

export class RedisStore implements Store {
  private client: RedisClientInterface;
  private prefix: string;

  constructor(options: RedisStoreOptions) {
    this.client = options.client;
    this.prefix = options.prefix ?? 'rate-shield:';
  }

  private hitKey(key: string): string {
    return `${this.prefix}hits:${key}`;
  }

  private banKey(key: string): string {
    return `${this.prefix}ban:${key}`;
  }

  async increment(key: string, windowMs: number): Promise<{ hits: number; resetTime: Date }> {
    const redisKey = this.hitKey(key);
    const hits = await this.client.incr(redisKey);

    if (hits === 1) {
      const windowSeconds = Math.ceil(windowMs / 1000);
      await this.client.expire(redisKey, windowSeconds);
      const resetTime = new Date(Date.now() + windowMs);
      return { hits, resetTime };
    }

    const ttlMs = await this.client.pttl(redisKey);
    const resetTime = new Date(Date.now() + (ttlMs > 0 ? ttlMs : windowMs));
    return { hits, resetTime };
  }

  async get(key: string): Promise<{ hits: number; resetTime: Date } | undefined> {
    const redisKey = this.hitKey(key);
    const val = await this.client.get(redisKey);
    if (!val) return undefined;

    const hits = parseInt(val, 10);
    const ttlMs = await this.client.pttl(redisKey);
    return {
      hits,
      resetTime: new Date(Date.now() + (ttlMs > 0 ? ttlMs : 0))
    };
  }

  async resetKey(key: string): Promise<void> {
    await this.client.del(this.hitKey(key));
  }

  async ban(key: string, durationMs: number): Promise<void> {
    const banKey = this.banKey(key);
    const seconds = Math.ceil(durationMs / 1000);
    await this.client.set(banKey, '1', 'EX', seconds);
  }

  async isBanned(key: string): Promise<boolean> {
    const banVal = await this.client.get(this.banKey(key));
    return banVal !== null && banVal !== undefined;
  }
}
