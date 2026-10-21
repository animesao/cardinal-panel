import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const installer = await readFile(path.join(ROOT, 'install.sh'), 'utf8');
const nginxTemplate = await readFile(
  path.join(ROOT, 'packaging', 'nginx', 'cardinal-panel.conf'),
  'utf8',
);
const cardinalTemplate = await readFile(
  path.join(ROOT, 'packaging', 'cardinal', 'cardinal-panel.toml'),
  'utf8',
);
const systemdUnit = await readFile(
  path.join(ROOT, 'packaging', 'systemd', 'cardinal-panel.service'),
  'utf8',
);

describe('установщик', () => {
  it('поддерживает ключи полной установки', () => {
    for (const flag of [
      '--domain',
      '--admin-email',
      '--wings-url',
      '--wings-token',
      '--install-mode',
      '--network',
      '--image-tag',
      '--no-proxy',
      '--no-tls',
      '--no-start',
      '--uninstall',
    ]) {
      expect(installer, `ключ ${flag} не обрабатывается`).toContain(`${flag})`);
    }
  });

  it('проверяет права после разбора аргументов (--help работает без root)', () => {
    const helpIndex = installer.indexOf('--help|-h)');
    const rootIndex = installer.indexOf('Must run as root');
    expect(helpIndex).toBeGreaterThan(-1);
    expect(rootIndex).toBeGreaterThan(helpIndex);
  });

  it('подставляет все плейсхолдеры nginx-шаблона', () => {
    const placeholders = [
      ...new Set([...nginxTemplate.matchAll(/__([A-Z_]+)__/g)].map((m) => m[1])),
    ];
    expect(placeholders.length).toBeGreaterThan(0);
    for (const name of placeholders) {
      expect(
        installer,
        `установщик не подставляет плейсхолдер __${name}__`,
      ).toContain(`__${name}__`);
    }
  });

  it('подставляет изменяемые поля cardinal-шаблона', () => {
    // В cardinal-шаблоне нет плейсхолдеров __X__: установщик правит
    // конкретные поля через sed. Проверяем, что и в шаблоне, и в sed-правилах
    // установщика фигурируют одни и те же поля.
    const sedLines = installer
      .split('\n')
      .filter((line) => line.includes('s#') && line.includes('#'));

    for (const field of ['image', 'network_mode']) {
      expect(
        cardinalTemplate.split('\n').some((line) => line.trim().startsWith(`${field} =`)),
        `в cardinal-шаблоне нет поля ${field}`,
      ).toBe(true);
      expect(
        sedLines.some((line) => line.includes(field)),
        `в установщике нет sed-правила для поля ${field}`,
      ).toBe(true);
    }

    expect(
      cardinalTemplate,
      'в cardinal-шаблоне нет env_file',
    ).toContain('env_file');
    expect(
      sedLines.some((line) => line.includes('panel.env')),
      'в установщике нет sed-правила для env_file',
    ).toBe(true);
  });

  it('создаёт администратора и регистрирует узел', () => {
    expect(installer).toContain('scripts/create-admin.mjs');
    expect(installer).toContain('scripts/admin-api-key.mjs');
    expect(installer).toContain('/api/admin/nodes');
  });

  it('отзывает временный ключ после регистрации узла', () => {
    const revokeIndex = installer.indexOf('--revoke=');
    const registerIndex = installer.indexOf('/api/admin/nodes');
    expect(revokeIndex).toBeGreaterThan(-1);
    expect(registerIndex).toBeGreaterThan(-1);
    // Отзыв должен идти ПОСЛЕ запроса, иначе ключ не сработает.
    expect(revokeIndex).toBeGreaterThan(registerIndex);
  });

  it('сохраняет NEXTAUTH_SECRET при переустановке', () => {
    expect(installer).toContain('Keeping the existing NEXTAUTH_SECRET');
  });

  it('не пишет секреты в репозиторий: конфиг только в /etc', () => {
    expect(installer).toContain('chmod 0600 "$CONF_FILE"');
    expect(installer).not.toMatch(/echo .*SECRET=.*>>\s*"?\$?INSTALL_DIR/);
  });
});

describe('systemd-юнит', () => {
  it('берёт секреты из отдельного файла, а не из Environment=', () => {
    expect(systemdUnit).toContain('EnvironmentFile=-/etc/cardinal-panel/panel.env');
    expect(systemdUnit).not.toMatch(/^Environment=.*SECRET=/m);
  });

  it('запускается от непривилегированного пользователя с песочницей', () => {
    expect(systemdUnit).toContain('User=cardinal');
    expect(systemdUnit).toContain('NoNewPrivileges=true');
    expect(systemdUnit).toContain('ProtectSystem=strict');
  });
});
