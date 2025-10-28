# Multi-stage Dockerfile for Hyperpage
# Security-hardened for production deployment

# Build stage
FROM node:22-alpine AS builder

# Install build dependencies and security updates
RUN apk update && apk upgrade && \
    apk add --no-cache git ca-certificates && \
    npm install -g npm@latest

# Create app user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S hyperpage -u 1001

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev)
RUN npm ci --only=production=false && npm cache clean --force

# Copy source code
COPY . .

# Build application
RUN npm run build && \
    npm prune --production

# Production stage
FROM node:22-alpine AS runtime

# Install security updates and required packages
RUN apk update && apk upgrade && \
    apk add --no-cache ca-certificates dumb-init su-exec && \
    rm -rf /var/cache/apk/* && \
    npm install -g npm@latest

# Create app user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S hyperpage -u 1001

# Set working directory
WORKDIR /app

# Copy built application from builder stage
COPY --from=builder --chown=hyperpage:nodejs /app/package*.json ./
COPY --from=builder --chown=hyperpage:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=hyperpage:nodejs /app/.next ./.next
COPY --from=builder --chown=hyperpage:nodejs /app/public ./public
COPY --from=builder --chown=hyperpage:nodejs /app/lib ./lib
COPY --from=builder --chown=hyperpage:nodejs /app/app ./app
COPY --from=builder --chown=hyperpage:nodejs /app/components ./components
COPY --from=builder --chown=hyperpage:nodejs /app/tools ./tools

# Switch to non-root user
USER hyperpage

# Expose port
EXPOSE 3000

# Health check for Kubernetes probes
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["npm", "start"]
