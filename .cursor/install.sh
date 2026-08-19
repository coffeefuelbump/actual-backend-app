#!/usr/bin/env bash
# Idempotent Cloud Agent install for actual-backend-app.
# Sets up the React frontend, the Node + Python Cloud Functions codebases, the
# Firebase CLI, the emulator binaries, and a mock service-account credential so
# the Firebase Emulator Suite runs fully offline.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# --- System dependency: python venv module (missing from the base image) ---
if ! python3 -c "import ensurepip" >/dev/null 2>&1; then
  sudo apt-get update -qq
  sudo apt-get install -y python3.12-venv
fi

# --- Frontend dependencies ---
npm ci

# --- Node Cloud Functions dependencies ---
(cd function && npm ci)

# --- Python Cloud Functions virtual environment ---
python3 -m venv python_functions/venv
python_functions/venv/bin/pip install --upgrade pip
python_functions/venv/bin/pip install -r python_functions/requirements.txt

# --- Firebase CLI (global) ---
if ! command -v firebase >/dev/null 2>&1; then
  sudo env "PATH=$PATH" npm install -g firebase-tools
fi

# --- Pre-download emulator binaries so startup is fast and offline-capable ---
for e in firestore storage pubsub ui; do
  firebase setup:emulators:"$e"
done

# --- Mock service account for the emulator ---
# firebase-admin 6.x resolves Application Default Credentials even when talking
# to the emulator; a structurally valid (non-production) key lets it do so
# offline. The demo- project id keeps every emulator in offline mode.
CRED_DIR="$HOME/.config/firebase-emulator"
CRED_FILE="$CRED_DIR/mock-service-account.json"
if [ ! -f "$CRED_FILE" ]; then
  mkdir -p "$CRED_DIR"
  KEY="$(openssl genrsa 2048 2>/dev/null)"
  KEY="$KEY" python3 - "$CRED_FILE" <<'PY'
import json, os, sys
key = os.environ["KEY"]
sa = {
    "type": "service_account",
    "project_id": "demo-actual-backend-app",
    "private_key_id": "mock-key-id",
    "private_key": key if key.endswith("\n") else key + "\n",
    "client_email": "mock-emulator@demo-actual-backend-app.iam.gserviceaccount.com",
    "client_id": "000000000000000000000",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/mock-emulator%40demo-actual-backend-app.iam.gserviceaccount.com",
}
with open(sys.argv[1], "w") as f:
    json.dump(sa, f, indent=2)
print("wrote", sys.argv[1])
PY
fi

echo "install.sh completed successfully."
