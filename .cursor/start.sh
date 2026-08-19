#!/usr/bin/env bash
# Per-boot startup for actual-backend-app: brings up the Firebase Emulator
# Suite (background) and the React dev server (foreground) pointed at it.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# --- Firebase Emulator Suite (offline demo project + mock credentials) ---
export GOOGLE_APPLICATION_CREDENTIALS="$HOME/.config/firebase-emulator/mock-service-account.json"
export GCLOUD_PROJECT=demo-actual-backend-app
export GOOGLE_CLOUD_PROJECT=demo-actual-backend-app
# Placeholder keys let the Python functions codebase load; real values (set as
# secrets) are required to actually call OpenAI/Stripe.
export OPENAI_API_KEY="${OPENAI_API_KEY:-sk-dummy-for-emulator}"
export STRIPE_SECRET_KEY="${STRIPE_SECRET_KEY:-sk_test_dummy}"
export STRIPE_WEBHOOK_SECRET="${STRIPE_WEBHOOK_SECRET:-whsec_dummy}"

firebase emulators:start --project demo-actual-backend-app \
  --only auth,functions,firestore,storage,ui \
  >/tmp/firebase-emulators.log 2>&1 &

# --- React dev server (Create React App) pointed at the emulators ---
export BROWSER=none
export PORT=3000
export REACT_APP_FIREBASE_API_KEY="${REACT_APP_FIREBASE_API_KEY:-demo-api-key}"
export REACT_APP_FIREBASE_AUTH_DOMAIN="${REACT_APP_FIREBASE_AUTH_DOMAIN:-demo-actual-backend-app.firebaseapp.com}"
export REACT_APP_FIREBASE_PROJECT_ID="${REACT_APP_FIREBASE_PROJECT_ID:-demo-actual-backend-app}"
export REACT_APP_FIREBASE_STORAGE_BUCKET="${REACT_APP_FIREBASE_STORAGE_BUCKET:-demo-actual-backend-app.appspot.com}"
export REACT_APP_FIREBASE_MESSAGING_SENDER_ID="${REACT_APP_FIREBASE_MESSAGING_SENDER_ID:-000000000000}"
export REACT_APP_FIREBASE_APP_ID="${REACT_APP_FIREBASE_APP_ID:-1:000000000000:web:demo}"

# Foreground process keeps `start` attached and surfaces the web-server logs.
exec npm start
