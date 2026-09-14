# syntax=docker/dockerfile:1.7@sha256:a57df69d0ea827fb7266491f2813635de6f17269be881f696fbfdf2d83dda33e

FROM node:24-bookworm-slim

RUN npm install --global pnpm@11.21.0

WORKDIR /app

ENV NODE_ENV=development \
    NEXT_TELEMETRY_DISABLED=1

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

COPY tenant-portal/next.config.ts tenant-portal/next-env.d.ts tenant-portal/tsconfig.json tenant-portal/postcss.config.mjs ./tenant-portal/
COPY tenant-portal/src ./tenant-portal/src
COPY packages/identifiers/src ./packages/identifiers/src

# Next dev creates .next and may update its generated types and TS config.
RUN chown node:node /app /app/tenant-portal /app/tenant-portal/next-env.d.ts /app/tenant-portal/tsconfig.json

USER node
WORKDIR /app/tenant-portal

EXPOSE 5002

# Compose supplies DEV_API_TARGET for the same-origin /api route handler and
# DEV_TENANT_HOST for the loopback host-admission fallback; without the latter
# every page renders notFound(). `dev` already pins port 5002 and --webpack,
# which this app requires -- it has no turbopack config and relies on the
# webpack hook in next.config.ts.
CMD ["pnpm", "dev", "--hostname", "0.0.0.0"]
