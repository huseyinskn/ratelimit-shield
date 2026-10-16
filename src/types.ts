export interface RateLimitInfo {
  totalHits: number;
  remainingHits: number;
  resetTime: Date;
  isBlocked: boolean;
  isBanned: boolean;
  retryAfterSeconds: number;
}

export interface Store {
  increment(key: string, windowMs: number): Promise<{ hits: number; resetTime: Date }>;
  get(key: string): Promise<{ hits: number; resetTime: Date } | undefined>;
  resetKey(key: string): Promise<void>;
  ban(key: string, durationMs: number): Promise<void>;
  isBanned(key: string): Promise<boolean>;
}

export interface RateShieldOptions {
  /**
   * Time frame for which requests are checked/remembered.
   * Default: 60,000 ms (1 minute)
   */
  windowMs?: number;

  /**
   * Max number of connections/requests during `windowMs` before rate limiting.
   * Default: 60
   */
  max?: number | ((req: any) => number | Promise<number>);

  /**
   * Status code returned when max requests exceeded.
   * Default: 429
   */
  statusCode?: number;

  /**
   * Response body sent when rate limit is exceeded.
   * Default: { success: false, error: "Too many requests, please try again later." }
   */
  message?: string | Record<string, unknown> | ((req: any, res: any) => unknown);

  /**
   * Function used to generate keys (e.g., client IP, user ID, API token).
   * Default: resolves client IP (supports Cloudflare, Reverse Proxies).
   */
  keyGenerator?: (req: any) => string | Promise<string>;

  /**
   * Function to skip rate limiting for specific requests (e.g. health check endpoints).
   */
  skip?: (req: any) => boolean | Promise<boolean>;

  /**
   * Set standard RateLimit headers (RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset, Retry-After).
   * Default: true
   */
  standardHeaders?: boolean;

  /**
   * Number of violations (429 hits) before an IP is temporarily auto-banned.
   * Disabled by default (0 or undefined).
   */
  banThreshold?: number;

  /**
   * Duration of the automatic ban when `banThreshold` is reached.
   * Default: 3,600,000 ms (1 hour)
   */
  banDurationMs?: number;

  /**
   * List of IPs or keys that completely bypass rate limiting.
   */
  whitelist?: string[];

  /**
   * List of IPs or keys that are immediately rejected with 403 Forbidden.
   */
  blacklist?: string[];

  /**
   * Custom storage engine. Defaults to optimized in-memory store.
   */
  store?: Store;

  /**
   * Custom callback triggered when a client hits the rate limit.
   */
  onLimitReached?: (req: any, res: any, info: RateLimitInfo) => void;
}
