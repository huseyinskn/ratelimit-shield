# rate-shield

A fast, zero-dependency in-memory and Redis rate limiting and abuse-prevention middleware for Node.js, Express, and Next.js.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue?style=flat-square)](https://www.typescriptlang.org/)

## Features

- Zero external runtime dependencies in memory mode.
- Single-line integration with Express, Connect, or native Node.js HTTP servers.
- Compatible with Next.js App Router and serverless route handlers.
- Optional distributed Redis store support for multi-instance deployments.
- Automatic IP banning for clients exceeding violation thresholds.
- Reverse proxy support (Cloudflare, AWS ALB, Nginx, Fly.io, Vercel).
- RFC-compliant RateLimit and Retry-After HTTP headers.
- IP whitelist and blacklist support.

## Installation

```bash
npm install rate-shield
```

## Usage

### Express

```javascript
import express from 'express';
import { rateShield } from 'rate-shield';

const app = express();

app.use(
  rateShield({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Too many requests, please slow down.' }
  })
);

app.get('/api/users', (req, res) => {
  res.json({ success: true, data: [] });
});

app.listen(3000);
```

### Sensitive Routes with Auto-Ban

```javascript
app.post(
  '/api/login',
  rateShield({
    windowMs: 5 * 60 * 1000,
    max: 5,
    banThreshold: 3,
    banDurationMs: 60 * 60 * 1000,
    message: { error: 'Too many failed attempts. Temporary ban applied.' }
  }),
  loginController
);
```

### Next.js Route Handlers

```typescript
import { NextResponse } from 'next/server';
import { RateLimiter, getClientIp } from 'rate-shield';

const limiter = new RateLimiter({
  windowMs: 60 * 1000,
  max: 10
});

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const result = await limiter.check(ip);

  if (result.isBlocked) {
    return NextResponse.json(
      { error: 'Rate limit exceeded.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(result.retryAfterSeconds),
          'RateLimit-Remaining': '0'
        }
      }
    );
  }

  return NextResponse.json({ success: true });
}
```

### Redis Store

```javascript
import Redis from 'ioredis';
import { rateShield, RedisStore } from 'rate-shield';

const redis = new Redis(process.env.REDIS_URL);

app.use(
  rateShield({
    windowMs: 60 * 1000,
    max: 60,
    store: new RedisStore({ client: redis, prefix: 'app-rate:' })
  })
);
```

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `windowMs` | `number` | `60000` | Time window in milliseconds. |
| `max` | `number \| (req) => number` | `60` | Maximum requests allowed in the window. |
| `statusCode` | `number` | `429` | HTTP status code sent when rate-limited. |
| `message` | `string \| object \| fn` | `{ success: false, ... }` | Response payload on limit exceeded. |
| `banThreshold` | `number` | `0` | Violations before a temporary ban is applied. |
| `banDurationMs`| `number` | `3600000` | Duration of temporary ban in milliseconds. |
| `whitelist` | `string[]` | `[]` | List of IP addresses that bypass rate limiting. |
| `blacklist` | `string[]` | `[]` | List of IP addresses rejected immediately with 403. |
| `keyGenerator` | `(req) => string` | `getClientIp` | Custom key generator function. |
| `skip` | `(req) => boolean` | `undefined` | Custom function to bypass checks for matching requests. |
| `store` | `Store` | `MemoryStore` | Storage engine instance (`MemoryStore` or `RedisStore`). |
| `standardHeaders` | `boolean` | `true` | Send standard RateLimit headers. |

## License

MIT
