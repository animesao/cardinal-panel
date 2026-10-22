import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  parseIPv4,
  parseIPv6,
  parseIp,
  mappedIPv4,
  parseCidr,
  ipInCidr,
  trustedCidrs,
  isTrustedHost,
} from '../../server/utils/cidr';
import {
  isPrivateHost,
  isMetadataHost,
  assertNodeUrl,
} from '../../server/utils/node-url';

const { lookupMock } = vi.hoisted(() => ({ lookupMock: vi.fn() }));
vi.mock('node:dns/promises', () => ({
  lookup: lookupMock,
  default: { lookup: lookupMock },
}));

const originalCidrs = process.env.NODE_TRUSTED_CIDRS;

beforeEach(() => {
  delete process.env.NODE_TRUSTED_CIDRS;
  lookupMock.mockReset();
  lookupMock.mockResolvedValue([]);
});

afterEach(() => {
  if (originalCidrs === undefined) delete process.env.NODE_TRUSTED_CIDRS;
  else process.env.NODE_TRUSTED_CIDRS = originalCidrs;
});

describe('разбор адресов', () => {
  it('читает IPv4', () => {
    expect(parseIPv4('192.168.0.1')).toBe(3232235521);
    expect(parseIPv4('0.0.0.0')).toBe(0);
    expect(parseIPv4('255.255.255.255')).toBe(4294967295);
  });

  it('не принимает мусор за IPv4', () => {
    expect(parseIPv4('192.168.0')).toBeNull();
    expect(parseIPv4('192.168.0.256')).toBeNull();
    expect(parseIPv4('example.com')).toBeNull();
  });

  it('читает IPv6, включая сжатую запись', () => {
    expect(parseIPv6('::1')).toEqual([0, 0, 0, 0, 0, 0, 0, 1]);
    expect(parseIPv6('::')).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    expect(parseIPv6('fd00::1')).toEqual([
      0xfd00, 0, 0, 0, 0, 0, 0, 1,
    ]);
    expect(parseIPv6('fe80::1')).not.toBeNull();
  });

  it('разбирает IPv4-mapped IPv6', () => {
    expect(mappedIPv4('::ffff:192.168.0.1')).toBe('192.168.0.1');
    expect(mappedIPv4('::1')).toBeNull();
    expect(mappedIPv4('192.168.0.1')).toBeNull();
  });

  it('определяет версию адреса', () => {
    expect(parseIp('10.0.0.1')?.version).toBe(4);
    expect(parseIp('fd00::1')?.version).toBe(6);
    expect(parseIp('не адрес')).toBeNull();
  });
});

describe('подсети', () => {
  it('разбирает CIDR и одиночный адрес', () => {
    expect(parseCidr('192.168.0.0/16')).toMatchObject({ bits: 16, version: 4 });
    expect(parseCidr('192.168.0.1')).toMatchObject({ bits: 32, version: 4 });
    expect(parseCidr('fd00::/8')).toMatchObject({ bits: 8, version: 6 });
    expect(parseCidr('мусор')).toBeNull();
    expect(parseCidr('192.168.0.0/99')).toBeNull();
  });

  it('проверяет попадание адреса в подсеть', () => {
    expect(ipInCidr('192.168.0.104', '192.168.0.0/16')).toBe(true);
    expect(ipInCidr('192.169.0.104', '192.168.0.0/16')).toBe(false);
    expect(ipInCidr('10.1.2.3', '10.0.0.0/8')).toBe(true);
    expect(ipInCidr('172.16.5.5', '172.16.0.0/12')).toBe(true);
    expect(ipInCidr('172.32.5.5', '172.16.0.0/12')).toBe(false);
    expect(ipInCidr('fd00::5', 'fd00::/8')).toBe(true);
    expect(ipInCidr('fe80::5', 'fd00::/8')).toBe(false);
  });

  it('считает IPv4-mapped IPv6 принадлежащим IPv4-подсети', () => {
    expect(ipInCidr('::ffff:192.168.0.104', '192.168.0.0/16')).toBe(true);
    expect(ipInCidr('::ffff:203.0.113.5', '192.168.0.0/16')).toBe(false);
  });

  it('не путает версии адресов', () => {
    expect(ipInCidr('fd00::1', '192.168.0.0/16')).toBe(false);
    expect(ipInCidr('192.168.0.1', 'fd00::/8')).toBe(false);
  });

  it('читает список доверенных подсетей из env', () => {
    expect(trustedCidrs()).toEqual([]);
    expect(trustedCidrs('192.168.0.0/16, 10.0.0.0/8')).toEqual([
      '192.168.0.0/16',
      '10.0.0.0/8',
    ]);
    process.env.NODE_TRUSTED_CIDRS = '192.168.0.0/16';
    expect(trustedCidrs()).toEqual(['192.168.0.0/16']);
  });

  it('доверяет только перечисленным подсетям', () => {
    process.env.NODE_TRUSTED_CIDRS = '192.168.0.0/16';
    expect(isTrustedHost('192.168.0.104')).toBe(true);
    expect(isTrustedHost('192.168.1.104')).toBe(true);
    expect(isTrustedHost('10.0.0.1')).toBe(false);
    expect(isTrustedHost('203.0.113.5')).toBe(false);
  });
});

