# FYTA Integration for Unfolded Circle Remote Two

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Node.js Version](https://img.shields.io/badge/node-%3E%3D16.18.0-brightgreen)
![Status: Alpha](https://img.shields.io/badge/status-alpha-red)

A Node.js integration for connecting FYTA plant sensors to the Unfolded Circle Remote Two smart home controller.

## 🚀 Upload Working, Configuration In Progress

**This integration can now be successfully uploaded to the Remote Two device!** However, there are still important issues to resolve:

### Current Status:

1. ✅ **Package Upload Fixed**: The integration package now uploads successfully to the Remote Two.
2. ❌ **Configuration Interface**: The setup interface appears but doesn't properly display or process FYTA credentials.
3. ❌ **API Integration**: The FYTA API client implementation needs testing and fixing with real credentials.

## Overview

This integration aims to allow you to monitor your FYTA plant sensors directly from your Unfolded Circle Remote Two device. It connects to the FYTA API to retrieve sensor data and presents it as entities on your Remote Two interface.

## Planned Features

- Real-time monitoring of plant sensor data:
  - Temperature
  - Moisture
  - Light levels
  - Fertility
- Battery level monitoring
- Automatic sensor discovery
- Configurable update intervals

## Installation (Upload Only)

### Prerequisites

- Unfolded Circle Remote Two device with firmware version 1.9.0 or higher
- FYTA account with at least one sensor

### Installation Steps

1. Download the pre-built package from the `package` directory:
   - Use the `fyta-integration.tar.gz` file directly

   OR

   Build the package yourself:
   ```bash
   ./package.sh
   ```

2. Install on your Remote Two:
   - Enable Developer Mode in Settings > System > Developer Options
   - Go to Settings > Integrations > Install Custom Integration
   - Upload the `fyta-integration.tar.gz` file
   
   **Note**: While the package uploads successfully, the configuration interface doesn't work properly yet, and the integration cannot connect to FYTA at this time.

## Development

### Setup

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the integration locally:
   ```bash
   node src/index.js
   ```

### Project Structure

- `src/index.js` - Main integration driver
- `src/fyta-api.js` - FYTA API client
- `src/entity-manager.js` - Entity management for Remote Two
- `src/driver.js` - Entry point for the integration
- `src/driver.json` - Integration metadata

### Environment Variables

The integration supports the following environment variables:

- `UC_CONFIG_HOME`: Configuration directory (default: current directory)
- `UC_INTEGRATION_INTERFACE`: WebSocket listening interface (default: 0.0.0.0)
- `UC_INTEGRATION_PORT`: WebSocket listening port (default: from driver.json or 8000)
- `UC_DISABLE_MDNS_PUBLISH`: Disable mDNS service advertisement (default: false)

## Known Issues

- **Configuration Interface**: The setup interface appears but doesn't properly display or process input fields.
- **FYTA API Authentication**: The authentication flow with FYTA credentials doesn't work yet.
- **Entity Creation**: The entity creation and management need implementation and testing with actual device data.

## Contributing

If you have experience with Remote Two integrations or the FYTA API, your contributions would be greatly appreciated. Please feel free to submit issues or pull requests.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [Unfolded Circle](https://www.unfoldedcircle.com/) for their excellent Remote Two platform
- [FYTA](https://www.fyta.io/) for their plant monitoring system 