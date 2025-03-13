// Script to create a package for the core-simulator
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Define paths
const rootDir = path.resolve('.');
const packageDir = path.resolve(rootDir, '../binary_package');
const fytaDir = path.join(packageDir, 'fyta');
const binDir = path.join(fytaDir, 'bin');
const binaryDir = path.join(fytaDir, 'binary');
const configDir = path.join(fytaDir, 'config');
const dataDir = path.join(fytaDir, 'data');
const dockerUploadDir = '/Users/alex/GIT/FYTA_Circle_API/HomeassistentFYTA/core-simulator/core-simulator/docker/upload';

// Create directories
console.log('Creating package directory...');
if (fs.existsSync(packageDir)) {
  fs.rmSync(packageDir, { recursive: true, force: true });
}
fs.mkdirSync(binDir, { recursive: true });
fs.mkdirSync(binaryDir, { recursive: true });
fs.mkdirSync(configDir, { recursive: true });
fs.mkdirSync(dataDir, { recursive: true });

// Copy files
console.log('Copying files...');
fs.cpSync(path.join(rootDir, 'node_modules'), path.join(fytaDir, 'node_modules'), { recursive: true });

// Copy JS files to bin
const jsFiles = fs.readdirSync(rootDir).filter(file => file.endsWith('.js'));
for (const file of jsFiles) {
  fs.copyFileSync(path.join(rootDir, file), path.join(binDir, file));
}

// Copy JSON files to config
const jsonFiles = fs.readdirSync(rootDir).filter(file => file.endsWith('.json'));
for (const file of jsonFiles) {
  fs.copyFileSync(path.join(rootDir, file), path.join(configDir, file));
}

// Create driver.js in both bin and binary directories
console.log('Creating driver.js entry points...');
const driverContent = `// FYTA Plant Monitor integration for Unfolded Circle Remote Two
import * as api from '@unfoldedcircle/integration-api';
import './index.js';

console.log('FYTA Plant Monitor integration started');
`;

fs.writeFileSync(path.join(binDir, 'driver.js'), driverContent);
fs.writeFileSync(path.join(binaryDir, 'driver.js'), driverContent);

// Create package archive
console.log('Creating package archive...');
process.chdir(packageDir);
execSync('tar -czf fyta-binary.tar.gz fyta');

// Copy to Docker upload directory
console.log('Copying package to Docker upload directory...');
fs.copyFileSync(path.join(packageDir, 'fyta-binary.tar.gz'), path.join(dockerUploadDir, 'fyta-binary.tar.gz'));

console.log('Package created at binary_package/fyta-binary.tar.gz');
console.log(`Package copied to Docker upload directory at ${dockerUploadDir}`);
console.log('You can now upload this file through the simulator\'s web interface.'); 