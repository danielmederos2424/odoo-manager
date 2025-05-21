#!/bin/bash
# Script to build Linux packages using Docker

# Ensure script fails on any error
set -e

echo "Building Linux packages using Docker..."

# Create a temporary Dockerfile
cat > Dockerfile.build << EOF
FROM electronuserland/builder:latest

WORKDIR /project
COPY . .

# Install dependencies
RUN npm install

# Build for Linux
RUN npm run build:linux
EOF

# Build the Docker image
docker build -t odoo-manager-builder -f Dockerfile.build .

# Create a container and copy the release files
CONTAINER_ID=$(docker create odoo-manager-builder)
docker cp $CONTAINER_ID:/project/release ./
docker rm $CONTAINER_ID

# Clean up
rm Dockerfile.build

echo "Linux builds completed successfully!"
echo "Packages are available in the 'release' directory"