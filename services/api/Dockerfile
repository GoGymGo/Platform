FROM node:24-alpine AS build

WORKDIR /workspace
COPY package.json package-lock.json ./
COPY apps/admin/package.json apps/admin/package.json
COPY apps/landing/package.json apps/landing/package.json
COPY apps/member-app/package.json apps/member-app/package.json
COPY services/api/package.json services/api/package.json
COPY packages/brand/package.json packages/brand/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN npm ci --ignore-scripts --workspace @gogymgo/api

COPY services/api services/api
RUN npm run build --workspace @gogymgo/api \
  && npm prune --omit=dev --ignore-scripts

FROM node:24-alpine AS runtime

ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /workspace

COPY --from=build --chown=node:node /workspace/node_modules ./node_modules
COPY --from=build --chown=node:node /workspace/services/api/package.json ./services/api/package.json
COPY --from=build --chown=node:node /workspace/services/api/node_modules ./services/api/node_modules
COPY --from=build --chown=node:node /workspace/services/api/dist ./services/api/dist

RUN rm -rf /usr/local/lib/node_modules/npm \
  && rm -f /usr/local/bin/npm /usr/local/bin/npx

WORKDIR /workspace/services/api
USER node
EXPOSE 3000
CMD ["node", "--require", "./dist/observability/instrumentation.js", "dist/main.js"]
