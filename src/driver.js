#!/usr/bin/env node

// FYTA Plant Monitor integration for Unfolded Circle Remote Two
import { 
  IntegrationAPI, 
  Events, 
  DeviceStates, 
  StatusCodes, 
  Sensor,
  SensorAttributes 
} from '@unfoldedcircle/integration-api';
import fs from 'fs';
import path from 'path';
import { networkInterfaces } from 'os';
import https from 'https';
import http from 'http';

// Configuration constants
const PORT = parseInt(process.env.UC_INTEGRATION_PORT || '8766', 10);
const HOST = process.env.UC_INTEGRATION_INTERFACE || '0.0.0.0';
const CONFIG_DIR = process.env.UC_CONFIG_HOME || './config';
const FYTA_API_BASE = 'https://web.fyta.de/api';
const FYTA_AUTH_ENDPOINT = `${FYTA_API_BASE}/auth/login`;
const FYTA_USER_PLANTS_ENDPOINT = `${FYTA_API_BASE}/user-plant`;

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

// Enhanced logging to capture the full object details
function logObject(prefix, obj) {
  try {
    log(`${prefix}: ${JSON.stringify(obj, null, 2)}`);
  } catch (e) {
    log(`${prefix}: [Error serializing object: ${e.message}]`);
    log(`${prefix} object type: ${typeof obj}`);
    
    if (obj) {
      // Try to log object keys
      try {
        log(`${prefix} keys: ${Object.keys(obj).join(', ')}`);
      } catch (e2) {
        log(`${prefix} failed to get keys: ${e2.message}`);
      }
    }
  }
}

// Helper function for making HTTPS requests
async function makeApiRequest(url, method = 'GET', data = null, headers = {}) {
  // Log the request details
  log(`[API REQUEST] ${method} ${url}`);
  console.log(`DIRECT API: Starting ${method} request to ${url}`);
  if (data) {
    logObject('[API REQUEST BODY]', data);
    console.log(`DIRECT API: Request body: ${JSON.stringify(data)}`);
  }
  logObject('[API REQUEST HEADERS]', headers);
  
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    log(`[API TIMER] Request started at ${startTime}`);
    console.log(`DIRECT API: Request started at ${startTime}`);
    
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: `${urlObj.pathname}${urlObj.search}`,
      method: method,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...headers
      },
      // Set a much shorter timeout (5 seconds) to avoid hanging the integration
      timeout: parseInt(process.env.UC_FYTA_API_TIMEOUT || '5000')
    };

    log(`[API DEBUG] Making request to ${urlObj.hostname} with timeout ${options.timeout}ms`);
    console.log(`DIRECT API: Making request to ${urlObj.hostname} with timeout ${options.timeout}ms`);
    console.log(`DIRECT API: Full options: ${JSON.stringify(options)}`);
    
    // Implement our own timeout to ensure it never hangs more than 8 seconds
    let timeoutId = setTimeout(() => {
      console.log(`DIRECT API: Manually cancelling request after 8 seconds`);
      if (req) {
        req.destroy();
      }
      reject(new Error('Request manually canceled after 8 seconds'));
    }, 8000);
    
    const req = (urlObj.protocol === 'https:' ? https : http).request(options, (res) => {
      console.log(`DIRECT API: Got response status code: ${res.statusCode}`);
      let responseData = '';
      
      // Log response headers
      log(`[API RESPONSE] Status: ${res.statusCode} ${res.statusMessage}`);
      logObject('[API RESPONSE HEADERS]', res.headers);
      
      res.on('data', (chunk) => {
        responseData += chunk;
        log(`[API DEBUG] Received data chunk of ${chunk.length} bytes`);
        console.log(`DIRECT API: Received data chunk of ${chunk.length} bytes`);
      });
      
      res.on('end', () => {
        clearTimeout(timeoutId); // Cancel our manual timeout
        const endTime = Date.now();
        log(`[API TIMER] Request completed in ${endTime - startTime}ms`);
        console.log(`DIRECT API: Request completed in ${endTime - startTime}ms`);
        
        if (res.statusCode >= 200 && res.statusCode < 300) {
          log(`[API SUCCESS] Received ${responseData.length} bytes`);
          console.log(`DIRECT API: Success! Received ${responseData.length} bytes`);
          try {
            const parsedData = JSON.stringify(responseData).length > 500 
              ? `[Large JSON response of ${responseData.length} bytes]` 
              : responseData;
            log(`[API RESPONSE DATA] ${parsedData}`);
            
            try {
              const parsedData = JSON.parse(responseData);
              console.log(`DIRECT API: Successfully parsed JSON response`);
              resolve(parsedData);
            } catch (error) {
              log(`[API ERROR] Error parsing response: ${error.message}`);
              console.log(`DIRECT API: Error parsing response: ${error.message}`);
              console.log(`DIRECT API: Raw response: ${responseData}`);
              resolve(responseData);
            }
          } catch (error) {
            log(`[API ERROR] Error logging response: ${error.message}`);
            console.log(`DIRECT API: Error logging response: ${error.message}`);
            resolve(responseData);
          }
        } else {
          log(`[API ERROR] Status ${res.statusCode}: ${responseData}`);
          console.log(`DIRECT API: Error status ${res.statusCode}: ${responseData}`);
          reject(new Error(`Request failed with status ${res.statusCode}: ${responseData}`));
        }
      });
    });
    
    req.on('error', (error) => {
      clearTimeout(timeoutId); // Cancel our manual timeout
      const endTime = Date.now();
      log(`[API ERROR] Request failed after ${endTime - startTime}ms: ${error.message}`);
      log(`[API ERROR] Error stack: ${error.stack}`);
      console.log(`DIRECT API: Request failed after ${endTime - startTime}ms: ${error.message}`);
      console.log(`DIRECT API: Error stack: ${error.stack}`);
      reject(error);
    });
    
    req.on('timeout', () => {
      clearTimeout(timeoutId); // Cancel our manual timeout
      const endTime = Date.now();
      log(`[API TIMEOUT] Request timed out after ${endTime - startTime}ms`);
      console.log(`DIRECT API: Request TIMED OUT after ${endTime - startTime}ms`);
      req.destroy();
      reject(new Error(`Request timed out after ${endTime - startTime}ms`));
    });
    
    if (data) {
      const stringData = JSON.stringify(data);
      log(`[API DEBUG] Sending request body: ${stringData}`);
      console.log(`DIRECT API: Sending request body: ${stringData}`);
      req.write(stringData);
    }
    
    log(`[API DEBUG] Ending request`);
    console.log(`DIRECT API: Ending request`);
    req.end();
  });
}

