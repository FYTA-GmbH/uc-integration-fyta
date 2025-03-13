// Debug script to inspect what's exported from the package
import * as api from '@unfoldedcircle/integration-api';

console.log('API exports:', Object.keys(api));

// Check if IntegrationDriver exists
console.log('IntegrationDriver exists:', 'IntegrationDriver' in api);

// Check the type of IntegrationDriver
console.log('Type of IntegrationDriver:', typeof api.IntegrationDriver);

// Check if there's a default export
console.log('Default export:', api.default ? 'Yes' : 'No');

// If there's a default export, check its properties
if (api.default) {
  console.log('Default export properties:', Object.keys(api.default));
}

// Check all properties and their types
for (const key in api) {
  console.log(`Property: ${key}, Type: ${typeof api[key]}`);
}

console.log('DeviceStates:', api.DeviceStates);
console.log('DeviceStates properties:', Object.keys(api.DeviceStates));

// Create an instance of IntegrationAPI
const driver = new api.IntegrationAPI({
  driverId: 'fyta',
  name: 'FYTA Plant Monitor',
  description: 'Integration for FYTA plant sensors',
  version: '0.1.0',
  icon: 'plant',
  driverMetadataFile: './driver.json'
});

// Check what methods are available on the driver instance
console.log('Driver methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(driver)));

// Check what properties are available on the driver instance
console.log('Driver properties:', Object.keys(driver)); 