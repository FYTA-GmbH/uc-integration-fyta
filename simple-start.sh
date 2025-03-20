#!/bin/bash

# Simple script to start the FYTA integration server in foreground mode

# Configuration
INTEGRATION_PORT=8766
CONFIG_DIR="./config"
DEBUG_LEVEL=3  # 0=none, 1=basic, 2=detailed, 3=verbose+network

echo "===== Starting FYTA Integration Server ====="
echo "Port: $INTEGRATION_PORT"
echo "Config directory: $CONFIG_DIR"
echo "Debug Level: $DEBUG_LEVEL (3=verbose)"
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
export UC_DEBUG_LEVEL="$DEBUG_LEVEL"       # Enable detailed logging
export NODE_DEBUG="http,http2,https,net"   # Debug HTTP requests
export DEBUG="integration:*,fyta:*"        # Debug namespaces
export UC_LOG_TIMESTAMPS="true"            # Add timestamps to logs
export UC_FYTA_API_TIMEOUT=15000           # API timeout in ms (15 seconds)

echo "✅ Network connectivity information:"
echo "  - Integration will listen on: 0.0.0.0:$INTEGRATION_PORT"
echo "  - Local machine IP address: $MAC_IP"
echo "  - Docker should connect via: host.docker.internal:$INTEGRATION_PORT"
echo

echo "✅ Testing FYTA API connectivity..."
if curl -s --connect-timeout 5 "https://web.fyta.de/api" > /dev/null; then
  echo "  - FYTA API is reachable"
else
  echo "  - ⚠️ FYTA API may not be reachable, check your internet connection"
fi
echo

echo "===== Integration Debug Information ====="
echo "To diagnose timeout issue, please check:"
echo "1. Is your FYTA email/password correct?"
echo "2. Can you log in to the FYTA app on your phone?"
echo "3. Do you have a working internet connection?"
echo "4. Are there any firewall rules blocking outbound connections?"
echo "5. The console output below for detailed error messages"
echo

echo "Starting integration server in foreground mode with verbose logging..."
echo "Press Ctrl+C to stop the integration"
echo "==================================================="
echo

# Start the integration in the foreground with debugging flags
cd "$(dirname "$0")" # Ensure we're in the right directory
node --trace-warnings --trace-uncaught src/driver.js 