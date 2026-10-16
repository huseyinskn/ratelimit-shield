import test from 'node:test';
import assert from 'node:assert/strict';
import { RateLimiter, MemoryStore } from '../dist/index.js';

test('RateLimiter - allows requests within limit', async () => {
  const store = new MemoryStore();
  const limiter = new RateLimiter({
    windowMs: 1000,
    max: 3,
    store
  });

  const ip = '192.168.1.100';

  const r1 = await limiter.check(ip);
  assert.equal(r1.isBlocked, false);
  assert.equal(r1.remainingHits, 2);
  assert.equal(r1.totalHits, 1);

  const r2 = await limiter.check(ip);
  assert.equal(r2.isBlocked, false);
  assert.equal(r2.remainingHits, 1);
  assert.equal(r2.totalHits, 2);

  const r3 = await limiter.check(ip);
  assert.equal(r3.isBlocked, false);
  assert.equal(r3.remainingHits, 0);
  assert.equal(r3.totalHits, 3);

  // 4th request exceeds max (3)
  const r4 = await limiter.check(ip);
  assert.equal(r4.isBlocked, true);
  assert.equal(r4.remainingHits, 0);
  assert.equal(r4.totalHits, 4);
});

test('RateLimiter - whitelist bypasses limits', async () => {
  const limiter = new RateLimiter({
    windowMs: 1000,
    max: 1,
    whitelist: ['10.0.0.1']
  });

  for (let i = 0; i < 5; i++) {
    const res = await limiter.check('10.0.0.1');
    assert.equal(res.isBlocked, false);
  }
});

test('RateLimiter - blacklist is immediately blocked', async () => {
  const limiter = new RateLimiter({
    blacklist: ['198.51.100.1']
  });

  const res = await limiter.check('198.51.100.1');
  assert.equal(res.isBlocked, true);
  assert.equal(res.isBanned, true);
});

test('RateLimiter - auto ban triggers after banThreshold', async () => {
  const limiter = new RateLimiter({
    windowMs: 5000,
    max: 2,
    banThreshold: 2, // 2 strikes after rate limit
    banDurationMs: 60000
  });

  const ip = '203.0.113.5';

  await limiter.check(ip); // hit 1
  await limiter.check(ip); // hit 2 (limit reached)
  const strike1 = await limiter.check(ip); // hit 3 (strike 1)
  assert.equal(strike1.isBlocked, true);
  assert.equal(strike1.isBanned, false);

  const strike2 = await limiter.check(ip); // hit 4 (strike 2 -> BAN triggered)
  assert.equal(strike2.isBlocked, true);
  assert.equal(strike2.isBanned, true);

  // Subsequent check is banned directly
  const bannedCheck = await limiter.check(ip);
  assert.equal(bannedCheck.isBanned, true);
});
