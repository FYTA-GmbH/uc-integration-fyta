#!/bin/bash

# Simple script to start the FYTA integration server in foreground mode

# Configuration
INTEGRATION_PORT=8766
CONFIG_DIR="./config"

echo "===== Starting FYTA Integration Server ====="
echo "Port: $INTEGRATION_PORT"
echo "Config directory: $CONFIG_DIR"
echo

# Ensure clean port
echo "===== Checking port availability ====="
if command -v lsof >/dev/null 2>&1; then
    EXISTING_PID=$(lsof -ti :$INTEGRATION_PORT 2>/dev/null)
    if [ ! -z "$EXISTING_PID" ]; then
        echo "Found process using port $INTEGRATION_PORT, terminating PID: $EXISTING_PID"
        kill -9 $EXISTING_PID 2>/dev/null
        sleep 1
    else
        echo "✅ Port $INTEGRATION_PORT is free"
    fi
fi

# Clean up any existing processes
echo "Cleaning up any existing integration processes..."
pkill -f "node.*driver.js" 2>/dev/null
sleep 1

# Create config directory if it doesn't exist
mkdir -p "$CONFIG_DIR"

# Get Mac's IP address for Docker connectivity
MAC_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | head -1 | awk '{print $2}')
export MAC_IP

# Set environment variables
export UC_CONFIG_HOME="$CONFIG_DIR"
export UC_INTEGRATION_PORT="$INTEGRATION_PORT"
export UC_INTEGRATION_INTERFACE="0.0.0.0"  # Listen on all interfaces

echo "✅ Network connectivity information:"
echo "  - Integration will listen on: 0.0.0.0:$INTEGRATION_PORT"
echo "  - Local machine IP address: $MAC_IP"
echo "  - Docker should connect via: host.docker.internal:$INTEGRATION_PORT"
echo

echo "Starting integration server in foreground mode..."
echo "Press Ctrl+C to stop the integration"
echo

# Start the integration in the foreground
cd "$(dirname "$0")" # Ensure we're in the right directory
node src/driver.js 