import * as api from '@unfoldedcircle/integration-api';
import FytaApiClient from './fyta-api.js';
import EntityManager from './entity-manager.js';

// Create FYTA API client and entity manager
const fytaClient = new FytaApiClient();
const entityManager = new EntityManager();

// Track device state
let pollInterval = 300; // Default polling interval in seconds
let subscribedEntities = new Set();

// Create FYTA integration driver
const driver = new api.IntegrationAPI();

// Initialize the driver with the driver.json file
driver.init("./driver.json");

// Handle connection events
driver.on(api.Events.Connect, async () => {
  console.log('Remote connected to FYTA integration');
  await driver.setDeviceState(api.DeviceStates.Connected);
});

driver.on(api.Events.Disconnect, async () => {
  console.log('Remote disconnected from FYTA integration');
  await driver.setDeviceState(api.DeviceStates.Disconnected);
});

// Handle driver setup
driver.on(api.Events.DriverSetup, async (setupData) => {
  console.log('Setting up FYTA integration...');
  
  try {
    const username = setupData.username;
    const password = setupData.password;
    
    if (setupData.poll_interval) {
      pollInterval = setupData.poll_interval;
    }
    
    // Login to FYTA API
    await fytaClient.login(username, password);
    console.log('Successfully logged in to FYTA API');
    
    // Start polling for sensor data
    fytaClient.startPolling(pollInterval);
    
    // Complete the setup
    driver.driverSetupComplete();
  } catch (error) {
    console.error('Setup failed:', error.message);
    driver.driverSetupError(error.message);
  }
});

// Handle available entities request
driver.on(api.Events.GetAvailableEntities, async () => {
  console.log('Available entities requested');
  
  try {
    if (!fytaClient.isLoggedIn()) {
      console.warn('Not authenticated, cannot provide entities');
      return [];
    }
    
    // Get sensors from FYTA API
    const sensors = await fytaClient.getSensors();
    console.log(`Found ${sensors.length} sensors`);
    
    // Create entity definitions for each sensor
    for (const sensor of sensors) {
      // Get sensor data to determine available measurements
      const data = await fytaClient.getSensorData(sensor.id);
      
      // Process sensor data to create entity definitions
      entityManager.processSensorData(sensor, data);
    }
    
    // Return all entity definitions
    return entityManager.getAllEntityDefinitions();
  } catch (error) {
    console.error('Error getting available entities:', error.message);
    return [];
  }
});

// Handle entity states request
driver.on(api.Events.GetEntityStates, async (entityIds) => {
  console.log(`Entity states requested for ${entityIds.length} entities`);
  
  const states = {};
  
  for (const entityId of entityIds) {
    const state = entityManager.getEntityState(entityId);
    if (state) {
      states[entityId] = state;
    }
  }
  
  return states;
});

// Handle subscribe events request
driver.on(api.Events.SubscribeEntities, async (entityIds) => {
  console.log(`Subscribe events requested for ${entityIds.length} entities`);
  
  // Clear previous subscriptions
  subscribedEntities.clear();
  
  // Add new subscriptions
  for (const entityId of entityIds) {
    subscribedEntities.add(entityId);
  }
  
  return true;
});

// Handle entity command
driver.on(api.Events.EntityCommand, async (entity, commandId, params) => {
  console.log(`Entity command received: ${entity.id} ${commandId}`);
  
  // FYTA sensors are read-only, so we don't handle any commands
  return api.StatusCodes.NotImplemented;
});

// Handle sensor data events
fytaClient.on('sensorData', ({ sensor, data }) => {
  console.log(`Received data for sensor ${sensor.id}`);
  
  // Process sensor data and update entity states
  const updatedEntities = entityManager.processSensorData(sensor, data);
  
  // Send entity change events for subscribed entities
  for (const { entityId, state } of updatedEntities) {
    if (subscribedEntities.has(entityId)) {
      driver.updateEntityAttributes(entityId, state);
    }
  }
}); 