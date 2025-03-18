#!/usr/bin/env node

// FYTA Plant Monitor integration for Unfolded Circle Remote Two
import { IntegrationAPI, Events, DeviceStates, StatusCodes } from '@unfoldedcircle/integration-api';
import fs from 'fs';
import path from 'path';
import { networkInterfaces } from 'os';

// Configuration constants
const PORT = parseInt(process.env.UC_INTEGRATION_PORT || '8766', 10);
const HOST = process.env.UC_INTEGRATION_INTERFACE || '0.0.0.0';
const CONFIG_DIR = process.env.UC_CONFIG_HOME || './config';

// Function to get the local IP address for debugging
function getLocalIpAddress() {
  try {
    const interfaces = networkInterfaces();
    for (const [name, nets] of Object.entries(interfaces)) {
      for (const net of nets) {
        // Skip internal and IPv6 interfaces
        if (!net.internal && net.family === 'IPv4') {
          return net.address;
        }
      }
    }
  } catch (error) {
    console.error('Error getting local IP address:', error);
  }
  return '127.0.0.1';
}

// Set up logging to file
const logFile = path.join(CONFIG_DIR, 'fyta-integration.log');

// Create a logging function that writes to both console and file
function log(...args) {
  const timestamp = new Date().toISOString();
  const message = args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg
  ).join(' ');
  
  // Write to console immediately
  console.log(`[${timestamp}] ${message}`);
  
  try {
    // Ensure log directory exists
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    
    // Append to log file
    fs.appendFileSync(logFile, `[${timestamp}] ${message}\n`);
  } catch (error) {
    console.error(`Error writing to log file: ${error.message}`);
  }
}

// Log system environment information
log('FYTA Plant Monitor integration starting');
log(`Process ID: ${process.pid}`);
log(`Working directory: ${process.cwd()}`);
log(`Environment variables: ${JSON.stringify({
  UC_CONFIG_HOME: CONFIG_DIR,
  UC_INTEGRATION_PORT: PORT,
  UC_INTEGRATION_INTERFACE: HOST,
  NODE_ENV: process.env.NODE_ENV
})}`);

// Start the integration
function startIntegration() {
  try {
    // Initialize the integration API
    const api = new IntegrationAPI({
      port: PORT,
      host: HOST,
      configDir: CONFIG_DIR,
    });

    // Log successful initialization
    log('Integration API initialized');
    log(`WebSocket server running on ${HOST}:${PORT}`);

    // Set up event handlers
    api.on(Events.Connect, async () => {
      log('Connect event received from Remote Two');
      
      try {
        // Set device state to connected
        await api.setDeviceState(DeviceStates.Connected);
        log('Device state set to Connected');
        
        // Return device information
        return {
          driverId: 'fyta_plant_monitor',
          version: '0.1.0',
          name: {
            en: 'FYTA Plant Monitor'
          },
          icon: 'mdi:flower',
          deviceClasses: ['sensor'],
          device: {}
        };
      } catch (error) {
        log(`Error in Connect event: ${error}`);
        throw error;
      }
    });

    api.on(Events.Disconnect, () => {
      log('Disconnect event received');
    });

    api.on(Events.Error, (error) => {
      log(`Error event received: ${error}`);
    });

    api.on(Events.Setup, async (setupData) => {
      log('Setup event received:', setupData);
      
      try {
        // Process setup data
        const { username, password } = setupData || {};
        
        if (!username || !password) {
          log('Invalid setup data: missing username or password');
          return {
            status: StatusCodes.BadRequest,
            error: {
              key: 'invalid_credentials',
              message: 'Username and password are required'
            }
          };
        }
        
        // Store credentials securely
        const credentialsPath = path.join(CONFIG_DIR, 'credentials.json');
        fs.writeFileSync(credentialsPath, JSON.stringify({ username, password }), { encoding: 'utf8' });
        log('Stored credentials');
        
        // Return success
        return {
          status: StatusCodes.OK
        };
      } catch (error) {
        log(`Error in Setup event: ${error}`);
        return {
          status: StatusCodes.InternalError,
          error: {
            key: 'setup_failed',
            message: error.message
          }
        };
      }
    });

    api.on(Events.GetEntities, async () => {
      log('GetEntities event received');
      
      try {
        // In a real implementation, you would fetch actual entities from the FYTA API
        // This is a placeholder for demonstration
        return {
          status: StatusCodes.OK,
          entities: [
            {
              id: 'plant_1',
              name: {
                en: 'Living Room Plant'
              },
              type: 'sensor',
              attributes: {
                moisture: {
                  type: 'integer',
                  value: 65,
                  min: 0,
                  max: 100,
                  unit: '%'
                },
                temperature: {
                  type: 'float',
                  value: 22.5,
                  min: 0,
                  max: 50,
                  unit: '°C'
                },
                light: {
                  type: 'integer',
                  value: 75,
                  min: 0,
                  max: 100,
                  unit: '%'
                }
              }
            }
          ]
        };
      } catch (error) {
        log(`Error in GetEntities event: ${error}`);
        return {
          status: StatusCodes.InternalError,
          error: {
            key: 'fetch_failed',
            message: error.message
          }
        };
      }
    });

    // Handle status reporting
    api.on(Events.GetStatus, async () => {
      log('GetStatus event received');
      
      try {
        // Check if we have credentials
        const credentialsPath = path.join(CONFIG_DIR, 'credentials.json');
        const hasCredentials = fs.existsSync(credentialsPath);
        
        return {
          status: StatusCodes.OK,
          configured: hasCredentials,
          available: true
        };
      } catch (error) {
        log(`Error in GetStatus event: ${error}`);
        return {
          status: StatusCodes.InternalError,
          configured: false,
          available: false
        };
      }
    });

    // Enhanced device state setting with error handling
    const setDeviceState = async (state) => {
      try {
        if (api && api.ws && api.ws.clients && api.ws.clients.size > 0) {
          await api.setDeviceState(state);
          log(`Device state set to: ${state}`);
          return true;
        } else {
          log('No WebSocket clients connected, skipping device state update');
          return false;
        }
      } catch (error) {
        log(`Error setting device state to ${state}: ${error.message}`);
        return false;
      }
    };

    // Periodically log status
    const statusInterval = setInterval(() => {
      try {
        const clientCount = (api.ws && api.ws.clients) ? api.ws.clients.size : 0;
        log(`Integration running on ${HOST}:${PORT}`);
        log(`WebSocket clients: ${clientCount > 0 ? clientCount : 'Not connected'}`);
      } catch (error) {
        log(`Error in status update: ${error.message}`);
      }
    }, 30000);

    // Handle process termination
    process.on('SIGINT', async () => {
      log('Received SIGINT signal');
      clearInterval(statusInterval);
      
      try {
        if (api) {
          await setDeviceState(DeviceStates.Disconnected);
          api.close();
          log('Integration API closed');
        }
      } catch (error) {
        log(`Error during shutdown: ${error.message}`);
      }
      
      log('Integration shutdown complete');
      process.exit(0);
    });

    log('FYTA integration is now running and ready');
    log('Type Ctrl+C to stop the integration');
  } catch (error) {
    log(`Failed to start integration: ${error.message}`);
    process.exit(1);
  }
}

// Start the integration
startIntegration();