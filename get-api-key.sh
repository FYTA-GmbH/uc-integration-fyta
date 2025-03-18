#!/bin/bash

# Your simulator IP - usually localhost or 127.0.0.1 when running in Docker
IP=localhost:8080
PIN=1234  # Your web-configurator pin

curl "http://$IP/api/auth/api_keys" \
  --header 'Content-Type: application/json' \
  -u "web-configurator:$PIN" \
  --data '{
    "name": "FYTA integration access",
    "scopes": [
      "admin"
    ]
  }'