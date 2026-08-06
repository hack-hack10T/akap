#!/usr/bin/env bash
# Контрольная сверка прода с репо после выкладки (оферта 06.08 → v9).
# Использование: ./check_prod.sh [путь_к_v9_на_проде, напр. /landing_v9.html]
set -uo pipefail
SITE="https://акап.рф"
REPO="/home/hack/akap"
FAIL=0

check() { # check <desc> <url> <grep-ok> [grep-bad...]
  local desc="$1" url="$2" ok="$3"; shift 3
  local body; body=$(curl -s --max-time 20 "$url")
  local bad
  if ! echo "$body" | grep -qE "$ok"; then
    echo "FAIL  $desc: нет '$ok'"; FAIL=1; return
  fi
  for bad in "$@"; do
    if echo "$body" | grep -qE "$bad"; then
      echo "FAIL  $desc: найдено нежелательное '$bad'"; FAIL=1; return
    fi
  done
  echo "OK    $desc"
}

echo "== Оферта =="
check "оферта: редакция 06.08"        "$SITE/guide/offer.html" "Редакция от 06\.08\.2026"
check "оферта: 7 календарных дней"    "$SITE/guide/offer.html" "7 \(семи\) календарных дней"
check "оферта: п. 5.4 возврат"         "$SITE/guide/offer.html" "5\.4\." "14 \(четырнадцати\) календарных дней"
echo "== buy.html =="
check "buy: 7 дней на возврат"        "$SITE/guide/buy.html"   "7 дней на возврат" "14 дней на возврат|визуальные схемы"
check "buy: согласие оферта/политика" "$SITE/guide/buy.html"   "публичной оферты.*политики конфиденциальности"
echo "== v9 (если путь задан) =="
V9_PATH="${1:-}"
if [[ -n "$V9_PATH" ]]; then
  check "v9: реквизиты ИНН"        "$SITE$V9_PATH" "ИНН 772453231807"
  check "v9: футер оферта/политика" "$SITE$V9_PATH" "Публичная оферта.*Политика конфиденциальности"
  check "v9: 7 дней на возврат"     "$SITE$V9_PATH" "7 дней на возврат" "14 дней на возврат|визуальные схемы"
  check "v9: гарантия п. 5.4"       "$SITE$V9_PATH" "5\.4" "Вместо 990"
  check "v9: кнопка → buy.html"     "$SITE$V9_PATH" "guide/buy\.html"
fi

echo "== index.html (главная) =="
check "index: футер возврат 7 дней"   "$SITE/" "возврат — в течение 7 дней" "14 дней"
echo "== Сверка с репо =="
curl -s --max-time 20 "$SITE/guide/offer.html" > /tmp/prod_offer.html
if diff <(grep -vE "^\s*$" /tmp/prod_offer.html) <(grep -vE "^\s*$" "$REPO/guide/offer.html") >/dev/null 2>&1; then
  echo "OK    оферта = репо (побайтно, без пустых строк)"
else
  echo "WARN  оферта отличается от репо (проверь вручную: diff /tmp/prod_offer.html $REPO/guide/offer.html)"
fi

[[ "$FAIL" == "0" ]] && echo "ИТОГ: OK — прод соответствует репо" || echo "ИТОГ: ЕСТЬ РАСХОЖДЕНИЯ"
exit "$FAIL"
