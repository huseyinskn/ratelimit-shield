import { RateShieldOptions, RateLimitInfo } from './types.js';
import { RateLimiter } from './limiter.js';
import { getClientIp } from './ip.js';

export function rateShield(options: RateShieldOptions = {}) {
  const limiter = new RateLimiter({
    ...options,
    keyGenerator: options.keyGenerator ?? ((req: any) => getClientIp(req))
  });

  return async function rateShieldMiddleware(req: any, res: any, next: (err?: any) => void) {
    try {
      if (options.skip && (await options.skip(req))) {
        return next();
      }

      const key = await limiter.options.keyGenerator(req);
      const info: RateLimitInfo = await limiter.check(key, req);

      if (limiter.options.standardHeaders && res && typeof res.setHeader === 'function') {
        const maxVal =
          typeof limiter.options.max === 'function'
            ? await limiter.options.max(req)
            : limiter.options.max;

        res.setHeader('RateLimit-Limit', maxVal);
        res.setHeader('RateLimit-Remaining', info.remainingHits);
        res.setHeader('RateLimit-Reset', Math.ceil(info.resetTime.getTime() / 1000));

        if (info.isBlocked) {
          res.setHeader('Retry-After', info.retryAfterSeconds);
        }
      }

      if (!info.isBlocked) {
        return next();
      }

      if (limiter.options.onLimitReached) {
        limiter.options.onLimitReached(req, res, info);
      }

      const statusCode = info.isBanned ? 403 : limiter.options.statusCode;

      if (res && typeof res.status === 'function' && typeof res.json === 'function') {
        const responseBody =
          typeof limiter.options.message === 'function'
            ? await limiter.options.message(req, res)
            : limiter.options.message;

        if (typeof responseBody === 'string') {
          return res.status(statusCode).send(responseBody);
        }
        return res.status(statusCode).json(responseBody);
      } else if (res && typeof res.writeHead === 'function') {
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        const body =
          typeof limiter.options.message === 'function'
            ? await limiter.options.message(req, res)
            : limiter.options.message;
        res.end(typeof body === 'string' ? body : JSON.stringify(body));
        return;
      }

      return next();
    } catch (err) {
      return next(err);
    }
  };
}
