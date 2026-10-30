FROM node:22-bookworm-slim AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl gosu \
  && rm -rf /var/lib/apt/lists/*
ENV PNPM_HOME=/pnpm
ENV PATH="${PNPM_HOME}:${PATH}"
RUN corepack enable && corepack prepare pnpm@10.33.4 --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS build
WORKDIR /app
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV APP_ENV=production
ENV APP_URL=http://127.0.0.1:3000
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/amalfi_production
ENV DIRECT_URL=postgresql://build:build@127.0.0.1:5432/amalfi_production
ENV AUTH_SECRET=build-only-secret-not-used-at-runtime-32
ENV ENCRYPTION_KEY=build-only-encryption-key-32-chars
ENV EMAIL_MARKETING_ENABLED=false
ENV MEDIA_ROOT=/var/lib/amalfi/production/media
RUN pnpm build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV SERVER_ENTRY=/app/server.js
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
RUN groupadd --gid 1001 amalfi && useradd --uid 1001 --gid 1001 --create-home amalfi
COPY --from=build /app/.next/standalone /app
COPY --from=build /app/.next/static /app/.next/static
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/prisma /app/prisma
COPY --from=build /app/scripts /app/scripts
COPY --from=build /app/src /app/src
COPY --from=build /app/package.json /app/package.json
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod 755 /entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "scripts/start-production.mjs"]
