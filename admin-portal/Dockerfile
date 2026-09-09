FROM node:24-bookworm-slim

RUN npm install --global pnpm@11.21.0

WORKDIR /app

ENV NODE_ENV=development \
    NEXT_TELEMETRY_DISABLED=1

# Build with the frontend workspace as context. The adjacent ignore file limits
# that context to Admin and its two source-based workspace dependencies.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY admin-portal/package.json ./admin-portal/package.json
COPY packages/identifiers/package.json ./packages/identifiers/package.json
COPY packages/webphone/package.json ./packages/webphone/package.json

RUN pnpm --filter admin-portal... install --frozen-lockfile

COPY admin-portal/next.config.ts admin-portal/next-env.d.ts admin-portal/tsconfig.json admin-portal/postcss.config.mjs ./admin-portal/
COPY admin-portal/src ./admin-portal/src
COPY packages/identifiers/src ./packages/identifiers/src
COPY packages/webphone/src ./packages/webphone/src

# Next dev creates .next and may update its generated types and TS config.
RUN chown node:node /app /app/admin-portal /app/admin-portal/next-env.d.ts /app/admin-portal/tsconfig.json

USER node
WORKDIR /app/admin-portal

EXPOSE 5001

# Compose supplies DEV_API_TARGET for the existing same-origin /api rewrite.
CMD ["pnpm", "dev", "--hostname", "0.0.0.0"]