// FYTA API helper functions
async function authenticateFyta(username, password) {
  log(`[FYTA AUTH] Starting authentication for user: ${username}`);
  console.log(`DIRECT: Starting authentication for user: ${username}`);
  try {
    log(`[FYTA AUTH] Calling FYTA API login endpoint`);
    console.log(`DIRECT: Calling FYTA API login endpoint: ${FYTA_AUTH_ENDPOINT}`);
    const startTime = Date.now();
    
    // Add more detailed logging for the API request
    console.log(`DIRECT: Creating API request with timeout: ${parseInt(process.env.UC_FYTA_API_TIMEOUT || '10000')}ms`);
    
    const authData = await makeApiRequest(FYTA_AUTH_ENDPOINT, 'POST', { email: username, password });
    
    const endTime = Date.now();
    log(`[FYTA AUTH] Authentication call completed in ${endTime - startTime}ms`);
    console.log(`DIRECT: Authentication call completed in ${endTime - startTime}ms`);
    
    if (!authData || !authData.access_token) {
      log(`[FYTA AUTH] Failed: No access token received in response`);
      console.log(`DIRECT: Authentication failed: No access token received in response`);
      console.log(`DIRECT: Auth response: ${JSON.stringify(authData)}`);
      return null;
    }
    
    log(`[FYTA AUTH] Success: Received ${authData.access_token.substring(0, 10)}... token, expires in ${authData.expires_in} seconds`);
    console.log(`DIRECT: Authentication successful: Received token, expires in ${authData.expires_in} seconds`);
    return authData;
  } catch (error) {
    log(`[FYTA AUTH] Error: ${error.message}`);
    log(`[FYTA AUTH] Error stack: ${error.stack}`);
    console.log(`DIRECT: Authentication error: ${error.message}`);
    console.log(`DIRECT: Error stack: ${error.stack}`);
    return null;
  }
}

async function getUserPlants(accessToken) {
  log(`[FYTA API] Fetching user plants with token: ${accessToken ? accessToken.substring(0, 10) + '...' : 'null'}`);
  try {
    const startTime = Date.now();
    
    const result = await makeApiRequest(FYTA_USER_PLANTS_ENDPOINT, 'GET', null, {
      'Authorization': `Bearer ${accessToken}`
    });
    
    const endTime = Date.now();
    log(`[FYTA API] Plants fetch completed in ${endTime - startTime}ms`);
    
    if (result && result.plants) {
      log(`[FYTA API] Successfully retrieved ${result.plants.length} plants`);
    } else {
      log(`[FYTA API] No plants found in response`);
    }
    
    return result;
  } catch (error) {
    log(`[FYTA API] Error fetching plants: ${error.message}`);
    log(`[FYTA API] Error stack: ${error.stack}`);
    return null;
  }
}

// Log system environment information
log('[STARTUP] FYTA Plant Monitor integration starting');
log(`[STARTUP] Process ID: ${process.pid}`);
log(`[STARTUP] Working directory: ${process.cwd()}`);
log(`[STARTUP] Node.js version: ${process.version}`);
log(`[STARTUP] Environment variables: ${JSON.stringify({
  UC_CONFIG_HOME: CONFIG_DIR,
  UC_INTEGRATION_PORT: PORT,
  UC_INTEGRATION_INTERFACE: HOST,
  NODE_ENV: process.env.NODE_ENV
})}`);

