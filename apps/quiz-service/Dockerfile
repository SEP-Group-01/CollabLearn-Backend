# Multi-stage build for quiz-service
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./

# Copy quiz service code
COPY apps/quiz-service ./apps/quiz-service/

# Install dependencies and build
RUN npm ci
RUN npm run build quiz-service

# Production stage
FROM node:20-slim AS production

WORKDIR /app

# Create non-root user
RUN groupadd -g 1001 nodejs && \
    useradd -u 1001 -g nodejs -s /bin/bash -m nestjs

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder
COPY --from=builder --chown=nestjs:nodejs /app/dist/apps/quiz-service ./dist/apps/quiz-service
COPY --chown=nestjs:nodejs tsconfig.json ./

# Switch to non-root user
USER nestjs

EXPOSE 3009

CMD ["node", "dist/apps/quiz-service/main.js"]