#!/usr/bin/env node

// FYTA Plant Monitor integration for Unfolded Circle Remote Two
import { IntegrationAPI, Events, DeviceStates, StatusCodes } from '@unfoldedcircle/integration-api';
import fs from 'fs';
import path from 'path';

// Set up logging to file
const logDir = process.env.UC_CONFIG_HOME || './config';
const logFile = path.join(logDir, 'fyta-debug.log');

// Create a logging function that writes to both console and file
function log(...args) {
  const message = args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg
  ).join(' ');
  
  console.log(message);
  
  try {
    // Ensure log directory exists
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    // Append to log file with timestamp
    fs.appendFileSync(
      logFile, 
      `[${new Date().toISOString()}] ${message}\n`
    );
  } catch (error) {
    console.error('Error writing to log file:', error);
  }
}

// Log startup information
log('FYTA Plant Monitor integration starting');
log('Process ID:', process.pid);
log('Working directory:', process.cwd());
log('Environment variables:', {
  UC_CONFIG_HOME: process.env.UC_CONFIG_HOME || './config',
  UC_INTEGRATION_PORT: process.env.UC_INTEGRATION_PORT || 9001,
  UC_INTEGRATION_INTERFACE: process.env.UC_INTEGRATION_INTERFACE || '0.0.0.0',
  NODE_ENV: process.env.NODE_ENV,
  PATH: process.env.PATH
});

// List files in current directory
try {
  log('Files in current directory:', fs.readdirSync(process.cwd()));
} catch (error) {
  log('Error listing files:', error.message);
}

// ************ CONFIGURATION SETTINGS ************
// FOR SIMULATOR (Mac): Use port 9001 and host 0.0.0.0
// FOR PHYSICAL REMOTE: Use port 9090 and comment out the driver_url line
const PORT = 9001; // Use 9001 for simulator, 9090 for physical Remote
const HOST = '0.0.0.0'; // Use 0.0.0.0 for both simulator and physical Remote
// Change MAC_IP to your actual Mac's IP address for simulator
const MAC_IP = '192.168.68.57'; // YOUR MAC'S IP ADDRESS HERE
// *********************************************** 

log(`Initializing IntegrationAPI with port ${PORT} and host ${HOST}`);

// Initialize the integration API
const api = new IntegrationAPI({
  port: PORT,
  host: HOST,
  configDir: process.env.UC_CONFIG_HOME || './config'
});

// Set up the required event handlers
api.on(Events.Connect, async () => {
  log('Remote connected to FYTA integration');
  try {
    await api.setDeviceState(DeviceStates.Connected);
    log('Device state set to Connected');
  } catch (error) {
    log('Error setting device state:', error);
  }
});

api.on(Events.Disconnect, async () => {
  log('Remote disconnected from FYTA integration');
  try {
    await api.setDeviceState(DeviceStates.Disconnected);
    log('Device state set to Disconnected');
  } catch (error) {
    log('Error setting device state:', error);
  }
});

// Required message: get_driver_version
api.on(Events.GetDriverVersion, async () => {
  log('Driver version requested');
  return {
    name: 'FYTA Plant Monitor',
    version: '0.1.0',
    min_core_api: '0.20.0'
  };
});

// Required message: get_device_state
api.on(Events.GetDeviceState, async () => {
  log('Device state requested');
  return DeviceStates.Connected;
});

// Required message: get_available_entities
api.on(Events.GetAvailableEntities, async () => {
  log('Available entities requested');
  return [];
});

// Required message: subscribe_events
api.on(Events.SubscribeEntities, async (entityIds) => {
  log('Entity subscription requested for:', entityIds);
  return true;
});

// Required message: get_entity_states
api.on(Events.GetEntityStates, async (entityIds) => {
  log('Entity states requested for:', entityIds);
  return {};
});

// Required message: entity_command
api.on(Events.EntityCommand, async (entity, commandId, params) => {
  log('Entity command received:', entity, commandId, params);
  return StatusCodes.Ok;
});

// Handle setup process
api.on(Events.DriverSetup, async (setupData) => {
  log('Driver setup event received:', JSON.stringify(setupData));
  
  // Simple check for the setup_fyta flag from initial screen
  if (setupData && setupData.setup_fyta) {
    log('Showing credentials form');
    
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
    
    try {
      await api.driverSetupUserInput(form);
      log('User input form sent successfully');
    } catch (error) {
      log('Error sending user input form:', error);
    }
  } else if (setupData && setupData.username) {
    // Got credentials, finish setup
    log('Credentials received, finishing setup');
    try {
      await api.driverSetupComplete();
      log('Setup completed successfully');
    } catch (error) {
      log('Error completing setup:', error);
    }
  } else {
    // No data, just complete the setup
    log('No setup data, completing setup');
    try {
      await api.driverSetupComplete();
      log('Setup completed successfully');
    } catch (error) {
      log('Error completing setup:', error);
    }
  }
});

// Try different driver.json paths
const possiblePaths = [
  './src/driver.json',
  'src/driver.json',
  './driver.json',
  '../driver.json',
  path.join(process.cwd(), 'src', 'driver.json'),
  path.join(process.cwd(), 'driver.json'),
  path.join(process.cwd(), '..', 'driver.json')
];

// Initialize the driver
log('Initializing driver...');
let initialized = false;

// Try each path until one works
const tryInitialize = async (index) => {
  if (index >= possiblePaths.length) {
    log('Failed to initialize with any driver.json path');
    process.exit(1);
    return;
  }
  
  const driverJsonPath = possiblePaths[index];
  log(`Trying to initialize with driver.json at: ${driverJsonPath}`);
  
  try {
    await api.init(driverJsonPath);
    log(`Driver initialized successfully with ${driverJsonPath}`);
    log(`WebSocket server listening on ${HOST}:${PORT}`);
    
    // Send a device state event to indicate we're connected
    try {
      await api.emitDeviceState(DeviceStates.Connected);
      log('Emitted Connected device state');
    } catch (error) {
      log('Error emitting device state:', error);
    }
    
    log('FYTA integration is now running and ready');
    initialized = true;
    
    // Log status periodically
    setInterval(() => {
      log('Integration still running, waiting for connections...');
    }, 30000);
  } catch (error) {
    log(`Error initializing with ${driverJsonPath}:`, error);
    // Try next path
    tryInitialize(index + 1);
  }
};

// Start initialization process
tryInitialize(0);

// Keep the process running
process.on('SIGINT', () => {
  log('Shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('Terminating...');
  process.exit(0);
});

// Log any unhandled errors
process.on('uncaughtException', (error) => {
  log('Unhandled exception:', error);
});

// Prevent the Node.js process from exiting
setInterval(() => {
  log('Heartbeat - integration still alive');
}, 3600000); 