// Check if driver.json exists and is readable
try {
  // Use import.meta.url instead of __dirname (which is not available in ES modules)
  const currentFileUrl = import.meta.url;
  // Handle both Windows and Unix paths
  const currentFilePath = new URL(currentFileUrl).pathname;
  // On Windows, the pathname will have an extra / at the beginning
  const fixedPath = process.platform === 'win32' 
    ? currentFilePath.substring(1) 
    : currentFilePath;
  const dirPath = path.dirname(fixedPath);
  const driverPath = path.join(dirPath, 'driver.json');
  
  if (fs.existsSync(driverPath)) {
    const driverConfig = JSON.parse(fs.readFileSync(driverPath, 'utf8'));
    log(`[STARTUP] driver.json found and valid: ${driverConfig.driver_id} v${driverConfig.version}`);
  } else {
    log(`[STARTUP] WARNING: driver.json not found at ${driverPath}`);
  }
} catch (error) {
  log(`[STARTUP] ERROR: driver.json exists but is invalid or cannot be read: ${error.message}`);
}

// Override environment variables in case they're needed
process.env.UC_CONFIG_HOME = CONFIG_DIR;
process.env.UC_INTEGRATION_PORT = PORT.toString();
process.env.UC_INTEGRATION_INTERFACE = HOST;

// Create the sensor command handler
const sensorCmdHandler = async function(entity, cmdId, params) {
  log(`[COMMAND] Received command for sensor ${entity.id}: ${cmdId}`);
  // Sensor entities typically don't handle commands, but we need to implement this
  return StatusCodes.Ok;
};

// ==================================================================================
// FOLLOW THE EXAMPLE PATTERN EXACTLY
// ==================================================================================

// Register a global unhandled error handler
process.on('uncaughtException', (error) => {
  log(`[FATAL] Uncaught exception: ${error.message}`);
  log(`[FATAL] Stack trace: ${error.stack}`);
  console.error(`DIRECT: Uncaught exception: ${error.message}`);
});

process.on('unhandledRejection', (reason, promise) => {
  log(`[FATAL] Unhandled rejection: ${reason}`);
  if (reason instanceof Error) {
    log(`[FATAL] Stack trace: ${reason.stack}`);
  }
  console.error(`DIRECT: Unhandled rejection: ${reason}`);
});

// 1. Create the driver instance FIRST - no custom arguments
log('[INIT] Creating IntegrationAPI instance');
console.log('DIRECT: Creating IntegrationAPI instance');
const driver = new IntegrationAPI();
log('[INIT] IntegrationAPI instance created successfully');
console.log('DIRECT: IntegrationAPI instance created successfully');

// Add a direct console log for every incoming message
const originalEmit = driver.emit;
driver.emit = function(event, ...args) {
  console.log(`DIRECT: WebSocket event received: ${event}`);
  console.log(`DIRECT: Event args: ${JSON.stringify(args, null, 2)}`);
  
  // Direct handling of setup_driver event
  if (event === 'setup_driver' && args.length >= 2) {
    console.log(`DIRECT: Direct handling of setup_driver event`);
    const sessionInfo = args[0];
    const setupData = args[1];
    
    // Process the setup data
    handleSetupDirectly(sessionInfo, setupData);
  }
  
  return originalEmit.apply(this, [event, ...args]);
};

// Function to handle setup directly
async function handleSetupDirectly(sessionInfo, setupData) {
  console.log(`DIRECT: Processing setup directly for session ${sessionInfo.wsId}`);
  console.log(`DIRECT: Setup data: ${JSON.stringify(setupData)}`);
  
  try {
    const { username, password, refresh_interval, temperature_unit } = setupData || {};
    
    if (!username || !password) {
      console.log('DIRECT: Missing username or password');
      return;
    }
    
    // Store credentials immediately
    console.log('DIRECT: Storing credentials immediately');
    const credentialsPath = path.join(CONFIG_DIR, 'credentials.json');
    const credentialsData = {
      username,
      password,
      refresh_interval: refresh_interval || 5,
      temperature_unit: temperature_unit || 'celsius',
      access_token: null, // Will be populated later
      refresh_token: null,
      token_expires_at: 0
    };
    
    try {
      if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
      }
      fs.writeFileSync(credentialsPath, JSON.stringify(credentialsData), { encoding: 'utf8' });
      console.log('DIRECT: Stored credentials successfully');
    } catch (fsError) {
      console.log(`DIRECT: Error storing credentials: ${fsError.message}`);
    }
    
    // Add a demo plant entity immediately
    console.log('DIRECT: Adding demo plant entity');
    try {
      const demoPlant = new Sensor('plant_demo', 'Demo Plant', {
        features: [],
        attributes: {
          'moisture': {
            type: 'integer',
            value: 65,
            min: 0,
            max: 100,
            unit: '%'
          },
          'temperature': {
            type: 'float',
            value: 22.5,
            min: 0,
            max: 50,
            unit: '°C'
          },
          'light': {
            type: 'integer',
            value: 75,
            min: 0,
            max: 100,
            unit: '%'
          }
        }
      });
      
      demoPlant.setCmdHandler(sensorCmdHandler);
      driver.addAvailableEntity(demoPlant);
      console.log('DIRECT: Added demo plant entity');
    } catch (demoError) {
      console.log(`DIRECT: Error creating demo plant: ${demoError.message}`);
    }
    
    // Send success response
    console.log('DIRECT: Sending success response');
    driver.emit('setup_driver_response', {
      status: StatusCodes.OK
    });
    
    // Continue authentication in the background
    setTimeout(async () => {
      console.log('DIRECT: Starting background authentication');
      try {
        const authData = await authenticateFyta(username, password);
        
        if (authData) {
          console.log('DIRECT: Background authentication succeeded');
          
          // Update credentials with tokens
          const updatedCredentials = {
            ...credentialsData,
            access_token: authData.access_token,
            refresh_token: authData.refresh_token,
            token_expires_at: Date.now() + (authData.expires_in * 1000)
          };
          
          fs.writeFileSync(credentialsPath, JSON.stringify(updatedCredentials), { encoding: 'utf8' });
          
          // Fetch plant data
          console.log('DIRECT: Fetching plant data in background');
          const plantData = await getUserPlants(authData.access_token);
          
          if (plantData && plantData.plants && plantData.plants.length > 0) {
            console.log(`DIRECT: Successfully fetched ${plantData.plants.length} plants`);
            
            // Store plant data
            const plantsPath = path.join(CONFIG_DIR, 'plants.json');
            fs.writeFileSync(plantsPath, JSON.stringify(plantData), { encoding: 'utf8' });
            
            // Refresh plant data to update entities
            refreshPlantData();
          }
        } else {
          console.log('DIRECT: Background authentication failed');
        }
      } catch (error) {
        console.log(`DIRECT: Background authentication error: ${error.message}`);
      }
    }, 100);
  } catch (error) {
    console.log(`DIRECT: Error in direct setup handling: ${error.message}`);
  }
}

