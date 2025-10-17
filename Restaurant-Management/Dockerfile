# Backend Dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev for Prisma) with retry logic
RUN npm config set registry https://registry.npmjs.org/ && \
    npm install --verbose || npm install --verbose || npm install --verbose

# Copy source code
COPY . .

# Generate Prisma client at build time
RUN npx prisma generate || echo "⚠️ Prisma generate failed at build time"

# Expose port
EXPOSE 3000

# Start the application with Prisma regeneration
CMD ["sh", "-c", "npx prisma generate && npm start"]