# syntax=docker/dockerfile:1.7@sha256:a57df69d0ea827fb7266491f2813635de6f17269be881f696fbfdf2d83dda33e

FROM node:24.22.1-bookworm-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205 AS build

WORKDIR /app
ENV NG_CLI_ANALYTICS=false \
    NODE_OPTIONS=--max-old-space-size=6144
RUN npm install --global pnpm@11.21.0

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=mutakamel-pnpm-store,target=/pnpm/store,sharing=locked \
    pnpm install --frozen-lockfile --store-dir=/pnpm/store

COPY angular.json tsconfig.json tsconfig.app.json .postcssrc.json ./
COPY public ./public
COPY src ./src
RUN pnpm build --configuration production --output-path /build/tenant-portal

FROM nginx:1.27-alpine@sha256:65645c7bb6a0661892a8b03b89d0743208a18dd2f3f17a54ef4b76fb8e2f2a10 AS runner

COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=build /build/tenant-portal/browser/ /usr/share/nginx/html/

USER nginx
EXPOSE 5002
ENTRYPOINT ["nginx"]
CMD ["-g", "daemon off;"]
