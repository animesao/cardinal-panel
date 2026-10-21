# Контейнер для проверки установщика cardinal-panel на Linux.
#
# Запускает install.sh внутри ubuntu:24.04 — ровно той среды, где
# установщик работает у пользователя. Ловит класс ошибок, которые
# невозможно увидеть на другой ОС: подстановка /etc/os-release,
# разбор путей, кодировка, битые ссылки в архиве, права, systemd-юнит.
#
#   docker build -f tests/install/Dockerfile -t panel-install-test .
#   docker run --rm panel-install-test
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update -qq \
 && apt-get install -y -qq --no-install-recommends \
      bash ca-certificates curl gpg sqlite3 systemd coreutils tar \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /work
COPY . /work

# Скрипт проверки живёт в репозитории и запускается внутри контейнера.
CMD ["bash", "/work/tests/install/run.sh"]
