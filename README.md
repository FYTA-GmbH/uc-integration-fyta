# FYTA Plant Monitor Integration for UC Remote

This integration connects FYTA plant sensors to Unfolded Circle's Remote Two, allowing you to monitor your plants' temperature and moisture status directly from your UC Remote interface.

**Current Status: Beta** - Stable version with reliable plant monitoring functionality.

## Screenshots

<div style="display: flex; flex-wrap: wrap; gap: 20px; justify-content: center;">
  <img src="assets/FYTA Integration on UC All.jpeg" width="400" alt="FYTA Integration Overview" style="max-width: 45%;"/>
  <img src="assets/FYTA Integration on UC Temperature.jpeg" width="400" alt="FYTA Temperature Detail" style="max-width: 45%;"/>
</div>

▶️ [Watch the installation and configuration video](https://youtu.be/pRwuLrct8fc)

## Features

- Authenticate with FYTA API
- Retrieve plant data for plants with sensors
- Display temperature readings with °C units
- Display moisture status as human-readable text (Perfect, Too Low, etc.)
- Low battery warnings displayed alongside moisture status
- Configuration through UC Remote interface
- Automatic periodic updates every 15 minutes
- Robust error handling with automatic retries for API timeouts
- Persistent storage of entity data that survives reboots

## Data Flow

```mermaid
sequenceDiagram
    participant User
    participant UCRemote as UC Remote
    participant Driver as FYTA Driver
    participant Storage as Persistent Storage
    participant FYTAAPI as FYTA API

    User->>UCRemote: Add Integration
    UCRemote->>Driver: Initialize
    Driver->>Storage: Load Stored Configuration
    Driver->>Storage: Load Stored Entities
    Driver->>UCRemote: Register Stored Entities
    Driver->>UCRemote: Request Credentials (if needed)
    User->>UCRemote: Enter FYTA Credentials
    UCRemote->>Driver: Provide Credentials
    Driver->>FYTAAPI: Authenticate (with retries)
    FYTAAPI->>Driver: Return Auth Token
    Driver->>FYTAAPI: Get User Plants (with retries)
    FYTAAPI->>Driver: Return Plant List
    Driver->>FYTAAPI: Get Plant Details (with retries)
    FYTAAPI->>Driver: Return Plant Data with Battery Status
    Driver->>UCRemote: Register Sensor Entities
    Driver->>Storage: Store Configuration & Entities
    User->>UCRemote: Subscribe to Sensors
    UCRemote->>Driver: Subscribe Events
    Driver->>UCRemote: Update Entity States
    
    loop Every 15 minutes
        Driver->>FYTAAPI: Get Updated Plant Data (with retries)
        FYTAAPI->>Driver: Return Fresh Plant Data
        Driver->>UCRemote: Update Entity Values
        Driver->>Storage: Store Updated Entities
    end
```

## Setup Instructions

### Prerequisites

- UC Remote
- FYTA account with plant sensors (you can also use the default plant called Günther for testing)
- Docker (for compiling)

### Quick Start Guide

To install the pre-compiled integration:

1. Enable Web Configurator and connect to it
2. In General settings, enable Beta Updates and restart
3. Install beta firmware 2.3.0
4. Upload `uc-fyta-custom-aarch64.tar.gz` in Integrations
5. Configure FYTA credentials and select plant sensors

### Installation

1. Compile the integration (see Compilation Instructions)
2. Add the integration to your UC Remote
3. Follow the setup process and enter your FYTA credentials
4. Select the plant sensors you want to monitor

## Compilation Instructions

The integration can be compiled using Docker:

```bash
# Clone the repository
git clone https://github.com/yourusername/uc-fyta-integration.git
cd uc-fyta-integration

# Run the compilation script
chmod +x docker-compile.sh
./docker-compile.sh
```

This will create a `uc-fyta-custom-aarch64.tar.gz` file that can be installed on UC Remote.

## Architecture

### Component Architecture

```mermaid
classDiagram
    class FytaConfig {
        +str id
        +str email
        +str password
        +str access_token
        +str refresh_token
        +int expires_in
    }

    class PlantTemperatureSensor {
        +str plant_id
        +str scientific_name
        +float temperature
        +int temperature_status
        +str status_text
        +datetime last_updated
    }

    class PlantMoistureSensor {
        +str plant_id
        +str scientific_name
        +int moisture_status
        +str status_text
        +bool battery_low
        +datetime last_updated
    }

    class ApiClient {
        +authenticate_fyta()
        +get_user_plants()
        +get_plant_details()
        +retry_api_call()
    }

    class DataPersistence {
        +save_config()
        +load_config()
        +store_entities()
        +load_entities()
    }

    class PeriodicUpdateService {
        +start_periodic_updates()
        +update_plant_data()
        +update_entities_from_api()
    }

    class UCAPIIntegration {
        +handle_setup()
        +on_connect()
        +on_subscribe_entities()
    }

    UCAPIIntegration --> PlantTemperatureSensor : creates/manages
    UCAPIIntegration --> PlantMoistureSensor : creates/manages
    UCAPIIntegration --> FytaConfig : uses
    UCAPIIntegration --> ApiClient : uses
    UCAPIIntegration --> DataPersistence : uses
    UCAPIIntegration --> PeriodicUpdateService : initializes
    ApiClient --> FytaConfig : uses credentials
    PeriodicUpdateService --> ApiClient : calls
    PeriodicUpdateService --> DataPersistence : stores updates
```

## How to Contribute

Contributions are welcome! Here are some ways you can help improve this integration:

1. **Code Improvements**:
   - Improve UI for data visualization

2. **Testing**:
   - Report bugs and issues

3. **Documentation**:
   - Improve this README

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- FYTA for their plant monitoring technology
- Unfolded Circle Community for the support
