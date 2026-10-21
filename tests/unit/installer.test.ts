import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
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

  it('проверяет свободное место на диске ДО установки', () => {
    expect(installer).toContain('check_disk_space');
    // Проверка должна идти до распаковки и до миграций.
    const checkIndex = installer.indexOf('\ncheck_disk_space\n');
    const extractIndex = installer.indexOf('tar -xzf "${TMP_DIR}/${ARCHIVE}"');
    const migrateIndex = installer.indexOf('apply_migrations_host');
    expect(checkIndex).toBeGreaterThan(-1);
    expect(extractIndex).toBeGreaterThan(checkIndex);
    expect(migrateIndex).toBeGreaterThan(checkIndex);
  });

  it('не ставит npm-зависимости без нужды', () => {
    // Миграции SQLite работают на встроенном node:sqlite. npm install
    // (~300 МБ) нужен только как запасной путь при неудаче.
    const fn = installer.slice(
      installer.indexOf('apply_migrations_host() {'),
      installer.indexOf('# ---- запуск выбранного режима ----'),
    );
    const depsIndex = fn.indexOf('install_runtime_deps');
    const migrateIndex = fn.indexOf('node scripts/migrate-sqlite.mjs');
    expect(migrateIndex).toBeGreaterThan(-1);
    // Попытка миграции без зависимостей идёт ПЕРВОЙ.
    expect(migrateIndex).toBeLessThan(depsIndex);
  });

  it('кладёт lock-файл в релизный пакет (детерминированный npm ci)', () => {
    const packager = readFileSync(
      path.join(ROOT, 'scripts', 'package-release.mjs'),
      'utf8',
    );
    expect(packager).toContain("'package-lock.json'");
  });

  it('раскрывает ссылки при упаковке (симлинки npm на Windows)', () => {
    // npm на Windows дедуплицирует пакеты через junction'ы; без dereference
    // они попадают в архив как ссылки на виндовые пути и ломают Node на
    // Linux («Cannot read package config»).
    const packager = readFileSync(
      path.join(ROOT, 'scripts', 'package-release.mjs'),
      'utf8',
    );
    expect(packager).toContain('dereference: true');
    // И страховка: упаковщик сам проверяет, что ссылок в архиве нет.
    expect(packager).toMatch(/line\.startsWith\('l'\)/);
  });

  it('сообщает о неудачной установке и завершается с ненулевым кодом', () => {
    expect(installer).toContain('INSTALL_OK=0');
    expect(installer).toContain('BUT NOT WORKING');
    expect(installer).toMatch(/if \[\[ "\$INSTALL_OK" -ne 1 \]\]; then[\s\S]*exit 1/);
  });

  it('печатает справку по шапке файла, а не по номерам строк', () => {
    // Номера строк ломаются при каждой правке шапки.
    expect(installer).not.toMatch(/--help\|-h\)\s+sed -n/);
    expect(installer).toContain("awk 'NR==1{next}");
  });

  it('поддерживает несколько имён доступа (--hostname)', () => {
    // Панель должна открываться и по IP, и по имени: nginx принимает
    // оба, а имя резолвится через /etc/hosts и mDNS.
    expect(installer).toContain('--hostname)');
    expect(installer).toContain('EXTRA_HOSTNAMES');
    expect(installer).toContain('SERVER_NAMES');
    expect(installer).toContain('normalize_hostname');
    // nginx получает список имён одним server_name.
    expect(installer).toContain('s#__SERVER_NAMES__#${SERVER_NAMES}#g');
    // Имена попадают в /etc/hosts сервера и в mDNS.
    expect(installer).toContain('/etc/hosts');
    expect(installer).toContain('/etc/avahi/hosts');
    expect(installer).toContain('detect_local_ip');
  });

  it('не дублирует имена в server_name', () => {
    expect(installer).toMatch(/case " \$SERVER_NAMES " in/);
  });

  it('нормализует домен (принимает URL, отбрасывает схему и путь)', () => {
    // Раньше схема попадала в server_name nginx и в NUXT_PANEL_URL
    // («https://http://192.168.0.105»).
    expect(installer).toContain('_d="${DOMAIN#http://}"');
    expect(installer).toContain('_d="${_d#https://}"');
    expect(installer).toContain('_d="${_d%%/*}"');
  });

  it('пропускает TLS для IP-адреса (Let\'s Encrypt их не выдаёт)', () => {
    expect(installer).toContain('is_ip_address');
    expect(installer).toMatch(/is_ip_address "\$DOMAIN"[\s\S]{0,200}USE_TLS=0/);
    // Причина пропуска должна быть видна: иначе выводится «TLS skipped
    // (--no-tls)», хотя пользователь --no-tls не передавал.
    expect(installer).toContain('TLS_SKIP_REASON');
  });

  it('не теряет кириллицу в install.sh', () => {
    // Скрипт с битой кодировкой ломается на Linux ещё до выполнения.
    expect(installer).toContain('Публичный');
    expect(installer).not.toContain('РџСѓР±');
  });

  it('переписывает panel.env на http, если сертификат не выдали', () => {
    // Иначе NUXT_PANEL_URL остался бы https://, и OAuth-колбэки уходили
    // бы на несуществующий https.
    const tlsFn = installer.slice(
      installer.indexOf('setup_tls() {'),
      installer.indexOf('# ---- первый администратор ----'),
    );
    expect(tlsFn).toContain('PUBLIC_SCHEME="http"');
    expect(tlsFn).toContain('write_env');
  });

  it('не считает неудачный TLS нерабочей установкой', () => {
    // Панель работает и по HTTP; «NOT WORKING» — только если сервис не
    // поднялся или не отвечает.
    expect(installer).toContain('setup_tls || true');
    expect(installer).toContain('install_nginx || INSTALL_OK=0');
  });

  it('останавливает сервис ДО замены файлов', () => {
    // Иначе процесс работает с удаляемыми чанками .output, падает и
    // рестартует в недоконченном каталоге.
    const stopIndex = installer.indexOf('systemctl stop "$SERVICE_NAME"');
    const removeIndex = installer.indexOf('rm -rf "${INSTALL_DIR}/.output"');
    expect(stopIndex).toBeGreaterThan(-1);
    expect(removeIndex).toBeGreaterThan(stopIndex);
  });

  it('не шумит ошибкой curl при разборе ответа API', () => {
    // grep -m1 закрывает пайп, curl пишет EPIPE — это видно как
    // "curl: (23) Failure writing output to destination".
    expect(installer).toMatch(/releases\/latest" 2>\/dev\/null/);
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
