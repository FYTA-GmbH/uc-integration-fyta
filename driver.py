#!/usr/bin/env python3
"""
FYTA Lite integration for UC Remote.

This integration connects to the FYTA API to get plant data.
"""

import asyncio
import json
import logging
import os
import uuid
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import httpx
import ucapi
from ucapi import (
    AbortDriverSetup,
    DriverSetupRequest,
    RequestUserInput,
    SetupAction,
    SetupComplete,
    SetupDriver,
    SetupError,
    UserDataResponse,
)
from ucapi.sensor import (
    Sensor,
    DeviceClasses,
    States,
    Features,
    Attributes,
    Commands,
)

# Setup logging
_LOG = logging.getLogger("driver")
_LOOP = asyncio.get_event_loop()

# Global variables
api = ucapi.IntegrationAPI(_LOOP)
_CONFIG_FILE = "config.json"
_fyta_config = None
_plant_sensors = {}  # Dictionary to keep track of plant sensors

# FYTA API endpoints
FYTA_AUTH_URL = "https://web.fyta.de/api/auth/login"
FYTA_USER_PLANTS_URL = "https://web.fyta.de/api/user-plant"
FYTA_PLANT_DETAILS_URL = "https://web.fyta.de/api/user-plant/{plant_id}"


@dataclass
class FytaConfig:
    """Configuration for FYTA API."""
    id: str
    email: str
    password: str
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    expires_in: Optional[int] = None


class PlantTemperatureSensor(Sensor):
    """Class representing a FYTA plant sensor."""
    
    def __init__(self, plant_id: str, nickname: str, scientific_name: str):
        """
        Initialize a plant sensor entity.
        
        :param plant_id: FYTA plant ID
        :param nickname: Plant nickname
        :param scientific_name: Scientific name of the plant
        """
        identifier = f"fyta-plant-{plant_id}"
        name = f"{nickname} Temperature"
        
        # Initialize attributes with defaults
        attributes = {
            Attributes.STATE: States.UNKNOWN,
            Attributes.VALUE: "0",
            "scientific_name": scientific_name,
        }
        
        # Configure appropriate options
        options = {
            "decimals": 1  # Show one decimal place for temperature
        }
        
        # Store FYTA-specific data that we'll need later
        self.plant_id = plant_id
        self.scientific_name = scientific_name
        self.temperature = None
        self.temperature_status = None
        self.last_updated = None
        
        # Initialize the sensor with the temperature device class
        super().__init__(
            identifier=identifier,
            name=name,
            features=[],  # Sensor has no features according to docs
            attributes=attributes,
            device_class=DeviceClasses.TEMPERATURE,
            options=options
        )


class PlantMoistureSensor(Sensor):
    """Class representing a FYTA plant moisture sensor that shows status text."""
    
    def __init__(self, plant_id: str, nickname: str, scientific_name: str):
        """
        Initialize a plant moisture sensor entity.
        
        :param plant_id: FYTA plant ID
        :param nickname: Plant nickname
        :param scientific_name: Scientific name of the plant
        """
        identifier = f"fyta-moisture-{plant_id}"
        name = f"{nickname} Moisture"
        
        # Initialize attributes with defaults
        attributes = {
            Attributes.STATE: States.UNKNOWN,
            Attributes.VALUE: "Unknown",
            "scientific_name": scientific_name,
        }
        
        # Configure appropriate options
        options = {
            "custom_unit": "Status"  # Show status as unit for moisture
        }
        
        # Store FYTA-specific data that we'll need later
        self.plant_id = plant_id
        self.scientific_name = scientific_name
        self.moisture_status = None
        self.last_updated = None
        
        # Initialize the sensor with the custom device class for text values
        super().__init__(
            identifier=identifier,
            name=name,
            features=[],  # Sensor has no features according to docs
            attributes=attributes,
            device_class=DeviceClasses.CUSTOM,
            options=options
        )


# Setup flow for configuring the FYTA API
class SetupSteps:
    """Enumeration of setup steps to keep track of user data responses."""
    INIT = 0
    ACCOUNT_CONFIG = 1


_setup_step = SetupSteps.INIT

_user_input_config = RequestUserInput(
    {"en": "FYTA Account Configuration"},
    [
        {
            "id": "info",
            "label": {"en": "FYTA Account"},
            "field": {
                "label": {
                    "value": {
                        "en": "Please enter your FYTA account credentials."
                    }
                }
            },
        },
        {
            "id": "email",
            "label": {"en": "FYTA Email"},
            "field": {
                "text": {
                    "placeholder": {
                        "en": "Your FYTA account email"
                    }
                }
            },
        },
        {
            "id": "password",
            "label": {"en": "FYTA Password"},
            "field": {
                "text": {
                    "placeholder": {
                        "en": "Your FYTA account password"
                    },
                    "masked": True
                }
            },
        }
    ],
)


