import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  assertPasswordRules,
} from '../../server/utils/password';

describe('hashPassword', () => {
  it('возвращает хэш в формате scrypt$N$R$p$salt$hash', () => {
    const stored = hashPassword('correct horse battery');
    const parts = stored.split('$');
    expect(parts).toHaveLength(6);
    expect(parts[0]).toBe('scrypt');
    expect(parts[1]).toBe('16384');
    expect(parts[2]).toBe('8');
    expect(parts[3]).toBe('1');
    expect(parts[4].length).toBeGreaterThan(0);
    expect(parts[5].length).toBeGreaterThan(0);
  });

  it('соль уникальна: два хэша одного пароля различаются', () => {
    expect(hashPassword('same-password')).not.toBe(hashPassword('same-password'));
  });

  it('не содержит пароль в открытом виде', () => {
    expect(hashPassword('hunter2')).not.toContain('hunter2');
  });
});

describe('verifyPassword', () => {
  it('принимает верный пароль', () => {
    const stored = hashPassword('s3cret-pass');
    expect(verifyPassword('s3cret-pass', stored)).toBe(true);
  });

  it('отклоняет неверный пароль', () => {
    const stored = hashPassword('s3cret-pass');
    expect(verifyPassword('wrong-pass', stored)).toBe(false);
  });

  it('отклоняет пустой пароль', () => {
    const stored = hashPassword('s3cret-pass');
    expect(verifyPassword('', stored)).toBe(false);
  });

  it('возвращает false на битом хранимом значении', () => {
    expect(verifyPassword('x', 'not-a-hash')).toBe(false);
    expect(verifyPassword('x', '')).toBe(false);
    expect(verifyPassword('x', 'scrypt$16384$8$1$onlyfive')).toBe(false);
  });

  it('возвращает false, если длина хэша не совпадает', () => {
    const stored = hashPassword('s3cret-pass');
    const tampered = stored.slice(0, -4) + 'AAAA';
    expect(verifyPassword('s3cret-pass', tampered)).toBe(false);
  });
});

describe('assertPasswordRules', () => {
  it('принимает пароль достаточной длины', () => {
    expect(assertPasswordRules('12345678')).toBe('12345678');
  });

  it('отклоняет слишком короткий пароль', () => {
    expect(() => assertPasswordRules('short')).toThrow(/8/);
  });

  it('отклоняет слишком длинный пароль', () => {
    expect(() => assertPasswordRules('x'.repeat(129))).toThrow(/128/);
  });

  it('отклоняет пустой пароль', () => {
    expect(() => assertPasswordRules('')).toThrow();
  });
});
