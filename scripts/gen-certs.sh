#!/usr/bin/env bash
# Genera un self-signed cert para uso on-premise en LAN.
# Cobertura: *.nip.io (acceso por <IP>.nip.io) + localhost + 127.0.0.1.
# Validez: 825 días (límite máx que Apple acepta sin warning extra).
set -euo pipefail

CERT_DIR="$(dirname "$0")/../nginx/certs"
mkdir -p "$CERT_DIR"

if [[ -f "$CERT_DIR/server.crt" && -f "$CERT_DIR/server.key" ]]; then
  echo "⚠  Ya existen certs en $CERT_DIR. Borralos antes si querés regenerar."
  exit 0
fi

openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout "$CERT_DIR/server.key" \
  -out    "$CERT_DIR/server.crt" \
  -days 825 \
  -subj "/C=PY/ST=Alto Parana/L=Hernandarias/O=Penguin Infrastructure/CN=*.nip.io" \
  -addext "subjectAltName=DNS:*.nip.io,DNS:localhost,IP:127.0.0.1,IP:0.0.0.0"

echo "Certs generados en $CERT_DIR/"
ls -la "$CERT_DIR"
