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

  it('не путает версию панели с VERSION из /etc/os-release', () => {
    // /etc/os-release определяет переменную VERSION (например
    // "24.04.4 LTS (Noble Numbat)"). После подключения файла её нужно
    // сбросить, иначе установщик пытается скачать релиз с именем
    // "24.04.4 LTS (Noble Numbat)".
    expect(installer).toMatch(/^\s*unset VERSION$/m);
    expect(installer).toContain('PANEL_VERSION=""');

    // Никаких обращений к голой переменной VERSION как к версии панели.
    const lines = installer.split('\n');
    const offenders = lines.filter((line) => {
      if (/unset VERSION/.test(line)) return false;
      if (/cardinal-panel\/VERSION/.test(line)) return false; // имя файла
      if (/NODE_VERSION|VERSION_ID|PANEL_VERSION/.test(line)) return false;
      return /\$\{?VERSION\b/.test(line);
    });
    expect(
      offenders,
      `обращение к $VERSION как к версии панели:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('проверяет, что версия из API похожа на SemVer', () => {
    // Вместо битого URL с пробелами — внятная ошибка.
    expect(installer).toContain("grep -Eq '^[0-9]+\\.[0-9]+\\.[0-9]+$'");
  });

  it('скачивает архив с версией в имени', () => {
    expect(installer).toContain('ARCHIVE="cardinal-panel-${PANEL_VERSION}.tar.gz"');
    expect(installer).toContain('releases/download/v${PANEL_VERSION}');
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
