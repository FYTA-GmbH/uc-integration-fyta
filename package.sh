#!/bin/bash
# Script to package the FYTA integration for Unfolded Circle Remote Two
# Following the official documentation: https://github.com/unfoldedcircle/core-api/blob/main/doc/integration-driver/driver-installation.md
# and the Roon integration's build workflow

echo "Creating package directory..."
rm -rf package
mkdir -p package/bin
mkdir -p package/config
mkdir -p package/data

echo "Installing dependencies..."
# Create a temporary package.json in the bin directory
cat > package/bin/package.json << 'EOF'
{
  "name": "fyta-integration",
  "version": "0.1.0",
  "description": "FYTA Plant Monitor integration for Unfolded Circle Remote Two",
  "main": "driver.js",
  "type": "module",
  "dependencies": {
    "@unfoldedcircle/integration-api": "^0.3.0"
  }
}
EOF

# Install dependencies in the bin directory
cd package/bin && npm install && cd ../..

echo "Copying files..."
# Copy driver.js to bin directory
cp src/driver.js package/bin/
chmod 755 package/bin/driver.js

# Copy driver.json to root
cp src/driver.json package/driver.json

echo "Creating package archive..."
cd package
tar -czf fyta-integration.tar.gz bin config data driver.json
cd ..

echo "Package created at package/fyta-integration.tar.gz"
echo "You can now upload this file through the Remote Two web interface."
echo "To install on your Remote Two:"
echo "1. Enable Developer Mode in Settings > System > Developer Options"
echo "2. Go to Settings > Integrations > Install Custom Integration"
echo "3. Upload the package/fyta-integration.tar.gz file"

# Copy to simulator upload directory if it exists
DOCKER_UPLOAD_DIR="/Users/alex/GIT/FYTA_Circle_API/HomeassistentFYTA/core-simulator/core-simulator/docker/upload"
if [ -d "$DOCKER_UPLOAD_DIR" ]; then
  echo "Copying package to Docker simulator upload directory..."
  cp package/fyta-integration.tar.gz "$DOCKER_UPLOAD_DIR/"
  echo "Package copied to Docker simulator upload directory."
fi