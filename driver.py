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

# Settings constants
MAX_STARTUP_RETRIES = 5
RETRY_DELAY_SECONDS = 10
API_RETRY_ATTEMPTS = 3  # Number of times to retry API calls on timeout
API_RETRY_DELAY = 3  # Seconds to wait between retries


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
        
        # Create plant sensors using the update function
        _LOG.info("Loading plant data from FYTA API")
        success = await update_plant_data()
        if not success:
            _LOG.warning("Initial plant data retrieval encountered issues")
            
        # Start periodic updates - also for first-time setup
        _LOG.info("Starting periodic updates during setup")
        asyncio.create_task(start_periodic_updates(15))  # Every 15 minutes (was 1 minute for testing)
        
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


def store_entities(entities_data: Dict[str, dict]) -> bool:
    """Store entity data to a file for persistence across reboots."""
    try:
        entities_path = os.path.join(os.getenv("UC_CONFIG_HOME", os.getcwd()), "entities.json")
        with open(entities_path, "w", encoding="utf-8") as f:
            json.dump(entities_data, f, ensure_ascii=False)
        _LOG.info("Successfully saved %d entities to file: %s", len(entities_data), entities_path)
        return True
    except Exception as e:
        _LOG.error("Failed to save entities: %s", e)
        return False


