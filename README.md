# FYTA Plant Monitor Integration for Unfolded Circle Remote Two

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Node.js Version](https://img.shields.io/badge/node-%3E%3D16.18.0-brightgreen)
![Status: Work in Progress](https://img.shields.io/badge/status-work%20in%20progress-yellow)

A Node.js integration for connecting FYTA plant sensors to the Unfolded Circle Remote Two smart home controller.

## Features

- Connect to FYTA API and monitor your plant devices
- Display plant status and health metrics on Remote Two
- Alert when plants need attention
- Monitor soil moisture, temperature, and light levels

## Prerequisites

- Node.js 18 or higher
- Unfolded Circle Remote Two
- FYTA Plant Sensor and account
- Docker (for running the Remote Two emulator)

## Installation

1. Clone this repository
2. Install dependencies:

```bash
npm install
```

3. Set up your configuration:

```bash
# Make scripts executable
chmod +x *.sh
```

## Running the Integration

Use the provided scripts to start the integration:

```bash
# Start the integration server
./simple-start.sh

# Register with Remote Two (in a new terminal)
./simple-register.sh
```

## Troubleshooting

### Network Connection Issues

If you're experiencing connection issues between Docker and the integration:

1. Make sure your firewall allows incoming connections on port 8766
2. Verify the WebSocket server is running with `lsof -i :8766`
3. If running on macOS, ensure Docker can connect to the host:
   - Try using `host.docker.internal` as the hostname
   - Ensure your Mac's IP address is accessible from Docker

### Driver Not Connected Error

If you see "Driver not connected. TimedOut" in Remote Two:

1. Verify the integration server is running
2. Check network connectivity between Docker and your machine
3. Try modifying the WebSocket URL in the registration script

## Development

The integration is built using the official Unfolded Circle integration API. The main components are:

- `src/driver.js`: Main integration driver
- `simple-start.sh`: Script to start the integration
- `simple-register.sh`: Script to register with Remote Two
- `package.sh`: Script to package the integration for distribution

## License

MIT 