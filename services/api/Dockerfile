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
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/aws-rds-ca-central-1-bundle.pem
WORKDIR /workspace

ADD --checksum=sha256:7e458e5489c48a92217efbe527da1203dc0fddebd802261fae9eed85fedb1e9f https://truststore.pki.rds.amazonaws.com/ca-central-1/ca-central-1-bundle.pem /etc/ssl/certs/aws-rds-ca-central-1-bundle.pem

COPY --from=build --chown=node:node /workspace/node_modules ./node_modules
COPY --from=build --chown=node:node /workspace/services/api/package.json ./services/api/package.json
COPY --from=build --chown=node:node /workspace/services/api/node_modules ./services/api/node_modules
COPY --from=build --chown=node:node /workspace/services/api/dist ./services/api/dist

RUN chmod 0444 /etc/ssl/certs/aws-rds-ca-central-1-bundle.pem \
  && rm -rf /usr/local/lib/node_modules/npm \
  && rm -f /usr/local/bin/npm /usr/local/bin/npx

WORKDIR /workspace/services/api
USER node
EXPOSE 3000
CMD ["node", "--require", "./dist/observability/instrumentation.js", "dist/main.js"]
