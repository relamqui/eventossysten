FROM node:20-alpine

RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source files
COPY . .

# Build args (passed by Easypanel)
ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL

# Generate Prisma Client and build Next.js
RUN npx prisma generate
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED=1

EXPOSE 3000

# Push schema to DB on startup, then start the app
CMD ["sh", "-c", "npx prisma db push --schema=./prisma/schema.prisma --accept-data-loss && npm start"]
