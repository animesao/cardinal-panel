import { describe, it, expect } from 'vitest';
import {
  checkBucket,
  rateLimitHeaders,
  checkAttemptBucket,
  resetAttemptBucket,
  API_RATE_LIMIT,
  API_RATE_WINDOW_MS,
  LOGIN_ATTEMPT_LIMIT,
  LOGIN_ATTEMPT_WINDOW_MS,
} from '../../server/utils/ratelimit';

describe('checkBucket', () => {
  it('первый запрос проходит и уменьшает остаток', () => {
    const state = checkBucket('key-a', 10, 1000, 0);
    expect(state.allowed).toBe(true);
    expect(state.remaining).toBe(9);
    expect(state.limit).toBe(10);
  });

  it('исчерпывает лимит после N запросов', () => {
    const limit = 5;
    let last = checkBucket('key-b', limit, 1000, 0);
    for (let i = 0; i < limit - 1; i += 1) {
      last = checkBucket('key-b', limit, 1000, 0);
    }
    expect(last.allowed).toBe(true);
    const blocked = checkBucket('key-b', limit, 1000, 0);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it('ведро восстанавливается со временем', () => {
    const limit = 2;
    checkBucket('key-c', limit, 1000, 0);
    checkBucket('key-c', limit, 1000, 0);
    expect(checkBucket('key-c', limit, 1000, 0).allowed).toBe(false);
    // Через 600 мс при limit=2, window=1000 доступно 1.2 токена.
    expect(checkBucket('key-c', limit, 1000, 600).allowed).toBe(true);
  });

  it('ключи не делят ведро между собой', () => {
    expect(checkBucket('key-d', 1, 1000, 0).allowed).toBe(true);
    expect(checkBucket('key-d', 1, 1000, 0).allowed).toBe(false);
    expect(checkBucket('key-e', 1, 1000, 0).allowed).toBe(true);
  });
});

describe('rateLimitHeaders', () => {
  it('отдаёт лимит и остаток строками', () => {
    const headers = rateLimitHeaders({ limit: 60, remaining: 59 });
    expect(headers['X-RateLimit-Limit']).toBe('60');
    expect(headers['X-RateLimit-Remaining']).toBe('59');
  });

  it('значения по умолчанию для публичного API', () => {
    expect(API_RATE_LIMIT).toBe(60);
    expect(API_RATE_WINDOW_MS).toBe(60_000);
  });
});

describe('checkAttemptBucket', () => {
  it('первая попытка не блокируется', () => {
    expect(checkAttemptBucket('user@example.com', 3, 1000, 0)).toBe(false);
  });

  it('блокирует после исчерпания лимита', () => {
    const key = 'attempts-block';
    for (let i = 0; i < 3; i += 1) {
      expect(checkAttemptBucket(key, 3, 1000, 0)).toBe(false);
    }
    expect(checkAttemptBucket(key, 3, 1000, 0)).toBe(true);
  });

  it('окно оканчивается и попытки снова разрешены', () => {
    const key = 'attempts-window';
    for (let i = 0; i < 3; i += 1) {
      checkAttemptBucket(key, 3, 1000, 0);
    }
    expect(checkAttemptBucket(key, 3, 1000, 0)).toBe(true);
    expect(checkAttemptBucket(key, 3, 1000, 1500)).toBe(false);
  });

  it('пустой ключ не блокируется', () => {
    expect(checkAttemptBucket('', 1, 1000, 0)).toBe(false);
  });

  it('счётчики разных ключей независимы', () => {
    for (let i = 0; i < 3; i += 1) {
      checkAttemptBucket('attempts-a', 3, 1000, 0);
    }
    expect(checkAttemptBucket('attempts-a', 3, 1000, 0)).toBe(true);
    expect(checkAttemptBucket('attempts-b', 3, 1000, 0)).toBe(false);
  });
});

describe('resetAttemptBucket', () => {
  it('сбрасывает счётчик после успешного входа', () => {
    const key = 'attempts-reset';
    for (let i = 0; i < 3; i += 1) {
      checkAttemptBucket(key, 3, 1000, 0);
    }
    expect(checkAttemptBucket(key, 3, 1000, 0)).toBe(true);
    resetAttemptBucket(key);
    expect(checkAttemptBucket(key, 3, 1000, 0)).toBe(false);
  });

  it('лимиты входа соответствуют документации', () => {
    expect(LOGIN_ATTEMPT_LIMIT).toBe(10);
    expect(LOGIN_ATTEMPT_WINDOW_MS).toBe(15 * 60 * 1000);
  });
});
