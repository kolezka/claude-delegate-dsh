#!/bin/sh
set -eu
cd "$(dirname "$0")"
if [ ! -f node_modules/@modelcontextprotocol/sdk/package.json ] || [ ! -f node_modules/zod/package.json ]; then
  (unset DSH_URL DSH_LAUNCH_TOKEN; bun install --production --ignore-scripts --frozen-lockfile) >&2
fi
exec bun --no-env-file --no-install ./index.ts