// Add direct console logging for websocket connection
if (driver._wss) {
  console.log('DIRECT: WebSocket server exists at instantiation time');
  driver._wss.on('connection', (ws, req) => {
    console.log(`DIRECT: WebSocket connection received from ${req.connection.remoteAddress}`);
    ws.on('message', (message) => {
      console.log(`DIRECT: WebSocket message received: ${message}`);
    });
    ws.on('close', (code, reason) => {
      console.log(`DIRECT: WebSocket connection closed: ${code} ${reason}`);
    });
    ws.on('error', (error) => {
      console.log(`DIRECT: WebSocket error: ${error.message}`);
    });
  });
} else {
  console.log('DIRECT: WebSocket server does not exist at instantiation time');
  // Add a hook to intercept when the WebSocket server is created
  const originalInit = driver.init;
  driver.init = function(configPath) {
    console.log(`DIRECT: driver.init called with: ${configPath}`);
    const result = originalInit.apply(this, [configPath]);
    
    if (this._wss) {
      console.log('DIRECT: WebSocket server created after init');
      this._wss.on('connection', (ws, req) => {
        console.log(`DIRECT: WebSocket connection received from ${req.connection.remoteAddress}`);
        
        // Add direct message handler for setup_driver
        ws.on('message', async (message) => {
          console.log(`DIRECT: WebSocket message received: ${message.toString()}`);
          
          try {
            const msgString = message.toString();
            const msgObj = JSON.parse(msgString);
            
            // Check if this is a setup_driver message
            if (msgObj && msgObj.method === 'setup_driver' && msgObj.params && msgObj.params.length >= 2) {
              console.log(`DIRECT: Manual handling of setup_driver message`);
              
              // Extract setup data from the message
              const sessionInfo = msgObj.params[0];
              const setupData = msgObj.params[1];
              const reqId = msgObj.id;
              
              console.log(`DIRECT: Setup request ID: ${reqId}`);
              console.log(`DIRECT: Session info: ${JSON.stringify(sessionInfo)}`);
              console.log(`DIRECT: Setup data: ${JSON.stringify(setupData)}`);
              
              // Get the credentials from the setup data
              const { username, password, refresh_interval, temperature_unit } = setupData || {};
              
              // Manually invoke setup logic (duplicated from our event handler)
              try {
                console.log(`DIRECT: Manually processing setup with username: ${username}`);
                
                if (!username || !password) {
                  console.log('DIRECT: Invalid setup data: missing username or password');
                  const errorResponse = {
                    id: reqId,
                    error: {
                      code: 400,
                      message: 'Username and password are required'
                    }
                  };
                  ws.send(JSON.stringify(errorResponse));
                  return;
                }
                
                // Try to authenticate with FYTA
                console.log('DIRECT: Attempting to authenticate with FYTA API...');
                const authData = await authenticateFyta(username, password);
                
                if (!authData) {
                  console.log('DIRECT: FYTA authentication failed');
                  const errorResponse = {
                    id: reqId,
                    error: {
                      code: 401,
                      message: 'Authentication with FYTA failed. Please check your credentials.'
                    }
                  };
                  ws.send(JSON.stringify(errorResponse));
                  return;
                }
                
                // Store credentials and tokens securely
                console.log('DIRECT: Storing credentials and tokens');
                const credentialsPath = path.join(CONFIG_DIR, 'credentials.json');
                const credentialsData = {
                  username,
                  password,
                  refresh_interval: refresh_interval || 5,
                  temperature_unit: temperature_unit || 'celsius',
                  access_token: authData.access_token,
                  refresh_token: authData.refresh_token,
                  token_expires_at: Date.now() + (authData.expires_in * 1000)
                };
                
                try {
                  if (!fs.existsSync(CONFIG_DIR)) {
                    fs.mkdirSync(CONFIG_DIR, { recursive: true });
                  }
                  fs.writeFileSync(credentialsPath, JSON.stringify(credentialsData), { encoding: 'utf8' });
                  console.log('DIRECT: Credentials stored successfully');
                } catch (fsError) {
                  console.log(`DIRECT: Error storing credentials: ${fsError.message}`);
                }
                
                // Fetch plant data
                console.log('DIRECT: Fetching plant data from FYTA API');
                const plantData = await getUserPlants(authData.access_token);
                
                // Send success response
                const response = {
                  id: reqId,
                  result: {
                    status: 200
                  }
                };
                
                ws.send(JSON.stringify(response));
                console.log(`DIRECT: Sent setup success response back to client`);
                
                // Trigger a refresh of plant data in the background
                setTimeout(() => refreshPlantData(), 500);
                
              } catch (setupError) {
                console.error(`DIRECT: Error in manual setup: ${setupError.message}`);
                console.error(`DIRECT: Stack: ${setupError.stack}`);
                
                // Send error response back
                const errorResponse = {
                  id: reqId,
                  error: {
                    code: 500,
                    message: setupError.message
                  }
                };
                
                ws.send(JSON.stringify(errorResponse));
              }
            }
            
            // Continue with normal parsing
            console.log(`DIRECT: Parsed message: ${JSON.stringify(msgObj)}`);

            // Also check for device_connect method
            if (msgObj && msgObj.method === 'device_connect') {
              console.log('DIRECT: Received device_connect message');
              const reqId = msgObj.id;
              
              // Send device information response
              try {
                const response = {
                  id: reqId,
                  result: {
                    driverId: 'fyta_plant_monitor',
                    version: '0.1.0',
                    name: {
                      en: 'FYTA Plant Monitor'
                    },
                    icon: 'mdi:flower',
                    deviceClasses: ['sensor'],
                    device: {}
                  }
                };
                
                ws.send(JSON.stringify(response));
                console.log(`DIRECT: Sent device_connect response`);
                
                // Set device state to connected
                console.log('DIRECT: Setting device state to Connected');
                driver.setDeviceState(DeviceStates.Connected).catch(err => {
                  console.error(`DIRECT: Error setting device state: ${err.message}`);
                });
              } catch (error) {
                console.error(`DIRECT: Error handling device_connect: ${error.message}`);
              }
            }

            // Check for get_device_state
            if (msgObj && msgObj.method === 'get_device_state') {
              console.log('DIRECT: Received get_device_state message');
              const reqId = msgObj.id;
              
              // Send device state response
              try {
                // Check if credentials exist to determine configured state
                const credentialsPath = path.join(CONFIG_DIR, 'credentials.json');
                const hasCredentials = fs.existsSync(credentialsPath);
                
                const response = {
                  id: reqId,
                  result: {
                    status: 200,
                    configured: hasCredentials,
                    available: true
                  }
                };
                
                ws.send(JSON.stringify(response));
                console.log(`DIRECT: Sent get_device_state response: configured=${hasCredentials}`);
              } catch (error) {
                console.error(`DIRECT: Error handling get_device_state: ${error.message}`);
              }
            }

            // Check for get_entities
            if (msgObj && msgObj.method === 'get_entities') {
              console.log('DIRECT: Received get_entities message');
              const reqId = msgObj.id;
              
              // Send entities response
              try {
                const response = {
                  id: reqId,
                  result: {
                    status: 200
                  }
                };
                
                ws.send(JSON.stringify(response));
                console.log(`DIRECT: Sent get_entities response`);
              } catch (error) {
                console.error(`DIRECT: Error handling get_entities: ${error.message}`);
              }
            }
          } catch (e) {
            console.log(`DIRECT: Could not parse message as JSON: ${e.message}`);
          }
        });
        
        ws.on('close', (code, reason) => {
          console.log(`DIRECT: WebSocket connection closed: ${code} ${reason}`);
        });
        ws.on('error', (error) => {
          console.log(`DIRECT: WebSocket error: ${error.message}`);
        });
      });
    } else {
      console.log('DIRECT: WebSocket server still does not exist after init');
    }
    
    return result;
  };
}

