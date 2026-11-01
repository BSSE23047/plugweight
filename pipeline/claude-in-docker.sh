#!/usr/bin/env bash
# Stands in for the claude command: runs one session in a fresh container with no credentials.
# The stub stays outside the container, so a plugin cannot alter the record of what was sent.
set -euo pipefail

image="${PLUGWEIGHT_IMAGE:-plugweight-capture}"
args=()
mounts=()
while (($#)); do
  if [[ "$1" == "--plugin-dir" ]]; then
    mounts+=(-v "$2:/plugweight-under-test")
    args+=(--plugin-dir /plugweight-under-test)
    shift 2
  else
    args+=("$1")
    shift
  fi
done

port="${ANTHROPIC_BASE_URL:-http://127.0.0.1:0}"
port="${port##*:}"

exec docker run --rm --init \
  --add-host=host.docker.internal:host-gateway \
  --memory=2g --pids-limit=512 --cap-drop=ALL --security-opt=no-new-privileges \
  --user "$(id -u):$(id -g)" \
  -e HOME=/tmp/plugweight-home \
  -e CLAUDE_CONFIG_DIR=/tmp/plugweight-home/config \
  -e "ANTHROPIC_BASE_URL=http://host.docker.internal:${port}" \
  -e ANTHROPIC_API_KEY=plugweight-stub-not-a-real-key \
  -e DISABLE_TELEMETRY=1 -e DISABLE_ERROR_REPORTING=1 -e CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1 \
  "${mounts[@]}" \
  "$image" claude "${args[@]}"
