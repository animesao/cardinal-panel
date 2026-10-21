import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const installer = await readFile(path.join(ROOT, 'install.sh'), 'utf8');

const defined = [...installer.matchAll(/^([a-z_][a-z0-9_]*)\(\)\s*\{/gm)].map(
  (match) => match[1],
);
const called = new Set(
  [...installer.matchAll(/(?:^|\s|\$\(|;)([a-z_][a-z0-9_]*)\s/gm)].map(
    (match) => match[1],
  ),
);

describe('install.sh', () => {
  it('объявляет ожидаемые функции', () => {
    for (const name of [
      'download',
      'install_node',
      'deploy_systemd',
      'deploy_cardinal',
      'install_runtime_deps',
      'apply_migrations_host',
      'run_in_panel',
      'install_nginx',
      'setup_tls',
      'create_first_admin',
      'register_node',
      'verify_panel',
    ]) {
      expect(defined, `нет функции ${name}`).toContain(name);
    }
  });

  it('вызывает каждую объявленную функцию', () => {
    // Функции, которые вызываются только через trap/eval, в этом скрипте
    // не используются.
    for (const name of defined) {
      expect(called.has(name), `функция ${name} нигде не вызывается`).toBe(true);
    }
  });

  it('не вызывает несуществующих функций', () => {
    // Собираем имена, вызываемые как shell-функции (имя + пробел/аргумент).
    const shellCalls = new Set(
      [...installer.matchAll(/^\s*([a-z_][a-z0-9_]*)\s+(?!--)/gm)].map(
        (match) => match[1],
      ),
    );
    const known = new Set([
      ...defined,
      // Внешние команды и встроенные конструкции.
      'if', 'then', 'else', 'elif', 'fi', 'for', 'do', 'done', 'while', 'case',
      'esac', 'function', 'return', 'echo', 'local', 'export', 'read', 'cd',
      'mkdir', 'rm', 'cp', 'mv', 'ln', 'sed', 'grep', 'cat', 'cut', 'tr',
      'head', 'tail', 'sort', 'uniq', 'awk', 'chmod', 'chown', 'id', 'useradd',
      'systemctl', 'nginx', 'certbot', 'curl', 'sha256sum', 'tar', 'node',
      'npm', 'ss', 'cardinal', 'sleep', 'printf', 'test', 'mktemp', 'sed',
    ]);
    for (const call of shellCalls) {
      if (known.has(call)) continue;
      // Неизвестное имя может быть внешней командой — пропускаем те, что
      // выглядят как команды (без camelCase и с дефисом/точкой не бывает).
      expect(
        /^[a-z][a-z0-9-]*$/.test(call),
        `вызов неизвестной функции: ${call}`,
      ).toBe(true);
    }
  });

  it('использует строгий режим shell', () => {
    expect(installer).toMatch(/^set -euo pipefail$/m);
  });

  it('проверяет контрольную сумму перед установкой', () => {
    const downloadIndex = installer.indexOf('sha256sum -c');
    const installIndex = installer.indexOf('Installing to $INSTALL_DIR');
    expect(downloadIndex).toBeGreaterThan(-1);
    expect(installIndex).toBeGreaterThan(downloadIndex);
  });
});
