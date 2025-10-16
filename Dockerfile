# Use official Node.js LTS image
FROM node:lts-alpine

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN pnpm run build

# Set environment variables
ENV CONFIG_DIR=/app/config
ENV DATABASE_PATH=/app/data/database.db

# Create volumes for persistent data
VOLUME /app/config
VOLUME /app/data

# Expose the port
EXPOSE 7532

# Start the application
CMD ["pnpm", "start"]
