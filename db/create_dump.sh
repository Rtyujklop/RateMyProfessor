#!/usr/bin/env bash
set -euo pipefail

# Generate a data-only MySQL dump suitable for re-seeding after terraform rebuilds.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

DEFAULT_CA_PATH="$REPO_ROOT/global-bundle.pem"
DEFAULT_OUTPUT_PATH="$SCRIPT_DIR/db_seed.sql"

usage() {
  cat <<EOF
Usage:
  $(basename "$0") --host <rds-host> [options]

Required:
  --host <value>            RDS/MySQL hostname

Options:
  --port <value>            MySQL port (default: 3306)
  --user <value>            MySQL username (default: admin)
  --db <value>              Database name (default: ratemyprof)
  --password <value>        MySQL password (or set MYSQL_PWD env var)
  --ssl-ca <path>           CA bundle path (default: $DEFAULT_CA_PATH)
  --output <path>           Output sql file (default: $DEFAULT_OUTPUT_PATH)
  --help                    Show this message

Examples:
  $(basename "$0") --host alex-dev-ratemyprof-db.example.us-east-2.rds.amazonaws.com
  MYSQL_PWD='secret' $(basename "$0") --host <host> --output "$SCRIPT_DIR/db_seed.sql"
EOF
}

HOST=""
PORT="3306"
USER="admin"
DB_NAME="ratemyprof"
SSL_CA="$DEFAULT_CA_PATH"
OUTPUT_PATH="$DEFAULT_OUTPUT_PATH"
PASSWORD="${MYSQL_PWD:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --host)
      HOST="$2"
      shift 2
      ;;
    --port)
      PORT="$2"
      shift 2
      ;;
    --user)
      USER="$2"
      shift 2
      ;;
    --db)
      DB_NAME="$2"
      shift 2
      ;;
    --password)
      PASSWORD="$2"
      shift 2
      ;;
    --ssl-ca)
      SSL_CA="$2"
      shift 2
      ;;
    --output)
      OUTPUT_PATH="$2"
      shift 2
      ;;
    --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "$HOST" ]]; then
  echo "Error: --host is required." >&2
  usage
  exit 1
fi

if [[ ! -f "$SSL_CA" ]]; then
  echo "Error: CA file not found at '$SSL_CA'." >&2
  exit 1
fi

if [[ -z "$PASSWORD" ]]; then
  read -r -s -p "MySQL password for '$USER': " PASSWORD
  echo
fi

mkdir -p "$(dirname "$OUTPUT_PATH")"

export MYSQL_PWD="$PASSWORD"
mysqldump \
  -h "$HOST" \
  -P "$PORT" \
  -u "$USER" \
  --ssl-mode=VERIFY_IDENTITY \
  --ssl-ca="$SSL_CA" \
  --single-transaction \
  --skip-lock-tables \
  --skip-add-locks \
  --skip-disable-keys \
  --no-create-info \
  --skip-triggers \
  --set-gtid-purged=OFF \
  --no-tablespaces \
  "$DB_NAME" > "$OUTPUT_PATH"
unset MYSQL_PWD

echo "Data-only dump written to: $OUTPUT_PATH"
