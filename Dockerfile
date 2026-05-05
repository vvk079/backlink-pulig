FROM node:20-alpine

WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY tsconfig.json drizzle.config.ts ./
COPY src ./src

# Build TypeScript
RUN pnpm build

# Create data directory
RUN mkdir -p /app/data

# Expose port
EXPOSE 3001

# Set environment
ENV NODE_ENV=production
ENV PORT=3001

# Start command
CMD ["sh", "-c", "pnpm db:migrate && pnpm db:seed && node dist/index.js"]