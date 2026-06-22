FROM node:20-slim

# better-sqlite3 needs build tooling for its native addon.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable
WORKDIR /app

COPY package.json ./
RUN pnpm install

COPY tsconfig.json ./
COPY src ./src

ENV NODE_ENV=production
EXPOSE 8080
CMD ["pnpm", "tsx", "src/index.ts"]
