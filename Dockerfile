# ── Stage 1: build the frontend (Turborepo workspace) ──────────────────────
FROM node:20-slim AS frontend-builder

WORKDIR /frontend

# Install workspace deps from the root lockfile. Copy only manifests first so
# the npm ci layer caches across source-only changes.
COPY package.json package-lock.json turbo.json ./
COPY apps/dashboard/package.json apps/dashboard/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN npm ci --prefer-offline

# Copy the two workspaces and build the dashboard. turbo runs the @coaching/ui
# `tokens` step + `^build` first (see turbo.json dependsOn), then vite build.
COPY packages/ui packages/ui
COPY apps/dashboard apps/dashboard
RUN npx turbo build --filter=@coaching/dashboard

# ── Stage 2: Python application ────────────────────────────────────────────
FROM python:3.12-slim

# Set working directory
WORKDIR /app

# Install build dependencies and Python build backend
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       build-essential \
       curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python build tool
RUN pip install --no-cache-dir hatchling

# Copy project files
COPY pyproject.toml pyproject.toml
COPY src src
COPY README.md README.md
COPY .env.example .env.example

# Install the package and runtime dependencies
RUN pip install --no-cache-dir .

# Copy built frontend — must land at web-ui/dist relative to repo root (/app)
# so web/app.py + WEB_UI_DIST=/app/web-ui/dist stay unchanged.
COPY --from=frontend-builder /frontend/apps/dashboard/dist web-ui/dist

# Default command to run the MCP server using stdio transport
CMD ["mcp", "run", "src/intervals_mcp_server/server.py"]
