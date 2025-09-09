#
# BUILD CONTAINER
#
FROM node:22 AS base
USER node
WORKDIR /app
COPY --chown=node:node package*.json tsconfig*.json ./

# Fix arm64 timeouts
RUN npm ci --fetch-timeout 3600000 --maxsockets 5
COPY --chown=node:node . .
ENV NODE_ENV=production
RUN npm run build

#
# PRODUCTION CONTAINER
#
ENV NODE_ENV=production
FROM node:22 AS production
USER node
EXPOSE 3000
WORKDIR /app
COPY --chown=node:node --from=base /app/node_modules ./node_modules
COPY --chown=node:node --from=base /app/dist ./dist
COPY --chown=node:node --from=base /app/scripts ./scripts
COPY --chown=node:node --from=base /app/package.json ./
# CMD [ "node", "dist/main.js" ]
CMD [ "/bin/bash", "./scripts/docker_run.sh" ]
