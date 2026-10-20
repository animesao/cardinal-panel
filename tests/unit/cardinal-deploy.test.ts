import { describe, it, expect } from 'vitest';
import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseToml } from 'smol-toml';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const COMPOSE_FILE = path.join(ROOT, 'packaging/cardinal/cardinal-panel.toml');
const DOCKERFILE = path.join(ROOT, 'Dockerfile.cardinal');

/**
 * Инструкции Dockerfile, которые понимает билдер cardinal.
 * Источник: cardinal/internal/builder/parser.go (список в parseInstruction).
 * Список продублирован здесь намеренно: панель собирается отдельно от
 * cardinal, и расхождение должно ломать CI панели, а не сборку образа.
 */
const CARDINAL_DOCKERFILE_INSTRUCTIONS = new Set([
  'FROM',
  'RUN',
  'COPY',
  'ADD',
  'WORKDIR',
  'ENV',
  'CMD',
  'ENTRYPOINT',
  'EXPOSE',
  'LABEL',
  'USER',
  'VOLUME',
  'SHELL',
  'ARG',
  'HEALTHCHECK',
  'STOPSIGNAL',
  'ONBUILD',
]);

describe('cardinal.toml панели', () => {
  it('разбирается как TOML', async () => {
    const raw = await readFile(COMPOSE_FILE, 'utf8');
    expect(() => parseToml(raw)).not.toThrow();
  });

  it('объявляет сервис panel с образом и healthcheck', async () => {
    const cfg = parseToml(await readFile(COMPOSE_FILE, 'utf8')) as {
      container: Record<string, Record<string, unknown>>;
    };
    const service = cfg.container?.panel;
    expect(service).toBeDefined();
    expect(typeof service.image).toBe('string');
    expect(String(service.image)).toMatch(/^cardinal-panel:/);

    const healthcheck = service.healthcheck as Record<string, number | string>;
    expect(typeof healthcheck.cmd).toBe('string');
    expect(String(healthcheck.cmd)).toContain('/api/health');
    expect(Number(healthcheck.interval)).toBeGreaterThan(0);
    expect(Number(healthcheck.retries)).toBeGreaterThan(0);
  });

  it('использует только поля, поддерживаемые схемой cardinal', async () => {
    // Набор полей взят из cardinal/internal/config/types.go (ContainerConfig).
    const allowed = new Set([
      'image', 'command', 'ports', 'volumes', 'env', 'env_file', 'restart',
      'restart_delay', 'hostname', 'memory', 'cpus', 'workdir', 'healthcheck',
      'entrypoint', 'network_mode', 'network', 'labels', 'cap_add', 'cap_drop',
      'user', 'readonly', 'no_new_privs', 'sysctls', 'ulimits', 'dns',
      'replicas', 'deploy', 'secrets', 'configs', 'depends_on', 'privileged',
    ]);
    const cfg = parseToml(await readFile(COMPOSE_FILE, 'utf8')) as {
      container: Record<string, Record<string, unknown>>;
    };
    for (const [name, service] of Object.entries(cfg.container ?? {})) {
      for (const key of Object.keys(service)) {
        expect(allowed.has(key), `поле "${key}" в сервисе "${name}" не поддерживается cardinal`).toBe(true);
      }
    }
  });

  it('указывает env_file и том с данными', async () => {
    const cfg = parseToml(await readFile(COMPOSE_FILE, 'utf8')) as {
      container: Record<string, { env_file?: string[]; volumes?: string[] }>;
    };
    const service = cfg.container.panel;
    expect(service.env_file?.[0]).toContain('panel.env');
    expect(service.volumes?.some((v) => v.includes('panel-data') && v.includes('/app/data'))).toBe(true);
  });
});

describe('Dockerfile.cardinal', () => {
  it('использует только инструкции, поддерживаемые билдером cardinal', async () => {
    const raw = await readFile(DOCKERFILE, 'utf8');
    // Продолжения строк (\\) склеиваются — иначе вторая строка ENV
    // выглядела бы отдельной инструкцией.
    const instructions = raw
      .replace(/\\\r?\n\s*/g, ' ')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'));

    expect(instructions.length).toBeGreaterThan(0);
    for (const line of instructions) {
      const verb = line.split(/\s+/)[0].toUpperCase();
      expect(
        CARDINAL_DOCKERFILE_INSTRUCTIONS.has(verb),
        `инструкция "${verb}" не поддерживается билдером cardinal`,
      ).toBe(true);
    }
  });

  it('берёт базовый образ node:24-alpine', async () => {
    const raw = await readFile(DOCKERFILE, 'utf8');
    expect(raw).toMatch(/^FROM node:24-alpine$/m);
  });

  it('копирует только то, что есть в релизном пакете', async () => {
    const raw = await readFile(DOCKERFILE, 'utf8');
    const copies = [...raw.matchAll(/^COPY\s+(\S+)/gm)].map((match) => match[1]);
    expect(copies.length).toBeGreaterThan(0);

    // Состав релизного пакета задан в scripts/package-release.mjs: проверяем
    // именно его. Каталог .output/ в репозитории отсутствует — он появляется
    // только после сборки, а тесты в CI идут ДО шага build.
    const packager = await readFile(
      path.join(ROOT, 'scripts', 'package-release.mjs'),
      'utf8',
    );
    const payloadBlock = packager.match(/const PAYLOAD = \[([\s\S]*?)\n\];/);
    expect(payloadBlock, 'не найден список PAYLOAD в package-release.mjs').not.toBeNull();
    const payload = [...payloadBlock![1].matchAll(/\[\s*'([^']+)'/g)].map(
      (match) => match[1],
    );
    expect(payload.length).toBeGreaterThan(0);

    for (const source of copies) {
      // Пакет может содержать подкаталог источника (server/db/migrations/
      // покрывает COPY server/) — такое тоже считается попаданием.
      const inPackage = payload.some(
        (entry) =>
          entry === source ||
          entry.startsWith(source) ||
          source.startsWith(entry),
      );
      expect(
        inPackage,
        `COPY ссылается на "${source}", которого нет в релизном пакете`,
      ).toBe(true);
    }

    // Всё, что копируется из репозитория (а не из сборки), должно
    // существовать в нём же.
    for (const source of copies) {
      if (source === '.output/') continue;
      const target = path.join(ROOT, source.replace(/\/$/, ''));
      const exists = await stat(target).then(
        () => true,
        () => false,
      );
      expect(exists, `COPY ссылается на отсутствующий путь: ${source}`).toBe(true);
    }
  });

  it('запускает сервер собранной сборки', async () => {
    const raw = await readFile(DOCKERFILE, 'utf8');
    expect(raw).toContain('CMD ["node", ".output/server/index.mjs"]');
  });
});
