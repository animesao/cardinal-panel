import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SCRIPT = path.join(ROOT, 'scripts', 'admin-api-key.mjs');

let dir: string;
let dbPath: string;

function run(args: string[]): { stdout: string; status: number } {
  try {
    const stdout = execFileSync('node', [SCRIPT, ...args], {
      encoding: 'utf8',
      env: { ...process.env, DB_DIALECT: 'sqlite', SQLITE_PATH: dbPath },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { stdout, status: 0 };
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; status?: number };
    // Скрипт пишет ошибки в stderr — возвращаем оба потока, чтобы тест
    // мог проверить текст сообщения.
    return {
      stdout: `${err.stdout ?? ''}${err.stderr ?? ''}`,
      status: err.status ?? 1,
    };
  }
}

function withDb<T>(fn: (db: DatabaseSync) => T): T {
  const db = new DatabaseSync(dbPath);
  try {
    return fn(db);
  } finally {
    db.close();
  }
}

describe('admin-api-key.mjs', () => {
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'panel-apikey-'));
    dbPath = path.join(dir, 'panel.sqlite');
    withDb((db) => {
      db.exec(`CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user'
      )`);
      db.exec(`CREATE TABLE api_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        prefix TEXT NOT NULL UNIQUE,
        token_hash TEXT NOT NULL UNIQUE,
        scopes TEXT NOT NULL DEFAULT '[]',
        last_used_at INTEGER,
        created_at INTEGER NOT NULL
      )`);
      db.exec(
        `INSERT INTO users (email, role) VALUES ('admin@example.com', 'admin')`,
      );
      db.exec(
        `INSERT INTO users (email, role) VALUES ('user@example.com', 'user')`,
      );
    });
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('выпускает ключ для администратора', () => {
    const { stdout, status } = run([
      '--email=admin@example.com',
      '--name=installer',
      '--scopes=nodes:2',
    ]);
    expect(status).toBe(0);
    const token = stdout.match(/^TOKEN=(.+)$/m)?.[1];
    const prefix = stdout.match(/^PREFIX=(.+)$/m)?.[1];
    expect(token).toMatch(/^cp_/);
    expect(prefix).toMatch(/^cp_/);
    expect(token!.startsWith(prefix!)).toBe(true);
  });

  it('в БД лежит только SHA-256 хэш, а не сам токен', () => {
    const { stdout } = run(['--email=admin@example.com', '--scopes=nodes:2']);
    const token = stdout.match(/^TOKEN=(.+)$/m)?.[1]!;
    const row = withDb((db) =>
      db.prepare('SELECT prefix, token_hash, scopes FROM api_keys').get() as {
        prefix: string;
        token_hash: string;
        scopes: string;
      },
    );
    expect(row.token_hash).toBe(
      createHash('sha256').update(token).digest('hex'),
    );
    expect(row.token_hash).not.toBe(token);
    expect(row.scopes).toBe('{"nodes":2}');
  });

  it('отказывает не-администрателю', () => {
    const { status, stdout } = run(['--email=user@example.com']);
    expect(status).not.toBe(0);
    expect(stdout).toContain('не администратор');
  });

  it('отказывает несуществующему пользователю', () => {
    const { status, stdout } = run(['--email=nobody@example.com']);
    expect(status).not.toBe(0);
    expect(stdout).toContain('не найден');
  });

  it('отзывает ключ', () => {
    const { stdout } = run(['--email=admin@example.com', '--scopes=nodes:2']);
    const prefix = stdout.match(/^PREFIX=(.+)$/m)?.[1]!;
    expect(withDb((db) => db.prepare('SELECT COUNT(*) c FROM api_keys').get() as { c: number }).c).toBe(1);

    const { stdout: revokeOut } = run([`--revoke=${prefix}`]);
    expect(revokeOut).toContain('отозван');
    expect(withDb((db) => db.prepare('SELECT COUNT(*) c FROM api_keys').get() as { c: number }).c).toBe(0);
  });

  it('разбирает несколько ресурсов в scopes', () => {
    const { stdout } = run([
      '--email=admin@example.com',
      '--scopes=nodes:2,users:1',
    ]);
    const prefix = stdout.match(/^PREFIX=(.+)$/m)?.[1]!;
    const row = withDb((db) =>
      db.prepare('SELECT scopes FROM api_keys WHERE prefix = ?').get(prefix) as {
        scopes: string;
      },
    );
    expect(JSON.parse(row.scopes)).toEqual({ nodes: 2, users: 1 });
  });
});
