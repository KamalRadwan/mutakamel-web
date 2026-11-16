# syntax=docker/dockerfile:1.7@sha256:a57df69d0ea827fb7266491f2813635de6f17269be881f696fbfdf2d83dda33e

# Two runnable targets share one dependency layer:
#   runner (default) -- `next build` + the standalone server, used day to day.
#   dev              -- `next dev` with Compose Watch, only on request.
# Rebuild the runner after a change with `node scripts/rebuild-portal.mjs admin`
# from the frontend repository (see docs/operations/portal-runtime.md).

FROM node:24.22.1-bookworm-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205 AS base

RUN npm install --global pnpm@11.21.0

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps

# Build with the frontend workspace as context. The adjacent ignore file limits
# that context to Admin and its two source-based workspace dependencies.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY admin-portal/package.json ./admin-portal/package.json
COPY packages/identifiers/package.json ./packages/identifiers/package.json
COPY packages/webphone/package.json ./packages/webphone/package.json

RUN --mount=type=cache,id=mutakamel-pnpm-store,target=/pnpm/store,sharing=locked \
    pnpm --filter admin-portal... install --frozen-lockfile --store-dir=/pnpm/store

COPY admin-portal/next.config.ts admin-portal/tsconfig.json admin-portal/postcss.config.mjs ./admin-portal/
COPY admin-portal/src ./admin-portal/src
COPY packages/identifiers/src ./packages/identifiers/src
COPY packages/webphone/src ./packages/webphone/src

FROM deps AS dev

ENV NODE_ENV=development

# Next dev creates .next and may update its generated types and TS config.
RUN chown node:node /app /app/admin-portal /app/admin-portal/tsconfig.json

USER node
WORKDIR /app/admin-portal

EXPOSE 5001

# Compose supplies DEV_API_TARGET for the existing same-origin /api rewrite.
CMD ["pnpm", "dev", "--hostname", "0.0.0.0"]

FROM deps AS build

ENV NODE_ENV=production

WORKDIR /app/admin-portal

# `next build` type-checks the app, so a type error fails the rebuild instead
# of reaching the running portal. The persistent build cache keeps a rebuild
# after a small change to a minute or two.
RUN --mount=type=cache,id=mutakamel-admin-portal-next-cache,target=/app/admin-portal/.next/cache \
    NODE_OPTIONS=--max-old-space-size=4096 pnpm build

FROM node:24.22.1-bookworm-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205 AS runner

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=5001 \
    HOSTNAME=0.0.0.0

WORKDIR /app

# The standalone output mirrors the workspace layout (outputFileTracingRoot is
# the frontend root), so the server lives at admin-portal/server.js. Static
# assets are not part of the trace and are copied beside it, as Next requires.
COPY --from=build /app/admin-portal/.next/standalone ./
COPY --from=build /app/admin-portal/.next/static ./admin-portal/.next/static

# Only the runtime cache is writable by the server; shipped code stays root-owned.
RUN mkdir -p admin-portal/.next/cache \
    && chown node:node admin-portal/.next/cache

USER node

EXPOSE 5001

# The /api rewrite is development-only (next.config.ts); in this image the
# portal edge proxy routes same-origin /api/* to the Gateway, exactly as a
# production ingress does.
CMD ["node", "admin-portal/server.js"]
