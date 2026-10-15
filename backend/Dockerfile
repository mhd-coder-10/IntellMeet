# IntellMeet Backend - Multi-Stage Dockerfile (Production Ready)
# Stage 1: Build & install production dependencies
# Stage 2: Minimal runtime image running as non-root user

# Stage 1: Dependencies Builder
FROM node:20-alpine AS dependencies

WORKDIR /usr/src/app

# Install native compilation dependencies required by bcrypt
RUN apk add --no-cache python3 make g++

# Copy dependency definition files
COPY package*.json ./

# Install only production dependencies (clean install)
RUN npm ci --omit=dev && npm cache clean --force

# -----------------------------------

# Stage 2: Production Runner
FROM node:20-alpine AS runner

WORKDIR /usr/src/app

# Install curl for Docker healthcheck and dumb-init / tini for proper process reaping
RUN apk add --no-cache curl

# Set production environment
ENV NODE_ENV=production
ENV PORT=5100

# Create upload directory and grant ownership to built-in 'node' user
RUN mkdir -p uploads && chown -R node:node /usr/src/app

# Copy production node_modules from dependencies stage
COPY --chown=node:node --from=dependencies /usr/src/app/node_modules ./node_modules

# Copy application source code
COPY --chown=node:node package*.json ./
COPY --chown=node:node src/ ./src/

# Security Best Practice: Use non-root user
USER node

# Expose backend API and Socket.io port
EXPOSE 5100

# Container Healthcheck probe
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:5100/api/health || exit 1

# Start the application
CMD ["node", "src/server.js"]
