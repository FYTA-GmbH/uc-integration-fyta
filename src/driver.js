#!/usr/bin/env node

// FYTA Plant Monitor integration for Unfolded Circle Remote Two
import { IntegrationAPI, Events, DeviceStates, StatusCodes } from '@unfoldedcircle/integration-api';

// Log startup information
console.log('FYTA Plant Monitor integration starting');
console.log('Process ID:', process.pid);
console.log('Working directory:', process.cwd());
console.log('Environment variables:', {
  UC_CONFIG_HOME: process.env.UC_CONFIG_HOME,
  UC_INTEGRATION_PORT: process.env.UC_INTEGRATION_PORT,
  UC_INTEGRATION_INTERFACE: process.env.UC_INTEGRATION_INTERFACE
});

// Create driver instance
const driver = new IntegrationAPI();

// Set up the required event handlers
driver.on(Events.Connect, async () => {
  console.log('Remote connected to FYTA integration');
  await driver.setDeviceState(DeviceStates.Connected);
});

driver.on(Events.Disconnect, async () => {
  console.log('Remote disconnected from FYTA integration');
  await driver.setDeviceState(DeviceStates.Disconnected);
});

// Required message: get_driver_version
driver.on(Events.GetDriverVersion, async () => {
  console.log('Driver version requested');
  return {
    name: 'FYTA Plant Monitor',
    version: '0.1.0',
    min_core_api: '0.20.0'
  };
});

// Required message: get_device_state
driver.on(Events.GetDeviceState, async () => {
  console.log('Device state requested');
  return DeviceStates.Connected;
});

// Required message: get_available_entities
driver.on(Events.GetAvailableEntities, async () => {
  console.log('Available entities requested');
  return [];
});

// Required message: subscribe_events
driver.on(Events.SubscribeEntities, async (entityIds) => {
  console.log('Entity subscription requested for:', entityIds);
  return true;
});

// Required message: get_entity_states
driver.on(Events.GetEntityStates, async (entityIds) => {
  console.log('Entity states requested for:', entityIds);
  return {};
});

// Required message: entity_command
driver.on(Events.EntityCommand, async (entity, commandId, params) => {
  console.log('Entity command received:', entity, commandId, params);
  return StatusCodes.Ok;
});

// Handle setup process
driver.on(Events.DriverSetup, async (setupData) => {
  console.log('Driver setup event received:', JSON.stringify(setupData));
  
  // Simple check for the setup_fyta flag from initial screen
  if (setupData && setupData.setup_fyta) {
    console.log('Showing credentials form');
    
    const form = {
      title: { en: 'FYTA Account' },
      input_fields: [
        {
          id: 'username',
          label: { en: 'Email Address' },
          field: { text: { value: '' } }
        },
        {
          id: 'password',
          label: { en: 'Password' },
          field: { text: { value: '', is_password: true } }
        }
      ]
    };
    
    driver.driverSetupUserInput(form);
  } else if (setupData && setupData.username) {
    // Got credentials, finish setup
    console.log('Credentials received, finishing setup');
    driver.driverSetupComplete();
  } else {
    // No data, just complete the setup
    console.log('No setup data, completing setup');
    driver.driverSetupComplete();
  }
});

// Initialize the driver
console.log('Initializing driver...');
driver.init('./driver.json')
  .then(() => {
    console.log('Driver initialized successfully');
    
    // Send a device state event to indicate we're connected
    driver.emitDeviceState(DeviceStates.Connected);
    
    console.log('FYTA integration is now running and ready');
  })
  .catch(error => {
    console.error('Driver initialization failed:', error);
  });

// Keep the process running
process.on('SIGINT', () => {
  console.log('Shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Terminating...');
  process.exit(0);
});

// Log any unhandled errors
process.on('uncaughtException', (error) => {
  console.error('Unhandled exception:', error);
}); 