// 2. Register ALL event handlers BEFORE initialization
log('[EVENTS] Registering Connect event handler');
console.log('DIRECT: Registering Connect event handler');
driver.on(Events.Connect, async () => {
  log('[CONNECT] Connect event received from Remote Two');
  console.log('DIRECT: Connect event received from Remote Two');
  
  try {
    // Set device state to connected
    log('[CONNECT] Setting device state to Connected');
    console.log('DIRECT: Setting device state to Connected');
    await driver.setDeviceState(DeviceStates.Connected);
    log('[CONNECT] Device state set to Connected');
    console.log('DIRECT: Device state set to Connected');
    
    log('[CONNECT] Returning device information');
    console.log('DIRECT: Returning device information');
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
    log(`[CONNECT ERROR] ${error.message}`);
    log(`[CONNECT ERROR] Stack trace: ${error.stack}`);
    console.error(`DIRECT: Connect error: ${error.message}`);
    throw error;
  }
});

log('[EVENTS] Registering Disconnect event handler');
console.log('DIRECT: Registering Disconnect event handler');
driver.on(Events.Disconnect, async () => {
  log('[DISCONNECT] Disconnect event received');
  console.log('DIRECT: Disconnect event received');
  try {
    await driver.setDeviceState(DeviceStates.Disconnected);
    log('[DISCONNECT] Device state set to Disconnected');
    console.log('DIRECT: Device state set to Disconnected');
  } catch (error) {
    log(`[DISCONNECT ERROR] Error setting device state: ${error.message}`);
    log(`[DISCONNECT ERROR] Stack trace: ${error.stack}`);
    console.error(`DIRECT: Disconnect error: ${error.message}`);
  }
});

