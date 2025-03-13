# Development Guide

This document provides additional information for developers who want to contribute to or modify the FYTA integration for Unfolded Circle Remote Two.

## ⚠️ Current Development Status ⚠️

This integration is currently **not working** due to several challenges:

1. **Package Structure Issues**: The Remote Two simulator rejects the integration package with a "Binary directory not found" error. Despite following the documented structure, the upload fails.

2. **FYTA API Integration**: The API client is implemented based on documentation and analysis but hasn't been fully tested with real credentials.

3. **Node.js Integration Structure**: There seems to be specific requirements for Node.js integrations that aren't fully documented.

## Architecture

The integration is built using Node.js and consists of three main components:

1. **FYTA API Client** (`src/fyta-api.js`): Handles authentication and communication with the FYTA API.
   - Currently implements login with email/password to obtain an authentication token
   - Methods for retrieving plants, sensors, and sensor data
   - **Note**: This has not been tested with actual FYTA credentials

2. **Entity Manager** (`src/entity-manager.js`): Manages the creation and updating of entities in the Remote Two system.
   - Creates sensor entities for each measurement type
   - Updates entity states based on sensor data
   - **Note**: This needs testing with the actual Remote Two system

3. **Integration Driver** (`src/index.js`): Implements the WebSocket server and integration lifecycle.
   - Handles setup flow for user credentials
   - Manages connection to the Remote Two
   - Schedules regular updates of sensor data
   - **Note**: This needs testing with the actual Remote Two system

## Development Environment

### Prerequisites

- Node.js 16.18.0 or newer
- npm 8.0.0 or newer
- Unfolded Circle Remote Two or Remote Two Simulator

### Local Development

1. Clone the repository:
   ```bash
   git clone https://github.com/Schalex01/uc-integration-fyta.git
   cd uc-integration-fyta
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the integration locally:
   ```bash
   node src/index.js
   ```

### Testing with Remote Two Simulator (Currently Not Working)

1. Package the integration:
   ```bash
   ./package.sh
   ```

2. Upload the package to the Remote Two Simulator:
   - Enable Developer Mode in the simulator
   - Go to Settings > Integrations > Install Custom Integration
   - Upload the `package/fyta-integration.tar.gz` file

   **Note**: Currently, this step fails with a "Binary directory not found" error.

## Package Structure

The integration package should follow this structure to be accepted by the Remote Two:

```
fyta/
├── bin/
│   ├── index.js
│   ├── fyta-api.js
│   ├── entity-manager.js
│   ├── package.json
│   └── node_modules/
├── config/
├── data/
└── driver.json
```

However, despite following this structure, the package is still rejected by the Remote Two simulator.

## Attempted Solutions

I've tried several approaches to resolve the package upload issue:

1. Different package structures:
   - All files in the root directory
   - Node.js files in the bin directory
   - Creating a native-like structure with a shell script as the binary

2. Different packaging methods:
   - Using npm to install dependencies
   - Including pre-installed node_modules
   - Creating empty config and data directories

None of these approaches have resolved the "Binary directory not found" error.

## Help Needed

If you have experience with Remote Two integrations, especially with Node.js, I would appreciate help with:

1. The correct package structure for Node.js integrations
2. Resolving the "Binary directory not found" error
3. Testing the FYTA API client with actual credentials
4. Any other insights into developing integrations for the Remote Two

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests. 