describe('private и metadata хосты', () => {
  it('узнаёт приватные диапазоны', () => {
    expect(isPrivateHost('127.0.0.1')).toBe(true);
    expect(isPrivateHost('10.1.2.3')).toBe(true);
    expect(isPrivateHost('172.16.0.1')).toBe(true);
    expect(isPrivateHost('192.168.0.104')).toBe(true);
    expect(isPrivateHost('169.254.1.1')).toBe(true);
    expect(isPrivateHost('::1')).toBe(true);
    expect(isPrivateHost('fd00::1')).toBe(true);
    expect(isPrivateHost('203.0.113.5')).toBe(false);
    expect(isPrivateHost('8.8.8.8')).toBe(false);
  });

  it('узнаёт адреса метаданных облаков', () => {
    expect(isMetadataHost('169.254.169.254')).toBe(true);
    expect(isMetadataHost('100.100.100.200')).toBe(true);
    expect(isMetadataHost('fd00:ec2::254')).toBe(true);
    expect(isMetadataHost('::ffff:169.254.169.254')).toBe(true);
    expect(isMetadataHost('192.168.0.1')).toBe(false);
  });
});

describe('assertNodeUrl', () => {
  it('пропускает публичный адрес', async () => {
    await expect(assertNodeUrl('http://203.0.113.5:8080')).resolves.toBe(
      'http://203.0.113.5:8080',
    );
  });

  it('режет внутренний адрес без доверенной подсети', async () => {
    await expect(assertNodeUrl('http://192.168.0.104:8080')).rejects.toThrow(
      /NODE_TRUSTED_CIDRS/,
    );
  });

  it('пропускает внутренний адрес из доверенной подсети', async () => {
    process.env.NODE_TRUSTED_CIDRS = '192.168.0.0/16';
    await expect(assertNodeUrl('http://192.168.0.104:8080')).resolves.toBe(
      'http://192.168.0.104:8080',
    );
  });

  it('режет внутренний адрес, если доверена другая подсеть', async () => {
    process.env.NODE_TRUSTED_CIDRS = '10.0.0.0/8';
    await expect(assertNodeUrl('http://192.168.0.104:8080')).rejects.toThrow(
      /внутренний адрес/,
    );
  });

  it('режет адрес метаданных даже из доверенной подсети', async () => {
    process.env.NODE_TRUSTED_CIDRS = '169.254.0.0/16,0.0.0.0/0';
    await expect(assertNodeUrl('http://169.254.169.254/latest')).rejects.toThrow(
      /метаданных/,
    );
  });

  it('режет не-http схемы', async () => {
    await expect(assertNodeUrl('file:///etc/passwd')).rejects.toThrow(/http/);
    await expect(assertNodeUrl('gopher://example.com')).rejects.toThrow(/http/);
  });

  it('режет логин в адресе', async () => {
    await expect(assertNodeUrl('http://user:pass@example.com')).rejects.toThrow(
      /логина/,
    );
  });

  it('режет неправильный URL', async () => {
    await expect(assertNodeUrl('не url')).rejects.toThrow(/Некорректный/);
  });

  it('смотрит на резолв имени, а не только на сам адрес', async () => {
    lookupMock.mockResolvedValue([{ address: '127.0.0.1' }]);
    await expect(assertNodeUrl('http://wings.internal.test:8080')).rejects.toThrow(
      /внутренний адрес/,
    );
  });

  it('пропускает имя, которое резолвится в доверенную подсеть', async () => {
    process.env.NODE_TRUSTED_CIDRS = '192.168.0.0/16';
    lookupMock.mockResolvedValue([{ address: '192.168.0.104' }]);
    await expect(assertNodeUrl('http://wings.lan.test:8080')).resolves.toBe(
      'http://wings.lan.test:8080',
    );
  });

  it('ругается, если имя не резолвится', async () => {
    lookupMock.mockRejectedValue(new Error('ENOTFOUND'));
    await expect(assertNodeUrl('http://nope.invalid:8080')).rejects.toThrow(
      /не удалось разрешить/,
    );
  });
});
