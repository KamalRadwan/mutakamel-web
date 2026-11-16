# syntax=docker/dockerfile:1.7@sha256:a57df69d0ea827fb7266491f2813635de6f17269be881f696fbfdf2d83dda33e

# Two runnable targets share one dependency layer:
#   runner (default) -- `next build` + the standalone server, used day to day.
#   dev              -- `next dev` with Compose Watch, only on request.
# Rebuild the runner after a change with `node scripts/rebuild-portal.mjs tenant`
# from the frontend repository (see docs/operations/portal-runtime.md).

FROM node:24.22.1-bookworm-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205 AS base

RUN npm install --global pnpm@11.21.0

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps

# Build with the frontend workspace as context. The adjacent ignore file limits
# that context to Tenant and its single source-based workspace dependency.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tenant-portal/package.json ./tenant-portal/package.json
COPY packages/identifiers/package.json ./packages/identifiers/package.json

# Unlike Admin, Tenant depends on two published @mutakamel packages
# (core-app-contracts, realtime-app-client) that resolve through GitHub
# Packages, so this install has to authenticate. Same idiom the backend images
# use: the generated npmrc stores the literal ${NODE_AUTH_TOKEN} placeholder
# rather than the token, npm expands it from the environment at read time, and
# the file is removed inside the same layer so no registry credential config
# reaches the shipped image.
RUN --mount=type=secret,id=npm_token,target=/run/secrets/npm_token \
    --mount=type=cache,id=mutakamel-pnpm-store,target=/pnpm/store,sharing=locked \
    export NODE_AUTH_TOKEN="$(cat /run/secrets/npm_token)" \
    && printf '%s\n' '@mutakamel:registry=https://npm.pkg.github.com' '//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}' 'always-auth=true' > /root/.npmrc \
    && pnpm --filter tenant-portal... install --frozen-lockfile --store-dir=/pnpm/store \
    && rm -f /root/.npmrc

COPY tenant-portal/next.config.ts tenant-portal/tsconfig.json tenant-portal/postcss.config.mjs ./tenant-portal/
COPY tenant-portal/src ./tenant-portal/src
COPY packages/identifiers/src ./packages/identifiers/src

FROM deps AS dev

ENV NODE_ENV=development

# Next dev creates .next and may update its generated types and TS config.
RUN chown node:node /app /app/tenant-portal /app/tenant-portal/tsconfig.json

USER node
WORKDIR /app/tenant-portal

EXPOSE 5002

# Compose supplies DEV_API_TARGET for the same-origin /api route handler and
# DEV_TENANT_HOST for the loopback host-admission fallback; without the latter
# every page renders notFound(). `dev` already pins port 5002 and --webpack,
# which this app requires -- it has no turbopack config and relies on the
# webpack hook in next.config.ts.
CMD ["pnpm", "dev", "--hostname", "0.0.0.0"]

FROM deps AS build

ENV NODE_ENV=production

# Inlined into the client bundle at build time; Compose passes it as a build
# argument. Absent means realtime stays off (the provider fails closed).
ARG NEXT_PUBLIC_REALTIME_MODE=
ENV NEXT_PUBLIC_REALTIME_MODE=${NEXT_PUBLIC_REALTIME_MODE}

WORKDIR /app/tenant-portal

# `next build` type-checks the app, so a type error fails the rebuild instead
# of reaching the running portal. The persistent build cache keeps a rebuild
# after a small change to a minute or two.
RUN --mount=type=cache,id=mutakamel-tenant-portal-next-cache,target=/app/tenant-portal/.next/cache \
    NODE_OPTIONS=--max-old-space-size=4096 pnpm build

FROM node:24.22.1-bookworm-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205 AS runner

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=5002 \
    HOSTNAME=0.0.0.0

WORKDIR /app

# The standalone output mirrors the workspace layout (outputFileTracingRoot is
# the frontend root), so the server lives at tenant-portal/server.js. Static
# assets are not part of the trace and are copied beside it, as Next requires.
COPY --from=build /app/tenant-portal/.next/standalone ./
COPY --from=build /app/tenant-portal/.next/static ./tenant-portal/.next/static

# Only the runtime cache is writable by the server; shipped code stays root-owned.
RUN mkdir -p tenant-portal/.next/cache \
    && chown node:node tenant-portal/.next/cache

USER node

EXPOSE 5002

# Runtime configuration (TENANT_GATEWAY_INTERNAL_ORIGIN) comes from Compose.
# Same-origin /api/* is routed to the Gateway by the portal edge proxy, exactly
# as a production ingress does; the dev-only route-handler proxy stays off.
CMD ["node", "tenant-portal/server.js"]
