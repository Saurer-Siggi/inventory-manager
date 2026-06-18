# Build stage
FROM node:25-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM node:25-slim AS production

WORKDIR /app
ENV NODE_ENV=production
# SQLite database lives on a mounted volume (see docker-compose.yml)
ENV DATABASE_PATH=/data/inventory.db

COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

RUN mkdir -p /data

EXPOSE 3000

CMD ["node", "build"]
