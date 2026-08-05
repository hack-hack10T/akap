#!/usr/bin/env bash
# ============================================================
# Деплой A CUP на хостинг REG.RU (nginx, server110.hosting.reg.ru)
# Читает креды из ~/.config/regru/ftp.env (chmod 600):
#   FTP_HOST=server110.hosting.reg.ru
#   FTP_USER=...
#   FTP_PASS=...
#   FTP_DIR=/путь/к/корню-сайта  (каталог с index.html)
# Использование: ./deploy.sh            — залить весь сайт
#                ./deploy.sh index.html — залить только index.html
# ============================================================
set -euo pipefail

ENV_FILE="${FTP_ENV:-$HOME/.config/regru/ftp.env}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Нет файла кредов: $ENV_FILE" >&2
  echo "Создайте его (chmod 600) или задайте FTP_ENV=/путь/к/env" >&2
  exit 1
fi
# shellcheck disable=SC1090
source "$ENV_FILE"
: "${FTP_HOST:?FTP_HOST не задан}" "${FTP_USER:?FTP_USER не задан}" "${FTP_PASS:?FTP_PASS не задан}" "${FTP_DIR:?FTP_DIR не задан}"

ROOT="$(cd "$(dirname "$0")" && pwd)"

# Все файлы сайта, которые идут на прод (относительно корня репо)
SITE_FILES=(
  index.html config.js robots.txt sitemap.xml og-image.jpg
  css/guide-legal.css
  js/api.js js/metrika.js
  guide/buy.html guide/offer.html guide/privacy.html guide/access.html guide/success.html
  guide/assets/mikhail-portrait.webp
)

upload() {
  local rel="$1"
  curl -sS --ftp-create-dirs -T "$ROOT/$rel" \
    "ftp://${FTP_HOST}${FTP_DIR}/${rel}" \
    --user "${FTP_USER}:${FTP_PASS}" \
    && echo "OK  $rel" || { echo "FAIL $rel" >&2; return 1; }
}

if [[ $# -gt 0 ]]; then
  for f in "$@"; do upload "$f" || exit 1; done
else
  for f in "${SITE_FILES[@]}"; do upload "$f" || exit 1; done
fi
echo "Готово. Проверка: curl -sI https://xn--80aa3av.xn--p1ai/<файл>"
