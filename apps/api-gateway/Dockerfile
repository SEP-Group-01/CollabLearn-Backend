# Multi-stage Dockerfile for NestJS API Gateway

# Stage 1: Dependencies and build
FROM node:20-slim AS builder

# Set working directory
WORKDIR /app

# Copy package files from root
COPY package*.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./

# Copy source code
COPY apps/api-gateway ./apps/api-gateway/

# Install all dependencies (including dev dependencies for building)
RUN npm ci

# Build the API Gateway
RUN npm run build api-gateway

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

# Expose the ports that the API Gateway runs on
EXPOSE 3000 3001

# Health check for HTTP endpoint
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Start the API Gateway
CMD ["node", "dist/apps/api-gateway/main.js"]