async def driver_setup_handler(msg: SetupDriver) -> SetupAction:
    """
    Handle the driver setup process.
    
    :param msg: Setup driver message
    :return: The next setup action
    """
    global _setup_step

    if isinstance(msg, DriverSetupRequest):
        _setup_step = SetupSteps.INIT
        return await handle_driver_setup()
    if isinstance(msg, UserDataResponse):
        _LOG.debug("User data response received")
        if _setup_step == SetupSteps.ACCOUNT_CONFIG:
            return await handle_account_config(msg)
    elif isinstance(msg, AbortDriverSetup):
        _LOG.info("Setup was aborted with code: %s", msg.error)
        _setup_step = SetupSteps.INIT

    return SetupError()


async def handle_driver_setup() -> RequestUserInput:
    """Start the driver setup process."""
    global _setup_step
    _setup_step = SetupSteps.ACCOUNT_CONFIG
    return _user_input_config


async def handle_account_config(msg: UserDataResponse) -> SetupComplete | SetupError:
    """
    Handle FYTA account configuration from user.
    
    :param msg: User response with account credentials
    :return: Setup complete action if successful
    """
    global _fyta_config
    
    if "email" not in msg.input_values or "password" not in msg.input_values:
        _LOG.error("Missing required credential fields")
        return SetupError("Please provide both email and password")

    email = msg.input_values["email"]
    password = msg.input_values["password"]
    
    # Test the credentials before proceeding
    try:
        auth_response = await authenticate_fyta(email, password)
        if not auth_response or "access_token" not in auth_response:
            _LOG.error("Authentication failed with provided credentials")
            return SetupError("Authentication failed. Please check your credentials.")
            
        config_id = str(uuid.uuid4())
        _fyta_config = FytaConfig(
            id=config_id,
            email=email,
            password=password,
            access_token=auth_response.get("access_token"),
            refresh_token=auth_response.get("refresh_token"),
            expires_in=auth_response.get("expires_in")
        )

        # Save configuration
        save_config(_fyta_config)
        _LOG.info("Successfully authenticated with FYTA API")
        
        # Create plant sensors using the existing function
        _LOG.info("Loading plant data from FYTA API")
        await create_plant_sensors()
        
        # Complete setup after all plants are loaded
        return SetupComplete()
        
    except Exception as e:
        _LOG.error("Error during FYTA authentication or plant loading: %s", e)
        return SetupError(f"Error: {str(e)}")


def save_config(config: FytaConfig) -> bool:
    """Save the configuration to a file."""

    try:
        config_path = os.path.join(os.getenv("UC_CONFIG_HOME", os.getcwd()), _CONFIG_FILE)
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump({
                "id": config.id,
                "email": config.email,
                "password": config.password,
                "access_token": config.access_token,
                "refresh_token": config.refresh_token,
                "expires_in": config.expires_in
            }, f, ensure_ascii=False)
        _LOG.info("Successfully saved configuration to file: %s", config_path)
        return True
    except Exception as e:
        _LOG.error("Failed to save configuration: %s", e)
        return False


