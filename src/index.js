const { IntegrationDriver, DeviceState } = require('@unfoldedcircle/integration-api');
const FytaApiClient = require('./fyta-api');
const EntityManager = require('./entity-manager');

// Create FYTA integration driver
const driver = new IntegrationDriver({
  driverId: 'fyta',
  name: 'FYTA Plant Monitor',
  description: 'Integration for FYTA plant sensors',
  version: '0.1.0',
  icon: 'plant',
  driverMetadataFile: './driver.json'
});

// Create FYTA API client and entity manager
const fytaClient = new FytaApiClient();
const entityManager = new EntityManager();

// Track device state
let deviceState = DeviceState.UNAVAILABLE;
let pollInterval = 300; // Default polling interval in seconds
let subscribedEntities = new Set();

// Handle driver setup
driver.onSetup(async (setupData) => {
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
    
    // Update device state
    deviceState = DeviceState.READY;
    driver.deviceState = deviceState;
    
    // Start polling for sensor data
    fytaClient.startPolling(pollInterval);
    
    return true;
  } catch (error) {
    console.error('Setup failed:', error.message);
    deviceState = DeviceState.ERROR;
    driver.deviceState = deviceState;
    return false;
  }
});

// Handle driver initialization
driver.onInitialize(async () => {
  console.log('Initializing FYTA integration...');
  
  // Set initial device state
  deviceState = fytaClient.isLoggedIn() ? DeviceState.READY : DeviceState.UNAVAILABLE;
  driver.deviceState = deviceState;
  
  // Handle sensor data events
  fytaClient.on('sensorData', ({ sensor, data }) => {
    console.log(`Received data for sensor ${sensor.id}`);
    
    // Process sensor data and update entity states
    const updatedEntities = entityManager.processSensorData(sensor, data);
    
    // Send entity change events for subscribed entities
    for (const { entityId, state } of updatedEntities) {
      if (subscribedEntities.has(entityId)) {
        driver.entityChange(entityId, state);
      }
    }
  });
  
  return true;
});

// Handle available entities request
driver.onAvailableEntitiesRequest(async () => {
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
driver.onEntityStatesRequest(async (entityIds) => {
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
driver.onSubscribeEvents(async (entityIds) => {
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
driver.onEntityCommand(async (entityType, entityId, commandId, params) => {
  console.log(`Entity command received: ${entityType} ${entityId} ${commandId}`);
  
  // FYTA sensors are read-only, so we don't handle any commands
  return false;
});

// Handle driver stop
driver.onStop(async () => {
  console.log('Stopping FYTA integration...');
  
  // Stop polling
  fytaClient.stopPolling();
  
  return true;
});

// Start the driver
driver.start().catch(error => {
  console.error('Failed to start driver:', error.message);
}); 