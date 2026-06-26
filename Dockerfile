# ── Stage 1: build the frontend ────────────────────────────────────────────
FROM node:20-slim AS frontend-builder

WORKDIR /frontend

COPY web-ui/package.json web-ui/package-lock.json ./
RUN npm ci --prefer-offline

COPY web-ui/ ./
RUN npm run build

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
COPY --from=frontend-builder /frontend/dist web-ui/dist

# Default command to run the MCP server using stdio transport
CMD ["mcp", "run", "src/intervals_mcp_server/server.py"]
