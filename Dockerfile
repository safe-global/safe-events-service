#
# BUILD CONTAINER
#
FROM node:25 AS base
USER node
WORKDIR /app
COPY --chown=node:node package*.json tsconfig*.json ./

RUN npm ci
COPY --chown=node:node . .
ENV NODE_ENV=production
RUN npm run build

#
# PRODUCTION CONTAINER
#
ENV NODE_ENV=production
FROM node:25 AS production
USER node
EXPOSE 3000
WORKDIR /app
COPY --chown=node:node --from=base /app/node_modules ./node_modules
COPY --chown=node:node --from=base /app/dist ./dist
COPY --chown=node:node --from=base /app/scripts ./scripts
COPY --chown=node:node --from=base /app/package.json ./
COPY --chown=node:node --from=base /app/package-lock.json ./

# CMD [ "node", "dist/main.js" ]
CMD [ "/bin/bash", "./scripts/docker_run.sh" ]
