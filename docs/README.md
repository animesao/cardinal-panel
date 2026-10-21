# Документация cardinal-panel

Всё, что нужно, чтобы поставить панель, настроить её и разобраться, когда
что-то пошло не так.

| Документ | О чём |
|---|---|
| [INSTALL.md](INSTALL.md) | Установка: быстрая, полная, все ключи, режимы (systemd / cardinal / Docker), публичный адрес, имена доступа |
| [UPGRADE.md](UPGRADE.md) | Обновление, откат, миграции базы, что делать, если обновление сломалось |
| [CONFIGURE.md](CONFIGURE.md) | Все переменные окружения, настройки в панели, узлы wings, API-ключи, лимиты |
| [OPERATIONS.md](OPERATIONS.md) | Эксплуатация: systemd, логи, бэкапы и восстановление, мониторинг, обслуживание узлов, регулярные задачи |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Типовые проблемы: симптом → диагностика → причина → решение |
| [API.md](API.md) | HTTP API панели: Client API (`/v1`), панельный, админский, колбэки wings |
| [DEVELOPMENT.md](DEVELOPMENT.md) | Разработка: запуск, проверки, структура, миграции, релизный процесс |
| [SECURITY.md](../SECURITY.md) | Модель безопасности, что и как хранится, рекомендации, сообщение об уязвимости |

## С чего начать

1. **[Установка](INSTALL.md)** — одна команда, полная установка за один
   проход.
2. **[Настройка](CONFIGURE.md)** — публичный адрес, OAuth, узлы wings.
3. **[Эксплуатация](OPERATIONS.md)** — бэкапы, логи, мониторинг.
4. **[Проблемы](TROUBLESHOOTING.md)** — если что-то не работает.

## Что где лежит

| Что | Путь |
|---|---|
| Файлы приложения | `/opt/cardinal-panel` |
| База данных | `/var/lib/cardinal-panel/panel.sqlite` |
| Конфигурация и секреты | `/etc/cardinal-panel/panel.env` (0600) |
| systemd-юнит | `/etc/systemd/system/cardinal-panel.service` |
| vhost nginx | `/etc/nginx/sites-available/cardinal-panel.conf` |
| Логи | `journalctl -u cardinal-panel` |

## Полезные команды

```bash
systemctl status cardinal-panel        # состояние
journalctl -u cardinal-panel -f        # логи в реальном времени
curl -s http://127.0.0.1:3000/api/health   # проверка живости
cd /opt/cardinal-panel && node scripts/create-admin.mjs --email=you@example.com
cd /opt/cardinal-panel && node scripts/migrate-sqlite.mjs
```

## Связанные проекты

- [cardinal](https://github.com/animesao/cardinal) — рантайм, в котором
  работают контейнеры серверов.
- [cardinal-wings](https://github.com/animesao/cardinal-wings) — агент на
  узле: панель управляет серверами через него.
- [cardinal-blueprints](https://github.com/animesao/cardinal-blueprints) —
  шаблоны установки серверов.
