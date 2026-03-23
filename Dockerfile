FROM node:22-slim AS base

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/

# Install all dependencies
RUN npm install

# Copy source
COPY client/ client/
COPY server/ server/

# Build client
RUN cd client && npx vite build

# Expose port
ENV PORT=3001
EXPOSE 3001

# Start server with tsx
CMD ["node", "node_modules/tsx/dist/cli.mjs", "server/src/index.ts"]
