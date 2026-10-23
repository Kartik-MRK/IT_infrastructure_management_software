# Multi-stage lightweight Node.js 20 production container
FROM node:20-alpine

# Install curl for Docker healthchecks
RUN apk add --no-cache curl

# Set production environment
ENV NODE_ENV=production \
    PORT=5000

# Set working directory
WORKDIR /app

# Copy package manifests first to leverage Docker layer caching
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Copy source code
COPY src ./src

# Use non-root node user for container security
USER node

# Expose backend port
EXPOSE 5000

# Container healthcheck
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1

# Start the Node.js server
CMD ["node", "src/server.js"]