def load_entities() -> Dict[str, dict]:
    """Load entity data from file."""
    try:
        entities_path = os.path.join(os.getenv("UC_CONFIG_HOME", os.getcwd()), "entities.json")
        if not os.path.exists(entities_path):
            _LOG.info("No stored entities file found")
            return {}
            
        _LOG.info("Loading entities from file: %s", entities_path)
        with open(entities_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        _LOG.error("Failed to load entities: %s", e)
        return {}


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
        async def auth_request():
            async with httpx.AsyncClient() as client:
                response = await client.post(FYTA_AUTH_URL, json=payload, timeout=10.0)
                response.raise_for_status()
                
                auth_data = response.json()
                _LOG.info("Successfully authenticated with FYTA API")
                return auth_data
        
        # Use the retry utility function
        auth_data = await retry_api_call(auth_request)
        if auth_data is None:
            _LOG.error("Authentication failed after retries")
            raise Exception("Authentication failed after multiple attempts")
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
        async def fetch_plants():
            async with httpx.AsyncClient() as client:
                response = await client.get(FYTA_USER_PLANTS_URL, headers=headers, timeout=10.0)
                response.raise_for_status()
                
                data = response.json()
                plants = data.get("plants", [])
                _LOG.info("Retrieved %d plants from FYTA API", len(plants))
                return plants
        
        # Use the retry utility function
        plants = await retry_api_call(fetch_plants)
        if plants is not None:
            return plants
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


async def retry_api_call(api_func, *args, max_retries=API_RETRY_ATTEMPTS, **kwargs):
    """
    Utility function to retry API calls with exponential backoff.
    
    :param api_func: The async function to call
    :param max_retries: Maximum number of retries
    :param args: Positional arguments for the function
    :param kwargs: Keyword arguments for the function
    :return: The result of the API call or None on failure
    """
    last_error = None
    
    for attempt in range(1, max_retries + 1):
        try:
            return await api_func(*args, **kwargs)
        except httpx.TimeoutException as e:
            last_error = e
            retry_delay = API_RETRY_DELAY * attempt  # Simple exponential backoff
            _LOG.warning("API timeout (attempt %d/%d), retrying in %d seconds: %s", 
                        attempt, max_retries, retry_delay, str(e))
            
            if attempt < max_retries:
                await asyncio.sleep(retry_delay)
            else:
                _LOG.error("API call failed after %d retries: %s", max_retries, str(e))
        except Exception as e:
            # For non-timeout errors, don't retry
            _LOG.error("API call error (not retrying): %s", str(e))
            last_error = e
            break
    
    if last_error:
        # Re-raise the last error for higher-level handling
        # raise last_error
        # Instead of raising, just return None to keep things simple
        return None


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
        async def get_details():
            async with httpx.AsyncClient() as client:
                url = FYTA_PLANT_DETAILS_URL.format(plant_id=plant_id)
                response = await client.get(url, headers=headers, timeout=10.0)
                response.raise_for_status()
                
                data = response.json()
                return data.get("plant", {})

        details = await retry_api_call(get_details)
        return details
    except Exception as e:
        _LOG.error("Error fetching plant details for ID %s: %s", plant_id, e)
        return {}


async def is_network_connected() -> bool:
    """Check if network is connected by trying to reach FYTA API endpoint."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.head(
                "https://web.fyta.de", 
                timeout=5.0
            )
            return response.status_code < 500  # Any response below 500 means network is working
    except Exception:
        return False


async def wait_for_network_connection(max_retries=MAX_STARTUP_RETRIES, delay=RETRY_DELAY_SECONDS) -> bool:
    """Wait for network connection with retries.
    
    Returns True if network becomes available, False if max retries exceeded.
    """
    for attempt in range(1, max_retries + 1):
        _LOG.info("Checking network connectivity (attempt %d/%d)", attempt, max_retries)
        if await is_network_connected():
            _LOG.info("Network is connected")
            return True
        
        if attempt < max_retries:
            _LOG.warning("Network not available, retrying in %d seconds...", delay)
            await asyncio.sleep(delay)
    
    _LOG.error("Network connection not available after %d attempts", max_retries)
    return False


@api.listens_to(ucapi.Events.CONNECT)
async def on_r2_connect_cmd() -> None:
    """Handle connect event from Remote Two."""
    _LOG.info("Connect command received from Remote Two")
    
    # Check current entities first
    entities = api.available_entities.get_all()
    _LOG.info("Found %d available entities at connect", len(entities))
    
    # Set device state to CONNECTED first so Remote can see the entities
    _LOG.info("Setting device state to CONNECTED")
    await api.set_device_state(ucapi.DeviceStates.CONNECTED)
    _LOG.info("Device state set to CONNECTED")
    
    # Check if we have configuration but need to update entity values
    if _fyta_config and _fyta_config.email:
        _LOG.info("Configuration exists - checking connectivity to update entities")
        
        if await is_network_connected():
            try:
                # Try to re-authenticate with FYTA API
                auth_response = await authenticate_fyta(_fyta_config.email, _fyta_config.password)
                if auth_response and "access_token" in auth_response:
                    _LOG.info("Successfully re-authenticated with FYTA API during connect")
                    # Update tokens in config
                    _fyta_config.access_token = auth_response.get("access_token")
                    _fyta_config.refresh_token = auth_response.get("refresh_token")
                    _fyta_config.expires_in = auth_response.get("expires_in")
                    save_config(_fyta_config)
                    
                    # Update entity data using the new function
                    success = await update_plant_data()
                    if success:
                        _LOG.info("Successfully updated entities on connect")
                    else:
                        _LOG.warning("No entities were updated on connect")
                else:
                    _LOG.error("Failed to re-authenticate with FYTA API during connect")
            except Exception as e:
                _LOG.error("Error during connect re-authentication: %s", e)
        else:
            _LOG.warning("Network not available during connect - using stored entities only")
            # Will continue using the stored entities loaded during startup
    else:
        _LOG.warning("No configuration available during connect")


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
            else:
                _LOG.error("Entity %s not found in available entities", entity_id)
                continue
        
        # Check if entity is a temperature sensor
        if entity and isinstance(entity, PlantTemperatureSensor):
            # Set initial state to ON
            _LOG.info("Setting initial state of temperature sensor %s", entity_id)
            
            # Get current value from the entity (might be from storage or fresh data)
            current_value = entity.attributes.get(Attributes.VALUE, "0")
            
            # Update the attributes using the configured_entities method
            api.configured_entities.update_attributes(
                entity_id, 
                {
                    Attributes.STATE: States.ON,
                    Attributes.VALUE: current_value,
                    Attributes.UNIT: "°C"
                }
            )
            _LOG.info("Updated temperature entity %s with value %s", entity_id, current_value)
        
        # Check if entity is a moisture sensor
        elif entity and isinstance(entity, PlantMoistureSensor):
            # Set initial state to ON
            _LOG.info("Setting initial state of moisture sensor %s", entity_id)
            
            # Get current value from the entity (might be from storage or fresh data)
            current_value = entity.attributes.get(Attributes.VALUE, "Unknown")
            
            # Update the attributes using the configured_entities method
            api.configured_entities.update_attributes(
                entity_id, 
                {
                    Attributes.STATE: States.ON,
                    Attributes.VALUE: current_value
                }
            )
            _LOG.info("Updated moisture entity %s with value %s", entity_id, current_value)


async def update_entities_from_api():
    """Background task to update entities from FYTA API."""
    _LOG.info("Starting background task to update entities from API")
    
    # Wait for network connectivity before authenticating
    if await wait_for_network_connection():
        # Try to re-authenticate with saved credentials
        try:
            auth_response = await authenticate_fyta(_fyta_config.email, _fyta_config.password)
            if auth_response and "access_token" in auth_response:
                _LOG.info("Successfully re-authenticated with FYTA API")
                # Update tokens in config
                _fyta_config.access_token = auth_response.get("access_token")
                _fyta_config.refresh_token = auth_response.get("refresh_token")
                _fyta_config.expires_in = auth_response.get("expires_in")
                save_config(_fyta_config)
                
                # Update plant sensors using the new function
                success = await update_plant_data()
                if success:
                    _LOG.info("Successfully updated entities from API during startup")
                else:
                    _LOG.warning("No entities were updated during startup update")
            else:
                _LOG.error("Failed to re-authenticate with FYTA API")
        except Exception as e:
            _LOG.error("Error during startup authentication: %s", e)
    else:
        _LOG.warning("Network not available during startup - will try to reconnect later")


async def update_plant_data() -> bool:
    """
    Update all plant data from the FYTA API and store the results.
    
    This function fetches data from FYTA API and updates the entity values.
    It's used for both initial creation and periodic updates.
    
    Returns True if the update was successful, False otherwise.
    """
    if not _fyta_config or not _fyta_config.access_token:
        _LOG.error("No valid FYTA authentication token available for update")
        return False
    
    try:
        # Get all plants from FYTA API
        plants = await get_user_plants()
        if not plants:
            _LOG.warning("No plants found from FYTA API during update")
            return False
        
        _LOG.info("Retrieved %d plants from FYTA API for update", len(plants))
        updates_made = False
        
        # Process each plant
        for plant in plants:
            plant_id = str(plant.get("id"))
            nickname = plant.get("nickname", f"Plant {plant_id}")
            
            # Check if this plant has a sensor
            has_sensor = False
            sensor = plant.get("sensor")
            if sensor is not None:
                has_sensor = sensor.get("has_sensor", False)
            
            if not has_sensor:
                _LOG.debug("Plant %s has no sensor, skipping", nickname)
                continue
            
            # Define entity IDs
            temp_entity_id = f"fyta-plant-{plant_id}"
            moisture_entity_id = f"fyta-moisture-{plant_id}"
            
            try:
                # Get detailed plant information
                plant_details = await get_plant_details(plant_id)
                if not plant_details or "measurements" not in plant_details:
                    _LOG.warning("No measurement data for plant %s, skipping", nickname)
                    continue
                
                # Check for battery low condition
                battery_low = False
                if "sensor" in plant_details and plant_details["sensor"].get("is_battery_low", False):
                    battery_low = True
                    _LOG.warning("Plant %s has low battery", nickname)
                
                measurements = plant_details.get("measurements", {})
                scientific_name = plant.get("scientific_name", "Unknown")
                
                # Process temperature data
                if "temperature" in measurements and isinstance(measurements["temperature"], dict):
                    temp_data = measurements["temperature"]
                    temp_values = temp_data.get("values", {})
                    temp_status = temp_data.get("status")
                    
                    # Check if temperature entity exists
                    if api.available_entities.contains(temp_entity_id):
                        # Update existing entity
                        temp_sensor = _plant_sensors.get(temp_entity_id)
                        if temp_sensor:
                            # Update temperature value
                            if temp_status == 0:
                                temp_sensor.attributes[Attributes.VALUE] = "0"
                            elif temp_values and "current" in temp_values:
                                temp_value = temp_values["current"]
                                if not isinstance(temp_value, str):
                                    temp_value = str(temp_value)
                                temp_sensor.attributes[Attributes.VALUE] = temp_value
                            
                            # Update status text
                            temp_sensor.attributes["status"] = get_measurement_status_text(temp_status)
                            
                            # Update configured entity if it exists
                            if api.configured_entities.contains(temp_entity_id):
                                api.configured_entities.update_attributes(
                                    temp_entity_id,
                                    {
                                        Attributes.STATE: States.ON,
                                        Attributes.VALUE: temp_sensor.attributes[Attributes.VALUE],
                                        Attributes.UNIT: "°C"
                                    }
                                )
                            
                            _LOG.info("Updated temperature entity %s with value %s", 
                                    temp_entity_id, temp_sensor.attributes[Attributes.VALUE])
                            updates_made = True
                    else:
                        # Create new temperature entity
                        temp_sensor = PlantTemperatureSensor(
                            plant_id=plant_id,
                            nickname=nickname,
                            scientific_name=scientific_name
                        )
                        
                        # Set initial values
                        if temp_status == 0:
                            temp_sensor.attributes[Attributes.VALUE] = "0"
                        elif temp_values and "current" in temp_values:
                            temp_value = temp_values["current"]
                            if not isinstance(temp_value, str):
                                temp_value = str(temp_value)
                            temp_sensor.attributes[Attributes.VALUE] = temp_value
                        
                        # Set status text
                        temp_sensor.attributes["status"] = get_measurement_status_text(temp_status)
                        
                        # Store and register the sensor
                        _plant_sensors[temp_sensor.id] = temp_sensor
                        api.available_entities.add(temp_sensor)
                        
                        _LOG.info("Created new temperature entity %s with value %s", 
                                temp_sensor.id, temp_sensor.attributes[Attributes.VALUE])
                        updates_made = True
                
                # Process moisture data
                if "moisture" in measurements and isinstance(measurements["moisture"], dict):
                    moisture_data = measurements["moisture"]
                    moisture_status_code = moisture_data.get("status")
                    moisture_values = moisture_data.get("values", {})
                    
                    # Check if moisture entity exists
                    if api.available_entities.contains(moisture_entity_id):
                        # Update existing entity
                        moisture_sensor = _plant_sensors.get(moisture_entity_id)
                        if moisture_sensor:
                            # Update moisture status
                            if moisture_status_code == 0:
                                moisture_sensor.attributes[Attributes.VALUE] = "No Data"
                            elif moisture_status_code == 1 and moisture_values.get("current") == "0":
                                moisture_sensor.attributes[Attributes.VALUE] = "Too Low"
                            else:
                                moisture_sensor.attributes[Attributes.VALUE] = get_measurement_status_text(moisture_status_code)
                            
                            # Add battery warning if applicable
                            if battery_low:
                                current_value = moisture_sensor.attributes[Attributes.VALUE]
                                moisture_sensor.attributes[Attributes.VALUE] = f"{current_value} (Battery Low)"
                            
                            # Update configured entity if it exists
                            if api.configured_entities.contains(moisture_entity_id):
                                api.configured_entities.update_attributes(
                                    moisture_entity_id,
                                    {
                                        Attributes.STATE: States.ON,
                                        Attributes.VALUE: moisture_sensor.attributes[Attributes.VALUE]
                                    }
                                )
                            
                            _LOG.info("Updated moisture entity %s with value %s", 
                                    moisture_entity_id, moisture_sensor.attributes[Attributes.VALUE])
                            updates_made = True
                    else:
                        # Create new moisture entity
                        moisture_sensor = PlantMoistureSensor(
                            plant_id=plant_id,
                            nickname=nickname,
                            scientific_name=scientific_name
                        )
                        
                        # Set initial values
                        if moisture_status_code == 0:
                            moisture_sensor.attributes[Attributes.VALUE] = "No Data"
                        elif moisture_status_code == 1 and moisture_values.get("current") == "0":
                            moisture_sensor.attributes[Attributes.VALUE] = "Too Low"
                        else:
                            moisture_sensor.attributes[Attributes.VALUE] = get_measurement_status_text(moisture_status_code)
                        
                        # Add battery warning if applicable
                        if battery_low:
                            current_value = moisture_sensor.attributes[Attributes.VALUE]
                            moisture_sensor.attributes[Attributes.VALUE] = f"{current_value} (Battery Low)"
                        
                        # Store and register the sensor
                        _plant_sensors[moisture_sensor.id] = moisture_sensor
                        api.available_entities.add(moisture_sensor)
                        
                        _LOG.info("Created new moisture entity %s with value %s", 
                                moisture_sensor.id, moisture_sensor.attributes[Attributes.VALUE])
                        updates_made = True
                
            except Exception as e:
                _LOG.error("Error updating plant %s: %s", nickname, e)
                continue
        
        # Store entities if updates were made
        if updates_made:
            _LOG.info("Storing updated entities to file")
            entities_data = {}
            for entity_id, entity in _plant_sensors.items():
                if isinstance(entity, PlantTemperatureSensor):
                    entities_data[entity_id] = {
                        "type": "temperature",
                        "plant_id": entity.plant_id,
                        "nickname": entity.name,
                        "scientific_name": entity.scientific_name,
                        "attributes": entity.attributes
                    }
                elif isinstance(entity, PlantMoistureSensor):
                    entities_data[entity_id] = {
                        "type": "moisture",
                        "plant_id": entity.plant_id,
                        "nickname": entity.name,
                        "scientific_name": entity.scientific_name,
                        "attributes": entity.attributes
                    }
            
            store_entities(entities_data)
        
        return updates_made
        
    except Exception as e:
        _LOG.error("Error updating plant data: %s", e)
        return False


async def start_periodic_updates(interval_minutes=15):
    """
    Start periodic updates of plant data from FYTA API.
    
    :param interval_minutes: How often to update data, in minutes
    """
    _LOG.info("Starting periodic updates every %d minutes", interval_minutes)
    
    while True:
        try:
            # Wait for the specified interval
            await asyncio.sleep(interval_minutes * 60)
            
            # Only update if network is connected
            if await is_network_connected():
                _LOG.info("Running scheduled update (every %d minutes)", interval_minutes)
                success = await update_plant_data()
                if success:
                    _LOG.info("Scheduled update completed successfully")
                else:
                    _LOG.warning("Scheduled update completed with no changes")
            else:
                _LOG.warning("Network not available for scheduled update - will try again later")
        except Exception as e:
            _LOG.error("Error during scheduled update: %s", e)
            # Continue the loop even if there was an error


async def main():
    """Main entry point for the integration."""
    global _fyta_config, _plant_sensors
    
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    # Set higher log level for websockets to prevent ping/pong spam
    logging.getLogger('websockets.server').setLevel(logging.WARNING)
    logging.getLogger('websockets.protocol').setLevel(logging.WARNING)

    _LOG.info("Starting FYTA integration for UC Remote")
    
    # Load existing configuration
    _fyta_config = load_config()

    # Initialize the integration with driver.json and setup handler
    _LOG.info("Initializing UC Remote integration API")
    await api.init("driver.json", driver_setup_handler)
    
    # Load stored entities first to ensure they're available immediately
    _LOG.info("Loading stored entities")
    stored_entities = load_entities()
    _LOG.info("Found %d stored entities", len(stored_entities))
    
    if stored_entities:
        _plant_sensors = {}
        for entity_id, entity_data in stored_entities.items():
            try:
                if entity_data["type"] == "temperature":
                    # Get nickname - handle both string and dict formats
                    nickname = entity_data.get("nickname", "Unknown Plant")
                    if isinstance(nickname, dict):
                        # If nickname is a dictionary, convert to string
                        nickname = str(nickname)
                    elif isinstance(nickname, str) and " Temperature" in nickname:
                        # If it's a string with suffix, remove the suffix
                        nickname = nickname.replace(" Temperature", "")
                    
                    # Create temperature sensor
                    sensor = PlantTemperatureSensor(
                        plant_id=entity_data["plant_id"],
                        nickname=nickname,
                        scientific_name=entity_data.get("scientific_name", "Unknown")
                    )
                    
                    # Set stored attributes if available
                    if "attributes" in entity_data:
                        # Set only the most essential attributes for initial display
                        sensor.attributes[Attributes.VALUE] = entity_data["attributes"].get(Attributes.VALUE, "0")
                        
                    _plant_sensors[entity_id] = sensor
                    api.available_entities.add(sensor)
                    _LOG.info("Loaded temperature entity %s from storage", entity_id)
                
                elif entity_data["type"] == "moisture":
                    # Get nickname - handle both string and dict formats
                    nickname = entity_data.get("nickname", "Unknown Plant")
                    if isinstance(nickname, dict):
                        # If nickname is a dictionary, convert to string
                        nickname = str(nickname)
                    elif isinstance(nickname, str) and " Moisture" in nickname:
                        # If it's a string with suffix, remove the suffix
                        nickname = nickname.replace(" Moisture", "")
                    
                    # Create moisture sensor
                    sensor = PlantMoistureSensor(
                        plant_id=entity_data["plant_id"],
                        nickname=nickname,
                        scientific_name=entity_data.get("scientific_name", "Unknown")
                    )
                    
                    # Set stored attributes if available
                    if "attributes" in entity_data:
                        # Set only the most essential attributes for initial display
                        sensor.attributes[Attributes.VALUE] = entity_data["attributes"].get(Attributes.VALUE, "Unknown")
                        
                    _plant_sensors[entity_id] = sensor
                    api.available_entities.add(sensor)
                    _LOG.info("Loaded moisture entity %s from storage", entity_id)
            except Exception as e:
                _LOG.error("Error loading entity %s: %s", entity_id, e)
    
    # IMPORTANT: Set device to CONNECTED state AFTER loading stored entities
    # This ensures entities are available to Remote Two when it connects
    _LOG.info("Setting device state to CONNECTED with stored entities")
    await api.set_device_state(ucapi.DeviceStates.CONNECTED)
    
    # AFTER setting connected state with stored entities, try to update from API
    if _fyta_config and _fyta_config.email:
        _LOG.info("Loaded FYTA configuration, will update entities in background")
        
        # Start a background task to update entities from API
        # This way the integration can respond to Remote Two immediately
        asyncio.create_task(update_entities_from_api())
        
        # Start periodic updates - run every 15 minutes for testing
        _LOG.info("Starting periodic updates")
        asyncio.create_task(start_periodic_updates(15))
    else:
        _LOG.warning("No configuration found or invalid configuration")
    
    _LOG.info("Integration startup complete")


if __name__ == "__main__":
    try:
        _LOOP.run_until_complete(main())
        # Keep the server running
        _LOOP.run_forever()
    except KeyboardInterrupt:
        pass 