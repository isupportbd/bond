#!/bin/bash
set -e

echo "================================================="
echo "🚀 Starting Bond Data Analysis Portal"
echo "================================================="

# Automatically push/sync database schema if DATABASE_URL is provided
if [ -n "$DATABASE_URL" ]; then
  echo "📦 Synchronizing PostgreSQL database schema..."
  bun maker db:push || echo "⚠️ Database sync warning (continuing startup)..."
fi

# Start the application server
echo "🌟 Starting backend server on port ${PORT:-3000}..."
exec bun src/framework/server.ts
