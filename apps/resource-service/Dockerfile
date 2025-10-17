# Multi-stage Dockerfile for NestJS Resource Service

# Stage 1: Dependencies and build
FROM node:20-slim AS builder

# Set working directory
WORKDIR /app

# Copy package files from root
COPY package*.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./

# Copy source code with tsconfig
COPY apps/resource-service ./apps/resource-service/

# Install all dependencies (including dev dependencies for building)
RUN npm ci

# Build the resource service
RUN npm run build resource-service

# Stage 2: Production runtime
FROM node:20-alpine AS production

# Create app directory
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nestjs -u 1001

# Copy package files from root
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist

# Copy any additional config files if needed
COPY --chown=nestjs:nodejs tsconfig.json ./

# Switch to non-root user
USER nestjs

# Expose the ports that the resource service runs on
EXPOSE 3007 3008

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('net').createConnection(3008, '0.0.0.0').on('connect', () => process.exit(0)).on('error', () => process.exit(1))"

# Start the resource service
CMD ["node", "dist/apps/resource-service/main.js"]
