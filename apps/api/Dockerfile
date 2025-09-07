# Simple container for the API (monorepo-aware)

FROM node:20-alpine

WORKDIR /workspace

# Enable pnpm via corepack
RUN corepack enable

# Copy minimal workspace manifests first for better caching
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/tsconfig ./packages/tsconfig
COPY apps/api/package.json apps/api/tsconfig.json ./apps/api/

# Install deps for the workspace (dev deps needed to build TypeScript)
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build only the API
RUN pnpm --filter ./apps/api build

EXPOSE 3000

# Run the built server
CMD ["node", "apps/api/dist/index.js"]

