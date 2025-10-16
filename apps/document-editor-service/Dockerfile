# Multi-stage Dockerfile for NestJS Document Editor Service

# Stage 1: Dependencies and build
FROM node:20-slim AS builder

# Set working directory
WORKDIR /app

# Copy package files from root
COPY package*.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./

# Copy source code
COPY apps/document-editor-service ./apps/document-editor-service/

# Install all dependencies (including dev dependencies for building)
RUN npm ci

# Build the document editor service
RUN npm run build document-editor-service

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

# Create uploads directory with proper permissions
RUN mkdir -p /app/uploads && chown -R nestjs:nodejs /app/uploads

# Switch to non-root user
USER nestjs

# Expose the port that the document editor service runs on
EXPOSE 3006

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('net').createConnection(3006, '0.0.0.0').on('connect', () => process.exit(0)).on('error', () => process.exit(1))"

# Start the document editor service
CMD ["node", "dist/apps/document-editor-service/main.js"]
