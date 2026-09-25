#!/usr/bin/env bash
# Lance la suite de tests Vitest depuis CE dossier, quel que soit le répertoire
# courant. Aucune dépendance à un chemin absolu.
#
# Usage : bash run-tests.sh [args vitest]     (ex. : bash run-tests.sh run)
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

if [ ! -d node_modules ]; then
  echo "node_modules absent. Lance d'abord : npm ci" >&2
  exit 1
fi

exec npx --no-install vitest "$@"
