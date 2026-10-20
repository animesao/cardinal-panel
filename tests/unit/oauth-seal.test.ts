import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { sealSecret, unsealSecret } from '../../server/utils/oauth-seal';

const SECRET = 'test-master-secret-value-32-chars!!';

describe('sealSecret / unsealSecret', () => {
  const original = process.env.NEXTAUTH_SECRET;

  beforeEach(() => {
    process.env.NEXTAUTH_SECRET = SECRET;
  });

  afterEach(() => {
    if (original === undefined) delete process.env.NEXTAUTH_SECRET;
    else process.env.NEXTAUTH_SECRET = original;
  });

  it('зашифровывает и расшифровывает без потерь', () => {
    const plain = 'discord-client-secret-abc123';
    expect(unsealSecret(sealSecret(plain))).toBe(plain);
  });

  it('возвращает строку из трёх частей через точку', () => {
    const sealed = sealSecret('value');
    expect(sealed.split('.')).toHaveLength(3);
  });

  it('не содержит открытый текст', () => {
    const sealed = sealSecret('super-secret-value');
    expect(sealed).not.toContain('super-secret-value');
  });

  it('каждый вызов даёт другой шифротекст (новый IV)', () => {
    expect(sealSecret('same')).not.toBe(sealSecret('same'));
  });

  it('не расшифровывает мусор', () => {
    expect(() => unsealSecret('not-sealed')).toThrow(/bad sealed secret/);
  });

  it('не расшифровывает подделанный шифротекст', () => {
    const sealed = sealSecret('value');
    const parts = sealed.split('.');
    parts[2] = Buffer.from('tampered').toString('base64url');
    expect(() => unsealSecret(parts.join('.'))).toThrow();
  });

  it('требует достаточно длинный NEXTAUTH_SECRET', () => {
    process.env.NEXTAUTH_SECRET = 'short';
    expect(() => sealSecret('value')).toThrow(/NEXTAUTH_SECRET/);
  });
});
