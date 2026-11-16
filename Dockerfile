#
# BASE
#
FROM node:24.22.3-slim AS base
WORKDIR /app
COPY package.json ./
RUN corepack enable pnpm && corepack install
COPY pnpm-lock.yaml pnpm-workspace.yaml ./

#
# PRODUCTION DEPENDENCIES
#
FROM base AS prod-deps
RUN --mount=type=cache,id=pnpm,target=/var/cache/pnpm \
    pnpm install --store-dir /var/cache/pnpm --frozen-lockfile --prod --ignore-scripts

#
# BUILD
#
FROM base AS build
RUN --mount=type=cache,id=pnpm,target=/var/cache/pnpm \
    pnpm install --store-dir /var/cache/pnpm --frozen-lockfile --ignore-scripts
COPY . .
ENV NODE_ENV=production
RUN pnpm run build && rm -rf node_modules src

#
# PRODUCTION CONTAINER
#
FROM node:24.22.3-slim AS production
ENV NODE_ENV=production
WORKDIR /app

COPY --from=prod-deps /app/node_modules ./node_modules
# The runtime files are the build context that .dockerignore allows, plus dist
COPY --from=build /app ./

USER node
EXPOSE 3000

# Declared after the build steps so a new commit does not invalidate the
# cached layers above
ARG BUILD_COMMIT
ENV BUILD_COMMIT=${BUILD_COMMIT}

CMD [ "/bin/bash", "./scripts/docker_run.sh" ]
