# One throwaway container per session. It holds no credentials.
FROM node:22-bookworm-slim
ARG CLAUDE_CODE_VERSION=2.1.316
RUN apt-get update \
  && apt-get install -y --no-install-recommends git python3 python3-pip curl ca-certificates jq \
  && rm -rf /var/lib/apt/lists/* \
  && pip3 install --break-system-packages uv \
  && npm install -g "@anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}" bun \
  && mkdir -p /tmp/plugweight-cwd /tmp/plugweight-home \
  && chmod 1777 /tmp/plugweight-cwd /tmp/plugweight-home
WORKDIR /tmp/plugweight-cwd
