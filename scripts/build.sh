#!/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# 构建前端到 dist/client/
npx vite build --outDir "$ROOT/dist/client" --emptyOutDir

echo "Build complete → dist/client/"
