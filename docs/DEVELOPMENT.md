# Development Guide

This document provides additional information for developers who want to contribute to or modify the FYTA integration for Unfolded Circle Remote Two.

## 🚀 Current Development Status

This integration is **partially working** with the following status:

1. ✅ **Package Upload Fixed**: The Remote Two simulator now accepts the integration package. The correct structure has been implemented following the Roon integration example.

2. ❌ **Configuration Interface**: The setup interface appears but doesn't properly display or process FYTA credentials.

3. ❌ **FYTA API Integration**: The API client is implemented but doesn't work yet with real credentials.

4. ✅ **Node.js Integration Structure**: The structure for Node.js integrations has been properly implemented following the Roon integration example.

## Architecture

The integration is built using Node.js and consists of three main components:

1. **FYTA API Client** (`src/fyta-api.js`): Handles authentication and communication with the FYTA API.
   - Currently implements login with email/password to obtain an authentication token
   - Methods for retrieving plants, sensors, and sensor data
   - **Note**: This doesn't work yet with actual FYTA credentials

2. **Entity Manager** (`src/entity-manager.js`): Manages the creation and updating of entities in the Remote Two system.
   - Creates sensor entities for each measurement type
   - Updates entity states based on sensor data
   - **Note**: This needs implementation and testing with the actual Remote Two system

3. **Integration Driver** (`src/index.js` and `src/driver.js`): Implements the WebSocket server and integration lifecycle.
   - Handles setup flow for user credentials
   - Manages connection to the Remote Two
   - Schedules regular updates of sensor data
   - **Note**: The setup flow doesn't work properly yet

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

### Testing with Remote Two Simulator (Upload Working)

1. Package the integration:
   ```bash
   ./package.sh
   ```

2. Upload the package to the Remote Two Simulator:
   - Enable Developer Mode in the simulator
   - Go to Settings > Integrations > Install Custom Integration
   - Upload the `package/fyta-integration.tar.gz` file

   **Note**: The package uploads successfully, but the configuration interface doesn't work properly yet.

## Package Structure

The integration package now follows this structure, which is accepted by the Remote Two:

```
/
├── bin/
│   ├── driver.js (executable)
│   ├── index.js
│   ├── fyta-api.js
│   ├── entity-manager.js
│   ├── package.json
│   └── node_modules/
├── config/
├── data/
└── driver.json
```

This structure was developed based on the Roon integration example and successfully uploads to the Remote Two.

## Successful Solutions

The following approaches have resolved the package upload issues:

1. **Correct Package Structure**:
   - Using the root directory for driver.json
   - Placing all Node.js files in the bin directory
   - Making driver.js executable with proper permissions

2. **Packaging Method**:
   - Using a clean tar command with proper permissions
   - Including empty config and data directories

## Remaining Issues

The following issues still need to be resolved:

1. **Configuration Interface**:
   - The setup interface appears but doesn't properly display input fields
   - The form doesn't process user input correctly
   - Need to investigate the correct setup_data_schema format

2. **FYTA API Integration**:
   - The authentication flow doesn't work yet
   - Need to verify API endpoints and data formats
   - Implement proper error handling

## Next Steps

The following areas need further development:

1. **Fix Configuration Interface**:
   - Investigate Remote Two setup form requirements
   - Update driver.json setup_data_schema
   - Test with different schema formats

2. **Fix FYTA API Client**:
   - Verify API endpoints and authentication flow
   - Test with real credentials
   - Implement proper error handling

3. **Implement Entity Creation**:
   - Create proper entity definitions
   - Test with actual device data
   - Implement state updates

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests. 