#!/bin/bash
# Script to package the FYTA integration for Unfolded Circle Remote Two
# Following the official documentation: https://github.com/unfoldedcircle/core-api/blob/main/doc/integration-driver/driver-installation.md

# Create package directory
echo "Creating package directory..."
rm -rf package
mkdir -p package/fyta/bin
mkdir -p package/fyta/config
mkdir -p package/fyta/data

# Copy Node.js files to bin directory
echo "Copying files..."
cp -r src/node_modules package/fyta/bin/
cp src/*.js package/fyta/bin/

# Create driver.js entry point in bin directory
echo "Creating driver.js entry point..."
cat > package/fyta/bin/driver.js << 'EOF'
#!/usr/bin/env node

// FYTA Plant Monitor integration for Unfolded Circle Remote Two
import * as api from '@unfoldedcircle/integration-api';
import './index.js';

console.log('FYTA Plant Monitor integration started');
EOF

# Make the driver.js file executable
chmod +x package/fyta/bin/driver.js

# Create driver.json in the root directory
echo "Creating driver.json file..."
cat > package/fyta/driver.json << 'EOF'
{
  "driver_id": "fyta",
  "version": "0.1.0",
  "min_core_api": "0.20.0",
  "name": {
    "en": "FYTA Plant Monitor"
  },
  "icon": "uc:plant",
  "description": {
    "en": "Monitor your FYTA plant sensors",
    "de": "Überwache deine FYTA Pflanzensensoren"
  },
  "developer": {
    "name": "Alexander",
    "url": "https://github.com/Schalex01/uc-integration-fyta"
  },
  "home_page": "https://fyta.de/",
  "release_date": "2024-03-13",
  "setup_data_schema": {
    "title": {
      "en": "FYTA Account"
    },
    "description": {
      "en": "Please enter your FYTA account credentials"
    },
    "type": "object",
    "required": [
      "username",
      "password"
    ],
    "properties": {
      "username": {
        "type": "string",
        "title": {
          "en": "Email"
        },
        "description": {
          "en": "Your FYTA account email"
        }
      },
      "password": {
        "type": "string",
        "format": "password",
        "title": {
          "en": "Password"
        },
        "description": {
          "en": "Your FYTA account password"
        }
      },
      "poll_interval": {
        "type": "number",
        "title": {
          "en": "Update interval"
        },
        "description": {
          "en": "Interval in seconds to update sensor data"
        },
        "default": 300,
        "minimum": 60,
        "maximum": 3600
      }
    }
  }
}
EOF

# Create package.json in bin directory
echo "Creating package.json file..."
cat > package/fyta/bin/package.json << 'EOF'
{
  "name": "fyta-integration",
  "version": "0.1.0",
  "description": "FYTA Plant Monitor integration for Unfolded Circle Remote Two",
  "main": "driver.js",
  "type": "module",
  "scripts": {
    "start": "node driver.js"
  },
  "dependencies": {
    "@unfoldedcircle/integration-api": "^0.3.0",
    "axios": "^1.8.3"
  }
}
EOF

# Create package archive
echo "Creating package archive..."
cd package
tar -czf fyta-integration.tar.gz fyta
cd ..

echo "Package created at package/fyta-integration.tar.gz"
echo "You can now upload this file through the Remote Two web interface."
echo "To install on your Remote Two:"
echo "1. Enable Developer Mode in Settings > System > Developer Options"
echo "2. Go to Settings > Integrations > Install Custom Integration"
echo "3. Upload the generated package/fyta-integration.tar.gz file"