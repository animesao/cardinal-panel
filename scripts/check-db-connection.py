#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Проверка подключения к MySQL и вывод всех таблиц базы.

Node-аналог: scripts/check-db-connection.mjs. Нужен там, где не под рукой
Node, и там, где нужно быстро посмотреть, что вообще лежит в базе игрового
сервера: какие таблицы созданы, сколько в них строк.

Пароль НЕ стоит передавать аргументом — он останется в истории командной
строки и в списке процессов. Предпочтительно:

    DB_HOST=192.168.0.104 DB_PORT=3306 DB_USER=u_xxx DB_PASSWORD=... \\
    DB_NAME=s15_60e931 python scripts/check-db-connection.py

Либо разобрать строку из карточки базы:

    python scripts/check-db-connection.py --url 'jdbc:mysql://host:3306/db'

Коды возврата: 0 — ок, 1 — ошибка подключения/запроса, 2 — ошибка вызова.
"""

import argparse
import os
import re
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

try:
    import mysql.connector
except ImportError:
    sys.exit(
        "Нет драйвера mysql-connector-python.\n"
        "  pip install mysql-connector-python\n"
    )

# Человеческие расшифровки вместо числовых errno.
ERRNO_HINTS = {
    1045: "доступ запрещён — неверный пароль или пользователь",
    1044: "пользователю запрещён доступ к этой базе",
    1049: "база не существует (проверьте имя и DB_NAME)",
    2002: "сервер недоступен (проверьте сеть/файрвол/туннель)",
    2003: "не удалось соединиться — порт закрыт или хост не отвечает",
    2005: "неизвестный хост (проверьте DNS/адрес)",
    2006: "сервер закрыл соединение во время handshake",
    2013: "соединение потеряно во время запроса (таймаут?)",
    2055: "соединение потеряно — возможно,MySQL ушёл в reconnect",
}

JDBC_RE = re.compile(
    r"^(?:jdbc:)?mysql://(?:[^@/]*@)?([^/:?]+)(?::(\d+))?(?:/([^?]*))?", re.I
)


def parse_jdbc(raw):
    """'jdbc:mysql://host:3306/db?x=1' -> (host, port, db)."""
    m = JDBC_RE.match(raw)
    if not m:
        return None
    return m.group(1), m.group(2), m.group(3)


def build_parser():
    p = argparse.ArgumentParser(
        prog="check-db-connection.py",
        description="Проверка подключения к MySQL и вывод всех таблиц",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Переменные окружения: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME\n"
            "Пароль через --password виден в списке процессов — для продакшена\n"
            "используйте DB_PASSWORD."
        ),
    )
    p.add_argument("-H", "--host", default=os.environ.get("DB_HOST"))
    p.add_argument("-P", "--port", type=int, default=os.environ.get("DB_PORT"))
    p.add_argument("-u", "--user", default=os.environ.get("DB_USER"))
    p.add_argument("-p", "--password", default=None,
                   help="небезопасно: см. справку")
    p.add_argument("-d", "--database", "--db", dest="database",
                   default=os.environ.get("DB_NAME"))
    p.add_argument("--url", help="разобрать jdbc:mysql://host:port/db")
    p.add_argument("--no-counts", action="store_true",
                   help="не считать строки в таблицах")
    p.add_argument("--limit", type=int, default=10,
                   help="сколько строк показать из каждой таблицы (0 = не показывать)")
    return p


def resolve_args(argv):
    args = build_parser().parse_args(argv)

    if args.url:
        host, port, db = parse_jdbc(args.url)
        if not host:
            sys.exit(f"Не разобрал строку подключения: {args.url}")
        args.host = args.host or host
        args.port = args.port or port
        args.database = args.database or db

    args.host = args.host or "127.0.0.1"
    args.port = int(args.port or 3306)
    args.user = args.user or ""
    # Пароль из --password в приоритете, иначе env, иначе пусто.
    # Флаг ведём отдельно, иначе предупреждение «передан аргументом»
    # срабатывало бы и на пароль из переменной окружения.
    args.password_from_argv = args.password is not None
    args.password = args.password if args.password is not None \
        else os.environ.get("DB_PASSWORD", "")
    args.database = args.database or ""

    if not args.user:
        sys.exit("Не указан пользователь (-u/--user или env DB_USER)")
    if not 1 <= args.port <= 65535:
        sys.exit(f"Некорректный порт: {args.port}")
    return args


def fail(msg, code=1):
    print(msg, file=sys.stderr)
    sys.exit(code)


def main(argv):
    args = resolve_args(argv)
    if args.password_from_argv:
        print("! Пароль передан аргументом — он виден в списке процессов "
              "и в истории командной строки.\n"
              "  Для продакшена используйте переменную окружения DB_PASSWORD.\n",
              file=sys.stderr)

    target = f"{args.user}@{args.host}:{args.port}" + (f"/{args.database}" if args.database else "")
    print(f"\nMySQL {target}\n")

    print("Сеть")
    kwargs = dict(
        host=args.host,
        port=args.port,
        user=args.user,
        password=args.password,
        connection_timeout=8,
    )
    if args.database:
        kwargs["database"] = args.database

    try:
        conn = mysql.connector.connect(**kwargs)
        print(f"  [OK  ] подключение установлено")
    except mysql.connector.Error as e:
        errno = e.errno
        hint = ERRNO_HINTS.get(errno, e.msg or str(e))
        print(f"  [FAIL] аутентификация — {errno}: {hint}")
        print("\nИтог: подключиться не удалось.\n")
        sys.exit(1)

    try:
        cur = conn.cursor()
        cur.execute("SELECT VERSION(), CURRENT_USER(), CONNECTION_ID(), DATABASE()")
        version, auth_user, conn_id, current_db = cur.fetchone()
        print("\nMySQL")
        print(f"  [OK  ] сервер — MySQL {version}, authenticated as {auth_user}, "
              f"conn #{conn_id}")
        if current_db:
            print(f"  [OK  ] текущая база — {current_db}")

        cur.execute("SHOW TABLES")
        tables = [list(r)[0] for r in cur.fetchall()]

        print(f"\nТаблицы в {current_db or '(default)'}: {len(tables)}")
        if not tables:
            print("  (пусто — база без таблиц)")
        else:
            width = max(len(t) for t in tables)
            for t in tables:
                quoted = f"`{t.replace('`', '``')}`"
                # Таблица в чужих правах/удалённая — считать нельзя.
                try:
                    c1 = conn.cursor()
                    c1.execute(f"SELECT COUNT(*) FROM {quoted}")
                    n = c1.fetchone()[0]
                    c1.close()
                    print(f"  {t.ljust(width)}  {n:>10,} строк".replace(",", " "))
                except mysql.connector.Error as e:
                    print(f"  {t.ljust(width)}  <недоступно: {e.errno}>")

                if args.limit and args.limit > 0:
                    try:
                        c2 = conn.cursor()
                        c2.execute(f"SELECT * FROM {quoted} LIMIT {args.limit}")
                        rows = c2.fetchall()
                        cols = [d[0] for d in c2.description] if c2.description else []
                        c2.close()
                        print(f"      {' | '.join(cols)}")
                        for row in rows:
                            print("      " + " | ".join(
                                "NULL" if v is None else str(v)[:60] for v in row))
                        if len(rows) >= args.limit:
                            print(f"      ... (показаны первые {args.limit})")
                    except mysql.connector.Error as e:
                        print(f"      <чтение не удалось: {e.errno}>")

        cur.execute("SHOW GRANTS FOR CURRENT_USER")
        grants = [r[0] for r in cur.fetchall()]
        print(f"\n  [OK  ] прав: {len(grants)}")
        for g in grants:
            print(f"      {g}")

        print("\nИтог: соединение работает\n")
    except mysql.connector.Error as e:
        print(f"  [FAIL] запросы — {e.errno}: {e.msg or e}")
        print("\nИтог: подключиться удалось, но запросы не проходят.\n")
        sys.exit(1)
    finally:
        try:
            conn.close()
        except Exception:
            pass


if __name__ == "__main__":
    main(sys.argv[1:])