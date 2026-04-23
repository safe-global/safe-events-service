#
# BUILD CONTAINER
#
FROM node:24 AS base
RUN corepack enable
USER node
WORKDIR /app
COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig*.json ./

# Install dependencies
RUN pnpm install --frozen-lockfile --ignore-scripts

# Copy source code
COPY --chown=node:node . .

# Build application
ENV NODE_ENV=production
RUN pnpm run build

# Clean and reinstall only production dependencies
ENV CI=true
RUN pnpm prune --prod --ignore-scripts

#
# PRODUCTION CONTAINER
#
FROM node:24 AS production
ENV NODE_ENV=production
USER node
EXPOSE 3000
WORKDIR /app

# Copy built application and production node_modules from base stage

COPY --chown=node:node --from=base /app/node_modules ./node_modules
COPY --chown=node:node --from=base /app/dist ./dist
COPY --chown=node:node --from=base /app/scripts ./scripts
COPY --chown=node:node --from=base /app/package.json ./

# Start the application
CMD [ "/bin/bash", "./scripts/docker_run.sh" ]
