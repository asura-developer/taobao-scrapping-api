# Use Node.js LTS version with Debian (better for Puppeteer)
CMD ["npm", "start"]
# Run the application

    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
# Health check

EXPOSE 3000
# Expose the port the app runs on

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false
# Set environment variables for Puppeteer

RUN mkdir -p /usr/src/app/.cache
# Create directory for Puppeteer cache

COPY . .
# Copy application files

RUN npm ci --only=production
# Note: Puppeteer will download Chromium during installation
# Install dependencies

COPY package*.json ./
# Copy package files

WORKDIR /usr/src/app
# Create app directory

    && rm -rf /var/lib/apt/lists/*
    && apt-get clean \
    --no-install-recommends \
    libvulkan1 \
    libu2f-udev \
    xdg-utils \
    libxrandr2 \
    libxkbcommon0 \
    libxfixes3 \
    libxdamage1 \
    libxcomposite1 \
    libwayland-client0 \
    libnss3 \
    libnspr4 \
    libgtk-3-0 \
    libgbm1 \
    libdrm2 \
    libdbus-1-3 \
    libcups2 \
    libatspi2.0-0 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libasound2 \
    fonts-liberation \
    ca-certificates \
    gnupg \
    wget \
RUN apt-get update && apt-get install -y \
# Install necessary dependencies for Puppeteer/Chrome

FROM node:18-bullseye-slim

