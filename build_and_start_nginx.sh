#!/bin/bash
set -euo pipefail

cd /src/build-your-own-radar

echo "Starting webpack build..."
npm run build:prod

echo "Copying built files to nginx directories..."

mkdir -p /opt/build-your-own-radar
cd /opt/build-your-own-radar
cp -r /src/build-your-own-radar/dist/* ./
mkdir -p files

cp /src/build-your-own-radar/spec/end_to_end_tests/resources/localfiles/* ./files/
cp /src/build-your-own-radar/default.template /etc/nginx/conf.d/default.conf

term_handler() {
  if [[ -n "${NGINX_PID:-}" ]]; then kill -TERM "$NGINX_PID" 2>/dev/null || true; fi
  if [[ -n "${UPLOAD_PID:-}" ]]; then kill -TERM "$UPLOAD_PID" 2>/dev/null || true; fi
}
trap term_handler INT TERM

echo "Starting upload server..."
FILES_DIR=/opt/build-your-own-radar/files UPLOAD_HOST=127.0.0.1 UPLOAD_PORT=3000 node /src/build-your-own-radar/server/upload.js &
UPLOAD_PID=$!

echo "Starting nginx server..."
nginx -g 'daemon off;' &
NGINX_PID=$!

wait -n "$NGINX_PID" "$UPLOAD_PID"
term_handler
wait
