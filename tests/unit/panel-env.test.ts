import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  readPanelEnv,
  resolveSqlitePath,
  resolveDialect,
} from '../../scripts/lib/panel-env.mjs';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'panel-env-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('readPanelEnv', () => {
  it('читает ключ=значение, снимает кавычки и игнорирует комментарии', () => {
    const file = path.join(dir, 'panel.env');
    writeFileSync(
      file,
      [
        '# комментарий',
        '',
        'NEXTAUTH_SECRET="abc123"',
        "DB_DIALECT='sqlite'",
        'SQLITE_PATH=/var/lib/cardinal-panel/panel.sqlite',
        'DEBUG=false',
        'битая строка без =',
      ].join('\n'),
      'utf8',
    );
    const env = readPanelEnv(file);
    expect(env.NEXTAUTH_SECRET).toBe('abc123');
    expect(env.DB_DIALECT).toBe('sqlite');
    expect(env.SQLITE_PATH).toBe('/var/lib/cardinal-panel/panel.sqlite');
    expect(env.DEBUG).toBe('false');
    expect(env['битая строка без ']).toBeUndefined();
  });

  it('не падает, если файла нет', () => {
    expect(readPanelEnv(path.join(dir, 'нет-такого.env'))).toEqual({});
  });
});

describe('resolveSqlitePath', () => {
  it('берёт путь из переменной окружения', () => {
    const previous = process.env.SQLITE_PATH;
    process.env.SQLITE_PATH = '/tmp/custom.sqlite';
    try {
      expect(resolveSqlitePath()).toContain('custom.sqlite');
    } finally {
      if (previous === undefined) delete process.env.SQLITE_PATH;
      else process.env.SQLITE_PATH = previous;
    }
  });

  it('берёт путь из файла panel.env, если в окружении его нет', () => {
    // Именно этот случай приводил к тому, что админ создавался не в той базе.
    const previous = process.env.SQLITE_PATH;
    const previousFile = process.env.PANEL_ENV_FILE;
    delete process.env.SQLITE_PATH;
    const file = path.join(dir, 'panel.env');
    writeFileSync(file, 'SQLITE_PATH=/var/lib/cardinal-panel/panel.sqlite\n', 'utf8');
    process.env.PANEL_ENV_FILE = file;
    try {
      const resolved = resolveSqlitePath();
      expect(resolved).toContain('var');
      expect(resolved).toContain('cardinal-panel');
    } finally {
      if (previous !== undefined) process.env.SQLITE_PATH = previous;
      if (previousFile !== undefined) process.env.PANEL_ENV_FILE = previousFile;
      else delete process.env.PANEL_ENV_FILE;
    }
  });

  it('явный --db важнее всего остального', () => {
    expect(resolveSqlitePath('/tmp/explicit.sqlite')).toContain('explicit.sqlite');
  });
});

describe('resolveDialect', () => {
  it('по умолчанию sqlite', () => {
    const previous = process.env.DB_DIALECT;
    delete process.env.DB_DIALECT;
    try {
      expect(resolveDialect()).toBe('sqlite');
    } finally {
      if (previous !== undefined) process.env.DB_DIALECT = previous;
    }
  });
});
