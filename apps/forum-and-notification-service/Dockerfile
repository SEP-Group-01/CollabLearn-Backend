# Multi-stage Dockerfile for Forum and Notification Service

# Stage 1: Dependencies and build
FROM node:20-slim AS builder

# Set working directory
WORKDIR /app

# Copy package files from root
COPY package*.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./

# Copy source code
COPY apps/forum-and-notification-service ./apps/forum-and-notification-service/

# Install all dependencies (including dev dependencies for building)
RUN npm ci

# Build the Forum and Notification Service
RUN npm run build forum-and-notification-service

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
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist

# Copy any additional config files if needed
COPY --chown=nestjs:nodejs tsconfig.json ./

# Switch to non-root user
USER nestjs

# Expose the ports that the Forum Service runs on
# 3004: HTTP/WebSocket Server
# 3005: TCP Microservice (if enabled)
EXPOSE 3004 3005

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3004/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Start the application
CMD ["node", "dist/apps/forum-and-notification-service/main.js"]
