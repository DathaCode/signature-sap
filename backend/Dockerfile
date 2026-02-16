# Development stage
FROM node:20-alpine AS development

WORKDIR /app

# Install OpenSSL and other dependencies for Prisma
RUN apk add --no-cache openssl libc6-compat

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies (including devDependencies)
RUN npm install

# Copy prisma schema
COPY prisma ./prisma

# Generate Prisma Client
RUN npx prisma generate

# Copy source code
COPY . .

# Expose port
EXPOSE 5000

# Development command (will be overridden by docker-compose)
CMD ["npm", "run", "dev"]

# Production build stage
FROM node:20-alpine AS build

WORKDIR /app

# Install OpenSSL for Prisma generate
RUN apk add --no-cache openssl libc6-compat

COPY package*.json ./
COPY tsconfig.json ./

RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY . .

# Compile migration/seed/admin scripts
RUN npx tsc prisma/seed.ts scripts/create-admin.ts --outDir dist --skipLibCheck --module commonjs --target es2020 --esModuleInterop

RUN npm run build && npm prune --production

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Install OpenSSL for runtime
RUN apk add --no-cache openssl libc6-compat

ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package*.json ./

EXPOSE 5000

CMD ["node", "dist/server.js"]
