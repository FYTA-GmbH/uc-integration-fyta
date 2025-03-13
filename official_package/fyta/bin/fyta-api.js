import axios from 'axios';
import { EventEmitter } from 'events';

class FytaApiClient extends EventEmitter {
  constructor() {
    super();
    this.apiBaseUrl = 'https://api.fyta.io/api/v1';
    this.token = null;
    this.isAuthenticated = false;
    this.client = axios.create({
      baseURL: this.apiBaseUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
  }

  /**
   * Login to FYTA API
   * @param {string} username - FYTA account email
   * @param {string} password - FYTA account password
   * @returns {Promise<boolean>} - Success status
   */
  async login(username, password) {
    try {
      const response = await this.client.post('/auth/login', {
        email: username,
        password: password
      });

      if (response.data && response.data.token) {
        this.token = response.data.token;
        this.client.defaults.headers.common['Authorization'] = `Bearer ${this.token}`;
        this.isAuthenticated = true;
        return true;
      }
      
      throw new Error('Authentication failed: No token received');
    } catch (error) {
      console.error('Login error:', error.message);
      this.isAuthenticated = false;
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  /**
   * Check if client is authenticated
   * @returns {boolean} - Authentication status
   */
  isLoggedIn() {
    return this.isAuthenticated && this.token !== null;
  }

  /**
   * Ensure the client is authenticated before making requests
   * @private
   */
  _ensureAuth() {
    if (!this.isLoggedIn()) {
      throw new Error('Not authenticated. Please login first.');
    }
  }

  /**
   * Get all plants
   * @returns {Promise<Array>} - List of plants
   */
  async getPlants() {
    this._ensureAuth();
    
    try {
      const response = await this.client.get('/plants');
      return response.data || [];
    } catch (error) {
      console.error('Error fetching plants:', error.message);
      throw new Error(`Failed to fetch plants: ${error.message}`);
    }
  }

  /**
   * Get all sensors
   * @returns {Promise<Array>} - List of sensors
   */
  async getSensors() {
    this._ensureAuth();
    
    try {
      const response = await this.client.get('/sensors');
      return response.data || [];
    } catch (error) {
      console.error('Error fetching sensors:', error.message);
      throw new Error(`Failed to fetch sensors: ${error.message}`);
    }
  }

  /**
   * Get sensor data for a specific sensor
   * @param {string} sensorId - Sensor ID
   * @returns {Promise<Object>} - Sensor data
   */
  async getSensorData(sensorId) {
    this._ensureAuth();
    
    try {
      const response = await this.client.get(`/sensors/${sensorId}/data`);
      return response.data || {};
    } catch (error) {
      console.error(`Error fetching sensor data for ${sensorId}:`, error.message);
      throw new Error(`Failed to fetch sensor data: ${error.message}`);
    }
  }

  /**
   * Start polling for sensor data
   * @param {number} interval - Polling interval in seconds
   */
  startPolling(interval = 300) {
    if (this._pollingInterval) {
      this.stopPolling();
    }

    this._pollingInterval = setInterval(async () => {
      try {
        if (!this.isLoggedIn()) {
          console.warn('Not authenticated, skipping polling');
          return;
        }

        const sensors = await this.getSensors();
        
        for (const sensor of sensors) {
          try {
            const data = await this.getSensorData(sensor.id);
            this.emit('sensorData', { sensor, data });
          } catch (error) {
            console.error(`Error polling sensor ${sensor.id}:`, error.message);
          }
        }
      } catch (error) {
        console.error('Error during polling:', error.message);
      }
    }, interval * 1000);
  }

  /**
   * Stop polling for sensor data
   */
  stopPolling() {
    if (this._pollingInterval) {
      clearInterval(this._pollingInterval);
      this._pollingInterval = null;
    }
  }
}

export default FytaApiClient; 