log('[EVENTS] Registering Error event handler');
console.log('DIRECT: Registering Error event handler');
driver.on(Events.Error, (error) => {
  log(`[ERROR EVENT] Error event received: ${error}`);
  console.error(`DIRECT: Error event received: ${error}`);
  if (error && error.stack) {
    log(`[ERROR EVENT] Stack trace: ${error.stack}`);
    console.error(`DIRECT: Error stack: ${error.stack}`);
  }
});

log('[EVENTS] Registering Setup event handler');
console.log('DIRECT: Registering Setup event handler');
driver.on(Events.Setup, async (setupData) => {
  log('[SETUP] Setup event received');
  console.log('DIRECT: Setup event received');
  logObject('[SETUP] Setup data', setupData);
  console.log(`DIRECT: Setup data: ${JSON.stringify(setupData, null, 2)}`);
  
  try {
    // Process setup data
    log('[SETUP] Extracting credentials from setup data');
    console.log('DIRECT: Extracting credentials from setup data');
    const { username, password, refresh_interval, temperature_unit } = setupData || {};
    
    log(`[SETUP] Username provided: ${username ? 'Yes' : 'No'}`);
    log(`[SETUP] Password provided: ${password ? 'Yes' : 'No'}`);
    log(`[SETUP] Refresh interval: ${refresh_interval || 'Not provided'}`);
    log(`[SETUP] Temperature unit: ${temperature_unit || 'Not provided'}`);
    console.log(`DIRECT: Username provided: ${username ? 'Yes' : 'No'}`);
    console.log(`DIRECT: Password provided: ${password ? 'Yes' : 'No'}`);
    
    if (!username || !password) {
      log('[SETUP] Invalid setup data: missing username or password');
      console.log('DIRECT: Invalid setup data: missing username or password');
      return {
        status: StatusCodes.BadRequest,
        error: {
          key: 'invalid_credentials',
          message: 'Username and password are required'
        }
      };
    }
    
    // Store credentials immediately to prevent timeout
    log('[SETUP] Storing credentials immediately');
    console.log('DIRECT: Storing credentials immediately to prevent timeout');
    const credentialsPath = path.join(CONFIG_DIR, 'credentials.json');
    const credentialsData = {
      username,
      password,
      refresh_interval: refresh_interval || 5,
      temperature_unit: temperature_unit || 'celsius',
      access_token: null, // Will be populated later
      refresh_token: null,
      token_expires_at: 0
    };
    
    try {
      if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
      }
      fs.writeFileSync(credentialsPath, JSON.stringify(credentialsData), { encoding: 'utf8' });
      log('[SETUP] Credentials stored successfully at', credentialsPath);
    } catch (fsError) {
      log(`[SETUP] Error storing credentials: ${fsError.message}`);
      log(`[SETUP] Error stack: ${fsError.stack}`);
    }
    
    // Add a demo plant immediately to ensure something is available
    log('[SETUP] Adding demo plant as temporary entity');
    console.log('DIRECT: Adding demo plant as temporary entity');
    try {
      const demoPlant = new Sensor('plant_demo', 'Demo Plant', {
        features: [],
        attributes: {
          'moisture': {
            type: 'integer',
            value: 65,
            min: 0,
            max: 100,
            unit: '%'
          },
          'temperature': {
            type: 'float',
            value: 22.5,
            min: 0,
            max: 50,
            unit: '°C'
          },
          'light': {
            type: 'integer',
            value: 75,
            min: 0,
            max: 100,
            unit: '%'
          }
        }
      });
      
      demoPlant.setCmdHandler(sensorCmdHandler);
      driver.addAvailableEntity(demoPlant);
      log('[SETUP] Added demo plant sensor entity');
      console.log('DIRECT: Added demo plant sensor entity');
    } catch (demoError) {
      log(`[SETUP] Error creating demo plant: ${demoError.message}`);
      console.log(`DIRECT: Error creating demo plant: ${demoError.message}`);
    }
    
    // Return success immediately, but continue authentication in background
    log('[SETUP] Returning success immediately to prevent timeout');
    console.log('DIRECT: Returning success immediately to prevent timeout');
    
    // Try to authenticate with FYTA in the background
    setTimeout(async () => {
      log('[SETUP] Attempting to authenticate with FYTA API in background...');
      console.log('DIRECT: Attempting to authenticate with FYTA API in background...');
      const startAuth = Date.now();
      
      try {
        const authData = await authenticateFyta(username, password);
        const endAuth = Date.now();
        log(`[SETUP] Background authentication completed in ${endAuth - startAuth}ms`);
        console.log(`DIRECT: Background authentication completed in ${endAuth - startAuth}ms`);
        
        if (authData) {
          // Update credentials with tokens
          log('[SETUP] Authentication successful, updating stored credentials');
          console.log('DIRECT: Authentication successful, updating stored credentials');
          
          const updatedCredentials = {
            ...credentialsData,
            access_token: authData.access_token,
            refresh_token: authData.refresh_token,
            token_expires_at: Date.now() + (authData.expires_in * 1000)
          };
          
          fs.writeFileSync(credentialsPath, JSON.stringify(updatedCredentials), { encoding: 'utf8' });
          
          // Fetch plant data
          log('[SETUP] Fetching plant data from FYTA API');
          console.log('DIRECT: Fetching plant data from FYTA API');
          const plantData = await getUserPlants(authData.access_token);
          
          if (plantData && plantData.plants && plantData.plants.length > 0) {
            log(`[SETUP] Successfully fetched ${plantData.plants.length} plants`);
            console.log(`DIRECT: Successfully fetched ${plantData.plants.length} plants`);
            
            // Store plant data
            const plantsPath = path.join(CONFIG_DIR, 'plants.json');
            fs.writeFileSync(plantsPath, JSON.stringify(plantData), { encoding: 'utf8' });
            
            // Call refreshPlantData to update entities
            refreshPlantData();
          }
        } else {
          log('[SETUP] Background authentication failed');
          console.log('DIRECT: Background authentication failed');
        }
      } catch (error) {
        log(`[SETUP] Background authentication error: ${error.message}`);
        console.log(`DIRECT: Background authentication error: ${error.message}`);
      }
    }, 100);
    
    // Return success immediately
    return {
      status: StatusCodes.OK
    };
  } catch (error) {
    log(`[SETUP ERROR] Error in Setup event: ${error.message}`);
    log(`[SETUP ERROR] Stack trace: ${error.stack || 'No stack trace available'}`);
    console.error(`DIRECT: Setup error: ${error.message}`);
    return {
      status: StatusCodes.InternalError,
      error: {
        key: 'setup_failed',
        message: error.message
      }
    };
  }
});

