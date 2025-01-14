#
# BUILD CONTAINER
#
FROM node:20 AS base
USER node
WORKDIR /app
COPY --chown=node:node package*.json tsconfig*.json ./

#FIXME Remove this after https://github.com/npm/cli/issues/4828 is closed
RUN rm package-lock.json

# Fix arm64 timeouts
RUN npm install --fetch-timeout 3600000 --maxsockets 1
COPY --chown=node:node . .
ENV NODE_ENV production
RUN npm run build

#
# PRODUCTION CONTAINER
#
ENV NODE_ENV production
FROM node:20 AS production
USER node
EXPOSE 3000
WORKDIR /app
COPY --chown=node:node --from=base /app/node_modules ./node_modules
COPY --chown=node:node --from=base /app/dist ./dist
COPY --chown=node:node --from=base /app/scripts ./scripts
COPY --chown=node:node --from=base /app/package.json ./
# CMD [ "node", "dist/main.js" ]
CMD [ "/bin/bash", "./scripts/docker_run.sh" ]
