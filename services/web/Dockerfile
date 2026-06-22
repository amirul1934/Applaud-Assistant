FROM node:20-slim
RUN corepack enable
WORKDIR /app
COPY package.json ./
RUN pnpm install
COPY . .
EXPOSE 3000
# Dev server for the foundation; swap to `pnpm build` + a static server for production.
CMD ["pnpm", "dev"]
