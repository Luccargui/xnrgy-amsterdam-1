#!/bin/sh
# Sube la versión de la web: app.js, version.txt y las URLs de index.html.
# Uso: sh tools/bump-version.sh 2026-11-03-2
set -e
V="$1"; [ -n "$V" ] || { echo "Uso: $0 VERSION"; exit 1; }
cd "$(dirname "$0")/.."
sed -i "s/^var APP_VERSION = \"[^\"]*\";/var APP_VERSION = \"$V\";/" app.js
sed -i -E "s/(styles\.css|i18n\.js|app\.js)\?v=[^\"]+/\1?v=$V/g" index.html
sed -i -E "s/(register\(\"sw\.js)\?v=[^\"]*/\1?v=$V/" app.js
echo "$V" > version.txt
echo "Versión $V"
