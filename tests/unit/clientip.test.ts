import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  clientIp,
  isTrustedProxy,
  trustedProxies,
} from '../../server/utils/clientip';

const event = (remoteAddress: string, headers: Record<string, string> = {}) => ({
  node: { req: { socket: { remoteAddress } } },
  headers,
});

describe('trustedProxies', () => {
  const original = process.env.TRUSTED_PROXY;

  afterEach(() => {
    if (original === undefined) delete process.env.TRUSTED_PROXY;
    else process.env.TRUSTED_PROXY = original;
  });

  it('по умолчанию доверяет только loopback', () => {
    delete process.env.TRUSTED_PROXY;
    expect(trustedProxies()).toEqual([
      '127.0.0.1',
      '::1',
      '::ffff:127.0.0.1',
    ]);
  });

  it('читает список из TRUSTED_PROXY и нормализует адреса', () => {
    process.env.TRUSTED_PROXY = '10.0.0.1, 10.0.0.2:8080 , [::1]';
    expect(trustedProxies()).toEqual(['10.0.0.1', '10.0.0.2', '::1']);
  });

  it('пустая переменная не отключает доверенные прокси', () => {
    process.env.TRUSTED_PROXY = '';
    expect(trustedProxies().length).toBeGreaterThan(0);
  });
});

describe('isTrustedProxy', () => {
  it('узнаёт loopback и нормализует IPv4-mapped адреса', () => {
    delete process.env.TRUSTED_PROXY;
    expect(isTrustedProxy('127.0.0.1')).toBe(true);
    expect(isTrustedProxy('::ffff:127.0.0.1')).toBe(true);
    expect(isTrustedProxy('::1')).toBe(true);
  });

  it('не доверяет постороннему адресу', () => {
    delete process.env.TRUSTED_PROXY;
    expect(isTrustedProxy('203.0.113.5')).toBe(false);
  });

  it('пустой адрес не доверенный', () => {
    expect(isTrustedProxy('')).toBe(false);
  });
});

describe('clientIp', () => {
  it('берёт адрес из сокета, игнорируя X-Forwarded-For от клиента', () => {
    // Прямой клиент может подменить XFF — троттлинг обошёл бы так.
    const ip = clientIp(event('203.0.113.5', { 'x-forwarded-for': '1.2.3.4' }) as never);
    expect(ip).toBe('203.0.113.5');
  });

  it('за доверенным прокси берёт последний адрес из X-Forwarded-For', () => {
    const ip = clientIp(
      event('127.0.0.1', { 'x-forwarded-for': '10.0.0.9, 203.0.113.5' }) as never,
    );
    expect(ip).toBe('203.0.113.5');
  });

  it('за доверенным прокси без XFF берёт X-Real-IP', () => {
    const ip = clientIp(event('127.0.0.1', { 'x-real-ip': '203.0.113.7' }) as never);
    expect(ip).toBe('203.0.113.7');
  });

  it('за доверенным прокси без заголовков возвращает адрес прокси', () => {
    const ip = clientIp(event('127.0.0.1') as never);
    expect(ip).toBe('127.0.0.1');
  });

  it('без сокета возвращает последний адрес из XFF', () => {
    const ip = clientIp({
      headers: { 'x-forwarded-for': '10.0.0.9, 203.0.113.5' },
    } as never);
    expect(ip).toBe('203.0.113.5');
  });

  it('без сокета и заголовков возвращает unknown', () => {
    expect(clientIp({ headers: {} } as never)).toBe('unknown');
  });

  it('нормализует адрес с портом', () => {
    const ip = clientIp(event('203.0.113.5:44321') as never);
    expect(ip).toBe('203.0.113.5');
  });

  it('не склеивает разные IPv6-адреса в один ключ', () => {
    // Регрессия: 'fe80::1' и 'fe80::2' нормализовались одинаково ('fe80:'),
    // из-за чего разные клиенты делили один rate-limit бакет.
    const first = clientIp(event('fe80::1') as never);
    const second = clientIp(event('fe80::2') as never);
    expect(first).toBe('fe80::1');
    expect(second).toBe('fe80::2');
    expect(first).not.toBe(second);
  });

  it('сохраняет IPv4-mapped IPv6 как есть', () => {
    expect(clientIp(event('::ffff:203.0.113.5') as never)).toBe('::ffff:203.0.113.5');
  });

  it('разбирает IPv6 в квадратных скобках с портом', () => {
    expect(clientIp(event('[2001:db8::1]:443') as never)).toBe('2001:db8::1');
  });
});
