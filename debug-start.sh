#!/bin/bash

# Debug script to start the FYTA integration server with more debugging
# This script adds more verbose logging to diagnose startup issues

# Configuration
INTEGRATION_PORT=8765
CONFIG_DIR="./config"
DEBUG_LOG="${CONFIG_DIR}/startup-debug.log"

echo "===== Starting FYTA Integration Server with Debug ====="
echo "Port: $INTEGRATION_PORT"
echo "Config directory: $CONFIG_DIR"
echo "Debug log: $DEBUG_LOG"
echo

# Create config directory if it doesn't exist
mkdir -p "$CONFIG_DIR"

# Clean logs
> "$DEBUG_LOG"

# Record environment information
echo "--- Environment Information ---" >> "$DEBUG_LOG"
echo "Date: $(date)" >> "$DEBUG_LOG"
echo "Hostname: $(hostname)" >> "$DEBUG_LOG"
echo "OS: $(uname -a)" >> "$DEBUG_LOG"
echo "Node.js version: $(node -v)" >> "$DEBUG_LOG"
echo "NPM version: $(npm -v)" >> "$DEBUG_LOG"
echo "Working directory: $(pwd)" >> "$DEBUG_LOG"
echo "--- End Environment Information ---" >> "$DEBUG_LOG"
echo >> "$DEBUG_LOG"

# Clean up any existing processes
echo "Checking for existing processes on port $INTEGRATION_PORT..."
if pgrep -f "node.*driver.js" > /dev/null; then
    echo "Found existing integration process, stopping it..." | tee -a "$DEBUG_LOG"
    pkill -f "node.*driver.js"
    sleep 1
fi

# Record package.json
echo "--- package.json ---" >> "$DEBUG_LOG"
cat package.json >> "$DEBUG_LOG" 2>&1
echo "--- End package.json ---" >> "$DEBUG_LOG"
echo >> "$DEBUG_LOG"

# Check for missing dependencies
echo "--- Checking Dependencies ---" >> "$DEBUG_LOG"
if [ -d "node_modules" ]; then
    echo "node_modules directory exists" >> "$DEBUG_LOG"
    ls -la node_modules >> "$DEBUG_LOG" 2>&1
    echo "Integration API directory:" >> "$DEBUG_LOG"
    ls -la node_modules/@unfoldedcircle/integration-api >> "$DEBUG_LOG" 2>&1
else
    echo "WARNING: node_modules directory does not exist! Running npm install..." | tee -a "$DEBUG_LOG"
    npm install >> "$DEBUG_LOG" 2>&1
fi
echo "--- End Dependency Check ---" >> "$DEBUG_LOG"
echo >> "$DEBUG_LOG"

# Set environment variables
export UC_CONFIG_HOME="$CONFIG_DIR"
export UC_INTEGRATION_PORT="$INTEGRATION_PORT"
export UC_INTEGRATION_INTERFACE="0.0.0.0"  # Listen on all interfaces
export DEBUG=*  # Enable all debug output

# Record the command we're about to run
echo "--- Starting integration with command ---" >> "$DEBUG_LOG"
echo "node src/driver.js" >> "$DEBUG_LOG"
echo "--- Environment variables ---" >> "$DEBUG_LOG"
env | grep UC_ >> "$DEBUG_LOG"
echo "--- End starting command ---" >> "$DEBUG_LOG"
echo >> "$DEBUG_LOG"

# Start the integration in the foreground with debugging output
echo "Starting integration server..." | tee -a "$DEBUG_LOG"

# Use strace if available to trace system calls
if command -v strace &> /dev/null; then
    echo "Running with strace for system call tracing..." | tee -a "$DEBUG_LOG"
    strace -f -o "${CONFIG_DIR}/strace.log" node --trace-warnings src/driver.js 2>&1 | tee -a "$CONFIG_DIR/integration-output.log" "$DEBUG_LOG"
else
    echo "Running with Node.js warnings and debug enabled..." | tee -a "$DEBUG_LOG"
    node --trace-warnings src/driver.js 2>&1 | tee -a "$CONFIG_DIR/integration-output.log" "$DEBUG_LOG"
fi

# Check exit status
EXIT_CODE=$?
echo "Node.js process exited with code: $EXIT_CODE" | tee -a "$DEBUG_LOG"

if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ Integration server exited successfully"
else
    echo "❌ Integration server exited with error code: $EXIT_CODE"
    echo "Check the log files for details:"
    echo "- $CONFIG_DIR/startup-debug.log"
    echo "- $CONFIG_DIR/integration-output.log" 
fi 