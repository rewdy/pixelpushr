#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_root"
bun run --filter '@pixelpushr/api' build
mkdir -p artifacts apps/api/dist/drizzle
cp -R apps/api/drizzle/. apps/api/dist/drizzle/
cp apps/api/package.json apps/api/dist/package.json
cd apps/api/dist
zip -FS -q -r ../../../artifacts/lambda.zip lambda.js migrateLambda.js package.json drizzle
