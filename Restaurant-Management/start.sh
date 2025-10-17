#!/bin/sh

echo "🚀 Starting Restaurant Management Backend..."

# Generate Prisma client if it doesn't exist
if [ ! -d "node_modules/.prisma" ]; then
  echo "📦 Generating Prisma client..."
  npx prisma generate || echo "⚠️ Warning: Prisma generate failed, continuing anyway..."
fi

# Start the application
echo "🌟 Starting server..."
exec npm start