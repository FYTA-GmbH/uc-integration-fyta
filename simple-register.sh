#!/bin/bash

# Simple script to register the FYTA integration with the Remote Two

# Configuration (Edit these if needed)
API_KEY="r2.remote.XXXXXXX"  # Replace with your actual API key
API_PORT=8080
CONFIG_DIR="./config"
MAC_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | head -1 | awk '{print $2}')

# Setup WebSocket URLs to try (in order of preference)
WS_URLS=(
  "ws://host.docker.internal:8766"
  "ws://$MAC_IP:8766"
  "ws://localhost:8766"
)

echo "===== Registering FYTA Integration with Remote Two ====="
echo "Mac IP: $MAC_IP"
echo "API Port: $API_PORT"
echo

# Create temporary file with integration registration data
TEMP_JSON="/tmp/fyta-integration.json"
cat > "$TEMP_JSON" << EOF
{
  "driver_id": "fyta_plant_monitor",
  "name": {
    "en": "FYTA Plant Monitor"
  },
  "icon": "mdi:flower",
  "version": "0.1.0",
  "description": {
    "en": "Integration for FYTA plant monitoring devices"
  }
}
EOF

echo "Created integration registration data"
echo

# Try each WebSocket URL in sequence
SUCCESS=false
for WS_URL in "${WS_URLS[@]}"; do
  echo "Trying to register using WebSocket URL: $WS_URL"
  
  # Register the integration
  RESPONSE=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -H "Accept: application/json" \
    -H "Authorization: Bearer $API_KEY" \
    -d @"$TEMP_JSON" \
    "http://localhost:$API_PORT/api/integration_api/register?ws_url=$WS_URL")
  
  # Check if registration was successful
  if [[ "$RESPONSE" == *"success"* ]]; then
    echo "✅ Registration successful using $WS_URL!"
    echo "Response: $RESPONSE"
    SUCCESS=true
    break
  else
    echo "❌ Registration failed using $WS_URL"
    echo "Error: $RESPONSE"
  fi
  
  echo
done

# Cleanup temp file
rm -f "$TEMP_JSON"

# Final status
if [ "$SUCCESS" = true ]; then
  echo "✅ FYTA integration registration complete!"
else
  echo "❌ All registration attempts failed."
  echo
  echo "Troubleshooting checklist:"
  echo "1. Is the integration server running? (./simple-start.sh)"
  echo "2. Is port 8766 accessible? (Check firewall settings)"
  echo "3. Is the Remote Two emulator running in Docker?"
  echo "4. Is the API key correct?"
  echo
  echo "For Docker connectivity issues, try:"
  echo "- Verify Docker and Mac can communicate"
  echo "- Check Docker network settings"
  echo "- Ensure host.docker.internal resolves correctly"
fi 