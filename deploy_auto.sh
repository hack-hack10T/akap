#!/usr/bin/env bash
# Авто-деплой A CUP: срабатывает при появлении /home/hack/.config/regru/ftp.env (или $FTP_ENV).
# Согласовано юр. 06.08: выкладка строго из репо по коммитам, порядок оферта → buy → v9 → index.
#   оферта 6dd41bc → guide/offer.html (ред. 06.08, возврат 7 дней, ст. 26.1 ЗоЗПП, п. 5.4)
#   buy     13ffe30 → guide/buy.html (Марк: логотип/мобилка/интервью с автором; N7: 6 разделов/49 глав)
#   v9      6dd41bc → landing_v9.html (отдельный файл)
#   index   6dd41bc → index.html      (только юр. футер возврата; контент кофейни не меняется)
# Перед заливкой — бэкап текущего прода. После — check_prod.sh /landing_v9.html.
# ИТОГ: OK = сайт выложен; любой FAIL = сайт НЕ считается выложенным.
# Тихий режим: без ftp.env или после завершённой попытки — пустой вывод (ничего не шлём).
set -uo pipefail

ENV_FILE="${FTP_ENV:-/home/hack/.config/regru/ftp.env}"
REPO="/home/hack/akap"
DONE="$REPO/.deploy_done"
ATTEMPT="$REPO/.deploy_attempted"

[[ -f "$ENV_FILE" ]] || exit 0
[[ -f "$DONE" ]] && exit 0
[[ -f "$ATTEMPT" ]] && exit 0

# shellcheck disable=SC1090
source "$ENV_FILE"
: "${FTP_HOST:?FTP_HOST не задан}" "${FTP_USER:?FTP_USER не задан}" "${FTP_PASS:?FTP_PASS не задан}" "${FTP_DIR:?FTP_DIR не задан}"
touch "$ATTEMPT"

cd "$REPO" || exit 1
for c in 6dd41bc; do
  git cat-file -e "$c^{commit}" 2>/dev/null || { echo "FAIL: нет коммита $c в репо"; exit 1; }
done

# 1. Бэкап текущего прода (откат за минуту); пустой бэкап = стоп
BK="$REPO/backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BK"
for f in index.html guide/offer.html guide/buy.html guide/privacy.html; do
  curl -s --max-time 30 "https://xn--80aa3av.xn--p1ai/$f" -o "$BK/$(basename "$f")" 2>/dev/null
  local_sz=$(stat -c%s "$BK/$(basename "$f")" 2>/dev/null || echo 0)
  echo "бэкап: $BK/$(basename "$f") ($local_sz байт)"
  if [[ "$local_sz" -lt 100 ]]; then
    echo "FAIL: бэкап $f пуст/оборван ($local_sz байт) — откат невозможен, деплой остановлен"
    exit 1
  fi
done

# 2. Заливка строго из репо (по коммитам)
ftp_path() { # нормализация: FTP_DIR="/" или "" не дают двойного слэша и не теряют разделитель
  local base="${FTP_DIR%/}"
  echo "${base}/$1"
}
upload() { # upload <tmpfile> <relpath>
  curl -sS --ftp-create-dirs -T "$1" "ftp://${FTP_HOST}$(ftp_path "$2")" --user "${FTP_USER}:${FTP_PASS}" \
    && echo "OK  $2" || { echo "FAIL $2"; exit 1; }
}
git show 6dd41bc:guide/offer.html > /tmp/acup_offer.html && upload /tmp/acup_offer.html guide/offer.html
git show 13ffe30:guide/buy.html   > /tmp/acup_buy.html   && upload /tmp/acup_buy.html   guide/buy.html
git show 6dd41bc:landing_v9.html  > /tmp/acup_v9.html    && upload /tmp/acup_v9.html    landing_v9.html
git show 6dd41bc:index.html       > /tmp/acup_index.html && upload /tmp/acup_index.html index.html

# 3. Контрольная сверка
echo "=== СВЕРКА (check_prod.sh /landing_v9.html) ==="
OUT=$(bash "$REPO/check_prod.sh" /landing_v9.html 2>&1)
echo "$OUT"
if echo "$OUT" | grep -q "ИТОГ: OK"; then
  touch "$DONE"
  echo "=== ДЕПЛОЙ ЗАВЕРШЁН: ИТОГ OK. v9 доступна: https://xn--80aa3av.xn--p1ai/landing_v9.html; замена index.html — по решению владельца ==="
else
  echo "=== ДЕПЛОЙ: FAIL — сайт НЕ считается выложенным до исправления ==="
  exit 1
fi