log('[EVENTS] Registering GetEntities event handler');
driver.on(Events.GetEntities, async () => {
  log('[GET_ENTITIES] GetEntities event received');
  
  try {
    // Entities are automatically handled by the API based on what we
    // registered with addAvailableEntity
    log('[GET_ENTITIES] Returning OK status');
    return {
      status: StatusCodes.OK
    };
  } catch (error) {
    log(`[GET_ENTITIES ERROR] Error in GetEntities event: ${error.message}`);
    return {
      status: StatusCodes.InternalError,
      error: {
        key: 'fetch_failed',
        message: error.message
      }
    };
  }
});

log('[EVENTS] Registering SubscribeEntities event handler');
driver.on(Events.SubscribeEntities, async (entityIds) => {
  log(`[SUBSCRIBE] SubscribeEntities event received for: ${entityIds.join(', ')}`);
  // The UC library automatically adds the subscribed entities
  // from available to configured
  return true;
});

log('[EVENTS] Registering UnsubscribeEntities event handler');
driver.on(Events.UnsubscribeEntities, async (entityIds) => {
  log(`[UNSUBSCRIBE] UnsubscribeEntities event received for: ${entityIds.join(', ')}`);
  // The UC library automatically removes the unsubscribed entities
  // from configured
  return true;
});

log('[EVENTS] Registering GetStatus event handler');
// Handle status reporting
driver.on(Events.GetStatus, async () => {
  log('[STATUS] GetStatus event received');
  
  try {
    // Check if we have credentials
    const credentialsPath = path.join(CONFIG_DIR, 'credentials.json');
    const hasCredentials = fs.existsSync(credentialsPath);
    log(`[STATUS] Credentials exist: ${hasCredentials}`);
    
    if (hasCredentials) {
      // Check if the token is still valid
      try {
        const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
        const tokenExpiresAt = credentials.token_expires_at || 0;
        const now = Date.now();
        const timeUntilExpiry = tokenExpiresAt - now;
        
        log(`[STATUS] Token expires in: ${Math.floor(timeUntilExpiry / 1000)} seconds`);
        
        if (now > tokenExpiresAt) {
          log('[STATUS] Access token has expired, re-authenticating');
          
          // Try to re-authenticate
          const authData = await authenticateFyta(credentials.username, credentials.password);
          if (authData) {
            // Update tokens
            credentials.access_token = authData.access_token;
            credentials.refresh_token = authData.refresh_token;
            credentials.token_expires_at = Date.now() + (authData.expires_in * 1000);
            
            fs.writeFileSync(credentialsPath, JSON.stringify(credentials), { encoding: 'utf8' });
            log('[STATUS] Refreshed authentication tokens');
          } else {
            log('[STATUS] Failed to refresh authentication token');
          }
        }
      } catch (error) {
        log(`[STATUS ERROR] Error checking/refreshing token: ${error.message}`);
      }
    }
    
    log('[STATUS] Returning status information');
    return {
      status: StatusCodes.OK,
      configured: hasCredentials,
      available: true
    };
  } catch (error) {
    log(`[STATUS ERROR] Error in GetStatus event: ${error.message}`);
    return {
      status: StatusCodes.InternalError,
      configured: false,
      available: false
    };
  }
});

