FROM node:20-alpine AS base
WORKDIR /app

RUN corepack enable

COPY apps/package.json apps/pnpm-lock.yaml apps/pnpm-workspace.yaml ./apps/
COPY apps/backend/package.json ./apps/backend/
COPY apps/frontend/package.json ./apps/frontend/
COPY apps/ui-config/package.json ./apps/ui-config/

WORKDIR /app/apps
RUN pnpm install --frozen-lockfile

FROM node:20-alpine AS build
WORKDIR /app/apps
COPY --from=base /app/apps/node_modules ./node_modules
COPY apps ./
RUN pnpm --filter @campus-team/api build
RUN pnpm --filter @campus-team/web build

FROM node:20-alpine AS runtime
WORKDIR /app/apps
ENV NODE_ENV=production
COPY --from=build /app/apps /app/apps
EXPOSE 3000 5173
CMD ["sh", "-c", "pnpm install --frozen-lockfile && pnpm --filter @campus-team/api prisma:generate && (pnpm --filter @campus-team/api start & pnpm --filter @campus-team/web preview -- --host 0.0.0.0)"]
