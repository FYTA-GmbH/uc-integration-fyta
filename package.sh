#!/bin/bash
# Script to package the FYTA integration for Remote Two

# Change to the current directory
cd "$(dirname "$0")"

echo "Packaging FYTA integration for Remote Two..."

# Clean up any previous package
rm -rf package
mkdir -p package/fyta/bin
mkdir -p package/fyta/config
mkdir -p package/fyta/data

# Copy the driver.json to the root directory
cp src/driver.json package/fyta/

# Copy the Node.js files to the bin directory
cp src/*.js package/fyta/bin/
cp src/package.json package/fyta/bin/

# Install dependencies in the bin directory
cd package/fyta/bin
npm install --production
cd ../../..

# Create the package
cd package
tar czf fyta-integration.tar.gz fyta
cd ..

echo "Package created at package/fyta-integration.tar.gz"
echo "You can now upload this file to your Remote Two device" 