// 3. NOW initialize the integration - only after all handlers are registered
log('[INIT] All event handlers registered, initializing integration with driver.json');
console.log('DIRECT: All event handlers registered, initializing integration with driver.json');
try {
  // Use import.meta.url to get path to current file
  const currentFileUrl = import.meta.url;
  // Handle both Windows and Unix paths
  const currentFilePath = new URL(currentFileUrl).pathname;
  // On Windows, the pathname will have an extra / at the beginning
  const fixedPath = process.platform === 'win32' 
    ? currentFilePath.substring(1) 
    : currentFilePath;
  const dirPath = path.dirname(fixedPath);
  const driverJsonPath = path.join(dirPath, 'driver.json');
  
  driver.init(driverJsonPath);
  log(`[INIT] Integration initialized successfully with ${driverJsonPath}`);
  console.log(`DIRECT: Integration initialized successfully with ${driverJsonPath}`);

  // Add direct WebSocket connection status check, runs every 5 seconds
  setInterval(() => {
    try {
      // Check if WebSocket server exists and how many clients are connected
      if (driver._wss) {
        let clients = 0;
        try {
          clients = driver._wss.clients ? driver._wss.clients.size : 0;
        } catch (e) {
          clients = -1; // Error getting client count
        }
        console.log(`DIRECT: WebSocket server status check - clients connected: ${clients}`);
      } else {
        console.log('DIRECT: WebSocket server status check - no server found');
      }
    } catch (error) {
      console.log(`DIRECT: Error checking WebSocket server status: ${error.message}`);
    }
  }, 5000);

  // Set a timeout to check if Setup was called
  setTimeout(() => {
    console.log(`DIRECT: Checking if Setup event was received after 30 seconds`);
    console.log(`DIRECT: Please check if you see any Setup event logs above`);
    console.log(`DIRECT: If not, there might be an issue with the connection or event handling`);
  }, 30000);

} catch (error) {
  log(`[INIT ERROR] Failed to initialize integration: ${error.message}`);
  log(`[INIT ERROR] Stack trace: ${error.stack}`);
  console.error(`DIRECT: Failed to initialize integration: ${error.message}`);
  console.error(`DIRECT: Stack trace: ${error.stack}`);
  process.exit(1);
}

// Function to refresh plant data
async function refreshPlantData() {
  log('[REFRESH] Starting plant data refresh');
  try {
    const credentialsPath = path.join(CONFIG_DIR, 'credentials.json');
    if (!fs.existsSync(credentialsPath)) {
      log('[REFRESH] No credentials found, skipping plant data refresh');
      return;
    }
    
    const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
    if (!credentials.access_token) {
      log('[REFRESH] No access token found, skipping plant data refresh');
      return;
    }
    
    // Check if token is expired
    if (Date.now() > (credentials.token_expires_at || 0)) {
      log('[REFRESH] Access token has expired, re-authenticating');
      const authData = await authenticateFyta(credentials.username, credentials.password);
      
      if (!authData) {
        log('[REFRESH] Re-authentication failed, skipping plant data refresh');
        return;
      }
      
      // Update tokens
      credentials.access_token = authData.access_token;
      credentials.refresh_token = authData.refresh_token;
      credentials.token_expires_at = Date.now() + (authData.expires_in * 1000);
      
      fs.writeFileSync(credentialsPath, JSON.stringify(credentials), { encoding: 'utf8' });
      log('[REFRESH] Refreshed authentication tokens');
    }
    
    // Fetch latest plant data
    log('[REFRESH] Fetching latest plant data');
    const plantData = await getUserPlants(credentials.access_token);
    if (!plantData || !plantData.plants) {
      log('[REFRESH] Failed to fetch plant data or no plants found');
      return;
    }
    
    log(`[REFRESH] Fetched ${plantData.plants.length} plants from FYTA API`);
    
    // Store updated plant data
    const plantsPath = path.join(CONFIG_DIR, 'plants.json');
    fs.writeFileSync(plantsPath, JSON.stringify(plantData), { encoding: 'utf8' });
    
    // Check if we have configured entities
    const configuredEntities = driver.getConfiguredEntities();
    log(`[REFRESH] Found ${configuredEntities ? configuredEntities.length : 0} configured entities`);
    
    if (!configuredEntities || configuredEntities.length === 0) {
      log('[REFRESH] No configured entities found, skipping updates');
      return;
    }
    
    // Update each plant's sensor data
    plantData.plants.forEach(plant => {
      const plantId = `plant_${plant.id}`;
      
      // Update moisture, temperature and light for this plant
      log(`[REFRESH] Updating data for plant ${plant.nickname} (ID: ${plantId})`);
      
      const attributes = {
        moisture: plant.moisture_status || 0,
        temperature: plant.temperature_status || 0,
        light: plant.light_status || 0
      };
      
      try {
        driver.updateEntityAttributes(plantId, attributes);
        log(`[REFRESH] Updated attributes for ${plantId}: ${JSON.stringify(attributes)}`);
      } catch (error) {
        log(`[REFRESH ERROR] Error updating entity ${plantId}: ${error.message}`);
      }
    });
  } catch (error) {
    log(`[REFRESH ERROR] Error in refreshPlantData: ${error.message}`);
    log(`[REFRESH ERROR] Stack trace: ${error.stack}`);
  }
}