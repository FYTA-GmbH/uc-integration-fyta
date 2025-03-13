# FYTA Integration for Unfolded Circle Remote Two

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Node.js Version](https://img.shields.io/badge/node-%3E%3D16.18.0-brightgreen)
![Status: Work in Progress](https://img.shields.io/badge/status-work%20in%20progress-yellow)

A Node.js integration for connecting FYTA plant sensors to the Unfolded Circle Remote Two smart home controller.

## ⚠️ Work in Progress ⚠️

**This integration is currently under development and not yet functional.** I'm sharing this code to collaborate with the community on resolving the current issues.

### Current Challenges:

1. **Package Upload Issues**: The integration package is being rejected by the Remote Two simulator with a "Binary directory not found" error. I've tried multiple package structures but haven't found a solution yet.

2. **Untested API Integration**: The FYTA API client implementation is based on my understanding of their API but hasn't been fully tested. The authentication flow and data retrieval need verification.

3. **Integration Structure**: I'm still working on the correct structure for Node.js integrations with the Remote Two platform.

If you have experience with Remote Two integrations or the FYTA API, I'd appreciate your input!

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

## Installation (Not Yet Working)

### Prerequisites

- Unfolded Circle Remote Two device with firmware version 1.9.0 or higher
- FYTA account with at least one sensor

### Installation Steps

1. Package the integration:
   ```bash
   ./package.sh
   ```

2. Install on your Remote Two:
   - Enable Developer Mode in Settings > System > Developer Options
   - Go to Settings > Integrations > Install Custom Integration
   - Upload the generated `package/fyta-integration.tar.gz` file

   **Note**: Currently, the upload process fails with a "Binary directory not found" error.

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
- `src/fyta-api.js` - FYTA API client (untested)
- `src/entity-manager.js` - Entity management for Remote Two
- `src/driver.json` - Integration metadata

### Environment Variables

The integration supports the following environment variables:

- `UC_CONFIG_HOME`: Configuration directory (default: current directory)
- `UC_INTEGRATION_INTERFACE`: WebSocket listening interface (default: 0.0.0.0)
- `UC_INTEGRATION_PORT`: WebSocket listening port (default: from driver.json or 8000)
- `UC_DISABLE_MDNS_PUBLISH`: Disable mDNS service advertisement (default: false)

## Known Issues

- **Package Upload Failure**: The integration package is rejected by the Remote Two simulator with a "Binary directory not found" error.
- **FYTA API Authentication**: The authentication flow with FYTA credentials has not been tested yet.
- **Entity Creation**: The entity creation and management need testing with actual device data.

## Contributing

If you have experience with Remote Two integrations or the FYTA API, your contributions would be greatly appreciated. Please feel free to submit issues or pull requests.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [Unfolded Circle](https://www.unfoldedcircle.com/) for their excellent Remote Two platform
- [FYTA](https://www.fyta.io/) for their plant monitoring system 