def load_config() -> Optional[FytaConfig]:
    """Load the configuration from a file."""
    try:
        config_path = os.path.join(os.getenv("UC_CONFIG_HOME", os.getcwd()), _CONFIG_FILE)
        if not os.path.exists(config_path):
            return None
            
        _LOG.info("Loading configuration from file: %s", config_path)
        with open(config_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            return FytaConfig(
                id=data.get("id", str(uuid.uuid4())),
                email=data.get("email", ""),
                password=data.get("password", ""),
                access_token=data.get("access_token"),
                refresh_token=data.get("refresh_token"),
                expires_in=data.get("expires_in")
            )
    except Exception as e:
        _LOG.error("Failed to load configuration: %s", e)
        return None


async def authenticate_fyta(email: str, password: str) -> Dict[str, Any]:
    """
    Authenticate with FYTA API.
    
    :param email: FYTA account email
    :param password: FYTA account password
    :return: Authentication response with tokens
    """
    _LOG.info("Authenticating with FYTA API")
    
    payload = {
        "email": email,
        "password": password
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(FYTA_AUTH_URL, json=payload, timeout=10.0)
            response.raise_for_status()
            
            auth_data = response.json()
            _LOG.info("Successfully authenticated with FYTA API")
            return auth_data
    except httpx.RequestError as e:
        _LOG.error("FYTA authentication request error: %s", e)
        raise
    except httpx.HTTPStatusError as e:
        _LOG.error("FYTA authentication HTTP error: %s", e)
        raise
    except Exception as e:
        _LOG.error("Unexpected error during FYTA authentication: %s", e)
        raise


async def get_user_plants() -> List[Dict[str, Any]]:
    """
    Get user plants from FYTA API.
    
    :return: List of user plants
    """
    if not _fyta_config or not _fyta_config.access_token:
        _LOG.error("No valid FYTA authentication token available")
        return []
    
    _LOG.info("Fetching user plants from FYTA API")
    
    headers = {
        "Authorization": f"Bearer {_fyta_config.access_token}"
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(FYTA_USER_PLANTS_URL, headers=headers, timeout=10.0)
            response.raise_for_status()
            
            data = response.json()
            plants = data.get("plants", [])
            _LOG.info("Retrieved %d plants from FYTA API", len(plants))
            return plants
    except httpx.RequestError as e:
        _LOG.error("Error fetching user plants: %s", e)
        return []
    except httpx.HTTPStatusError as e:
        _LOG.error("HTTP error fetching user plants: %s", e)
        # If token expired, try to re-authenticate
        if e.response.status_code == 401:
            _LOG.info("Token expired, attempting to re-authenticate")
            try:
                auth_response = await authenticate_fyta(_fyta_config.email, _fyta_config.password)
                if auth_response and "access_token" in auth_response:
                    _fyta_config.access_token = auth_response["access_token"]
                    _fyta_config.refresh_token = auth_response["refresh_token"]
                    _fyta_config.expires_in = auth_response["expires_in"]
                    save_config(_fyta_config)
                    # Try again with new token
                    return await get_user_plants()
            except Exception as auth_error:
                _LOG.error("Re-authentication failed: %s", auth_error)
        return []
    except Exception as e:
        _LOG.error("Unexpected error fetching user plants: %s", e)
        return []


async def get_plant_details(plant_id: str) -> Dict[str, Any]:
    """
    Get detailed information for a specific plant.
    
    :param plant_id: ID of the plant to get details for
    :return: Detailed plant information
    """
    if not _fyta_config or not _fyta_config.access_token:
        _LOG.error("No valid FYTA authentication token available")
        return {}
    
    _LOG.info("Fetching details for plant ID: %s", plant_id)
    
    headers = {
        "Authorization": f"Bearer {_fyta_config.access_token}"
    }
    
    try:
        async with httpx.AsyncClient() as client:
            url = FYTA_PLANT_DETAILS_URL.format(plant_id=plant_id)
            response = await client.get(url, headers=headers, timeout=10.0)
            response.raise_for_status()
            
            data = response.json()
            return data.get("plant", {})
    except Exception as e:
        _LOG.error("Error fetching plant details for ID %s: %s", plant_id, e)
        return {}


async def create_plant_sensors() -> None:
    """Create and register entities for each plant with a sensor."""
    global _plant_sensors
    
    _LOG.info("Starting to create plant sensors")
    # _plant_sensors = {}  # Reset plant sensors
    
    # Get all plants
    plants = await get_user_plants()
    _LOG.info("Found %d plants", len(plants))
    
    entities_created = 0
    for plant in plants:
        try:
            # Only create entities for plants with sensors
            has_sensor = False
            sensor = plant.get("sensor")
            if sensor is not None:
                has_sensor = sensor.get("has_sensor", False)
            
            _LOG.info("Plant %s has sensor: %s", plant.get("nickname", "Unknown"), has_sensor)
            
            if has_sensor:
                plant_id = plant.get("id")
                if plant_id is None:
                    _LOG.error("Plant has no ID: %s", plant)
                    continue
                    
                nickname = plant.get("nickname", f"Plant {plant_id}")
                scientific_name = plant.get("scientific_name", "Unknown")
                
                # Get plant details for initial values
                try:
                    plant_details = await get_plant_details(str(plant_id))
                    if not plant_details:
                        _LOG.warning("Could not get details for plant %s, skipping", nickname)
                        continue
                except Exception as e:
                    _LOG.error("Error fetching details for plant %s: %s", nickname, e)
                    continue
                
                # Create a new temperature sensor entity
                temp_sensor = PlantTemperatureSensor(
                    plant_id=str(plant_id),
                    nickname=nickname,
                    scientific_name=scientific_name
                )
                
                # Create a new moisture sensor entity
                moisture_sensor = PlantMoistureSensor(
                    plant_id=str(plant_id),
                    nickname=nickname,
                    scientific_name=scientific_name
                )
                
                # Set initial values if data is available
                if plant_details and "measurements" in plant_details:
                    _LOG.debug("Plant details received")
                    measurements = plant_details.get("measurements", {})
                    
                    # Check for battery low condition - Fix for undefined variable
                    battery_low = False
                    if "sensor" in plant_details and plant_details["sensor"].get("is_battery_low", False):
                        battery_low = True
                        _LOG.warning("Plant %s has low battery", nickname)
                    
                    # Set temperature values
                    if "temperature" in measurements and isinstance(measurements["temperature"], dict):
                        _LOG.debug("Temperature measurements received")
                        temp_values = measurements["temperature"].get("values", {})
                        temp_status = measurements["temperature"].get("status")
                        
                        # Use try/except to handle potential type conversion issues
                        try:
                            # Status 0 means "No Data" according to FYTA API docs
                            if temp_status == 0:
                                _LOG.debug("Temperature has no data for plant %s", nickname)
                                temp_sensor.attributes[Attributes.VALUE] = "0"
                            elif temp_values and "current" in temp_values:
                                # We have a valid temperature reading
                                temp_value = temp_values["current"]
                                # Make sure it's a string before setting it as an attribute
                                if not isinstance(temp_value, str):
                                    temp_value = str(temp_value)
                                _LOG.debug("Temperature value received: %s", temp_value)
                                temp_sensor.attributes[Attributes.VALUE] = temp_value
                            
                            # Set status text based on the status code
                            temp_sensor.attributes["status"] = get_measurement_status_text(temp_status)
                        except Exception as e:
                            _LOG.error("Error processing temperature for plant %s: %s", nickname, e)
                            # Set safe default value on error
                            temp_sensor.attributes[Attributes.VALUE] = "0"
                            temp_sensor.attributes["status"] = "Error"
                    
                    # Set moisture values - focus on status text rather than numeric value
                    if "moisture" in measurements and isinstance(measurements["moisture"], dict):
                        _LOG.debug("Moisture measurements received")
                        moisture_status_code = measurements["moisture"].get("status")
                        moisture_values = measurements["moisture"].get("values", {})
                        
                        try:
                            # Status 0 means "No Data" according to FYTA API docs
                            if moisture_status_code == 0:
                                _LOG.debug("Moisture has no data for plant %s", nickname)
                                moisture_sensor.attributes[Attributes.VALUE] = "No Data"
                            # Special handling for plants with zero moisture and status 1 (Too Low)
                            elif moisture_status_code == 1 and moisture_values.get("current") == "0":
                                _LOG.warning("Plant %s has zero moisture", nickname)
                                moisture_sensor.attributes[Attributes.VALUE] = "To Low"
                                moisture_sensor.moisture_status = moisture_status_code
                            else:
                                # We have a valid moisture status
                                moisture_status_text = get_measurement_status_text(moisture_status_code)
                                moisture_sensor.attributes[Attributes.VALUE] = moisture_status_text
                                moisture_sensor.moisture_status = moisture_status_code
                                
                            # Add battery warning to status if necessary
                            if battery_low:
                                current_value = moisture_sensor.attributes[Attributes.VALUE]
                                moisture_sensor.attributes[Attributes.VALUE] = f"{current_value} (Battery Low)"
                        except Exception as e:
                            _LOG.error("Error processing moisture for plant %s: %s", nickname, e)
                            # Set safe default value on error
                            moisture_sensor.attributes[Attributes.VALUE] = "Unknown"
                
                # Store the sensors - Use sensor.id instead of sensor.identifier
                _plant_sensors[temp_sensor.id] = temp_sensor
                _plant_sensors[moisture_sensor.id] = moisture_sensor
                
                # Add to available entities
                api.available_entities.add(temp_sensor)
                api.available_entities.add(moisture_sensor)
                
                # Log successful registration
                entities_created += 2
                if api.available_entities.contains(temp_sensor.id):
                    _LOG.info("Successfully registered temperature entity %s", temp_sensor.id)
                else:
                    _LOG.error("Failed to register temperature entity %s", temp_sensor.id)
                    entities_created -= 1
                    
                if api.available_entities.contains(moisture_sensor.id):
                    _LOG.info("Successfully registered moisture entity %s", moisture_sensor.id)
                else:
                    _LOG.error("Failed to register moisture entity %s", moisture_sensor.id)
                    entities_created -= 1
                
        except Exception as e:
            _LOG.error("Error processing plant: %s", e, exc_info=True)
            continue
    
    _LOG.info("Finished creating entities. Total created: %d", entities_created)
    # log all the registered entities
    entities = api.available_entities.get_all()  # This is correct - get_all() is NOT async
    _LOG.info("Found %d registered entities", len(entities))
    _LOG.debug("Entity list available")
    
    # But get_states() IS async, so we need to await it
    entity_states = await api.available_entities.get_states()
    _LOG.debug("Entity states retrieved")
    
    # Also log the configured entities to verify
    configured_entities = api.configured_entities.get_all()
    _LOG.info("Found %d configured entities", len(configured_entities))
    for entity in configured_entities:
        _LOG.info("Configured entity: %s", entity["entity_id"])


@api.listens_to(ucapi.Events.CONNECT)
async def on_r2_connect_cmd() -> None:
    """Handle connect event from Remote Two."""
    _LOG.info("Connect command received from Remote Two")
    
    _LOG.info("Setting device state to CONNECTED")

    await api.set_device_state(ucapi.DeviceStates.CONNECTED)
    _LOG.info("Device state set to CONNECTED")

    entities = api.available_entities.get_all()
    _LOG.info("Found %d registered entities", len(entities))
    _LOG.info("entities: %s", entities)


def get_measurement_status_text(status_code) -> str:
    """Convert measurement status code to text."""
    if status_code == 0:
        return "No Data"
    elif status_code == 1:
        return "Too Low"
    elif status_code == 2:
        return "Low"
    elif status_code == 3:
        return "Perfect"
    elif status_code == 4:
        return "High"
    elif status_code == 5:
        return "Too High"
    else:
        return "Unknown"


@api.listens_to(ucapi.Events.DISCONNECT)
async def on_r2_disconnect_cmd() -> None:
    """Handle disconnect event from Remote Two."""
    _LOG.debug("Disconnect command received")
    await api.set_device_state(ucapi.DeviceStates.DISCONNECTED)


@api.listens_to(ucapi.Events.SUBSCRIBE_ENTITIES)
async def on_subscribe_entities(entity_ids: list[str]) -> None:
    """
    Subscribe to given entities and ensure they display proper temperature data.
    
    :param entity_ids: entity identifiers.
    """
    _LOG.info("Subscribe entities event: %s", entity_ids)
    
    for entity_id in entity_ids:
        entity = api.configured_entities.get(entity_id)
        
        # Add the entity to configured_entities if not already there
        if entity is None:
            # Try to get it from available entities
            entity = api.available_entities.get(entity_id)
            if entity is not None:
                # If found in available entities, add to configured
                api.configured_entities.add(entity)
                _LOG.info("Added entity %s to configured entities", entity_id)
        
        # Check if entity is a temperature sensor
        if entity and isinstance(entity, PlantTemperatureSensor):
            # Set initial state to ON
            _LOG.info("Setting initial state of temperature sensor %s", entity_id)
            
            # Update the attributes using the configured_entities method
            api.configured_entities.update_attributes(
                entity_id, 
                {
                    ucapi.sensor.Attributes.STATE: ucapi.sensor.States.ON,
                    ucapi.sensor.Attributes.VALUE: entity.attributes.get(ucapi.sensor.Attributes.VALUE, "0"),
                    ucapi.sensor.Attributes.UNIT: "°C"
                }
            )
        
        # Check if entity is a moisture sensor
        elif entity and isinstance(entity, PlantMoistureSensor):
            # Set initial state to ON
            _LOG.info("Setting initial state of moisture sensor %s", entity_id)
            
            # Update the attributes using the configured_entities method
            api.configured_entities.update_attributes(
                entity_id, 
                {
                    ucapi.sensor.Attributes.STATE: ucapi.sensor.States.ON,
                    ucapi.sensor.Attributes.VALUE: entity.attributes.get(ucapi.sensor.Attributes.VALUE, "Unknown"),
                    # ucapi.sensor.Attributes.UNIT: "Status"
                }
            )


async def main():
    """Main entry point for the integration."""
    global _fyta_config
    
    # Configure logging
    logging.basicConfig(
        level=logging.DEBUG,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    _LOG.info("Starting FYTA integration for UC Remote")
    
    # Load existing configuration
    _fyta_config = load_config()
    if _fyta_config and _fyta_config.email:
        _LOG.info("Loaded FYTA configuration")
    else:
        _LOG.warning("No configuration found or invalid configuration")

    # Initialize the integration with driver.json and setup handler
    _LOG.info("Initializing UC Remote integration API")
    await api.init("driver.json", driver_setup_handler)
    
    _LOG.info("Integration startup complete")


if __name__ == "__main__":
    try:
        _LOOP.run_until_complete(main())
        # Keep the server running
        _LOOP.run_forever()
    except KeyboardInterrupt:
        pass 