# ─────────────────────────────────────────────────────────────────────────────
# Facial.io — NestJS Server Dockerfile
#
# Multi-stage build:
#   Stage 1 (development) — used by Docker Compose locally, hot reload via watch
#   Stage 2 (builder)     — compiles TypeScript to dist/
#   Stage 3 (production)  — minimal image with only the compiled output
#
# Why multi-stage?
#   The production image has NO devDependencies, NO TypeScript compiler,
#   NO source files. Smaller attack surface, faster cold start on Render.
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Development ──────────────────────────────────────────────────────
FROM node:22-alpine AS development
WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps
COPY . .
EXPOSE 3001
CMD ["npm", "run", "start:dev"]


# ── Stage 2: Build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN npm run build


# ── Stage 3: Production ───────────────────────────────────────────────────────
FROM node:22-alpine AS production
WORKDIR /app

# Only copy production deps manifest and install — no devDeps
COPY package*.json ./
RUN npm ci --omit=dev --legacy-peer-deps

# Copy compiled output from builder stage
COPY --from=builder /app/dist ./dist

EXPOSE 3001
CMD ["node", "dist/main"]
