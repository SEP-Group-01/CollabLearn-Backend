# Multi-stage Dockerfile for NestJS Workspaces Service

# Stage 1: Dependencies and build
FROM node:20-slim AS builder

# Set working directory
WORKDIR /app

# Copy package files from root
COPY package*.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./

# Copy source code
COPY apps/workspaces-service ./apps/workspaces-service/

# Install all dependencies (including dev dependencies for building)
RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-maxtimeout 300000 && \
    npm config set fetch-retry-mintimeout 10000 && \
    npm ci --maxsockets 1

# Build the workspaces service
RUN npm run build workspaces-service

# Stage 2: Production runtime
FROM node:20-slim AS production

# Create app directory
WORKDIR /app

# Create non-root user for security
RUN groupadd -g 1001 nodejs && \
    useradd -r -u 1001 -g nodejs nestjs

# Copy package files from root
COPY package*.json ./

# Install only production dependencies
RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-maxtimeout 300000 && \
    npm config set fetch-retry-mintimeout 10000 && \
    npm ci --only=production --maxsockets 1 && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist

# Copy any additional config files if needed
COPY --chown=nestjs:nodejs tsconfig.json ./

# Switch to non-root user
USER nestjs

# Expose the port that the workspaces service runs on
EXPOSE 3003

# Health check for TCP service
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('net').createConnection(3003, '0.0.0.0').on('connect', () => process.exit(0)).on('error', () => process.exit(1))"

# Start the Workspaces Service
CMD ["node", "dist/apps/workspaces-service/main.js"]