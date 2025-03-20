#!/bin/bash

# Registration script for FYTA integration with Remote Two simulator

# Get Mac's IP address for WebSocket URL
MAC_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | head -1 | awk '{print $2}')

# Try to find Remote Two simulator IP - try localhost first then fall back to Mac's IP
IP="localhost:8080"  # Start with localhost since Docker often runs there
API_KEY="xVebOrt.Zjc5ZDdiOTMyNWJlNDFhNjhlYmQ4MGFjZGM4MzMzNDkuNzZhNzNlNmNmMjFjNDEyNDg3ODI1NzNhYWVlZmJjYTE"
DRIVER_URL="ws://$MAC_IP:8766"  # Your integration's WebSocket URL

echo "===== FYTA Integration Registration ====="
echo "Initial Remote Two simulator: http://$IP"
echo "Integration WebSocket URL: $DRIVER_URL"

# Debug step 1: Check if driver.json exists
if [ ! -f "src/driver.json" ]; then
  echo "⚠️ ERROR: driver.json not found in src directory!"
  echo "Current directory: $(pwd)"
  echo "Files in src directory:"
  ls -la src/
  echo
  echo "You need a valid driver.json file in the src directory."
  exit 1
else
  echo "✅ driver.json found"
  echo "File details: $(ls -la src/driver.json)"
  echo "Content preview: $(head -5 src/driver.json)"
fi

# Debug step 2: Test connection to simulator
echo "Testing connection to simulator..."
if curl -s --connect-timeout 5 "http://$IP/api/system/version" > /dev/null; then
  echo "✅ Connection to simulator at $IP successful"
else
  echo "⚠️ Cannot connect to simulator at http://$IP"
  echo "Trying Mac's IP instead..."
  
  # Try with Mac's IP
  if curl -s --connect-timeout 5 "http://$MAC_IP:8080/api/system/version" > /dev/null; then
    echo "✅ Connection to simulator at $MAC_IP:8080 successful"
    IP="$MAC_IP:8080"
  else
    echo "⚠️ Cannot connect to simulator at $MAC_IP:8080 either"
    echo "Trying other common possibilities..."
    
    # Try without port (port 80)
    if curl -s --connect-timeout 5 "http://$MAC_IP/api/system/version" > /dev/null; then
      echo "✅ Connection to simulator at $MAC_IP (port 80) successful"
      IP="$MAC_IP"
    else
      echo "⚠️ WARNING: Cannot find the Remote Two simulator automatically"
      echo "Please enter the IP address of the Remote Two simulator:"
      read -p "IP (default localhost:8080): " USER_IP
      IP=${USER_IP:-"localhost:8080"}
    fi
  fi
fi

echo "Using Remote Two simulator at: http://$IP"

# Debug step 3: Test API key
echo "Testing API key..."
AUTH_RESULT=$(curl -s -o /dev/null -w "%{http_code}" \
  "http://$IP/api/system/version" \
  -H "Authorization: Bearer $API_KEY")

if [ "$AUTH_RESULT" == "401" ]; then
  echo "⚠️ ERROR: API key unauthorized (HTTP 401)"
  echo "Check if your API key is correct"
elif [ "$AUTH_RESULT" == "200" ]; then
  echo "✅ API key is valid"
else
  echo "⚙️ API auth check returned: $AUTH_RESULT (not 401, proceeding anyway)"
fi

# Register integration with verbose output
echo "Attempting registration with integration..."
TEMP_JSON="/tmp/fyta_register.json"
jq --arg driver_url "$DRIVER_URL" '. + { "driver_url": $driver_url }' src/driver.json > $TEMP_JSON
echo "Registration payload preview:"
head -10 $TEMP_JSON

RESPONSE=$(curl -s -v -X 'POST' \
  "http://$IP/api/intg/drivers" \
  -H "accept: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d @$TEMP_JSON 2>&1)

HTTP_CODE=$(echo "$RESPONSE" | grep -o "< HTTP/[0-9.]* [0-9]*" | grep -o "[0-9][0-9][0-9]" || echo "unknown")
BODY=$(echo "$RESPONSE" | grep -A 20 "< HTTP/")

if [[ "$RESPONSE" == *"success"* ]]; then
  echo "✅ Registration successful (HTTP $HTTP_CODE)"
else
  echo "❌ Registration failed (HTTP $HTTP_CODE)"
  echo "Response details:"
  echo "$BODY"
fi

# Check if integration server is running
echo "Checking if integration server is running on port 8766..."
if command -v lsof > /dev/null; then
  INTEGRATION_PID=$(lsof -ti :8766 2>/dev/null)
  if [ -z "$INTEGRATION_PID" ]; then
    echo "⚠️ WARNING: No process found listening on port 8766"
    echo "Make sure your integration server is running (./simple-start.sh)"
  else
    echo "✅ Integration server is running (PID: $INTEGRATION_PID)"
  fi
else
  echo "⚙️ Cannot check if integration server is running (lsof not available)"
fi 