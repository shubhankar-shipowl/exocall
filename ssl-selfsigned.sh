#!/bin/bash
set -e
mkdir -p ssl
OPENSSL_SUBJ=${OPENSSL_SUBJ:-"/C=US/ST=Local/L=Local/O=ExoCall/OU=Dev/CN=localhost"}
DAYS=${DAYS:-365}
KEY=ssl/selfsigned.key
CRT=ssl/selfsigned.crt

if [ -f "$KEY" ] || [ -f "$CRT" ]; then
  echo "Existing self-signed certs found in ssl/. Remove to recreate.";
  exit 0;
fi

openssl req -x509 -nodes -days "$DAYS" -newkey rsa:2048 \
  -keyout "$KEY" -out "$CRT" -subj "$OPENSSL_SUBJ"

echo "Generated: $KEY and $CRT"
echo "Update nginx.conf to use these paths and set server_name localhost;"
