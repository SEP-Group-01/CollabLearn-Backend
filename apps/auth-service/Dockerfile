# Multi-stage Dockerfile for NestJS Auth Service

# Stage 1: Dependencies and build
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files from root
COPY package*.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./

# Copy source code
COPY apps/auth-service ./apps/auth-service/

# Install all dependencies (including dev dependencies for building)
RUN npm ci

# Build the auth service
RUN npm run build auth-service

# Stage 2: Production runtime
FROM node:18-alpine AS production

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

# Expose the port that the auth service runs on
EXPOSE 3002

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('net').createConnection(3002, '0.0.0.0').on('connect', () => process.exit(0)).on('error', () => process.exit(1))"

# Start the auth service
CMD ["node", "dist/apps/auth-service/main.js"]