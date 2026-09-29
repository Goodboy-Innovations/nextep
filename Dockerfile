# syntax=docker/dockerfile:1
# Multi-arch (amd64 + arm64): works on Linux, Windows (WSL2) and macOS (Intel and Apple Silicon).

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Full source + dev dependencies. Also used by the `migrate` and `seed` compose services.
FROM deps AS build
COPY . .
# SvelteKit imports server modules while analysing the build; they need *a* database URL
# but never connect. The real one is given at runtime.
RUN DATABASE_URL=postgres://build:build@localhost:5432/build npm run build

FROM node:24-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:24-alpine AS runtime
WORKDIR /app
# BODY_SIZE_LIMIT: adapter-node rejects bodies over 512 kB by default; image uploads need more.
ENV NODE_ENV=production \
	PORT=3000 \
	BODY_SIZE_LIMIT=5M
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY package.json ./
USER node
EXPOSE 3000
CMD ["node", "build"]
