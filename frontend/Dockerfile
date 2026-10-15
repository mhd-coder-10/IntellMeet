
# IntellMeet Frontend - Multi-Stage Dockerfile (Production Ready)
# Stage 1: Build React/Vite application into static bundle
# Stage 2: Serve optimized assets with ultra-lightweight Nginx Alpine (~25MB)


# Stage 1: Vite Builder
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency specifications
COPY package*.json ./

# Install dependencies (clean install)
RUN npm ci

# Copy project source files
COPY . .

# Build-time argument for API URL if needed
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Build production bundle with TypeScript check & Vite
RUN npm run build

# ------------------------------- 

# Stage 2: Production Nginx Server
FROM nginx:alpine AS runner

# Remove default nginx static html files
RUN rm -rf /usr/share/nginx/html/*

# Copy custom Nginx server configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled production bundle from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 80 for HTTP web traffic
EXPOSE 80

# Healthcheck to verify Nginx is actively serving the SPA
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

# Launch Nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
